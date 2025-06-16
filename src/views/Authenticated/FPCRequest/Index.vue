<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { getUser, fetchUserDetails, isFPCollector } from '@/router/routeGuard';
import { toast, Toaster } from 'vue-sonner';
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
import Button from '@/components/ui/button/Button.vue';
import {
  Pagination,
  PaginationList,
  PaginationListItem,
  PaginationFirst,
  PaginationLast,
  PaginationNext,
  PaginationPrev,
  PaginationEllipsis,
} from '@/components/ui/pagination'

const router = useRouter();
const requests = ref([]); // Store all requests
const paginatedRequests = ref([]); // Store paginated requests
const error = ref(null);
const currentPage = ref(1);
const itemsPerPage = 7;
const searchQuery = ref('');
const requestToDelete = ref(null);
const loading = ref(true); // Add loading state
const showNotes = ref(true); // Add showNotes state
const requestToRevert = ref(null); // Add state for revert request
const revertRequests = ref([]); // Add state to store existing revert requests

// Add subscription channel
const subscription = ref(null);

// Add filter states
const statusFilter = ref('all'); // 'all', 'approved', 'pending', 'rejected'
const recordedFilter = ref('all'); // 'all', 'recorded', 'unrecorded'

// Function to handle real-time updates
const handleRealtimeUpdate = (payload) => {
  const { eventType, new: newRecord, old: oldRecord } = payload;
  console.log(`Received ${eventType} event:`, payload);

  // Handle request_for_revert changes
  if (payload.table === 'request_for_revert') {
    if (eventType === 'INSERT') {
      revertRequests.value.push(newRecord.collection_request_id);
    } else if (eventType === 'DELETE') {
      revertRequests.value = revertRequests.value.filter(id => id !== oldRecord.collection_request_id);
    }
    return;
  }

  // Handle collection_requests changes
  if (eventType === 'DELETE') {
    // Remove the request from the local array
    const index = requests.value.findIndex(r => r.id === oldRecord.id);
    if (index !== -1) {
      requests.value.splice(index, 1);
      paginateRequests();
      toast.success(`Request #${oldRecord.id} deleted successfully, now in trashed requests.`, { duration: 5000 });
    }
    return;
  }

  if (eventType === 'INSERT') {
    // Add the new request to the local array
    requests.value.unshift(newRecord);
    paginateRequests();
    // Optionally show a notification for new requests
    // toast.info(`New request #${newRecord.id} submitted.`, { duration: 5000 });
    return;
  }

  if (eventType === 'UPDATE') {
    // First, check if this is a deleted_at change (moved to recycle bin)
    if (oldRecord?.deleted_at === null && newRecord?.deleted_at !== null) {
      console.log(`Request #${newRecord.id} moved to recycle bin`);
      // Simply remove from local array - no need for refetch in this component
      const index = requests.value.findIndex(r => r.id === newRecord.id);
      if (index !== -1) {
        requests.value.splice(index, 1);
        paginateRequests();
        toast.success(`Request #${newRecord.id} deleted successfully, now in trashed requests.`, { duration: 5000 });
      }
      return;
    }
    
    const index = requests.value.findIndex(r => r.id === newRecord.id);
    if (index !== -1) {
      // Update the local data first
      requests.value[index] = newRecord;
      paginateRequests();
      
      // Now handle the specific change types independently

      // RECORDING STATUS CHANGES - completely separate from approval/rejection
      if (newRecord.is_recorded !== oldRecord.is_recorded && newRecord.deleted_at === null) {
        // Only recording status changed
        if (newRecord.is_recorded === true && newRecord.deleted_at === null && newRecord.remarks === 'Approved') {
          // Changed from unrecorded to recorded
          toast.success(`Request #${newRecord.id} has been recorded!`, {
            duration: 5000,
            description: 'Your collection has been successfully recorded in the system.',
            action: {
              label: 'View',
              onClick: () => viewRequest(newRecord.id)
            }
          });
          return; // Important: return to prevent other notifications
        } else if (newRecord.is_recorded === false && oldRecord.is_recorded === true) {
          // Changed from recorded to unrecorded
          toast.info(`Request #${newRecord.id} has been marked as unrecorded`, {
            duration: 5000,
            description: 'The collection has been marked as unrecorded in the system.',
            action: {
              label: 'View',
              onClick: () => viewRequest(newRecord.id)
            }
          });
          return; // Important: return to prevent other notifications
        }
      }
      
      // APPROVAL/REJECTION CHANGES - only if no recording status change was handled
      if (newRecord.remarks !== oldRecord.remarks && newRecord.deleted_at === null && newRecord.is_recorded === false) {
        if (newRecord.remarks === 'Approved') {
          toast.success(`Request #${newRecord.id} approved. You can now proceed to collection.`, { duration: 5000 });
        } else if (newRecord.remarks === 'Rejected' && oldRecord.remarks !== 'Rejected') {
          toast.error(`Request #${newRecord.id} rejected.`, { duration: 5000, description: newRecord.rejection_reason ? `Reason: ${newRecord.rejection_reason}` : undefined });
        } else {
          toast.info(`Request #${newRecord.id} reverted.`, { duration: 5000, description: 'The request has been reverted to pending.' });
        }
        return; // Return to prevent further notifications
      }
    }
  }
};

// Subscribe to real-time updates
const subscribeToChanges = () => {
  const user = getUser();
  if (user) {
    // Subscribe to collection_requests changes
    subscription.value = supabase
      .channel('collection-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collection_requests',
          filter: `user_id=eq.${user.id}`
        },
        handleRealtimeUpdate
      )
      .subscribe();

    // Subscribe to request_for_revert changes
    const revertSubscription = supabase
      .channel('request-for-revert-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'request_for_revert',
          filter: `user_id=eq.${user.id}`
        },
        handleRealtimeUpdate
      )
      .subscribe();
  }
};

// Unsubscribe when component is unmounted
onUnmounted(() => {
  if (subscription.value) {
    subscription.value.unsubscribe();
  }
  supabase.removeChannel('request-for-revert-changes');
});

const fetchAllRequests = async () => {
  loading.value = true; // Set loading to true before fetching
  const user = getUser();
  
  // First, get IDs of requests that are referenced in deleted collection records
  const { data: excludedRequestIds, error: excludedError } = await supabase
    .from('collection_records')
    .select('collection_request_id')
    .not('deleted_at', 'is', null)
    .not('collection_request_id', 'is', null);
  
  if (excludedError) {
    console.error('Error fetching excluded request IDs:', excludedError);
    error.value = excludedError.message;
    loading.value = false;
    return;
  }
  
  // Extract the IDs to exclude
  const requestIdsToExclude = excludedRequestIds.map(record => record.collection_request_id);
  console.log('Excluding request IDs:', requestIdsToExclude);
  
  try {
    // Then fetch requests that aren't in the excluded list
    let query = supabase
      .from('collection_requests')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null);
    
    // Add filter to exclude requests referenced in deleted collection records
    // Use a different approach for filtering with arrays
    if (requestIdsToExclude.length > 0) {
      // Using .filter() instead of .not() with 'in'
      query = query.filter('id', 'not.in', `(${requestIdsToExclude.join(',')})`);
    }
    
    // Always add the ordering at the end
    query = query.order('id', { ascending: false });
    
    const { data, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching requests:', fetchError);
      error.value = fetchError.message;
    } else {
      requests.value = data;
      paginateRequests();
    }
  } catch (err) {
    console.error('Exception in fetchAllRequests:', err);
    error.value = err.message;
  }
  
  loading.value = false; // Set loading to false after fetching
};

const paginateRequests = () => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  paginatedRequests.value = filteredRequests.value.slice(start, end);
};

const filteredRequests = computed(() => {
  // First filter by search query
  let filtered = requests.value;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(request =>
      request.id.toString().includes(query) ||
      (request.remarks ? request.remarks.toLowerCase() : 'pending').includes(query)
    );
  }

  // Then filter by status
  if (statusFilter.value !== 'all') {
    if (statusFilter.value === 'approved') {
      filtered = filtered.filter(request => request.remarks === 'Approved');
    } else if (statusFilter.value === 'pending') {
      filtered = filtered.filter(request => !request.remarks || request.remarks === 'Pending');
    } else if (statusFilter.value === 'rejected') {
      filtered = filtered.filter(request => request.remarks === 'Rejected');
    }
  }

  // Then filter by recorded status
  if (recordedFilter.value !== 'all') {
    if (recordedFilter.value === 'recorded') {
      filtered = filtered.filter(request => request.is_recorded === true);
    } else if (recordedFilter.value === 'unrecorded') {
      filtered = filtered.filter(request => request.is_recorded === false);
    }
  }

  return filtered;
});

const nextPage = () => {
  if ((currentPage.value * itemsPerPage) < filteredRequests.value.length) {
    currentPage.value++;
    paginateRequests();
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    paginateRequests();
  }
};

const editRequest = (requestId, event) => {
  event.stopPropagation();
  router.push(`/authenticated/collection-requests/${requestId}/edit`);
};

const viewRequest = (requestId) => {
  router.push(`/authenticated/collection-requests/${requestId}`);
};

const confirmDeleteRequest = (requestId) => {
  requestToDelete.value = requestId;
};

const deleteRequest = async () => {
  if (requestToDelete.value !== null) {
    const requestId = requestToDelete.value;
    const currentDate = new Date().toISOString();
    const { error: deleteError } = await supabase
      .from('collection_requests')
      .update({ deleted_at: currentDate })
      .eq('id', requestId);

    if (deleteError) {
      error.value = deleteError.message;
    } else {
      fetchAllRequests();
      toast.success('Request deleted successfully', { duration: 2000 });
    }
    requestToDelete.value = null;
  }
};

// Add method to check for existing revert requests
const checkExistingRevertRequests = async () => {
  const user = getUser();
  if (!user) return;

  try {
    const { data, error } = await supabase
      .from('request_for_revert')
      .select('collection_request_id')
      .eq('user_id', user.id);

    if (error) throw error;
    revertRequests.value = data.map(item => item.collection_request_id);
  } catch (err) {
    console.error('Error checking revert requests:', err);
  }
};

// Modify the requestForRevert method
const requestForRevert = async () => {
  if (!requestToRevert.value) return;
  
  const user = getUser();
  if (!user) {
    toast.error('User not authenticated');
    return;
  }

  try {
    const { error } = await supabase
      .from('request_for_revert')
      .insert({
        user_id: user.id,
        collection_request_id: requestToRevert.value
      });

    if (error) throw error;

    // Update local state
    revertRequests.value.push(requestToRevert.value);
    
    toast.success('Request for revert submitted successfully', {
      duration: 5000,
      description: 'Your request will be reviewed by the administrator.'
    });
  } catch (err) {
    console.error('Error requesting revert:', err);
    toast.error('Failed to submit request for revert', {
      duration: 5000,
      description: err.message
    });
  } finally {
    requestToRevert.value = null;
  }
};

// Add method to initiate revert request
const initiateRevertRequest = (requestId) => {
  requestToRevert.value = requestId;
};

onMounted(() => {
  fetchUserDetails();
  fetchAllRequests();
  subscribeToChanges();
  checkExistingRevertRequests(); // Add this line
});

// Reset page when filters change
watch([searchQuery, statusFilter, recordedFilter], () => {
  currentPage.value = 1;
  paginateRequests();
});

watch(currentPage, () => {
  paginateRequests();
});
</script>
<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header Section -->
    <div
      class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0 mt-2"
    >
      <div class="flex items-center space-x-2">
      <img
        src="@/assets/request2.png"
        alt="Request Icon"
        class="w-12 h-12 group-hover:scale-110 transition-transform"
      />
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-green-900">
        Your Collection Requests
        </h2>
        <p class="mt-1 text-sm text-green-900">
        View and manage all your collection requests
        </p>
      </div>
      </div>
      <div class="flex flex-col sm:flex-row sm:items-center sm:space-x-4 w-full sm:w-auto">
      <div class="relative flex-1 sm:flex-none">
        <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by ID..."
        class="block w-full px-4 py-2 rounded-full bg-white border border-gray-200 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
        />
        <div
        class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
        >
        <svg
          class="h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        </div>
      </div>
      <div class="flex space-x-2 mt-2 sm:mt-0">
        <Button
        v-if="isFPCollector"
        @click="router.push('/authenticated/collection-request/create')"
        class="min-w-10 bg-emerald-900 text-white hover:bg-emerald-700"
        >
        +
        </Button>
      </div>
      </div>
    </div>

    <!-- Filters -->
    <div
      class="flex flex-col sm:flex-row justify-start items-start sm:items-center gap-3 mb-6"
    >
      <div class="flex items-center">
        <label for="statusFilter" class="mr-2 text-sm font-medium text-gray-700"
          >Status:</label
        >
        <select
          id="statusFilter"
          v-model="statusFilter"
          class="block w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div class="flex items-center">
        <label
          for="recordedFilter"
          class="mr-2 text-sm font-medium text-gray-700"
          >Recording:</label
        >
        <select
          id="recordedFilter"
          v-model="recordedFilter"
          class="block w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="all">All</option>
          <option value="recorded">Recorded</option>
          <option value="unrecorded">Unrecorded</option>
        </select>
      </div>
    </div>

    <!-- Info Notes -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900">Important Information</h3>
        <button
          @click="showNotes = !showNotes"
          class="flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <span>{{ showNotes ? 'Hide Notes' : 'Show Notes' }}</span>
          <svg
            class="w-4 h-4 ml-1 transform transition-transform"
            :class="{ 'rotate-180': showNotes }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      <div v-if="showNotes" class="space-y-4">
        <!-- Request Management Note -->
        <div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg
                class="h-5 w-5 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-blue-700">
                <span class="font-medium">Request Management:</span> Collection
                requests can only be edited or deleted if they are pending. Once
                a request is approved, it becomes permanent and cannot be
                modified.
              </p>
            </div>
          </div>
        </div>

        <!-- Recording Status Note -->
        <div class="bg-emerald-50 border-l-4 border-green-400 p-4 rounded-r-lg">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg
                class="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-green-700">
                <span class="font-medium">Next Steps:</span> Once your request
                is approved, you can proceed to the Forest Protection Unit to
                record your collection and pay the required forest fees.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error"
      class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg"
    >
      <div class="flex">
        <svg
          class="h-5 w-5 text-red-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <p class="ml-3">{{ error }}</p>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="animate-pulse">
      <!-- Desktop Table Skeleton -->
      <div
        class="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-emerald-900">
              <tr>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12 hidden md:table-cell"></th>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="n in 5" :key="n">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-10"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-6 bg-gray-200 rounded-full w-20"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-6 bg-gray-200 rounded-full w-20"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <div class="flex items-center justify-end space-x-3">
                    <div class="h-8 w-8 bg-gray-200 rounded-md"></div>
                    <div class="h-8 w-8 bg-gray-200 rounded-md"></div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile Cards Skeleton -->
      <div class="sm:hidden px-4 py-4 space-y-4">
        <div
          v-for="n in 5"
          :key="n"
          class="bg-white rounded-lg shadow border border-gray-100 overflow-hidden"
        >
          <!-- Card header skeleton -->
          <div
            class="p-4 border-b border-gray-100 flex items-center justify-between"
          >
            <div class="h-4 bg-gray-200 rounded w-16"></div>
            <div class="flex space-x-2">
              <div class="h-6 bg-gray-200 rounded-full w-20"></div>
              <div class="h-6 bg-gray-200 rounded-full w-20"></div>
            </div>
          </div>

          <!-- Card body skeleton -->
          <div class="p-4">
            <div class="space-y-3">
              <div class="flex justify-between">
                <div>
                  <div class="h-3 bg-gray-200 rounded w-20 mb-1"></div>
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                </div>
                <div>
                  <div class="h-3 bg-gray-200 rounded w-20 mb-1"></div>
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card actions skeleton -->
          <div
            class="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between"
          >
            <div class="h-8 bg-gray-200 rounded w-16"></div>
            <div class="h-8 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      </div>

      <!-- Pagination Skeleton -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div
          class="flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div class="h-4 bg-gray-200 rounded w-48 hidden sm:block"></div>
          <div class="flex items-center gap-2">
            <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
            <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
            <div class="flex items-center gap-1">
              <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
              <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
              <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
            </div>
            <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
            <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Requests Table/Cards -->
    <div
      v-else
      class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <!-- Desktop view (table) - hidden on small screens -->
      <div class="hidden sm:block overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-emerald-900">
            <tr>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
              >
                ID
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
              >
                Requested At
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden md:table-cell"
              >
                Collection Date
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
              >
                Recording
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider"
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="filteredRequests.length === 0">
              <td colspan="6" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center">
                  <svg
                    class="w-12 h-12 text-gray-300 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  <p class="text-gray-500 text-sm">
                    No requests found matching your criteria
                  </p>
                </div>
              </td>
            </tr>
            <tr
              v-for="request in paginatedRequests"
              :key="request.id"
              class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
              @click="viewRequest(request.id)"
            >
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                #{{ request.id }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ new Date(request.requested_at).toLocaleDateString() }}
              </td>
              <td
                class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell"
              >
                {{ new Date(request.collection_date).toLocaleDateString() }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  :class="request.remarks === 'Approved' ? 'bg-emerald-100 text-green-800' : request.remarks === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'"
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                >
                  {{ request.remarks === 'Approved' ? 'Approved' : request.remarks === 'Rejected' ? 'Rejected' : 'Pending' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  :class="request.is_recorded ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'"
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                >
                  {{ request.is_recorded ? 'Recorded' : 'Unrecorded' }}
                </span>
              </td>
              <td
                class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                @click.stop
              >
                <div class="flex items-center justify-end space-x-3">
                  <AlertDialog v-if="request.remarks === 'Approved' && !request.is_recorded">
                    <AlertDialogTrigger asChild>
                      <Button
                        class="bg-yellow-900 text-white hover:bg-yellow-700"
                        :disabled="revertRequests.includes(request.id)"
                        @click="initiateRevertRequest(request.id)"
                      >
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Request for Revert?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to request a revert for this approved request? This will notify the FPU Personnel and will have the option to revert your request.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          class="bg-yellow-900 hover:bg-yellow-700"
                          @click="requestForRevert"
                        >
                          Request Revert
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    class="bg-emerald-900 text-white hover:bg-emerald-600"
                    @click="editRequest(request.id, $event)"
                    :disabled="request.remarks === 'Approved'"
                  >
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </Button>
                  <AlertDialog v-if="request.remarks === 'Pending' || request.remarks === 'Rejected'">
                    <AlertDialogTrigger>
                      <Button
                        class="bg-red-900 text-white hover:bg-red-700"
                        @click="confirmDeleteRequest(request.id)"
                      >
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Request?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This request will be transferred to the recycle bin.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          class="bg-red-900 hover:bg-red-700"
                          @click="deleteRequest"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile view (cards) - only shown on small screens -->
      <div class="sm:hidden px-4 py-4 space-y-4">
        <!-- Empty state when no requests are found -->
        <div
          v-if="filteredRequests.length === 0"
          class="bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center"
        >
          <svg
            class="w-12 h-12 text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <p class="text-gray-500 text-sm">
            No requests found matching your criteria
          </p>
        </div>

        <!-- Card for each request -->
        <div
          v-for="request in paginatedRequests"
          :key="request.id"
          class="bg-white rounded-lg shadow border border-gray-100 overflow-hidden"
          @click="viewRequest(request.id)"
        >
          <!-- Card header with ID and status badges -->
          <div
            class="p-4 border-b border-gray-100 flex items-center justify-between"
          >
            <div class="flex items-center">
              <span class="font-medium text-gray-800 mr-2"
                >#{{ request.id }}</span
              >
            </div>
            <div class="flex space-x-2">
              <span
                :class="request.remarks === 'Approved' ? 'bg-emerald-100 text-green-800' : request.remarks === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              >
                {{ request.remarks === 'Approved' ? 'Approved' : request.remarks === 'Rejected' ? 'Rejected' : 'Pending' }}
              </span>
              <span
                :class="request.is_recorded ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              >
                {{ request.is_recorded ? 'Recorded' : 'Unrecorded' }}
              </span>
            </div>
          </div>

          <!-- Card body with request details -->
          <div class="p-4">
            <div class="space-y-3">
              <div class="flex justify-between">
                <div>
                  <div class="text-xs text-gray-500">Requested At</div>
                  <div class="font-medium text-sm">
                    {{ new Date(request.requested_at).toLocaleDateString() }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-gray-500">Collection Date</div>
                  <div class="font-medium text-sm">
                    {{ new Date(request.collection_date).toLocaleDateString() }}
                  </div>
                </div>
              </div>

              <div v-if="request.remarks === 'Approved'">
                <div class="text-xs text-gray-500">Approved At</div>
                <div class="font-medium text-sm">
                  {{ new Date(request.remarked_at).toLocaleDateString() }}
                </div>
              </div>
              <div v-if="request.remarks === 'Rejected'">
                <div class="text-xs text-gray-500">Rejected At</div>
                <div class="font-medium text-sm">
                  {{ new Date(request.remarked_at).toLocaleDateString() }}
                </div>
                <div class="text-xs text-red-500 mt-1">
                  Reason: {{ request.rejection_reason }}
                </div>
              </div>
            </div>
          </div>

          <!-- Card actions -->
          <div
            v-if="request.remarks === 'Pending' || request.remarks === 'Rejected' || (request.remarks === 'Approved' && !request.is_recorded)"
            class="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between"
            @click.stop
          >
            <AlertDialog v-if="request.remarks === 'Approved' && !request.is_recorded">
              <AlertDialogTrigger asChild>
                <Button
                  class="bg-yellow-900 text-white hover:bg-yellow-700 text-sm"
                  :disabled="revertRequests.includes(request.id)"
                  @click="initiateRevertRequest(request.id)"
                >
                  <svg
                    class="w-4 h-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {{ revertRequests.includes(request.id) ? 'Revert Requested' : 'Request Revert' }}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Request for Revert?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to request a revert for this approved request? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    class="bg-yellow-900 hover:bg-yellow-700"
                    @click="requestForRevert"
                  >
                    Request Revert
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              v-if="request.remarks === 'Pending' || request.remarks === 'Rejected'"
              class="bg-emerald-900 text-white hover:bg-emerald-600 text-sm"
              @click="editRequest(request.id, $event)"
            >
              <svg
                class="w-4 h-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  class="bg-red-900 text-white hover:bg-red-700 text-sm"
                  @click="confirmDeleteRequest(request.id)"
                >
                  <svg
                    class="w-4 h-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Request?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This request will be transferred to the recycle bin.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction @click="deleteRequest"
                    >Delete</AlertDialogAction
                  >
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div
          class="flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div class="text-sm text-gray-600 hidden sm:block">
            Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to
            {{ Math.min(currentPage * itemsPerPage, filteredRequests.length) }}
            of {{ filteredRequests.length }} items
          </div>
          <Pagination
            v-slot="{ page }"
            :total="filteredRequests.length"
            :items-per-page="itemsPerPage"
            :sibling-count="1"
            show-edges
            :default-page="currentPage"
            @update:page="(newPage) => {
              currentPage = newPage;
              paginateRequests();
            }"
            class="w-full sm:w-auto"
          >
            <div class="flex items-center justify-center sm:justify-end gap-2">
              <!-- Mobile View -->
              <div class="flex items-center gap-2 sm:hidden">
                <PaginationPrev class="!w-12 !h-12" />
                <div class="text-sm font-medium">
                  {{ currentPage }} /
                  {{ Math.ceil(filteredRequests.length / itemsPerPage) }}
                </div>
                <PaginationNext class="!w-12 !h-12" />
              </div>

              <!-- Desktop View -->
              <div class="hidden sm:flex items-center gap-1">
                <PaginationFirst />
                <PaginationPrev />
                <PaginationList
                  v-slot="{ items }"
                  class="flex items-center gap-1"
                >
                  <template v-for="(item, index) in items">
                    <PaginationListItem
                      v-if="item.type === 'page'"
                      :key="index"
                      :value="item.value"
                      :class="[
                        'w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-colors',
                        item.value === page ? 'bg-emerald-900 text-white' : 'hover:bg-gray-100'
                      ]"
                    >
                      {{ item.value }}
                    </PaginationListItem>
                    <PaginationEllipsis
                      v-else
                      :key="item.type"
                      :index="index"
                    />
                  </template>
                </PaginationList>
                <PaginationNext />
                <PaginationLast />
              </div>
            </div>
          </Pagination>
        </div>
      </div>
    </div>
    <Toaster />
  </div>
</template>
