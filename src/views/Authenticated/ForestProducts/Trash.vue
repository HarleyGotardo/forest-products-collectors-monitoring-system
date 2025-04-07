<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'
import { isFPCollector, isVSUAdmin, isFPUAdmin, isForestRanger } from '@/router/routeGuard'
import Button from '@/components/ui/button/Button.vue'
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
} from '@/components/ui/alert-dialog'

const router = useRouter()
const trashedProducts = ref([])
const forestProducts = ref([])
const error = ref(null)
const currentPage = ref(1)
const itemsPerPage = 8
const searchQuery = ref('')
const selectedType = ref('')
const loading = ref(true)

const fetchTrashedProducts = async () => {
  loading.value = true
  
  let { data: forest_products, error: fetchError } = await supabase
    .from('forest_products')
    .select(`
      *,
      fp_and_locations (
        locations (
          id,
          name
        )
      ),
      measurement_units:measurement_unit_id (
        unit_name
      )
    `)
    .not('deleted_at', 'is', null) // Get only products with non-null deleted_at

  if (fetchError) {
    error.value = fetchError.message
  } else {
    trashedProducts.value = forest_products.map(product => ({
      ...product,
      locations: product.fp_and_locations.map(fp => fp.locations),
      unit_name: product.measurement_units ? product.measurement_units.unit_name : 'N/A',
      image_url: JSON.parse(product.image_url).data.publicUrl
    }))
    paginateForestProducts()
  }
  
  loading.value = false
}

const paginateForestProducts = () => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  forestProducts.value = filteredForestProducts.value.slice(start, end)
}

const filteredForestProducts = computed(() => {
  let products = trashedProducts.value

  if (selectedType.value) {
    products = products.filter(product => product.type === selectedType.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    products = products.filter(product =>
      product.name.toLowerCase().includes(query) ||
      product.type.toLowerCase().includes(query) ||
      product.locations.some(location => location.name.toLowerCase().includes(query))
    )
  }

  return products
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

const restoreProduct = async (productId) => {
  const { error: updateError } = await supabase
    .from('forest_products')
    .update({ deleted_at: null })
    .eq('id', productId)

  if (updateError) {
    toast.error(updateError.message, { duration: 3000 })
  } else {
    toast.success('Forest product restored successfully', { duration: 3000 })
    fetchTrashedProducts()
  }
}

const deletePermanently = async (productId) => {
  const { error: deleteError } = await supabase
    .from('forest_products')
    .delete()
    .eq('id', productId)

  if (deleteError) {
    toast.error(deleteError.message, { duration: 3000 })
  } else {
    toast.success('Forest product deleted permanently', { duration: 3000 })
    fetchTrashedProducts()
  }
}

const viewForestProduct = (productId) => {
  router.push(`/authenticated/forest-products/${productId}`)
}

onMounted(() => {
  fetchTrashedProducts()
})

watch(searchQuery, () => {
  currentPage.value = 1 // Reset to first page on search query change
  paginateForestProducts()
})

watch(currentPage, () => {
  paginateForestProducts()
})

watch(selectedType, () => {
  currentPage.value = 1 // Reset to first page on type change
  paginateForestProducts()
})
</script>

<template>
  <div class="max-w-7xl mx-auto p-4 sm:p-6 mt-2">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0 mt-2">
      <div class="flex items-center space-x-4">
        <img src="@/assets/trash-bin.png" alt="Forest Map" class="w-12 h-12 group-hover:scale-110 transition-transform" />
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Trashed Forest Products</h2>
          <p class="mt-1 text-sm text-gray-500">Manage and restore trashed forest products</p>
        </div>
      </div>
      <div class="flex space-x-4">
        <div class="relative flex-1 sm:flex-none">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search products..."
            class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
          />
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters Section -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
      <!-- Type Filter -->
      <div class="relative">
        <label for="type" class="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
        <div class="relative">
          <select
            id="type"
            v-model="selectedType"
            class="appearance-none block w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-white border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
          >
            <option value="">All Types</option>
            <option value="Timber">Timber</option>
            <option value="Non-Timber">Non-Timber</option>
          </select>
          <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="animate-pulse">
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th class="px-6 py-6 bg-gray-200 h-12"></th>
                <th class="px-6 py-6 bg-gray-200 h-12"></th>
                <th class="px-6 py-6 bg-gray-200 h-12"></th>
                <th class="px-6 py-6 bg-gray-200 h-12"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="n in 8" :key="n">
                <td class="px-6 py-8 bg-gray-100 h-12"></td>
                <td class="px-6 py-8 bg-gray-100 h-12"></td>
                <td class="px-6 py-8 bg-gray-100 h-12"></td>
                <td class="px-6 py-8 bg-gray-100 h-12"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Products Table -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-700">
            <tr>
              <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Product</th>
              <th class="px-4 hidden sm:table-cell sm:px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Type</th>
              <th class="px-4 hidden sm:table-cell sm:px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Locations</th>
              <th class="px-4 hidden sm:table-cell sm:px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="forestProducts.length === 0">
              <td colspan="4" class="px-4 sm:px-6 py-12 text-center">
                <div class="flex flex-col items-center">
                  <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p class="text-gray-500 text-sm">No trashed products found</p>
                </div>
              </td>
            </tr>
            <tr v-for="product in forestProducts" :key="product.id" class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer" @click="viewForestProduct(product.id)">
              <td class="px-4 sm:px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="h-10 w-10 flex-shrink-0">
                    <img v-if="product.image_url" :src="product.image_url" alt="Product Image" class="h-10 w-10 rounded-full object-cover" />
                    <div v-else class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span class="text-gray-600 font-medium">{{ product.name[0] }}</span>
                    </div>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ product.name }}</div>
                    <div class="block sm:hidden text-sm text-gray-600">{{ product.type }}</div>
                    <div class="block sm:hidden text-sm text-gray-600">{{ product.locations.map(location => location.name).join(', ') }}</div>
                    <div class="sm:hidden flex space-x-2 mt-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button @click.stop>
                            <img src="@/assets/restore2.png" alt="Restore" class="w-5 h-5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Restore Product?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to restore this product?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction @click="restoreProduct(product.id)">Restore</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button @click.stop>
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Product Permanently?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction @click="deletePermanently(product.id)">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-4 hidden sm:table-cell sm:px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-600">{{ product.type }}</div>
              </td>
              <td class="px-4 hidden sm:table-cell sm:px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-600">{{ product.locations.map(location => location.name).join(', ') }}</div>
              </td>
              <td class="px-4 hidden sm:table-cell sm:px-6 py-4 whitespace-nowrap">
                <div class="flex space-x-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button @click.stop>
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
    d="M9 5L4 10m0 0l5 5m-5-5h7a5 5 0 1 1 0 10" />
</svg>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restore Product?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to restore this product?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction @click="restoreProduct(product.id)">Restore</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button @click.stop>
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Product Permanently?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction @click="deletePermanently(product.id)">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Pagination Controls -->
      <div class="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <button @click="prevPage" :disabled="currentPage === 1" class="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
        <svg class="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Previous
          </button>
          <span class="text-sm text-gray-700">
        <span class="hidden sm:inline">Page {{ currentPage }} of {{ Math.ceil(filteredForestProducts.length / itemsPerPage) }}</span>
        <span class="sm:hidden">{{ currentPage }} / {{ Math.ceil(filteredForestProducts.length / itemsPerPage) }}</span>
          </span>
          <button @click="nextPage" :disabled="(currentPage * itemsPerPage) >= filteredForestProducts.length" class="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
        Next
        <svg class="ml-1 sm:ml-2 h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
          </button>
        </div>
      </div>
    </div>
    <Toaster />
  </div>
</template>