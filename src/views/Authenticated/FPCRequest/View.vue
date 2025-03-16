<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'vue-sonner';

const route = useRoute();
const requestId = route.params.id;
const request = ref(null);
const requestItems = ref([]);
const user = ref({ first_name: '', last_name: '' });
const error = ref(null);

const fetchRequestDetails = async () => {
  try {
    const { data: requestData, error: requestError } = await supabase
      .from('collection_requests')
      .select('*, user_id')
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
  } catch (err) {
    error.value = err.message;
  }
};

onMounted(() => {
  fetchRequestDetails();
});
</script>
<template>
    <div class="max-w-4xl mx-auto p-6">
      <!-- Header Section -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 mt-2 space-y-4 sm:space-y-0">
        <h2 class="text-3xl font-bold text-gray-900">Collection Request Details</h2>
        <div v-if="request" class="px-3 py-1 rounded-full text-sm font-medium" :class="request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'">
          {{ request.status }}
        </div>
      </div>
  
      <!-- Error Alert -->
      <div v-if="error" class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
        <div class="flex flex-col sm:flex-row items-start sm:items-center">
          <svg class="h-5 w-5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          <p class="ml-3 mt-2 sm:mt-0">{{ error }}</p>
        </div>
      </div>
  
      <!-- Main Content -->
      <div v-if="request" class="space-y-6">
        <!-- Request Information Card -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="p-6">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
              <h3 class="text-2xl font-semibold text-gray-900">Request ID: #{{ request.id }}</h3>
              <span class="text-sm text-gray-500 mt-2 sm:mt-0">Requested At: {{ new Date(request.requested_at).toLocaleDateString() }}</span>
            </div>
  
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Left Column -->
              <div class="space-y-4">
                <div class="flex items-center space-x-3">
                  <div class="p-2 bg-gray-50 rounded-lg">
                    <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm text-gray-500">Collection Date</p>
                    <p class="text-gray-900">{{ new Date(request.collection_date).toLocaleDateString() }}</p>
                  </div>
                </div>
  
                <div class="flex items-center space-x-3">
                  <div class="p-2 bg-gray-50 rounded-lg">
                    <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm text-gray-500">Updated At</p>
                    <p class="text-gray-900">{{ request.updated_at ? new Date(request.updated_at).toLocaleDateString() : 'N/A' }}</p>
                  </div>
                </div>
              </div>
  
              <!-- Right Column -->
              <div class="space-y-4">
                <div class="flex items-center space-x-3">
                  <div class="p-2 bg-gray-50 rounded-lg">
                    <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm text-gray-500">Status</p>
                    <p class="text-gray-900">{{ request.status }}</p>
                  </div>
                </div>
  
                <div class="flex items-center space-x-3">
                  <div class="p-2 bg-gray-50 rounded-lg">
                    <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm text-gray-500">Requested By</p>
                    <p class="text-gray-900">{{ user.first_name }} {{ user.last_name }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
  
        <!-- Request Items Section -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="p-6 border-b border-gray-100">
            <div class="flex items-center space-x-2">
              <svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <h3 class="text-xl font-semibold text-gray-900">Requested Items</h3>
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
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="item in requestItems" :key="item.id">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.forest_product_id.name }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.requested_quantity }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.forest_product_id.measurement_unit_id.unit_name }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </template>