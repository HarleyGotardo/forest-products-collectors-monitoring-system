<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { toast, Toaster } from 'vue-sonner'
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
import Button from '@/components/ui/button/Button.vue'
import { Pagination, PaginationFirst, PaginationLast, PaginationList, PaginationListItem, PaginationNext, PaginationPrev } from '@/components/ui/pagination'

// Fix for Leaflet default marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
})

const loading = ref(true)
const route = useRoute()
const router = useRouter()
const locationId = route.params.id
const location = ref(null)
const error = ref(null)
const mapInstance = ref(null)
const showRestoreDialog = ref(false)
const showDeleteDialog = ref(false)
const forestProducts = ref([])
const mapInitialized = ref(false)

// Add these new refs
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const selectedProduct = ref(null)
const quantityInput = ref('')
const availableForestProducts = ref([])
const currentEntryId = ref(null)
const currentProduct = ref(null)

// Add new reactive variable for delete confirmation
const showDeleteConfirmDialog = ref(false)
const productToDelete = ref(null)

const fetchAvailableForestProducts = async () => {
  try {
    // Get IDs of already added products
    const existingIds = forestProducts.value.map(fp => fp.id)
    
    // Fetch products not already linked and not deleted
    const { data, error } = await supabase
      .from('forest_products')
      .select('id, name, measurement_unit_id')
      .is('deleted_at', null)
      .not('id', 'in', `(${existingIds.join(',')})`)

    if (error) throw error
    availableForestProducts.value = data
  } catch (err) {
    toast.error('Error fetching available products: ' + err.message)
  }
}

const openAddDialog = async () => {
  await fetchAvailableForestProducts()
  showAddDialog.value = true
}

const addForestProduct = async () => {
  try {
    if (!selectedProduct.value || quantityInput.value === '') {
      throw new Error('Please fill all fields')
    }

    const { error } = await supabase
      .from('fp_and_locations')
      .insert([{
        forest_product_id: selectedProduct.value,
        location_id: locationId,
        quantity: parseFloat(quantityInput.value)
      }])

    if (error) throw error

    toast.success('Forest product added successfully')
    showAddDialog.value = false
    selectedProduct.value = null
    quantityInput.value = ''
    await fetchForestProducts()
  } catch (err) {
    toast.error('Failed to add product: ' + err.message)
  }
}

const openEditDialog = (product) => {
  currentEntryId.value = product.fp_and_locations_id
  currentProduct.value = product
  quantityInput.value = product.quantity
  showEditDialog.value = true
}

const updateForestProduct = async () => {
  try {
    if (!quantityInput.value) {
      throw new Error('Please enter a quantity')
    }

    const { error } = await supabase
      .from('fp_and_locations')
      .update({ quantity: parseFloat(quantityInput.value) })
      .eq('id', currentEntryId.value)

    if (error) throw error

    toast.success('Quantity updated successfully')
    showEditDialog.value = false
    await fetchForestProducts()
  } catch (err) {
    toast.error('Failed to update product: ' + err.message)
  }
}

const confirmDelete = (product) => {
  productToDelete.value = product
  showDeleteConfirmDialog.value = true
}

const deleteForestProduct = async () => {
  try {
    const { error } = await supabase
      .from('fp_and_locations')
      .delete()
      .eq('id', productToDelete.value.fp_and_locations_id)

    if (error) throw error

    toast.success('Product removed successfully')
    await fetchForestProducts()
    await fetchAvailableForestProducts()
    showDeleteConfirmDialog.value = false
    productToDelete.value = null
  } catch (err) {
    toast.error('Failed to remove product: ' + err.message)
  }
}

const fetchLocation = async () => {
  let { data, error: fetchError } = await supabase
    .from('locations')
    .select('*')
    .eq('id', locationId)
    .single()

  if (fetchError) {
    error.value = fetchError.message
  } else {
    location.value = data
  }
}

const fetchForestProducts = async () => {
  let { data, error: fetchError } = await supabase
    .from('fp_and_locations')
    .select(`
      id,
      forest_product:forest_products ( id, name, measurement_unit_id, deleted_at ),
      quantity
    `)
    .eq('location_id', locationId)

  if (fetchError) {
    error.value = fetchError.message
    return
  }

  // Process remaining data
  const productIds = data
    .filter(item => item.forest_product.deleted_at === null)
    .map(item => item.forest_product.measurement_unit_id)

  const { data: units, error: unitsError } = await supabase
    .from('measurement_units')
    .select('id, unit_name')
    .in('id', productIds)

  if (unitsError) {
    error.value = unitsError.message
  } else {
    forestProducts.value = data
      .filter(item => item.forest_product.deleted_at === null)
      .map(item => ({
        fp_and_locations_id: item.id, // Add this line
        ...item.forest_product,
        quantity: item.quantity,
        unit_name: units.find(unit => unit.id === item.forest_product.measurement_unit_id)?.unit_name
      }))
  }
}

const initializeMap = () => {
  // Only initialize if we have location data and the map container exists
  if (!location.value || mapInitialized.value) return;

  const mapContainer = document.getElementById('locationMap');
  if (!mapContainer) return;

  const lat = location.value.latitude;
  const lng = location.value.longitude;

  // Clean up existing map instance if it exists
  if (mapInstance.value) {
    mapInstance.value.remove();
  }

  // Create new map
  mapInstance.value = L.map('locationMap').setView([lat, lng], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapInstance.value);

  L.marker([lat, lng])
    .addTo(mapInstance.value)
    .bindTooltip(location.value.name, {
      permanent: true,
      direction: 'top',
      className: 'bg-white px-2 py-1 rounded shadow-lg'
    });

  mapInitialized.value = true;
}

const restoreLocation = async () => {
  const { error: restoreError } = await supabase
    .from('locations')
    .update({ deleted_at: null })
    .eq('id', locationId)

  if (restoreError) {
    error.value = restoreError.message
  } else {
    fetchLocation()
    toast.success('Location restored successfully', { duration: 2000 })
  }
}

const deletePermanently = async () => {
  const { error: deleteError } = await supabase
    .from('locations')
    .delete()
    .eq('id', locationId)

  if (deleteError) {
    error.value = deleteError.message
  } else {
    toast.success('Location deleted permanently', { duration: 2000 })
    router.push('/authenticated/locations/trash')
  }
}

const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  return new Date(dateString).toLocaleDateString(undefined, options)
}

const goToForestProduct = (productId) => {
  router.push(`/authenticated/forest-products/${productId}`)
}

const currentPage = ref(1)
const itemsPerPage = 5

const paginatedForestProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return forestProducts.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(forestProducts.value.length / itemsPerPage)
})

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await fetchLocation()
    await fetchForestProducts()
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
    // Initialize map on the next tick after loading is complete
    nextTick(() => {
      if (location.value) {
        initializeMap()
      }
    })
  }
})
</script>

<template>
  <div class="max-w-4xl mx-auto p-4 sm:p-6">
    <!-- Header Section -->
    <div class="mb-4 sm:mb-6 flex items-center space-x-4">
      <button
        @click="router.back()"
        class="inline-flex items-center px-3 sm:px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        <span class="hidden sm:inline">Back</span>
      </button>
      <img src="@/assets/location2.png" alt="Location" class="w-12 h-12 sm:w-16 sm:h-16" />
      <div>
        <h2 class="text-lg sm:text-xl font-bold text-gray-900">Location Details</h2>
        <p class="text-xs sm:text-sm text-gray-600">
          Detailed information about this location
        </p>
      </div>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error"
      class="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg"
    >
      <div class="flex">
        <svg
          class="h-5 w-5 text-red-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 101.414 1.414L10 11.414l1.293 1.293a1 1 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <p class="ml-3 text-sm">{{ error }}</p>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="animate-pulse">
      <!-- Location Info Card Skeleton -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-6">
          <div class="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
            <!-- Location Icon Skeleton -->
            <div class="p-5 bg-gray-100 rounded-full flex items-center justify-center">
              <div class="w-10 h-10 bg-gray-200 rounded-full"></div>
            </div>

            <!-- Location Details Skeleton -->
            <div class="flex-1">
              <div class="flex flex-col md:flex-row md:items-center justify-between">
                <div class="h-8 w-48 bg-gray-200 rounded"></div>
                <div class="mt-4 md:mt-0 flex items-center space-x-3">
                  <div class="h-6 w-20 bg-gray-200 rounded-full"></div>
                  <div class="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
              </div>

              <div class="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div class="p-5 bg-gray-50 rounded-lg">
                  <div class="h-4 w-16 bg-gray-200 rounded mb-2"></div>
                  <div class="h-6 w-24 bg-gray-200 rounded"></div>
                </div>
                <div class="p-5 bg-gray-50 rounded-lg">
                  <div class="h-4 w-20 bg-gray-200 rounded mb-2"></div>
                  <div class="h-6 w-24 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Map Card Skeleton -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="h-6 w-48 bg-gray-200 rounded"></div>
            <div class="px-3 py-1 bg-gray-100 rounded-full">
              <div class="h-4 w-20 bg-gray-200 rounded"></div>
            </div>
          </div>
          <div class="h-[300px] sm:h-[500px] w-full rounded-lg bg-gray-100"></div>
          <div class="mt-3 h-4 w-48 bg-gray-200 rounded"></div>
        </div>
      </div>

      <!-- Forest Products Section Skeleton -->
      <div class="mt-8 sm:mt-12">
        <div class="flex items-center space-x-2 mb-4 sm:mb-6">
          <div class="w-1.5 h-6 bg-gray-200 rounded-full"></div>
          <div class="h-6 w-48 bg-gray-200 rounded"></div>
        </div>

        <!-- Forest Products Table Skeleton -->
        <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <!-- Table Header Skeleton -->
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <div class="h-5 w-32 bg-gray-200 rounded"></div>
          </div>

          <!-- Table Body Skeleton -->
          <div class="overflow-x-auto">
            <!-- Mobile Card View Skeleton -->
            <div class="block sm:hidden">
              <div v-for="n in 5" :key="n" class="p-4 border-b border-gray-200">
                <div class="flex justify-between items-center mb-2">
                  <div class="h-4 w-12 bg-gray-200 rounded"></div>
                  <div class="h-4 w-16 bg-gray-200 rounded"></div>
                </div>
                <div class="h-5 w-32 bg-gray-200 rounded mb-1"></div>
                <div class="h-4 w-24 bg-gray-200 rounded"></div>
              </div>
            </div>

            <!-- Desktop Table View Skeleton -->
            <table class="hidden sm:table min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3"><div class="h-4 w-12 bg-gray-200 rounded"></div></th>
                  <th class="px-6 py-3"><div class="h-4 w-24 bg-gray-200 rounded"></div></th>
                  <th class="px-6 py-3"><div class="h-4 w-20 bg-gray-200 rounded"></div></th>
                  <th class="px-6 py-3"><div class="h-4 w-16 bg-gray-200 rounded"></div></th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="n in 5" :key="n">
                  <td class="px-6 py-4"><div class="h-4 w-12 bg-gray-200 rounded"></div></td>
                  <td class="px-6 py-4"><div class="h-4 w-32 bg-gray-200 rounded"></div></td>
                  <td class="px-6 py-4"><div class="h-4 w-16 bg-gray-200 rounded"></div></td>
                  <td class="px-6 py-4"><div class="h-4 w-16 bg-gray-200 rounded"></div></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Skeleton -->
          <div class="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <div class="h-10 w-10 bg-gray-200 rounded-md"></div>
                <div class="h-10 w-10 bg-gray-200 rounded-md"></div>
                <div class="h-10 w-10 bg-gray-200 rounded-md"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content (only visible when not loading) -->
    <div v-if="!loading && location">
      <!-- Location Info Card -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-4 sm:p-6">
          <div class="flex flex-col items-center md:flex-row md:items-center space-y-4 sm:space-y-6 md:space-y-0 md:space-x-8">
            <!-- Location Icon -->
            <div class="p-3 sm:p-5 bg-blue-100 rounded-full flex items-center justify-center shadow-md">
              <svg class="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>

            <!-- Location Details -->
            <div class="flex-1 w-full">
              <div class="flex flex-col items-center md:flex-row md:items-center justify-between space-y-3 md:space-y-0">
                <h3 class="text-xl sm:text-2xl font-bold text-gray-900 text-center md:text-left">
                  {{ location.name }}
                </h3>
                <div v-if="location.deleted_at" class="flex flex-col items-center md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-3">
                  <span class="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-red-100 text-red-800">
                    Deleted
                  </span>
                  <span class="font-mono text-xs sm:text-sm text-gray-700">
                    {{ formatDate(location.deleted_at) }}
                  </span>
                </div>
              </div>

              <div v-if="location.deleted_at" class="mt-4 sm:mt-6 flex flex-wrap justify-center md:justify-start gap-2 sm:gap-4">
                <AlertDialog>
                  <AlertDialogTrigger>
                    <Button class="p-2 sm:p-3">
                      <img src="@/assets/restore2.png" alt="Restore" class="w-4 h-4 sm:w-5 sm:h-5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Restore Location?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This location will be restored.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction @click="restoreLocation">Restore</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger>
                    <Button class="p-2 sm:p-3">
                      <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Location Permanently?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction @click="deletePermanently">Delete Permanently</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div class="p-4 sm:p-5 bg-gray-50 rounded-lg shadow-md">
                  <p class="text-xs sm:text-sm text-gray-500 text-center md:text-left">Latitude</p>
                  <p class="mt-2 font-mono text-base sm:text-lg text-gray-900 text-center md:text-left">
                    {{ location.latitude }}
                  </p>
                </div>
                <div class="p-4 sm:p-5 bg-gray-50 rounded-lg shadow-md">
                  <p class="text-xs sm:text-sm text-gray-500 text-center md:text-left">Longitude</p>
                  <p class="mt-2 font-mono text-base sm:text-lg text-gray-900 text-center md:text-left">
                    {{ location.longitude }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Map Card -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-4 sm:mt-6">
        <div class="p-4 sm:p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base sm:text-lg font-semibold text-gray-900">
              Map View of {{ location.name }}
            </h3>
            <div class="px-2 sm:px-3 py-1 bg-blue-50 rounded-full">
              <span class="text-xs sm:text-sm text-blue-700">Interactive Map</span>
            </div>
          </div>
          <div
            id="locationMap"
            class="h-[250px] sm:h-[500px] w-full rounded-lg overflow-hidden border border-gray-200 z-0"
          ></div>
          <p class="mt-3 text-xs sm:text-sm text-gray-500">
            Click and drag to pan, use scroll wheel to zoom
          </p>
        </div>
      </div>

      <!-- Forest Products Section -->
      <div v-if="forestProducts.length" class="mt-6 sm:mt-12">
        <div class="flex items-center justify-between space-x-2 mb-4 sm:mb-6">
            <div class="flex items-center space-x-2">
            <div class="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            <h3 class="text-base sm:text-xl font-bold text-gray-800">
              Forest Products in {{ location.name }}
            </h3>
            </div>
          <Button @click="openAddDialog" class="ml-4">
            Add Forest Product
          </Button>
        </div>
        

        <!-- Forest Products Table -->
        <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <!-- Table Header -->
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h4 class="text-sm sm:text-base font-medium text-gray-700">Forest Products</h4>
            </div>
          </div>

          <!-- Table Body - Responsive Design -->
          <div class="overflow-x-auto">
            <!-- Mobile Card View -->
            <div class="block sm:hidden">
              <div v-for="product in paginatedForestProducts" :key="product.id" 
                   class="p-4 border-b border-gray-200 hover:bg-blue-50 transition-colors duration-200"
                   @click="goToForestProduct(product.id)">
                <div class="flex justify-between items-center mb-2">
                  <span class="text-xs font-medium text-blue-600">#{{ product.id }}</span>
                  <span class="text-xs text-gray-500">{{ product.unit_name }}</span>
                </div>
                <div class="text-sm font-medium text-gray-800 mb-1">{{ product.name }}</div>
                <div class="text-xs">
                  <span v-if="product.quantity === null" class="text-red-500 font-semibold">
                    Out of Stock
                  </span>
                  <span v-else class="text-gray-700">
                    Qty: {{ product.quantity }}
                  </span>
                </div>
                <div class="mt-2 flex space-x-2">
                  <Button variant="outline" size="sm" @click.stop="openEditDialog(product)">
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" @click.stop="confirmDelete(product)">
                    Delete
                  </Button>
                </div>
              </div>
            </div>

            <!-- Desktop Table View -->
            <table class="hidden sm:table min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="product in paginatedForestProducts" :key="product.id"
                    class="hover:bg-blue-50 transition-colors duration-200 cursor-pointer"
                    @click="goToForestProduct(product.id)">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    #{{ product.id }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {{ product.name }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <span v-if="product.quantity === null" class="text-red-500 font-semibold">
                      (Out of Stock)
                    </span>
                    <span v-else>
                      {{ product.quantity }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {{ product.unit_name }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex justify-end space-x-2">
                      <Button variant="outline" size="sm" @click.stop="openEditDialog(product)">
                        Edit Quantity
                      </Button>
                      <Button variant="destructive" size="sm" @click.stop="confirmDelete(product)">
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Improved Pagination Controls -->
          <div class="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="text-xs sm:text-sm text-gray-600 hidden sm:block">
                Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentPage * itemsPerPage, forestProducts.length) }} of {{ forestProducts.length }} items
              </div>
              <Pagination
                v-slot="{ page }"
                :total="forestProducts.length"
                :items-per-page="itemsPerPage"
                :sibling-count="1"
                show-edges
                :default-page="currentPage"
                @update:page="(newPage) => {
                  currentPage = newPage;
                }"
                class="w-full sm:w-auto"
              >
                <div class="flex items-center justify-center sm:justify-end gap-2">
                  <!-- Mobile View -->
                  <div class="flex items-center gap-2 sm:hidden">
                    <PaginationPrev class="!w-12 !h-12" />
                    <div class="text-sm font-medium">
                      {{ currentPage }} / {{ Math.ceil(forestProducts.length / itemsPerPage) }}
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
                            item.value === page ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
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
      </div>
    </div>

    <!-- Add Forest Product Dialog -->
    <AlertDialog v-model:open="showAddDialog">
      <AlertDialogContent class="dialog-content">
        <AlertDialogHeader>
          <AlertDialogTitle>Add Forest Product</AlertDialogTitle>
        </AlertDialogHeader>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Product</label>
            <select 
              v-model="selectedProduct"
              class="w-full border rounded-md p-2"
            >
              <option value="" disabled>Select a product</option>
              <option 
                v-for="product in availableForestProducts" 
                :key="product.id" 
                :value="product.id"
              >
                {{ product.name }}
              </option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              v-model.number="quantityInput"
              type="number"
              step="0.01"
              class="w-full border rounded-md p-2"
            >
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel @click="showAddDialog = false">Cancel</AlertDialogCancel>
          <AlertDialogAction @click="addForestProduct">Add Product</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Edit Quantity Dialog -->
    <AlertDialog v-model:open="showEditDialog">
      <AlertDialogContent class="dialog-content">
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Quantity</AlertDialogTitle>
          <AlertDialogDescription v-if="currentProduct">
            Editing {{ currentProduct.name }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input
            v-model.number="quantityInput"
            type="number"
            step="0.01"
            class="w-full border rounded-md p-2"
          >
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel @click="showEditDialog = false">Cancel</AlertDialogCancel>
          <AlertDialogAction @click="updateForestProduct">Update</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Add Delete Confirmation Dialog -->
    <AlertDialog v-model:open="showDeleteConfirmDialog">
      <AlertDialogContent class="dialog-content">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Forest Product in this Location</AlertDialogTitle>
          <AlertDialogDescription v-if="productToDelete">
            Are you sure you want to remove {{ productToDelete.name }} from this location? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel @click="showDeleteConfirmDialog = false">Cancel</AlertDialogCancel>
          <AlertDialogAction @click="deleteForestProduct" variant="destructive">
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Toaster />

  </div>
</template>

<style scoped>
.leaflet-container {
  font-family: inherit;
  z-index: 0;
}

.leaflet-tooltip {
  @apply bg-white px-3 py-1.5 rounded-lg shadow-lg border-none text-sm font-medium !important;
}

.dialog-overlay {
  z-index: 1000 !important;
}

.dialog-content {
  z-index: 1001 !important;
}
</style>
