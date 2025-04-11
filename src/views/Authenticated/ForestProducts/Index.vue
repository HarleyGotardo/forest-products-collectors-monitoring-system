<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'
import { user, isFPCollector, isVSUAdmin, isFPUAdmin, isForestRanger, fetchUserDetails } from '@/router/routeGuard'
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

const loading = ref(true);
const router = useRouter()
const allForestProducts = ref([]) // Store all forest products
const forestProducts = ref([]) // Store paginated forest products
const error = ref(null)
const currentPage = ref(1)
const itemsPerPage = 8
const searchQuery = ref('')
const selectedType = ref('') // New ref for selected type

const createForestProduct = () => {
  router.push('/authenticated/forest-products/create')
}

const fetchAllForestProducts = async () => {
  loading.value = true; // Start loading
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
    .is('deleted_at', null) // Exclude products with non-null deleted_at

  if (fetchError) {
    error.value = fetchError.message
  } else {
    // Transform the data to include locations and measurement unit symbol
    allForestProducts.value = forest_products.map(product => ({
      ...product,
      locations: product.fp_and_locations.map(fp => fp.locations),
      unit_name: product.measurement_units ? product.measurement_units.unit_name : 'N/A',
      image_url: JSON.parse(product.image_url).data.publicUrl // Extract the actual URL from the JSON string
    }))
    paginateForestProducts()
  }
  loading.value = false; // Stop loading after fetching
}

const paginateForestProducts = () => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  forestProducts.value = filteredForestProducts.value.slice(start, end)
}

const filteredForestProducts = computed(() => {
  let products = allForestProducts.value;

  if (selectedType.value) {
    products = products.filter(product => product.type === selectedType.value);
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    products = products.filter(product =>
      product.id.toString().includes(query) ||
      product.name.toLowerCase().includes(query) ||
      product.fp_and_locations.some(fp => 
        fp.locations && fp.locations.name.toLowerCase().includes(query)
      )
    );
  }

  return products;
});

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
  const currentDate = new Date()
  const formattedDate = format(currentDate, 'yyyy-MM-dd HH:mm:ss')

  const { error: updateError } = await supabase
    .from('forest_products')
    .update({ deleted_at: formattedDate })
    .eq('id', productId)

  if (updateError) {
    toast.error(updateError.message, { duration: 3000 })
  } else {
    toast.success('Forest product deleted successfully', { duration: 3000 })
    fetchAllForestProducts() 
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

watch(selectedType, () => {
  currentPage.value = 1 // Reset to first page on type change
  paginateForestProducts()
})
</script>

<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0 mt-2">
      <div class="flex items-center space-x-2">
      <img src="@/assets/forest-product.png" alt="Forest Map" class="w-12 h-12 group-hover:scale-110 transition-transform" />
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Forest Products</h2>
        <p class="mt-1 text-sm">View and manage all forest products</p>
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
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
        <Button 
        v-if="isForestRanger || isFPUAdmin"
        @click="createForestProduct"
        >
        +
        </Button>
      </div>
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

<!-- Loading Skeleton -->
<div v-if="loading" class="animate-pulse">
  <div class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-200">
          <tr>
            <th class="px-6 py-3 h-10"></th>
            <th class="px-6 py-3 h-10"></th>
            <th class="px-6 py-3 h-10"></th>
            <th class="px-6 py-3 h-10"></th>
            <th class="px-6 py-3 h-10"></th>
            <th class="px-6 py-3 h-10"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in 5" :key="n">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="h-4 bg-gray-200 rounded w-16"></div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div class="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-lg"></div>
                <div class="ml-4 w-24">
                  <div class="h-4 bg-gray-200 rounded"></div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="h-4 bg-gray-200 rounded w-20"></div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="h-4 bg-gray-200 rounded w-32"></div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex gap-1">
                <div class="h-6 bg-gray-200 rounded-full w-16"></div>
                <div class="h-6 bg-gray-200 rounded-full w-16"></div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
              <div class="flex items-center justify-end space-x-3">
                <div class="h-8 w-8 bg-gray-200 rounded"></div>
                <div class="h-8 w-8 bg-gray-200 rounded"></div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

    <!-- Forest Products Table -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
  <table class="min-w-full border-collapse sm:border-separate sm:border-spacing-0 cursor-pointer">
    <thead class="bg-gray-700 hidden sm:table-header-group">
      <tr>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">ID</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Name</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Type</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Price</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Locations</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Actions</th>
      </tr>
    </thead>

    <tbody class="bg-white">

      <tr v-if="filteredForestProducts.length === 0" class="block sm:table-row">
        <td colspan="6" class="px-6 py-12 text-center block sm:table-cell">
          <div class="flex flex-col items-center">
             <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                 d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
             </svg>
            <p class="text-gray-900 text-sm">No forest products found matching your criteria</p>
          </div>
        </td>
      </tr>

      <tr
        v-for="product in forestProducts"
        :key="product.id"
        class="block mb-4 rounded-lg shadow-md border border-gray-200 bg-white sm:table-row sm:mb-0 sm:rounded-none sm:shadow-none sm:border-0 sm:border-b sm:border-gray-200 sm:hover:bg-gray-50 transition-colors duration-150"
        @click="viewProduct(product.id, $event)"
      >

        <td class="block p-4 sm:hidden" colspan="6">
          <div class="flex items-start space-x-4 mb-3">
             <div class="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-lg bg-blue-50">
               <img :src="product.image_url" alt="Product Image" class="h-12 w-12 rounded-lg object-cover" />
             </div>
             <div class="flex-grow min-w-0"> <h3 class="text-base font-semibold text-gray-900 mb-0.5 truncate">{{ product.name }}</h3> <p class="text-xs text-gray-500">ID: #{{ product.id }}</p>
             </div>
             <div class="flex-shrink-0 flex items-center space-x-1" @click.stop> <Button
                  v-if="isForestRanger || isFPUAdmin"
                  @click="editProduct(product.id, $event)"
                  aria-label="Edit product"
                >
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                     <Button
                       v-if="isForestRanger || isFPUAdmin"
                       aria-label="Delete product"
                     >
                       <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                           d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                       </svg>
                     </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                     <AlertDialogHeader>
                       <AlertDialogTitle>Delete Forest Product?</AlertDialogTitle>
                       <AlertDialogDescription>
                         This forest product will be transferred to the recycle bin.
                       </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                       <AlertDialogCancel>Cancel</AlertDialogCancel>
                       <AlertDialogAction @click="deleteProduct(product.id)">Delete</AlertDialogAction>
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
             <div>
               <span class="block text-xs text-gray-500 font-medium">Price</span>
               <p class="text-gray-800">
                 ₱{{ product.price_based_on_measurement_unit }}
                 <span class="text-gray-500 text-xs">/ {{ product.unit_name }}</span>
               </p>
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
            <div class="ml-4 min-w-0"> <div class="text-sm font-medium text-gray-900 truncate">{{ product.name }}</div> </div>
          </div>
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
          {{ product.type === 'Timber' ? 'Timber' : 'Non-Timber' }}
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
           ₱{{ product.price_based_on_measurement_unit }} <span class="text-gray-500 text-xs">per {{ product.unit_name }}</span>
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap border-b border-gray-200">
           <div class="flex flex-wrap gap-1">
             <span
               v-for="location in product.locations"
               :key="location?.id"
               class="bg-gray-100 px-2 py-1 rounded-full text-sm"
             >
               {{ location?.name }}
             </span>
             <span v-if="!product.locations || product.locations.length === 0" class="text-sm text-gray-400 italic">N/A</span>
           </div>
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-right text-sm font-medium border-b border-gray-200" @click.stop>
           <div class="flex items-center justify-end space-x-2"> <Button
               v-if="isForestRanger || isFPUAdmin"
               @click="editProduct(product.id, $event)"
               aria-label="Edit product"
             >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
             </Button>
             <AlertDialog>
               <AlertDialogTrigger asChild>
                  <Button
                    v-if="isForestRanger || isFPUAdmin"
                    aria-label="Delete product"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </Button>
               </AlertDialogTrigger>
               <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Forest Product?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This forest product will be transferred to the recycle bin.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction @click="deleteProduct(product.id)">Delete</AlertDialogAction>
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
        <div class="flex items-center justify-between">
          <button 
        @click="prevPage" 
        :disabled="currentPage === 1"
        class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        <span class="hidden sm:inline ml-2">Previous</span>
          </button>
          <div 
        class="text-sm text-gray-700"
        :class="{ 'hidden sm:block': true }"
          >
        Page {{ currentPage }} of {{ Math.ceil(filteredForestProducts.length / itemsPerPage) }}
          </div>
          <div 
        class="text-sm font-medium text-gray-700"
        :class="{ 'block sm:hidden': true }"
          >
        {{ currentPage }}/{{ Math.ceil(filteredForestProducts.length / itemsPerPage) }}
          </div>
          <button 
        @click="nextPage" 
        :disabled="forestProducts.length < itemsPerPage"
        class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
        <span class="hidden sm:inline mr-2">Next</span>
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>