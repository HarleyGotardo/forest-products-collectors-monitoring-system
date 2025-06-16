<script setup>
import { ref, onMounted, nextTick, computed, watch, onUnmounted } from 'vue'
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
import { isForestRanger, isFPUAdmin } from '@/router/routeGuard'

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

// Add computed property for form validation
const isAddFormValid = computed(() => {
  return selectedProduct.value && quantityInput.value !== '' && quantityInput.value > 0
})

const fetchAvailableForestProducts = async () => {
  try {
    // Get IDs of already added products
    const existingIds = forestProducts.value.map(fp => fp.id)

    // Fetch products not already linked, not deleted, and not soft-deleted
    const { data, error } = await supabase
      .from('forest_products')
      .select(`
        id,
        name,
        measurement_unit_id,
        description,
        created_at,
        measurement_units (
          unit_name
        )
      `)
      .is('deleted_at', null)
      .not('id', 'in', `(${existingIds.length > 0 ? existingIds.join(',') : '0'})`)

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

    // First check if the product exists and is not deleted
    const { data: product, error: productError } = await supabase
      .from('forest_products')
      .select('id')
      .eq('id', selectedProduct.value)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      throw new Error('Selected product is not available')
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

    // Refresh both lists
    await Promise.all([
      fetchForestProducts(),
      fetchAvailableForestProducts()
    ])
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
    .select(`
      *,
      fp_and_locations (
        id,
        collection_request_items (
          id
        ),
        collection_record_items (
          id
        )
      )
    `)
    .eq('id', locationId)
    .single()

  if (fetchError) {
    error.value = fetchError.message
  } else {
    location.value = data
  }
}

const fetchForestProducts = async () => {
  try {
    // First fetch the fp_and_locations entries for this location
    let { data: fpLocations, error: fetchError } = await supabase
      .from('fp_and_locations')
      .select(`
        id,
        quantity,
        forest_product:forest_products (
          id,
          name,
          measurement_unit_id,
          deleted_at
        )
      `)
      .eq('location_id', locationId)
      .is('forest_products.deleted_at', null)

    if (fetchError) {
      error.value = fetchError.message
      return
    }

    // Filter out entries where the forest product is null or deleted
    const validEntries = fpLocations.filter(item =>
      item.forest_product &&
      item.forest_product.deleted_at === null
    )

    if (validEntries.length === 0) {
      forestProducts.value = []
      return
    }

    // Get all unique measurement unit IDs
    const measurementUnitIds = validEntries
      .map(item => item.forest_product.measurement_unit_id)
      .filter((id, index, self) => self.indexOf(id) === index)

    // Fetch measurement units
    const { data: units, error: unitsError } = await supabase
      .from('measurement_units')
      .select('id, unit_name')
      .in('id', measurementUnitIds)

    if (unitsError) {
      error.value = unitsError.message
      return
    }

    // Create a map of measurement units for quick lookup
    const unitsMap = new Map(units.map(unit => [unit.id, unit.unit_name]))

    // Transform the data into the format we need
    forestProducts.value = validEntries.map(item => ({
      fp_and_locations_id: item.id,
      id: item.forest_product.id,
      name: item.forest_product.name,
      quantity: item.quantity,
      unit_name: unitsMap.get(item.forest_product.measurement_unit_id) || 'N/A'
    }))

  } catch (err) {
    error.value = err.message
    toast.error('Failed to fetch forest products: ' + err.message)
  }
}

const initializeMap = () => {
  // Only initialize if we have location data
  if (!location.value) return;

  // Wait for next tick to ensure DOM is updated
  nextTick(() => {
    const mapContainer = document.getElementById('locationMap');
    if (!mapContainer) return;

    // Clean up existing map instance if it exists
    if (mapInstance.value) {
      mapInstance.value.remove();
      mapInstance.value = null;
    }

    const lat = location.value.latitude;
    const lng = location.value.longitude;

    // Create new map with proper options
    mapInstance.value = L.map('locationMap', {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: true
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance.value);

    // Add marker with custom styling
    const marker = L.marker([lat, lng], {
      title: location.value.name
    }).addTo(mapInstance.value);

    // Add tooltip with custom styling
    marker.bindTooltip(location.value.name, {
      permanent: true,
      direction: 'top',
      className: 'bg-white px-2 py-1 rounded shadow-lg'
    });

    // Force a resize event to ensure proper rendering
    setTimeout(() => {
      mapInstance.value.invalidateSize();
    }, 100);

    mapInitialized.value = true;
  });
}

// Update onMounted to handle map initialization
onMounted(async () => {
  loading.value = true;

  try {
    // Check if location exists
    const { data: locationData, error } = await supabase
      .from('locations')
      .select('id')
      .eq('id', route.params.id)
      .single();

    if (error || !locationData) {
      router.push('/authenticated/locations');
      toast.error('Location not found');
      return;
    }

    // If location exists, fetch the details
    await fetchLocation();

    // Fetch forest products after location is loaded
    await fetchForestProducts();

    loading.value = false;

    // Initialize map after a short delay
    setTimeout(() => {
      if (location.value) {
        initializeMap();
      }
    }, 300);
  } catch (err) {
    error.value = err.message;
    toast.error('Failed to load location: ' + err.message);
    loading.value = false;
  }
});

// Add watcher for location changes
watch(() => location.value, (newLocation) => {
  if (newLocation && !loading.value) {
    setTimeout(() => {
      initializeMap();
    }, 300);
  }
}, { immediate: true });

// Add cleanup on component unmount
onUnmounted(() => {
  if (mapInstance.value) {
    mapInstance.value.remove();
    mapInstance.value = null;
  }
});

// Add resize handler
const handleResize = () => {
  if (mapInstance.value) {
    mapInstance.value.invalidateSize();
  }
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

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

// Add these computed properties and functions
const hasAssociatedRecords = computed(() => {
  if (!location.value) return false;
  return location.value.fp_and_locations?.some(fp =>
    (fp.collection_request_items?.length > 0) ||
    (fp.collection_record_items?.length > 0)
  );
});

const editLocation = () => {
  router.push(`/authenticated/locations/${locationId}/edit`)
}

const deleteLocation = async () => {
  const currentDate = new Date().toISOString()

  try {
    const { error: deleteError } = await supabase
      .from('locations')
      .update({ deleted_at: currentDate })
      .eq('id', locationId)

    if (deleteError) throw deleteError

    toast.success('Location deleted successfully')
    router.push('/authenticated/locations')
  } catch (err) {
    toast.error('Failed to delete location: ' + err.message)
  }
}

// Add this new function to handle input validation
const handleQuantityInput = (event) => {
  // Remove any 'e' or 'E' characters
  let value = event.target.value.replace(/[eE]/g, '')

  // Only allow numbers and one decimal point
  if (value === '' || /^\d*\.?\d*$/.test(value)) {
    quantityInput.value = value
  } else {
    // If invalid input, revert to previous valid value
    event.target.value = quantityInput.value
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-3">
    <!-- Header Section with Actions -->
    <div class="mb-4 sm:mb-6 flex items-center justify-between">
      <div class="flex items-center space-x-4">
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

      <!-- Action Buttons -->
      <div v-if="!loading" class="flex items-center space-x-2">
        <!-- Edit and Delete buttons for non-deleted locations -->
        <template v-if="!location?.deleted_at && (isForestRanger || isFPUAdmin)">
          <Button
            @click="editLocation"
            class="p-2"
            title="Edit location"
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

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                class="p-2" 
                title="Delete location"
                :disabled="hasAssociatedRecords"
                :class="{ 'opacity-50 cursor-not-allowed': hasAssociatedRecords }"
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
                <AlertDialogTitle>Delete Location?</AlertDialogTitle>
                <AlertDialogDescription>
                  {{ hasAssociatedRecords 
                    ? 'This location cannot be deleted because it has associated collection records or requests.' 
                    : 'This location will be transferred to the recycle bin.' }}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  @click="deleteLocation"
                  :disabled="hasAssociatedRecords"
                  class="bg-red-900 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </template>

        <!-- Restore and Delete Permanently buttons for deleted locations -->
        <template v-if="location?.deleted_at && (isForestRanger || isFPUAdmin)">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button class="p-2" title="Restore location">
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
            <AlertDialogTrigger asChild>
              <Button class="p-2" title="Delete permanently">
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
        </template>
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
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <p class="ml-3 text-sm">{{ error }}</p>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="animate-pulse">
      <!-- Location Info Card Skeleton -->
      <div
        class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="p-4 sm:p-6">
          <div
            class="flex flex-col items-center md:flex-row md:items-center space-y-4 sm:space-y-6 md:space-y-0 md:space-x-8"
          >
            <!-- Location Icon Skeleton -->
            <div
              class="p-3 sm:p-5 bg-blue-100 rounded-full flex items-center justify-center shadow-md"
            >
              <div
                class="w-8 h-8 sm:w-10 sm:h-10 bg-gray-200 rounded-full"
              ></div>
            </div>

            <!-- Location Details Skeleton -->
            <div class="flex-1 w-full">
              <div
                class="flex flex-col items-center md:flex-row md:items-center justify-between space-y-3 md:space-y-0"
              >
                <div class="h-8 w-48 bg-gray-200 rounded"></div>
                <div class="flex items-center space-x-3">
                  <div class="h-6 w-20 bg-gray-200 rounded-full"></div>
                  <div class="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
              </div>

              <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div class="p-4 sm:p-5 bg-gray-50 rounded-lg shadow-md">
                  <div class="h-4 w-16 bg-gray-200 rounded mb-2"></div>
                  <div class="h-6 w-24 bg-gray-200 rounded"></div>
                </div>
                <div class="p-4 sm:p-5 bg-gray-50 rounded-lg shadow-md">
                  <div class="h-4 w-20 bg-gray-200 rounded mb-2"></div>
                  <div class="h-6 w-24 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Map Card Skeleton -->
      <div
        class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-4 sm:mt-6"
      >
        <div class="p-4 sm:p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="h-6 w-48 bg-gray-200 rounded"></div>
            <div class="px-2 sm:px-3 py-1 bg-blue-50 rounded-full">
              <div class="h-4 w-20 bg-gray-200 rounded"></div>
            </div>
          </div>
          <div
            class="h-[300px] sm:h-[600px] lg:h-[700px] w-full rounded-lg bg-gray-100"
          ></div>
          <div class="mt-3 text-center sm:text-left">
            <div class="h-4 w-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>

      <!-- Forest Products Section Skeleton -->
      <div class="mt-6 sm:mt-12">
        <div class="flex items-center justify-between space-x-2 mb-4 sm:mb-6">
          <div class="flex items-center space-x-2">
            <div class="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            <div class="h-6 w-48 bg-gray-200 rounded"></div>
          </div>
          <div class="h-10 w-32 bg-gray-200 rounded-md"></div>
        </div>

        <!-- Forest Products Table Skeleton -->
        <div
          class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <!-- Table Header Skeleton -->
          <div
            class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200"
          >
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
                <div class="mt-2 flex space-x-2">
                  <div class="h-8 w-16 bg-gray-200 rounded"></div>
                  <div class="h-8 w-16 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>

            <!-- Desktop Table View Skeleton -->
            <table class="hidden sm:table min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3">
                    <div class="h-4 w-12 bg-gray-200 rounded"></div>
                  </th>
                  <th class="px-6 py-3">
                    <div class="h-4 w-24 bg-gray-200 rounded"></div>
                  </th>
                  <th class="px-6 py-3">
                    <div class="h-4 w-20 bg-gray-200 rounded"></div>
                  </th>
                  <th class="px-6 py-3">
                    <div class="h-4 w-16 bg-gray-200 rounded"></div>
                  </th>
                  <th class="px-6 py-3">
                    <div class="h-4 w-24 bg-gray-200 rounded"></div>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="n in 5" :key="n">
                  <td class="px-6 py-4">
                    <div class="h-4 w-12 bg-gray-200 rounded"></div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="h-4 w-32 bg-gray-200 rounded"></div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="h-4 w-16 bg-gray-200 rounded"></div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="h-4 w-16 bg-gray-200 rounded"></div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex justify-end space-x-2">
                      <div class="h-8 w-20 bg-gray-200 rounded"></div>
                      <div class="h-8 w-20 bg-gray-200 rounded"></div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Skeleton -->
          <div
            class="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200"
          >
            <div
              class="flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div class="hidden sm:block">
                <div class="h-4 w-48 bg-gray-200 rounded"></div>
              </div>
              <div class="flex items-center gap-2">
                <div class="h-10 w-10 bg-gray-200 rounded-md"></div>
                <div class="h-10 w-10 bg-gray-200 rounded-md"></div>
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
      <div
        class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="p-4 sm:p-6">
          <div
            class="flex flex-col items-center md:flex-row md:items-center space-y-4 sm:space-y-6 md:space-y-0 md:space-x-8"
          >
            <!-- Location Icon -->
            <div
              class="p-3 sm:p-5 bg-blue-100 rounded-full flex items-center justify-center shadow-md"
            >
              <svg
                class="w-8 h-8 sm:w-10 sm:h-10 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
            <div class="flex-1 w-full">
              <div
                class="flex flex-col items-center md:flex-row md:items-center justify-between space-y-3 md:space-y-0"
              >
                <h3
                  class="text-xl sm:text-2xl font-bold text-gray-900 text-center md:text-left"
                >
                  {{ location.name }}
                </h3>
                <div
                  v-if="location.deleted_at"
                  class="flex flex-col items-center md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-3"
                >
                  <span
                    class="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-red-100 text-red-800"
                  >
                    Deleted
                  </span>
                  <span class="font-mono text-xs sm:text-sm text-gray-700">
                    {{ formatDate(location.deleted_at) }}
                  </span>
                </div>
              </div>

              <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div class="p-4 sm:p-5 bg-gray-50 rounded-lg shadow-md">
                  <p
                    class="text-xs sm:text-sm text-gray-500 text-center md:text-left"
                  >
                    Latitude
                  </p>
                  <p
                    class="mt-2 font-mono text-base sm:text-lg text-gray-900 text-center md:text-left"
                  >
                    {{ location.latitude }}
                  </p>
                </div>
                <div class="p-4 sm:p-5 bg-gray-50 rounded-lg shadow-md">
                  <p
                    class="text-xs sm:text-sm text-gray-500 text-center md:text-left"
                  >
                    Longitude
                  </p>
                  <p
                    class="mt-2 font-mono text-base sm:text-lg text-gray-900 text-center md:text-left"
                  >
                    {{ location.longitude }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Map Card -->
      <div
        class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-4 sm:mt-6"
      >
        <div class="p-4 sm:p-6">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 mb-4 sm:mb-6">
            <div class="flex items-center space-x-2">
              <div class="w-1 h-10 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
              <h3 class="text-lg sm:text-xl font-semibold text-gray-900">
              {{ location.name }}
              <span class="block text-sm font-normal text-gray-500 mt-0.5">Geographic Location</span>
              </h3>
            </div>
            <div class="flex items-center space-x-2 text-blue-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span class="text-sm font-medium">Interactive Map</span>
            </div>
            </div>
          <div
            id="locationMap"
            class="h-[300px] sm:h-[600px] lg:h-[700px] w-full rounded-lg overflow-hidden border border-gray-200 z-0 relative"
            style="min-height: 300px; background-color: #f3f4f6"
          ></div>
          <p
            class="mt-3 text-xs sm:text-sm text-gray-500 text-center sm:text-left"
          >
            Click and drag to pan, use scroll wheel to zoom
          </p>
        </div>
      </div>

    <!-- Forest Products Section -->
  <div class="mt-6 sm:mt-8 lg:mt-12">
    <!-- Section Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div class="flex items-center space-x-3">
        <div class="w-1 h-6 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-full"></div>
        <h3 class="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">
          Forest Products in {{ location.name }}
        </h3>
      </div>
      <Button
        v-if="isFPUAdmin || isForestRanger"
        @click="openAddDialog"
        class="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 text-sm"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        Add Product
      </Button>
    </div>

    <!-- Forest Products Content -->
    <div v-if="forestProducts.length" class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <!-- Table Header - Desktop Only -->
      <div class="hidden sm:block bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-medium text-gray-700">Forest Products Inventory</h4>
          <span class="text-xs text-gray-500">{{ forestProducts.length }} items total</span>
        </div>
      </div>

      <!-- Content Area -->
      <div class="overflow-hidden">
        <!-- Mobile Card View -->
        <div class="sm:hidden divide-y divide-gray-100">
          <div
            v-for="product in paginatedForestProducts"
            :key="product.id"
            class="p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer active:bg-gray-100"
            @click="goToForestProduct(product.id)"
          >
            <!-- Mobile Card Header -->
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center space-x-2">
                <span class="inline-flex items-center px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium">
                  #{{ product.id }}
                </span>
                <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                  {{ product.unit_name }}
                </span>
              </div>
              <div class="flex items-center space-x-1" v-if="isForestRanger || isFPUAdmin">
                <button
                  @click.stop="openEditDialog(product)"
                  class="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                  title="Edit"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                  </svg>
                </button>
                <button
                  @click.stop="confirmDelete(product)"
                  class="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                  title="Delete"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Mobile Card Content -->
            <div class="space-y-2">
              <h4 class="font-medium text-gray-900 text-base leading-tight">
                {{ product.name }}
              </h4>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600">Quantity:</span>
                <div class="text-right">
                  <span
                    v-if="product.quantity === null"
                    class="inline-flex items-center px-2 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium"
                  >
                    Out of Stock
                  </span>
                  <span v-else class="font-medium text-gray-900">
                    {{ new Intl.NumberFormat().format(product.quantity) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Desktop Table View -->
        <div class="hidden sm:block overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product Name
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th v-if="isForestRanger || isFPUAdmin" scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr
                v-for="product in paginatedForestProducts"
                :key="product.id"
                class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                @click="goToForestProduct(product.id)"
              >
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium">
                    #{{ product.id }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{{ product.name }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">
                    <span
                      v-if="product.quantity === null"
                      class="inline-flex items-center px-2 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium"
                    >
                      Out of Stock
                    </span>
                    <span v-else class="font-medium">
                      {{ new Intl.NumberFormat().format(product.quantity) }}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                    {{ product.unit_name }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right" v-if="isForestRanger || isFPUAdmin">
                  <div class="flex justify-end items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      @click.stop="openEditDialog(product)"
                      class="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors"
                    >
                      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                      </svg>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      @click.stop="confirmDelete(product)"
                      class="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium transition-colors border border-red-200"
                    >
                      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Enhanced Pagination -->
      <div class="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
          <!-- Results Info - Hidden on mobile -->
          <div class="hidden sm:block text-sm text-gray-600">
            Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to
            {{ Math.min(currentPage * itemsPerPage, forestProducts.length) }}
            of {{ forestProducts.length }} products
          </div>

          <!-- Pagination Component -->
          <Pagination
            v-slot="{ page }"
            :total="forestProducts.length"
            :items-per-page="itemsPerPage"
            :sibling-count="1"
            show-edges
            :default-page="currentPage"
            @update:page="(newPage) => { currentPage = newPage; }"
            class="w-full sm:w-auto"
          >
            <div class="flex items-center justify-center sm:justify-end">
              <!-- Mobile Pagination -->
              <div class="flex items-center gap-3 sm:hidden">
                <PaginationPrev class="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600" />
                <div class="flex items-center px-3 py-1 bg-white rounded-lg border border-gray-300">
                  <span class="text-sm font-medium text-gray-900">
                    {{ currentPage }} of {{ Math.ceil(forestProducts.length / itemsPerPage) }}
                  </span>
                </div>
                <PaginationNext class="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600" />
              </div>

              <!-- Desktop Pagination -->
              <div class="hidden sm:flex items-center gap-1">
                <PaginationFirst class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-600" />
                <PaginationPrev class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-600" />
                <PaginationList v-slot="{ items }" class="flex items-center gap-1">
                  <template v-for="(item, index) in items">
                    <PaginationListItem
                      v-if="item.type === 'page'"
                      :key="index"
                      :value="item.value"
                      :class="[
                        'flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                        item.value === page 
                          ? 'bg-emerald-600 text-white shadow-sm' 
                          : 'text-gray-700 hover:bg-gray-100'
                      ]"
                    >
                      {{ item.value }}
                    </PaginationListItem>
                    <PaginationEllipsis
                      v-else
                      :key="item.type"
                      :index="index"
                      class="flex items-center justify-center w-8 h-8 text-gray-400"
                    />
                  </template>
                </PaginationList>
                <PaginationNext class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-600" />
                <PaginationLast class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-600" />
              </div>
            </div>
          </Pagination>
        </div>
      </div>
    </div>

    <!-- Enhanced Empty State -->
    <div
      v-else
      class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <div class="px-6 py-12 text-center">
        <div class="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No Forest Products Available</h3>
        <p class="text-gray-500 mb-6 max-w-sm mx-auto">
          This location doesn't have any forest products yet. Add some products to get started with inventory management.
        </p>
        <!-- <Button
          v-if="isFPUAdmin || isForestRanger"
          @click="openAddDialog"
          class="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Add First Product
        </Button> -->
      </div>
    </div>
  </div>

    <!-- Add Forest Product Dialog -->
    <AlertDialog v-model:open="showAddDialog">
      <AlertDialogContent class="dialog-content">
        <AlertDialogHeader>
          <AlertDialogTitle class="flex items-center gap-2 text-lg">
            <svg
              class="w-5 h-5 text-emerald-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add Forest Product
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Product</label
            >
            <select
              v-model="selectedProduct"
              class="w-full border rounded-md p-2"
              :class="{ 'border-red-500': showAddDialog && !selectedProduct }"
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
            <p
              v-if="showAddDialog && !selectedProduct"
              class="mt-1 text-sm text-red-500"
            >
              Please select a product
            </p>
          </div>

          <div v-if="selectedProduct">
            <div class="bg-gray-100 rounded-lg p-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p
                    class="text-sm font-bold text-emerald-700 flex items-center gap-2"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    Product ID
                  </p>
                  <p class="text-lg font-normal text-gray-900">
                    {{ selectedProduct }}
                  </p>
                </div>
                <div>
                  <p
                    class="text-sm font-bold text-emerald-700 flex items-center gap-2"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                    Product Name
                  </p>
                  <p class="text-lg font-normal text-gray-900">
                    {{ availableForestProducts.find(p => p.id === selectedProduct)?.name }}
                  </p>
                </div>
                <div>
                  <p
                    class="text-sm font-bold text-emerald-700 flex items-center gap-2"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                      />
                    </svg>
                    Measurement Unit
                  </p>
                  <p class="text-lg font-normal text-gray-900">
                    {{ availableForestProducts.find(p => p.id === selectedProduct)?.measurement_units?.unit_name }}
                  </p>
                </div>
                <div>
                  <p
                    class="text-sm font-bold text-emerald-700 flex items-center gap-2"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 6h16M4 10h16M4 14h16M4 18h16"
                      />
                    </svg>
                    Description
                  </p>
                  <div class="max-h-24 overflow-y-auto pr-2 custom-scrollbar">
                    <p class="text-lg font-normal text-gray-900">
                      {{ availableForestProducts.find(p => p.id === selectedProduct)?.description || 'N/A' }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Quantity
              <span v-if="selectedProduct" class="text-gray-500">
                (in
                {{ availableForestProducts.find(p => p.id === selectedProduct)?.measurement_units?.unit_name
                }})
              </span>
            </label>
            <input
              :value="quantityInput"
              @input="handleQuantityInput"
              type="text"
              inputmode="decimal"
              class="w-full border rounded-md p-2"
              :disabled="!selectedProduct"
              :class="{ 
                'border-red-500': showAddDialog && (!quantityInput || parseFloat(quantityInput) <= 0),
                'bg-gray-100': !selectedProduct,
                'cursor-not-allowed': !selectedProduct
              }"
            />
            <p
              v-if="showAddDialog && (!quantityInput || parseFloat(quantityInput) <= 0)"
              class="mt-1 text-sm text-red-500"
            >
              Please enter a valid quantity greater than 0
            </p>
            <p v-if="!selectedProduct" class="mt-1 text-sm text-gray-500">
              Please select a product first
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel @click="showAddDialog = false"
            >Cancel</AlertDialogCancel
          >
          <AlertDialogAction
            @click="addForestProduct"
            :disabled="!isAddFormValid"
            :class="{ 'opacity-50 cursor-not-allowed': !isAddFormValid }"
          >
            Add Product
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Edit Quantity Dialog -->
    <AlertDialog v-model:open="showEditDialog">
      <AlertDialogContent
        class="dialog-content bg-white rounded-2xl shadow-xl border-0"
      >
        <AlertDialogHeader>
          <AlertDialogTitle class="flex items-center gap-2 text-lg">
            <svg
              class="w-5 h-5 text-emerald-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            Edit Quantity
          </AlertDialogTitle>
          <AlertDialogDescription v-if="currentProduct" class="mt-3">
            <div class="bg-gray-50 rounded-xl p-4 space-y-2">
              <div class="flex items-center gap-2">
                <svg
                  class="w-4 h-4 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <span
                  class="text-gray-700 font-medium"
                  >{{ currentProduct.name }}</span
                >
              </div>
              <div class="flex items-center gap-2">
                <svg
                  class="w-4 h-4 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                  />
                </svg>
                <span class="text-gray-500"
                  >Measured in {{ currentProduct.unit_name }}</span
                >
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div class="mt-6">
          <label class="block text-sm font-medium text-gray-700 mb-2"
            >New Quantity</label
          >
          <div class="relative">
            <input
              v-model.number="quantityInput"
              type="number"
              step="0.01"
              class="w-full px-4 py-3 rounded-full border border-gray-200 focus:border-emerald-500 focus:ring focus:ring-emerald-200 focus:ring-opacity-50 transition-all duration-200 outline-none"
              placeholder="Enter new quantity..."
            />
            <div
              class="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none"
            >
              <span class="text-gray-400">{{ currentProduct?.unit_name }}</span>
            </div>
          </div>
        </div>

        <AlertDialogFooter class="mt-6 space-x-3">
          <AlertDialogCancel
            class="px-6 py-2.5 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors duration-200"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            @click="updateForestProduct"
            class="px-6 py-2.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors duration-200"
          >
            Update Quantity
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Add Delete Confirmation Dialog -->
    <AlertDialog v-model:open="showDeleteConfirmDialog">
      <AlertDialogContent class="dialog-content">
        <AlertDialogHeader>
          <AlertDialogTitle
            >Remove Forest Product in this Location</AlertDialogTitle
          >
          <AlertDialogDescription v-if="productToDelete">
            Are you sure you want to remove {{ productToDelete.name }} from this
            location? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel @click="showDeleteConfirmDialog = false"
            >Cancel</AlertDialogCancel
          >
          <AlertDialogAction @click="deleteForestProduct" variant="destructive">
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

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
</div>
</template>

<style scoped>
.leaflet-container {
  font-family: inherit;
  z-index: 0;
  width: 100%;
  height: 100%;
  background-color: #f3f4f6;
}

.leaflet-tooltip {
  @apply bg-white px-3 py-1.5 rounded-lg shadow-lg border-none text-sm font-medium !important;
}

.leaflet-popup-content {
  @apply text-sm !important;
}

.leaflet-popup-tip {
  @apply bg-white !important;
}

.leaflet-control-attribution {
  @apply text-xs !important;
}

.dialog-overlay {
  z-index: 1000 !important;
}

.dialog-content {
  z-index: 1001 !important;
}

/* Add styles for disabled button */
:deep(.opacity-50) {
  opacity: 0.5;
}

:deep(.cursor-not-allowed) {
  cursor: not-allowed;
}

/* Custom scrollbar styles */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
