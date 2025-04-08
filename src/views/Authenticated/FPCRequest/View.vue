<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'vue-sonner';
import { useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const requestId = route.params.id;
const request = ref(null);
const requestItems = ref([]);
const user = ref({ first_name: '', last_name: '' });
const approver = ref({ first_name: '', last_name: '' });
const error = ref(null);

const fetchRequestDetails = async () => {
  try {
    const { data: requestData, error: requestError } = await supabase
      .from('collection_requests')
      .select('*, user_id, approved_by, approved_at')
      .eq('id', requestId)
      .single();

    if (requestError) {
      throw requestError;
    }

    request.value = requestData;

    const { data: itemsData, error: itemsError } = await supabase
      .from('collection_request_items')
      .select('*, forest_product_id (name, measurement_unit_id (unit_name))')
      .eq('collection_request_id', requestId);

    if (itemsError) {
      throw itemsError;
    }

    requestItems.value = itemsData;

    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', request.value.user_id)
      .single();

    if (userError) {
      throw userError;
    }

    user.value = userData;

    if (request.value.approved_by) {
      const { data: approverData, error: approverError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', request.value.approved_by)
        .single();

      if (approverError) {
        throw approverError;
      }

      approver.value = approverData;
    }
  } catch (err) {
    error.value = err.message;
  }
};

// Watch for changes in the request object and update approved_by if approved_at is null
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

      request.value.approved_by = null;
    } catch (err) {
      error.value = err.message;
    }
  }
});

onMounted(() => {
  fetchRequestDetails();
});
</script>

<template>
  <div class="max-w-4xl mx-auto p-6">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 mt-2 space-y-4 sm:space-y-0">
      <div class="flex items-center space-x-4">
        <img src="@/assets/request2.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
        <h2 class="text-3xl font-bold text-gray-900">Collection Request Details</h2>
      </div>

      <div v-if="request" 
           class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150"
           :class="request.approved_at ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'">
        {{ request.approved_at ? 'Approved' : 'Pending' }}
      </div>
      <div v-if="request && request.deleted_at" 
        class="px-4 py-1.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
        Deleted
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg shadow-sm">
      <div class="flex items-center gap-3">
        <svg class="h-5 w-5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <p>{{ error }}</p>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="!request && !error" class="space-y-6 animate-pulse">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6">
        <div class="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-4">
            <div class="h-6 bg-gray-200 rounded w-3/4"></div>
            <div class="h-6 bg-gray-200 rounded w-2/3"></div>
          </div>
          <div class="space-y-4">
            <div class="h-6 bg-gray-200 rounded w-3/4"></div>
            <div class="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6">
        <div class="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div class="space-y-3">
          <div class="h-6 bg-gray-200 rounded w-full"></div>
          <div class="h-6 bg-gray-200 rounded w-full"></div>
          <div class="h-6 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div v-if="request" class="space-y-6">
      <!-- Request Information Card -->
      <div class="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300">
        <div class="p-6">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
            <h3 class="text-2xl font-semibold text-gray-900">Request ID: #{{ request.id }}</h3>
            <span class="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full mt-2 sm:mt-0">
              {{ new Date(request.requested_at).toLocaleDateString() }}
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Left Column -->
            <div class="space-y-5">
              <div class="flex items-center gap-4">
                <div class="p-3 bg-indigo-50 rounded-lg">
                  <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-500">Collection Date</p>
                  <p class="text-gray-900 font-medium">{{ new Date(request.collection_date).toLocaleDateString() }}</p>
                </div>
              </div>

              <div class="flex items-center gap-4">
                <div class="p-3 bg-indigo-50 rounded-lg">
                  <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-500">Updated At</p>
                  <p class="text-gray-900 font-medium">{{ request.updated_at ? new Date(request.updated_at).toLocaleDateString() : 'N/A' }}</p>
                </div>
              </div>
                <div class="flex items-center gap-4">
                <div class="p-3 bg-indigo-50 rounded-lg">
                  <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-500">Status</p>

                    <p class="text-gray-900 font-medium">{{ request.approved_at ? 'Approved' : 'Pending' }}</p>

                </div>
                </div>
            </div>

            <!-- Right Column -->
            <div class="space-y-5">
              <div class="flex items-center gap-4">
                <div class="p-3 bg-indigo-50 rounded-lg">
                  <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-500">Requested By</p>
                  <p class="text-gray-900 font-medium">{{ user.first_name }} {{ user.last_name }}</p>
                </div>
              </div>

              <div v-if="request.approved_at" class="flex items-center gap-4">
                <div class="p-3 bg-green-50 rounded-lg">
                  <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-500">Approved At</p>
                  <p class="text-gray-900 font-medium">{{ new Date(request.approved_at).toLocaleDateString() }}</p>
                </div>
              </div>

              <div v-if="request.approved_by" class="flex items-center gap-4">
                <div class="p-3 bg-green-50 rounded-lg">
                  <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-500">Approved By</p>
                  <p class="text-gray-900 font-medium">{{ approver.first_name }} {{ approver.last_name }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Request Items Section -->
      <div class="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300">
        <div class="p-6 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
            <h3 class="text-xl font-semibold text-gray-900">Requested Forest Products</h3>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Forest Product</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Measurement Unit</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in requestItems" 
                  :key="item.id" 
                  class="hover:bg-gray-50 transition-colors duration-150"
                  :class="index % 2 === 0 ? 'bg-white' : 'bg-gray-50'">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{{ item.forest_product_id.name }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{{ item.requested_quantity }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-500">{{ item.forest_product_id.measurement_unit_id.unit_name }}</div>
                </td>
              </tr>
              
              <!-- Empty state if no items -->
              <tr v-if="requestItems.length === 0">
                <td colspan="3" class="px-6 py-8 text-center text-sm text-gray-500">
                  <div class="flex flex-col items-center justify-center">
                    <svg class="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
                    </svg>
                    <p>No items found in this request</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Back Button -->
      <div class="mt-8 flex justify-start">
        <button type="button" 
                @click="router.back()"
                class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150">
          <svg class="-ml-1 mr-2 h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Back to Requests
        </button>
      </div>
    </div>
  </div>
</template>