<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'

const route = useRoute()
const recordId = route.params.id
const record = ref(null)
const error = ref(null)

const fetchCollectionRecord = async () => {
  const { data, error: fetchError } = await supabase
    .from('collection_records')
    .select(`
      id,
      created_at,
      total_cost,
      deducted_quantity,
      remaining_quantity,
      quantity_during_purchase,
      price_per_unit_during_purchase,
      is_paid,
      user:profiles!forest_product_collection_records_user_id_fkey ( first_name, last_name ),
      forest_product:forest_products ( name, measurement_unit_id, measurement_unit:measurement_units ( unit_name ) ),
      location:location ( name ),
      created_by:profiles!collection_records_created_by_fkey ( first_name, last_name )
    `)
    .eq('id', recordId)
    .single()

  if (fetchError) {
    error.value = fetchError.message
  } else {
    record.value = data
  }
}

onMounted(() => {
  fetchCollectionRecord()
})
</script>
<template>
  <div class="min-h-screen bg-gray-50 py-4 px-2 sm:py-8 mt-5 sm:px-6 lg:px-8">
    <!-- Error Alert -->
    <div 
      v-if="error" 
      class="max-w-4xl mx-auto mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-lg"
    >
      <div class="flex items-center">
        <svg class="h-4 w-4 sm:h-5 sm:w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <p class="ml-2 sm:ml-3 text-xs sm:text-sm">{{ error }}</p>
      </div>
    </div>

    <!-- Invoice Card -->
    <div v-if="record" class="max-w-4xl mx-auto bg-white rounded-lg sm:rounded-xl shadow-md sm:shadow-lg overflow-hidden">
      <!-- Invoice Header -->
      <div class="border-b border-gray-200 p-4 sm:p-8">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 sm:gap-0">
          <!-- Logo/Company Area -->
          <div>
            <h1 class="text-xl sm:text-2xl font-bold text-gray-900">Collection Receipt</h1>
            <p class="text-xs sm:text-sm text-gray-500 mt-1">Forest Products Collection Record</p>
          </div>
          <!-- Invoice Number & Date -->
          <div class="sm:text-right">
            <p class="text-xs sm:text-sm text-gray-500">Receipt No.</p>
            <p class="text-lg sm:text-xl font-bold text-gray-900">#{{ record.id }}</p>
            <p class="text-xs sm:text-sm text-gray-500 mt-2">Date Issued</p>
            <p class="text-sm sm:text-base text-gray-900">{{ new Date(record.created_at).toLocaleDateString() }}</p>
          </div>
        </div>
      </div>

      <!-- Invoice Body -->
      <div class="p-4 sm:p-8">
        <!-- Parties Information -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
          <!-- From Section -->
          <div>
            <h2 class="text-xs sm:text-sm font-medium text-gray-500 mb-2">Processed By</h2>
            <p class="text-sm sm:text-base text-gray-900 font-medium">
              {{ record.created_by ? `${record.created_by.first_name} ${record.created_by.last_name}` : 'N/A' }}
            </p>
          </div>
          <!-- To Section -->
          <div>
            <h2 class="text-xs sm:text-sm font-medium text-gray-500 mb-2">Customer Details</h2>
            <p class="text-sm sm:text-base text-gray-900 font-medium">
              {{ record.user ? `${record.user.first_name} ${record.user.last_name}` : 'N/A' }}
            </p>
          </div>
        </div>

        <!-- Product Details -->
        <div class="mb-6 sm:mb-8">
          <h2 class="text-xs sm:text-sm font-medium text-gray-500 mb-4">Collection Details</h2>
          <div class="bg-gray-50 rounded-lg overflow-x-auto">
            <table class="w-full min-w-[640px]">
              <thead>
                <tr class="bg-gray-100">
                  <th class="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th class="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th class="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th class="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Price Per Unit</th>
                  <th class="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr>
                  <td class="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900">
                    {{ record.forest_product ? record.forest_product.name : 'N/A' }}
                  </td>
                  <td class="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 text-right">
                    {{ record.location ? record.location.name : 'N/A' }}
                  </td>
                  <td class="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 text-right">
                    {{ record.quantity_during_purchase }} {{ record.forest_product.measurement_unit.unit_name }}
                  </td>
                  <td class="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 text-right">
                    ₱{{ record.price_per_unit_during_purchase }}
                  </td>
                  <td class="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 text-right font-medium">
                    ₱{{ record.total_cost }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Summary & Totals -->
        <div class="border-t border-gray-200 pt-6 sm:pt-8">
          <div class="flex flex-col sm:flex-row sm:justify-between gap-6 sm:gap-4">
            <div>
              <h2 class="text-xs sm:text-sm font-medium text-gray-500 mb-4">Additional Information</h2>
              <div class="text-xs sm:text-sm text-gray-600">
                <p class="mb-2">Deducted Quantity: {{ record.deducted_quantity }} {{ record.forest_product.measurement_unit.unit_name }}</p>
                <p>Remaining Quantity: {{ record.remaining_quantity }} {{ record.forest_product.measurement_unit.unit_name }}</p>
              </div>
            </div>
            <div class="w-full sm:w-64">
              <div class="flex justify-between py-2">
                <p class="text-xs sm:text-sm font-medium text-gray-500">Total Amount</p>
                <p class="text-lg sm:text-xl font-bold text-gray-900">₱{{ record.total_cost }}</p>
              </div>
              <div class="flex justify-between py-2 border-t border-gray-200 mt-2">
                <p class="text-xs sm:text-sm font-medium text-gray-500">Payment Status</p>
                <p class="text-xs sm:text-sm font-medium" :class="record.is_paid ? 'text-green-600' : 'text-red-600'">
                  {{ record.is_paid ? 'PAID' : 'UNPAID' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Invoice Footer -->
      <div class="bg-gray-50 px-4 sm:px-8 py-4 sm:py-6">
        <div class="text-xs sm:text-sm text-gray-500 text-center">
          <p>Thank you for your business</p>
        </div>
      </div>
    </div>
  </div>
</template>