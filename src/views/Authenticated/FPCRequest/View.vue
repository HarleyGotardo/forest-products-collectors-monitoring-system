<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'vue-sonner';
import { useRouter } from 'vue-router';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const route = useRoute();
const router = useRouter();
const requestId = route.params.id;
const request = ref(null);
const requestItems = ref([]);
const user = ref({ first_name: '', last_name: '' });
const approver = ref({ first_name: '', last_name: '' });
const error = ref(null);
const isLoading = ref(true); // Added loading state
const isApproving = ref(false); // New state for tracking approval process

const fetchRequestDetails = async () => {
  isLoading.value = true;
  error.value = null; // Reset error on fetch
  try {
    // 1. Fetch the main request details
    const { data: requestData, error: requestError } = await supabase
      .from('collection_requests')
      .select('*, user_id, approved_by, approved_at, requested_at, updated_at, deleted_at, is_recorded') // Select all needed fields
      .eq('id', requestId)
      .single();

    if (requestError) {
      if (requestError.code === 'PGRST116') { // Handle not found specifically
        throw new Error(`Collection request with ID #${requestId} not found.`);
      }
      throw requestError; // Throw other errors
    }

    request.value = requestData;

    // 2. Fetch the request items using the new structure
    const { data: itemsData, error: itemsError } = await supabase
      .from('collection_request_items')
      .select(`
        id,
        requested_quantity,
        fp_and_location_id (
          id,
          locations ( name ),
          forest_products (
            name,
            measurement_units ( unit_name )
          )
        )
      `)
      .eq('collection_request_id', requestId);

    if (itemsError) {
      throw itemsError;
    }

    // Map the fetched items data to a flatter, more usable structure
    requestItems.value = itemsData.map(item => {
      // Add checks for potentially null nested data
      const fpAndLocation = item.fp_and_location_id;
      const forestProduct = fpAndLocation?.forest_products;
      const location = fpAndLocation?.locations;
      const measurementUnit = forestProduct?.measurement_units;

      return {
        id: item.id,
        requested_quantity: item.requested_quantity,
        product_name: forestProduct?.name ?? 'N/A',
        unit_name: measurementUnit?.unit_name ?? 'N/A',
        location_name: location?.name ?? 'N/A',
      };
    });


    // 3. Fetch requester details
    if (request.value.user_id) {
        const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', request.value.user_id)
        .maybeSingle(); // Use maybeSingle to handle potential null user

        if (userError) {
            console.warn('Error fetching user details:', userError.message);
            // Don't throw, just provide default values
             user.value = { first_name: 'Unknown', last_name: 'User' };
        } else {
            user.value = userData || { first_name: 'Unknown', last_name: 'User' };
        }
    } else {
         user.value = { first_name: 'Unknown', last_name: 'User' };
    }


    // 4. Fetch approver details if applicable
    if (request.value.approved_by) {
      const { data: approverData, error: approverError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', request.value.approved_by)
        .maybeSingle(); // Use maybeSingle

      if (approverError) {
         console.warn('Error fetching approver details:', approverError.message);
         approver.value = { first_name: 'Unknown', last_name: 'Approver' };
      } else {
        approver.value = approverData || { first_name: 'Unknown', last_name: 'Approver' };
      }
    } else {
        // Clear approver if not approved_by
        approver.value = { first_name: '', last_name: '' };
    }

  } catch (err) {
    console.error('Error fetching collection request details:', err);
    error.value = `Failed to load request details: ${err.message}`;
    request.value = null; // Clear request data on error
    requestItems.value = []; // Clear items on error
  } finally {
    isLoading.value = false; // Ensure loading state is turned off
  }
};

// Watcher for resetting approved_by (seems okay, keeping it)
watch(request, async (newRequest) => {
  if (newRequest && newRequest.approved_at === null && newRequest.approved_by !== null) {
    try {
      const { error: updateError } = await supabase
        .from('collection_requests')
        .update({ approved_by: null })
        .eq('id', requestId);

      if (updateError) {
        throw updateError;
      }
      // Update local state if Supabase update is successful
      if (request.value) { // Check if request still exists
       request.value.approved_by = null;
      }
      approver.value = { first_name: '', last_name: '' }; // Clear approver name
      toast.info('Approver reset as approval timestamp is missing.');

    } catch (err) {
      console.error("Error resetting approved_by:", err);
      toast.error(`Failed to reset approver: ${err.message}`);
      // Optionally revert local state or refetch if update fails critically
    }
  }
});

// New function to handle request approval
const approveRequest = async () => {
  if (!request.value || request.value.approved_at) return;
  
  isApproving.value = true;
  try {
    // Get current user's ID for approved_by field
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (!currentUser) {
      throw new Error('User authentication required');
    }
    
    const now = new Date().toISOString();
    
    // Update the request with approval information
    const { error: updateError } = await supabase
      .from('collection_requests')
      .update({
        approved_at: now,
        approved_by: currentUser.id,
        updated_at: now
      })
      .eq('id', requestId);
      
    if (updateError) {
      throw updateError;
    }
    
    // Update local request object to reflect changes
    request.value.approved_at = now;
    request.value.approved_by = currentUser.id;
    request.value.updated_at = now;
    
    // Fetch approver details to display name
    const { data: approverData, error: approverError } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', currentUser.id)
      .maybeSingle();
      
    if (!approverError && approverData) {
      approver.value = approverData;
    } else {
      approver.value = { first_name: 'Current', last_name: 'User' };
    }
    
    toast.success('Collection request approved successfully');
  } catch (err) {
    console.error('Error approving request:', err);
    toast.error(`Failed to approve request: ${err.message}`);
  } finally {
    isApproving.value = false;
  }
};

onMounted(() => {
  fetchRequestDetails();
});

// Helper function for formatting dates
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString(undefined, { // Use locale-sensitive formatting
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch (e) {
    console.warn("Could not format date:", dateString, e);
    return 'Invalid Date';
  }
};

// Helper function for formatting date and time
const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return 'N/A';
   try {
    return new Date(dateTimeString).toLocaleString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit' // Add time
    });
  } catch (e) {
    console.warn("Could not format date/time:", dateTimeString, e);
    return 'Invalid Date/Time';
  }
};
</script>

<template>
  <div class="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
    <div
      class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 mt-2 space-y-4 sm:space-y-0"
    >
      <div class="flex items-center space-x-3">
        <img src="@/assets/request2.png" alt="Request Icon" class="w-7 h-7" />
        <h2 class="text-2xl sm:text-3xl font-bold text-gray-800">
          Collection Request Details
        </h2>
      </div>

      <div class="flex items-center gap-2">
        <div
          v-if="request && !request.deleted_at"
          class="px-3 py-1 rounded-full text-xs sm:text-sm font-medium"
          :class="{
                  'bg-emerald-100 text-emerald-700 border border-emerald-200': request.approved_at,
                  'bg-amber-100 text-amber-700 border border-amber-200': !request.approved_at
              }"
        >
          {{ request.approved_at ? 'Approved' : 'Pending' }}
        </div>
        <div
          v-if="request && request.deleted_at"
          class="px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-red-100 text-red-700 border border-red-200"
        >
          Deleted
        </div>
      </div>
    </div>

    <div
      v-if="error && !isLoading"
      class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg shadow-md"
    >
      <div class="flex items-center gap-3">
        <svg
          class="h-5 w-5 text-red-400 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1.293-8.707a1 1 0 011.414-1.414L10 8.586l1.293-1.293a1 1 0 111.414 1.414L11.414 10l1.293 1.293a1 1 0 01-1.414 1.414L10 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L8.586 10 7.293 8.707z"
            clip-rule="evenodd"
          />
        </svg>
        <p class="font-medium">{{ error }}</p>
      </div>
    </div>

    <div v-if="isLoading" class="space-y-6 animate-pulse">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex justify-between items-center mb-6">
          <div class="h-7 bg-gray-200 rounded w-1/3"></div>
          <div class="h-5 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-4">
            <div class="h-5 bg-gray-200 rounded w-3/4"></div>
            <div class="h-5 bg-gray-200 rounded w-2/3"></div>
            <div class="h-5 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div class="space-y-4">
            <div class="h-5 bg-gray-200 rounded w-3/4"></div>
            <div class="h-5 bg-gray-200 rounded w-2/3"></div>
            <div class="h-5 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div class="space-y-3">
          <div class="h-10 bg-gray-200 rounded w-full"></div>
          <div class="h-10 bg-gray-200 rounded w-full"></div>
          <div class="h-10 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    </div>

    <div v-if="request && !isLoading" class="space-y-6">
      <!-- Action button for pending requests -->
      <div v-if="request && !request.approved_at && !request.deleted_at" class="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              :disabled="isApproving"
              class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg 
                v-if="!isApproving" 
                class="-ml-1 mr-2 h-5 w-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  stroke-linecap="round" 
                  stroke-linejoin="round" 
                  stroke-width="2" 
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              <svg 
                v-else 
                class="-ml-1 mr-2 h-5 w-5 animate-spin" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle 
                  class="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  stroke-width="4"
                ></circle>
                <path 
                  class="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {{ isApproving ? 'Approving...' : 'Approve Request' }}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Approval</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to approve this collection request? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction @click="approveRequest">
                Approve
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div
        class="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden"
      >
        <div class="p-5 sm:p-6">
          <div
        class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 sm:mb-6"
          >
        <h3 class="text-xl font-semibold text-gray-800 mb-2 sm:mb-0">
          Request ID:
          <span class="font-bold text-indigo-600">#{{ request.id }}</span>
        </h3>
        <span
          class="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full"
        >
          Requested: {{ formatDateTime(request.requested_at) }}
        </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 text-sm">
        <div class="space-y-3">
          <div class="flex items-start gap-3">
            <div class="mt-1 p-1.5 bg-indigo-50 rounded-md flex-shrink-0">
          <svg
            class="w-4 h-4 text-indigo-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
            </div>
            <div>
          <p class="font-medium text-gray-500">Collection Date</p>
          <p class="text-gray-800 font-semibold">
            {{ formatDate(request.collection_date) }}
          </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="mt-1 p-1.5 bg-indigo-50 rounded-md flex-shrink-0">
          <svg
            class="w-4 h-4 text-indigo-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
            </div>
            <div>
          <p class="font-medium text-gray-500">Last Updated</p>
          <p class="text-gray-800 font-semibold">
            {{ formatDateTime(request.updated_at) }}
          </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="mt-1 p-1.5 bg-indigo-50 rounded-md flex-shrink-0">
          <svg
            class="w-4 h-4 text-indigo-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
            </div>
            <div>
          <p class="font-medium text-gray-500">Status</p>
          <p class="text-gray-800 font-semibold">
            {{ request.approved_at ? 'Approved' : 'Pending' }}
          </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="mt-1 p-1.5 bg-indigo-50 rounded-md flex-shrink-0">
          <svg
            class="w-4 h-4 text-indigo-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
            </div>
            <div>
          <p class="font-medium text-gray-500">Recorded Status</p>
          <p class="text-gray-800 font-semibold">
            {{ request.is_recorded ? 'Recorded' : 'Not Recorded' }}
          </p>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-start gap-3">
            <div class="mt-1 p-1.5 bg-indigo-50 rounded-md flex-shrink-0">
          <svg
            class="w-4 h-4 text-indigo-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
            </div>
            <div>
          <p class="font-medium text-gray-500">Requested By</p>
          <p class="text-gray-800 font-semibold">
            {{ user.first_name }} {{ user.last_name }}
          </p>
            </div>
          </div>

          <div v-if="request.approved_at" class="flex items-start gap-3">
            <div class="mt-1 p-1.5 bg-green-50 rounded-md flex-shrink-0">
          <svg
            class="w-4 h-4 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
            </div>
            <div>
          <p class="font-medium text-gray-500">Approved At</p>
          <p class="text-green-700 font-semibold">
            {{ formatDateTime(request.approved_at) }}
          </p>
            </div>
          </div>

          <div
            v-if="request.approved_by && request.approved_at"
            class="flex items-start gap-3"
          >
            <div class="mt-1 p-1.5 bg-green-50 rounded-md flex-shrink-0">
          <svg
            class="w-4 h-4 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
            </div>
            <div>
          <p class="font-medium text-gray-500">Approved By</p>
          <p class="text-green-700 font-semibold">
            {{ approver.first_name }} {{ approver.last_name }}
          </p>
            </div>
          </div>
          <div v-if="request.deleted_at" class="flex items-start gap-3">
            <div class="mt-1 p-1.5 bg-red-50 rounded-md flex-shrink-0">
          <svg
            class="w-4 h-4 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
            </div>
            <div>
          <p class="font-medium text-gray-500">Deleted At</p>
          <p class="text-red-700 font-semibold">
            {{ formatDateTime(request.deleted_at) }}
          </p>
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>

      <div
        class="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden"
      >
        <div class="p-5 sm:p-6 border-b border-gray-200">
          <div class="flex items-center gap-3">
            <svg
              class="w-6 h-6 text-indigo-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h3 class="text-lg font-semibold text-gray-800">
              Requested Forest Products
            </h3>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Forest Product
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Location
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Quantity
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Unit
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr
                v-for="(item) in requestItems"
                :key="item.id"
                class="hover:bg-gray-50 transition-colors duration-150"
              >
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">
                    {{ item.product_name }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-600">
                    {{ item.location_name }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <div class="text-sm font-medium text-gray-900">
                    {{ item.requested_quantity }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-500">{{ item.unit_name }}</div>
                </td>
              </tr>

              <tr v-if="requestItems.length === 0">
                <td
                  colspan="4"
                  class="px-6 py-8 text-center text-sm text-gray-500"
                >
                  <div class="flex flex-col items-center justify-center">
                    <svg
                      class="w-10 h-10 text-gray-300 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                      stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                      />
                    </svg>
                    <p>No items found in this request.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="mt-8 flex justify-between">
        <button
          type="button"
          @click="router.back()"
          class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
        >
          <svg
            class="-ml-1 mr-2 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back
        </button>
      </div>
    </div>
  </div>
</template>