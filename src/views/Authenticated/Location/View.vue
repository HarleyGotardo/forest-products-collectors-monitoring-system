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
      forest_product:forest_products ( id, name, measurement_unit_id ),
      quantity
    `)
    .eq('location_id', locationId)
    .then(async ({ data }) => {
      const productIds = data.map(item => item.forest_product.measurement_unit_id);
      const { data: units, error: unitsError } = await supabase
        .from('measurement_units')
        .select('id, unit_name')
        .in('id', productIds);

      if (unitsError) {
        error.value = unitsError.message;
      } else {
        forestProducts.value = data.map(item => ({
          ...item.forest_product,
          quantity: item.quantity,
          unit_name: units.find(unit => unit.id === item.forest_product.measurement_unit_id)?.unit_name
        }));
      }
    });

  if (fetchError) {
    error.value = fetchError.message;
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
  <div class="max-w-4xl mx-auto p-6">
    <!-- Header Section -->
    <div class="mb-6 flex items-center space-x-4">
      <img src="@/assets/location2.png" alt="Location" class="w-16 h-16" />
      <div>
        <h2 class="text-xl font-bold text-gray-900">Location Details</h2>
        <p class="text-sm text-gray-600">
          Detailed information about this location
        </p>
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
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 101.414 1.414L10 11.414l1.293 1.293a1 1 001.414-1.414L11.414 10l1.293-1.293a1 1 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <p class="ml-3">{{ error }}</p>
      </div>
    </div>

<!-- Loading Skeleton -->
<div v-if="loading">
  <!-- Location Card Skeleton -->
  <div
    class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
  >
    <div class="p-6">
      <div
        class="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6"
      >
        <!-- Location Icon Skeleton -->
        <div
          class="p-4 bg-gray-100 rounded-full flex items-center justify-center animate-pulse"
        >
          <div class="w-8 h-8 rounded-full bg-gray-200"></div>
        </div>

        <!-- Location Details Skeleton -->
        <div class="flex-1 w-full">
          <div class="flex items-center justify-between">
            <div class="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
            <div class="h-6 bg-gray-200 rounded w-1/4 animate-pulse"></div>
          </div>

          <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="p-4 bg-gray-50 rounded-lg">
              <div
                class="h-4 bg-gray-200 rounded w-1/3 mb-2 animate-pulse"
              ></div>
              <div
                class="h-6 bg-gray-200 rounded w-1/2 animate-pulse"
              ></div>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg">
              <div
                class="h-4 bg-gray-200 rounded w-1/3 mb-2 animate-pulse"
              ></div>
              <div
                class="h-6 bg-gray-200 rounded w-1/2 animate-pulse"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Map Card Skeleton -->
  <div
    class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6"
  >
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="h-6 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div class="px-3 py-1 bg-gray-100 rounded-full">
          <div class="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
        </div>
      </div>
      <div
        class="h-[500px] w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-100 animate-pulse"
      ></div>
      <div class="mt-3 h-4 bg-gray-200 rounded w-2/3 animate-pulse"></div>
    </div>
  </div>
  
  <!-- Forest Products Table Skeleton -->
  <div
    class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6"
  >
    <!-- Table Header Skeleton -->
    <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <div class="h-5 bg-gray-200 rounded w-1/4 animate-pulse"></div>
      </div>
    </div>

    <!-- Table Body Skeleton -->
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3.5 text-left">
              <div class="h-3 bg-gray-200 rounded w-10 animate-pulse"></div>
            </th>
            <th scope="col" class="px-6 py-3.5 text-left">
              <div class="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
            </th>
            <th scope="col" class="px-6 py-3.5 text-left">
              <div class="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
            </th>
            <th scope="col" class="px-6 py-3.5 text-left">
              <div class="h-3 bg-gray-200 rounded w-14 animate-pulse"></div>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <!-- Skeleton rows -->
          <tr v-for="i in 5" :key="i" class="hover:bg-blue-50 transition-colors duration-200">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="h-4 bg-gray-200 rounded w-14 animate-pulse"></div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

    <!-- Main Content (only visible when not loading) -->
    <div v-if="!loading && location">
      <!-- Location Info Card -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-6">
          <div class="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
            <!-- Location Icon -->
            <div class="p-4 bg-blue-50 rounded-full flex items-center justify-center">
              <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>

            <!-- Location Details -->
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <h3 class="text-2xl font-semibold text-gray-900">
                  {{ location.name }}
                </h3>
                <div v-if="location.deleted_at" class="flex items-center space-x-2">
                  <p class="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    Deleted
                  </p>
                  <p class="font-mono text-gray-900">
                    {{ formatDate(location.deleted_at) }}
                  </p>
                </div>
              </div>

              <div v-if="location.deleted_at" class="mt-4 flex space-x-4">
                <AlertDialog>
                  <AlertDialogTrigger>
                    <Button class="flex items-center space-x-2">
                      <img src="@/assets/restore2.png" alt="Restore" class="w-5 h-5" />
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
                    <Button class="flex items-center space-x-2">
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

              <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="p-4 bg-gray-50 rounded-lg">
                  <p class="text-sm text-gray-500">Latitude</p>
                  <p class="mt-1 font-mono text-gray-900">
                    {{ location.latitude }}
                  </p>
                </div>
                <div class="p-4 bg-gray-50 rounded-lg">
                  <p class="text-sm text-gray-500">Longitude</p>
                  <p class="mt-1 font-mono text-gray-900">
                    {{ location.longitude }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Map Card -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Map View</h3>
            <div class="px-3 py-1 bg-blue-50 rounded-full">
              <span class="text-sm text-blue-700">Interactive Map</span>
            </div>
          </div>
          <div
            id="locationMap"
            class="h-[500px] w-full rounded-lg overflow-hidden border border-gray-200 z-0"
          ></div>
          <p class="mt-3 text-sm text-gray-500">
            Click and drag to pan, use scroll wheel to zoom
          </p>
        </div>
      </div>

      <!-- Forest Products Section -->
      <div v-if="forestProducts.length" class="mt-12">
        <div class="flex items-center space-x-2 mb-6">
          <div class="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
          <h3 class="text-xl font-bold text-gray-800">
            Forest Products in {{ location.name }}
          </h3>
        </div>

        <!-- Forest Products Table -->
        <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <!-- Table Header -->
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h4 class="font-medium text-gray-700">Forest Products</h4>
            </div>
          </div>

          <!-- Table Body -->
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    ID
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Quantity
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Unit
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr
                  v-for="product in paginatedForestProducts"
                  :key="product.id"
                  class="hover:bg-blue-50 transition-colors duration-200 cursor-pointer"
                  @click="goToForestProduct(product.id)"
                >
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    #{{ product.id }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {{ product.name }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {{ product.quantity }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {{ product.unit_name }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Controls -->
          <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div class="flex items-center justify-between">
              <button
                @click="prevPage"
                :disabled="currentPage === 1"
                class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                :class="currentPage === 1 ? 'text-gray-400' : 'text-gray-700'"
              >
                <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <div class="flex items-center px-4 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
                <span class="text-sm font-medium text-gray-700">Page {{ currentPage }} of {{ totalPages }}</span>
              </div>

              <button
                @click="nextPage"
                :disabled="currentPage === totalPages"
                class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                :class="currentPage === totalPages ? 'text-gray-400' : 'text-gray-700'"
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
    </div>

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