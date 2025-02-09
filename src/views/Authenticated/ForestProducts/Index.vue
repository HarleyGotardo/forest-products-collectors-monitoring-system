<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import Swal from 'sweetalert2'
import {isFPCollector ,isVSUAdmin, isFPUAdmin, isForestRanger, fetchUserDetails } from '@/components/routeGuard/routeGuard';

const router = useRouter()
const allForestProducts = ref([]) // Store all forest products
const forestProducts = ref([]) // Store paginated forest products
const error = ref(null)
const currentPage = ref(1)
const itemsPerPage = 8
const searchQuery = ref('')

const createForestProduct = () => {
  router.push('/authenticated/forest-products/create')
}

const fetchAllForestProducts = async () => {
  let { data: forest_products, error: fetchError } = await supabase
    .from('forest_products')
    .select(`
      *,
      fp_and_location (
        location (
          id,
          name
        )
      ),
      measurement_units:measurement_unit_id (
        unit_name
      )
    `)
    .is('deleted_at', null) // Exclude products with non-null deleted_at

  if (fetchError) {
    error.value = fetchError.message
  } else {
    // Transform the data to include locations and measurement unit symbol
    allForestProducts.value = forest_products.map(product => ({
      ...product,
      locations: product.fp_and_location.map(fp => fp.location),
      unit_name: product.measurement_units ? product.measurement_units.unit_name : 'N/A'
    }))
    paginateForestProducts()
  }
}

const paginateForestProducts = () => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  forestProducts.value = filteredForestProducts.value.slice(start, end)
}

const filteredForestProducts = computed(() => {
  if (!searchQuery.value) {
    return allForestProducts.value
  }
  const query = searchQuery.value.toLowerCase()
  return allForestProducts.value.filter(product =>
    product.name.toLowerCase().includes(query) ||
    product.type.toLowerCase().includes(query) ||
    product.locations.some(location => location.name.toLowerCase().includes(query))
  )
})

const nextPage = () => {
  if ((currentPage.value * itemsPerPage) < filteredForestProducts.value.length) {
    currentPage.value++
    paginateForestProducts()
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    paginateForestProducts()
  }
}

const viewProduct = (productId) => {
  router.push(`/authenticated/forest-products/${productId}`)
}

const editProduct = (productId) => {
  router.push(`/authenticated/forest-products/${productId}/edit`)
}

const deleteProduct = async (productId) => {
  const result = await Swal.fire({
    title: 'Delete Forest Product?',
    text: "This forest product will be transferred to the recycle bin.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',  
    confirmButtonText: 'Delete'
  })

  if (result.isConfirmed) {
    const currentDate = new Date()
    const formattedDate = format(currentDate, 'yyyy-MM-dd HH:mm:ss')

    const { error: updateError } = await supabase
      .from('forest_products')
      .update({ deleted_at: formattedDate })
      .eq('id', productId)

    if (updateError) {
      Swal.fire('Error', updateError.message, 'error')
    } else {
      Swal.fire('Deleted!', 'The forest product has been transferred to the recycle bin.', 'success')
      fetchAllForestProducts() 
    }
  }
}

onMounted(() => {
  fetchUserDetails()
  fetchAllForestProducts()
})

watch(searchQuery, () => {
  currentPage.value = 1 // Reset to first page on search query change
  paginateForestProducts()
})

watch(currentPage, () => {
  paginateForestProducts()
})
</script>
<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header Section -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Forest Products</h2>
        <p class="mt-1 text-sm text-gray-500">View and manage all registered forest products</p>
      </div>
      <div class="flex space-x-4">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search forest products..."
            class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
          />
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <button 
          v-if="isForestRanger || isFPUAdmin"
          @click="createForestProduct"
          class="px-4 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          +
        </button>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" 
         class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg">
      <div class="flex">
        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <p class="ml-3">{{ error }}</p>
      </div>
    </div>

    <!-- Forest Products Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Locations</th>
              <th v-if="isFPUAdmin || isForestRanger" scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="filteredForestProducts.length === 0">
              <td colspan="8" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center">
                  <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p class="text-gray-500 text-sm">No forest products found matching your criteria</p>
                </div>
              </td>
            </tr>
            <tr 
              v-for="product in forestProducts" 
              :key="product.id" 
              class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
              @click="viewProduct(product.id, $event)"
            >
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                #{{ product.id }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-blue-50">
                    <svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ product.name }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  {{ product.type === 'T' ? 'Timber' : 'Non-Timber' }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  {{ product.quantity }} {{ product.unit_name }}(s)
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  ₱{{ product.price_based_on_measurement_unit }} per {{ product.unit_name }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex flex-wrap gap-1">
                  <span 
                    v-for="location in product.locations" 
                    :key="location.id"
                    class="bg-gray-100 px-2 py-1 rounded-full text-sm"
                  >
                    {{ location.name }}
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" @click.stop>
                <div class="flex items-center justify-end space-x-3">
                  <button
                    v-if="isForestRanger || isFPUAdmin" 
                    class="p-1 rounded-lg hover:bg-blue-50 transition-colors duration-200 text-blue-600 hover:text-blue-700"
                    @click="editProduct(product.id, $event)"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button 
                    v-if="isForestRanger || isFPUAdmin" 
                    class="p-1 rounded-lg hover:bg-red-50 transition-colors duration-200 text-red-600 hover:text-red-700"
                    @click="deleteProduct(product.id)"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <button 
            @click="prevPage" 
            :disabled="currentPage === 1"
            class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          <button 
            @click="nextPage" 
            :disabled="forestProducts.length < itemsPerPage"
            class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <svg class="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>