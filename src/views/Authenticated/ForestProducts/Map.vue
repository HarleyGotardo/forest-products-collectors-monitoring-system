<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from '@/lib/supabaseClient'
import Button from "@/components/ui/button/Button.vue";

// Fix for the default icon issue
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const locations = ref([])
const filteredLocations = ref([])
const showModal = ref(false)
const selectedLocation = ref(null)
const selectedLocationProducts = ref([])
const currentPage = ref(1)
const itemsPerPage = 3
const searchQuery = ref('')
const router = useRouter()
const route = useRoute()
const isSearching = ref(false)
const mapMarkers = ref([])
let map

const goToForestProduct = (forestProductId) => {
  router.push({
    name: 'ForestProductsView',
    params: { id: forestProductId },
  })
}

const createLocation = () => {
  router.push('/authenticated/locations/create')
}

const fetchLocationsWithProducts = async () => {
  isSearching.value = true
  try {
    let { data, error } = await supabase
      .from('locations')
      .select(`
        id,
        name,
        latitude,
        longitude,
        fp_and_locations (
          forest_product_id,
          quantity,
          forest_products (
            id,
            name,
            description,
            type,
            price_based_on_measurement_unit,
            measurement_unit_id,
            measurement_units (
              unit_name
            )
          )
        )
      `)

    if (error) {
      console.error('Error fetching locations:', error)
    } else {
      locations.value = data
      filteredLocations.value = data
    }
  } finally {
    isSearching.value = false
  }
}

const showLocationDetails = async (location) => {
  selectedLocation.value = location
  currentPage.value = 1

  // Transform the nested data structure
  selectedLocationProducts.value = location.fp_and_locations
    .map(fp => ({
      ...fp.forest_products,
      quantity: fp.quantity
    }))
    .filter(Boolean)

  showModal.value = true

  // Update URL with state
  router.replace({
    query: {
      ...route.query,
      modal: 'true',
      locationId: location.id,
      page: currentPage.value
    }
  })
}

const closeModal = () => {
  showModal.value = false

  // Remove modal params from URL
  const query = { ...route.query }
  delete query.modal
  delete query.locationId
  delete query.page
  router.replace({ query })
}

const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return selectedLocationProducts.value.slice(start, end)
})

const totalPages = computed(() =>
  Math.ceil(selectedLocationProducts.value.length / itemsPerPage)
)

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    updatePageInUrl()
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    updatePageInUrl()
  }
}

const updatePageInUrl = () => {
  router.replace({
    query: {
      ...route.query,
      page: currentPage.value
    }
  })
}

const searchLocation = () => {
  if (!searchQuery.value.trim()) {
    filteredLocations.value = locations.value
    renderAllMarkers()
    return
  }

  const query = searchQuery.value.toLowerCase().trim()
  filteredLocations.value = locations.value.filter(loc =>
    loc.name.toLowerCase().includes(query)
  )

  renderFilteredMarkers()

  if (filteredLocations.value.length === 1) {
    const location = filteredLocations.value[0]
    if (location && location.latitude && location.longitude) {
      map.setView([location.latitude, location.longitude], 16)
    }
  } else if (filteredLocations.value.length > 1) {
    // Create bounds for all filtered locations
    const bounds = L.latLngBounds(
      filteredLocations.value
        .filter(loc => loc.latitude && loc.longitude)
        .map(loc => [loc.latitude, loc.longitude])
    )

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }
}

const renderAllMarkers = () => {
  // Clear existing markers
  mapMarkers.value.forEach(marker => marker.remove())
  mapMarkers.value = []

  // Add markers for all locations
  locations.value.forEach(location => {
    if (location.latitude && location.longitude) {
      const marker = L.marker([location.latitude, location.longitude])
        .addTo(map)
        .bindTooltip(location.name, {
          permanent: false,
          direction: 'top',
          offset: [0, -32],
          className: 'bg-white px-2 py-1 rounded shadow-lg'
        })
        .on('click', () => showLocationDetails(location))

      mapMarkers.value.push(marker)
    }
  })
}

const renderFilteredMarkers = () => {
  // Clear existing markers
  mapMarkers.value.forEach(marker => marker.remove())
  mapMarkers.value = []

  // Add markers only for filtered locations
  filteredLocations.value.forEach(location => {
    if (location.latitude && location.longitude) {
      const marker = L.marker([location.latitude, location.longitude])
        .addTo(map)
        .bindTooltip(location.name, {
          permanent: false,
          direction: 'top',
          offset: [0, -32],
          className: 'bg-white px-2 py-1 rounded shadow-lg'
        })
        .on('click', () => showLocationDetails(location))

      mapMarkers.value.push(marker)
    }
  })
}

const handleKeyDown = (event) => {
  if (event.key === 'Enter') {
    searchLocation()
  }
}

const resetSearch = () => {
  searchQuery.value = ''
  filteredLocations.value = locations.value
  renderAllMarkers()
}

// Watch for search query changes for real-time filtering (debounced)
let debounceTimer
watch(searchQuery, () => {
  clearTimeout(debounceTimer)
  if (searchQuery.value.trim() === '') {
    resetSearch()
    return
  }

  debounceTimer = setTimeout(() => {
    searchLocation()
  }, 300)
})

onMounted(async () => {
  await fetchLocationsWithProducts()

  map = L.map("map", {
    dragging: true,
    zoomControl: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    boxZoom: true,
    keyboard: true,
  }).setView([10.744340, 124.791995], 16);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);

  renderAllMarkers()

  // Restore state from query parameters
  if (route.query.modal === 'true' && route.query.locationId) {
    const location = locations.value.find(loc => loc.id === route.query.locationId)
    if (location) {
      showLocationDetails(location)
      currentPage.value = parseInt(route.query.page) || 1
    }
  }
});
</script>

<template>
  <div>
    <!-- Header Section -->
    <div
      class="flex flex-col mt-8 sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0"
    >
      <div class="flex items-center space-x-2">
        <img
          src="@/assets/forest-map.png"
          alt="Forest Map"
          class="w-12 h-12 group-hover:scale-110 transition-transform"
        />
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-green-900">
            Forest Products Map
          </h2>
          <p class="mt-1 text-sm text-green-900">View the locations of forest products</p>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
  <div class="relative w-full sm:min-w-[240px]">
    <input
      v-model="searchQuery"
      type="text"
      placeholder="Search locations..."
      class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 pl-11 pr-10 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors duration-200"
      @keydown="handleKeyDown"
    />
    <div
      class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
    >
      <svg
        class="h-5 w-5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
    <button
      v-if="searchQuery"
      @click="resetSearch"
      class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
  </div>
  <div class="flex space-x-2 w-full sm:w-auto">
    <Button
    
      @click="searchLocation"
      :disabled="isSearching"
      class="flex-1 sm:flex-none transition-all duration-200 bg-green-900 text-white hover:bg-green-600"
    >
      <span v-if="isSearching" class="flex items-center">
        <svg
          class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        Searching...
      </span>
      <span v-else>Search</span>
    </Button class="bg-green-900 text-white hover:bg-green-600">
    <Button  @click="createLocation" class="flex-1 sm:flex-none bg-green-900 text-white hover:bg-green-600"> + Create Location </Button>
  </div>
</div>
    </div>

    <!-- Map Status and Stats  -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
      <div class="flex items-center gap-4">
        <span class="flex items-center text-gray-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 mr-1 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
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
          {{ locations.length }} Total Locations
        </span>
        <span
          v-if="filteredLocations.length !== locations.length"
          class="flex items-center text-gray-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 mr-1 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          {{ filteredLocations.length }} Filtered Locations
        </span>
      </div>

      <div
        v-if="searchQuery && filteredLocations.length !== locations.length"
        class="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full"
      >
        <span>Filtered by: "{{ searchQuery }}"</span>
        <button
          @click="resetSearch"
          class="ml-2 text-blue-600 hover:text-blue-800"
        >
          Clear Filter
        </button>
      </div>
    </div>

    <!-- Map container -->
    <div id="map" class="h-[500px] w-full rounded-lg shadow-md mb-6"></div>

    <!-- Map Instructions -->
    <div class="flex items-center gap-2 text-sm text-gray-600 mt-2 mb-6">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 text-blue-500"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clip-rule="evenodd"
        />
      </svg>
      <span
        >Click on map markers to view available forest products at each
        location.</span
      >
    </div>

    <!-- Modal (No backdrop blur for better performance) -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 flex items-center justify-center z-50"
      >
        <!-- Backdrop without blur -->
        <div class="absolute inset-0 bg-black/60" @click="closeModal"></div>

        <!-- Modal Content -->
        <div
          class="relative bg-white w-full max-w-xl rounded-xl shadow-lg overflow-hidden mx-4"
        >
          <!-- Header -->
          <div
            class="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-green-100"
          >
            <div class="flex justify-between items-center">
              <h3
                class="text-xl font-semibold text-gray-800 flex items-center gap-2"
              >
                <span class="text-green-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      d="M10 3.5a6.5 6.5 0 00-6.5 6.5c0 3.13 2.185 5.754 5.105 6.395l.007-.007c.407.107.832.165 1.273.165.441 0 .866-.058 1.273-.165l.007.007c2.92-.641 5.105-3.265 5.105-6.395A6.5 6.5 0 0010 3.5z"
                    />
                  </svg>
                </span>
                {{ selectedLocation?.name }}
              </h3>
              <button
                @click="closeModal"
                class="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <p class="text-sm text-gray-600 mt-1">
              Available forest products at this location
            </p>
          </div>

          <!-- Body -->
          <div class="p-6 overflow-y-auto max-h-[60vh]">
            <div v-if="paginatedProducts.length > 0" class="space-y-4">
              <div
                v-for="product in paginatedProducts"
                :key="product.id"
                class="group p-4 bg-white border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-md transition-all duration-200"
              >
                <div
                  class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4"
                >
                  <div class="flex-1">
                    <h4
                      class="text-lg font-medium text-gray-800 group-hover:text-green-600 transition-colors"
                    >
                      {{ product.name }}
                    </h4>
                    <p class="mt-1 text-sm text-gray-600 leading-relaxed">
                      {{ product.description }}
                    </p>
                  </div>
                  <button
                    @click="goToForestProduct(product.id)"
                    class="px-4 py-2 w-full sm:w-auto bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    View Details
                  </button>
                </div>
                <div
                  class="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-gray-100"
                >
                  <span class="flex items-center text-sm text-gray-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"
                      />
                    </svg>
                    Quantity: {{ product.quantity }}
                    {{ product.measurement_unit_id ? product.measurement_units.unit_name : ''
                    }}(s)
                  </span>
                  <span
                    class="flex items-center text-sm font-medium text-green-700"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"
                      />
                      <path
                        fill-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    ₱{{ product.price_based_on_measurement_unit }}
                  </span>
                  <span
                    v-if="product.type"
                    class="flex items-center text-sm text-gray-600"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    Type: {{ product.type }}
                  </span>
                </div>
              </div>
            </div>
            <div
              v-else
              class="flex flex-col items-center justify-center py-8 text-gray-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-12 w-12 mb-3 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p class="text-center">
                No forest products found at this location.
              </p>
              <p class="text-sm text-center mt-1">
                Try visiting another location on the map.
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-100 bg-gray-50">
            <div
              v-if="selectedLocationProducts.length > 0"
              class="flex justify-between items-center mb-4"
            >
              <button
                @click="prevPage"
                :disabled="currentPage === 1"
                class="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <span class="flex items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  Previous
                </span>
              </button>

              <div class="flex items-center gap-1 text-gray-600">
                <button
                  v-for="page in totalPages"
                  :key="page"
                  @click="currentPage = page; updatePageInUrl()"
                  :class="[
                    'w-8 h-8 flex items-center justify-center rounded-full transition-colors',
                    currentPage === page 
                      ? 'bg-green-600 text-white font-medium' 
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  ]"
                >
                  {{ page }}
                </button>
              </div>

              <button
                @click="nextPage"
                :disabled="currentPage === totalPages"
                class="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <span class="flex items-center gap-1">
                  Next
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </span>
              </button>
            </div>

            <div class="flex gap-3">
              <button
                @click="closeModal"
                class="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 focus:ring-offset-1 transition-all duration-200"
              >
                Close
              </button>

                <button
                @click="router.push('/authenticated/forest-products')"
                class="flex-1 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200"
                >
                View All Products
                </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
#map {
  height: 500px;
  z-index: 1;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Ensure modal appears above map */
.fixed {
  z-index: 1000;
}

/* Responsive adjustments for small screens */
@media (max-width: 640px) {
  #map {
    height: 400px;
  }
}
</style>
