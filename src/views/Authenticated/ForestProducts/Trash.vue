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
    .order('deleted_at', { ascending: false })

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
          <h2 class="text-xl sm:text-2xl font-bold text-green-900">Trashed Forest Products</h2>
          <p class="mt-1 text-sm text-green-900">Manage and restore trashed forest products</p>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
        <div class="relative flex-1 sm:flex-none">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="ID, name, location"
            class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
          />
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <div class="flex space-x-4">
          <select
            v-model="selectedType"
            class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
          >
            <option value="">All Types</option>
            <option value="Timber">Timber</option>
            <option value="Non-Timber">Non-Timber</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="animate-pulse">
      <!-- Desktop Table Skeleton -->
      <div class="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-emerald-900">
              <tr>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="n in 8" :key="n">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-12"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-lg"></div>
                    <div class="ml-4">
                      <div class="h-4 bg-gray-200 rounded w-24"></div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-20"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex gap-1">
                    <div class="h-6 bg-gray-200 rounded-full w-16"></div>
                    <div class="h-6 bg-gray-200 rounded-full w-16"></div>
                  </div>
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
        <div v-for="n in 8" :key="n" class="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
          <!-- Card header skeleton -->
          <div class="p-4 border-b border-gray-100 flex items-center justify-between">
            <div class="h-4 bg-gray-200 rounded w-12"></div>
            <div class="h-4 bg-gray-200 rounded-full w-16"></div>
          </div>
          
          <!-- Card body skeleton -->
          <div class="p-4">
            <div class="space-y-3">
              <div class="flex justify-between">
                <div>
                  <div class="h-3 bg-gray-200 rounded w-16 mb-1"></div>
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                </div>
                <div>
                  <div class="h-3 bg-gray-200 rounded w-16 mb-1"></div>
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
              
              <div>
                <div class="h-3 bg-gray-200 rounded w-12 mb-1"></div>
                <div class="h-4 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
          </div>
          
          <!-- Card actions skeleton -->
          <div class="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between">
            <div class="h-8 bg-gray-200 rounded w-24"></div>
            <div class="h-8 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </div>

      <!-- Pagination Skeleton -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="h-4 bg-gray-200 rounded w-48 hidden sm:block"></div>
          <div class="flex items-center gap-2">
            <!-- Mobile Pagination Skeleton -->
            <div class="flex items-center gap-2 sm:hidden">
              <div class="h-12 w-12 bg-gray-200 rounded-lg"></div>
              <div class="h-4 bg-gray-200 rounded w-16"></div>
              <div class="h-12 w-12 bg-gray-200 rounded-lg"></div>
            </div>
            
            <!-- Desktop Pagination Skeleton -->
            <div class="hidden sm:flex items-center gap-1">
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
    </div>

    <!-- Trashed Forest Products Table -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse sm:border-separate sm:border-spacing-0 cursor-pointer">
          <thead class="bg-emerald-900 hidden sm:table-header-group">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">ID</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Name</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Type</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Action</th>
            </tr>
          </thead>

          <tbody class="bg-white">
            <tr v-if="forestProducts.length === 0" class="block sm:table-row">
              <td colspan="6" class="px-6 py-12 text-center block sm:table-cell">
                <div class="flex flex-col items-center">
                  <img src="@/assets/forest-product.png" alt="" class="w-12 h-12 mb-4" />
                  <p class="text-gray-900 text-sm">No trashed forest products found</p>
                </div>
              </td>
            </tr>

            <tr
              v-for="product in forestProducts"
              :key="product.id"
              class="block mb-4 rounded-lg shadow-md border border-gray-200 bg-white sm:table-row sm:mb-0 sm:rounded-none sm:shadow-none sm:border-0 sm:border-b sm:border-gray-200 sm:hover:bg-gray-50 transition-colors duration-150"
              @click="viewForestProduct(product.id, $event)"
            >
              <td class="block p-4 sm:hidden" colspan="5">
                <div class="flex items-start space-x-4 mb-3">
                  <div class="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-lg bg-blue-50">
                    <img :src="product.image_url" alt="Product Image" class="h-12 w-12 rounded-lg object-cover" />
                  </div>
                  <div class="flex-grow min-w-0">
                    <h3 class="text-base font-semibold text-gray-900 mb-0.5 truncate">{{ product.name }}</h3>
                    <p class="text-xs text-gray-500">ID: #{{ product.id }}</p>
                  </div>
                  <div class="flex-shrink-0 flex items-center space-x-1" @click.stop>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                        class="bg-emerald-900 text-white hover:bg-emerald-600"
                        @click.stop>
                          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M9 5L4 10m0 0l5 5m-5-5h7a5 5 0 1 1 0 10" />
                          </svg>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Restore Forest Product?</AlertDialogTitle>
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
                        <Button 
                        class="bg-red-900 text-white hover:bg-red-700"
                        @click.stop>
                          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                          <AlertDialogAction class="bg-red-900 hover:bg-red-700" @click="deletePermanently(product.id)">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t border-gray-100 pt-3">
                  <div>
                    <span class="block text-xs text-gray-500 font-medium">Type</span>
                    <p class="text-gray-800">{{ product.type === 'Timber' ? 'Timber' : 'Non-Timber' }}</p>
                  </div>
                  <div class="col-span-2">
                    <span class="block text-xs text-gray-500 font-medium">Locations</span>
                    <div class="flex flex-wrap gap-1 mt-1">
                      <span
                        v-for="location in product.locations"
                        :key="location?.id"
                        class="bg-gray-100 px-2 py-0.5 rounded-full text-xs text-gray-700"
                      >
                        {{ location?.name }}
                      </span>
                      <span v-if="!product.locations || product.locations.length === 0" class="text-xs text-gray-400 italic">
                        N/A
                      </span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                #{{ product.id }}
              </td>
              <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap border-b border-gray-200">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-blue-50">
                    <img :src="product.image_url" alt="Forest Product Image" class="h-10 w-10 rounded-lg object-cover" />
                  </div>
                  <div class="ml-4 min-w-0">
                    <div class="text-sm font-medium text-gray-900 truncate">{{ product.name }}</div>
                  </div>
                </div>
              </td>
              <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                {{ product.type === 'Timber' ? 'Timber' : 'Non-Timber' }}
              </td>
              <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-right text-sm font-medium border-b border-gray-200" @click.stop>
                <div class="flex items-center justify-end space-x-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                      class="bg-emerald-900 text-white hover:bg-emerald-600" @click.stop>
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M9 5L4 10m0 0l5 5m-5-5h7a5 5 0 1 1 0 10" />
                        </svg>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restore Forest Product?</AlertDialogTitle>
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
                      <Button 
                      class="bg-red-900 text-white hover:bg-red-700"
                      @click.stop>
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                        <AlertDialogAction class="bg-red-900 hover:bg-red-700" @click="deletePermanently(product.id)">Delete Permanently</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="text-sm text-gray-600 hidden sm:block">
            Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentPage * itemsPerPage, filteredForestProducts.length) }} of {{ filteredForestProducts.length }} items
          </div>
          <Pagination
            v-slot="{ page }"
            :total="filteredForestProducts.length"
            :items-per-page="itemsPerPage"
            :sibling-count="1"
            show-edges
            :default-page="currentPage"
            @update:page="(newPage) => {
              currentPage = newPage;
              paginateForestProducts();
            }"
            class="w-full sm:w-auto"
          >
            <div class="flex items-center justify-center sm:justify-end gap-2">
              <!-- Mobile View -->
              <div class="flex items-center gap-2 sm:hidden">
                <PaginationPrev class="!w-12 !h-12" />
                <div class="text-sm font-medium">
                  {{ currentPage }} / {{ Math.ceil(filteredForestProducts.length / itemsPerPage) }}
                </div>
                <PaginationNext class="!w-12 !h-12" />
              </div>

              <!-- Desktop View -->
              <div class="hidden sm:flex items-center gap-1">
                <PaginationFirst />
                <PaginationPrev />
                <PaginationList v-slot="{ items }" class="flex items-center gap-1">
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
    <Toaster
  theme="light"
  :toastOptions="{
    class: 'bg-[#ecfdf5] text-gray-800 border border-green-200 rounded-lg shadow-md',
    style: {
      padding: '1rem',
    }
  }"
/>

  </div>
</template>