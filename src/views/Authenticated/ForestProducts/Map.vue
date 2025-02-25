<script setup>
import { ref, onMounted, computed } from "vue";
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
const showModal = ref(false)
const selectedLocation = ref(null)
const selectedLocationProducts = ref([])
const currentPage = ref(1)
const itemsPerPage = 3
const searchQuery = ref('')
const router = useRouter()
const route = useRoute()
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
  let { data, error } = await supabase
    .from('location')
    .select(`
      id,
      name,
      latitude,
      longitude,
      fp_and_location (
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
  }
}

const showLocationDetails = async (location) => {
  selectedLocation.value = location
  
  // Transform the nested data structure
  selectedLocationProducts.value = location.fp_and_location
    .map(fp => ({
      ...fp.forest_products,
      quantity: fp.quantity
    }))
    .filter(Boolean)
  
  showModal.value = true
}

const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return selectedLocationProducts.value.slice(start, end)
})

const nextPage = () => {
  if ((currentPage.value * itemsPerPage) < selectedLocationProducts.value.length) {
    currentPage.value++
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const searchLocation = () => {
  const location = locations.value.find(loc => loc.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
  if (location && location.latitude && location.longitude) {
    map.setView([location.latitude, location.longitude], 16)
  }
}

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

  locations.value.forEach(location => {
    if (location.latitude && location.longitude) {
      L.marker([location.latitude, location.longitude])
        .addTo(map)
        .bindTooltip(location.name, {
          permanent: true,
          direction: 'top',
          offset: [0, -32],
          className: 'bg-white px-2 py-1 rounded shadow-lg'
        })
        .on('click', () => showLocationDetails(location))
    }
  })

  // Restore state from query parameters
  if (route.query.modal) {
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
    <div class="flex flex-col mt-8 sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0">
      <div class="flex items-center space-x-2">
      <img src="@/assets/forest-map.png" alt="Forest Map" class="w-12 h-12 group-hover:scale-110 transition-transform" />
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Forest Products Map</h2>
        <p class="mt-1 text-sm">View the locations of the forest products</p>
      </div>
      </div>
      <div class="flex space-x-4">
      <div class="relative flex-1 sm:flex-none">
        <input
        v-model="searchQuery"
        type="text"
        placeholder="Search locations..."
        class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
        />
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        </div>
      </div>
      <Button 
        @click="searchLocation"
      >
        Search
      </Button>
      <Button 
        @click="createLocation"
      >
       + Create Location
      </Button>
      </div>
    </div>
    <!-- Map container -->
    <div id="map" class="h-[500px] w-full rounded-lg shadow-md"></div>

    <div v-if="showModal" class="fixed inset-0 flex items-center justify-center z-50">
    <!-- Backdrop with blur effect -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showModal = false"></div>
    <!-- Modal Content -->
    <div class="relative bg-white w-full max-w-xl rounded-xl shadow-lg overflow-hidden">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-green-100">
        <h3 class="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <span class="text-green-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3.5a6.5 6.5 0 00-6.5 6.5c0 3.13 2.185 5.754 5.105 6.395l.007-.007c.407.107.832.165 1.273.165.441 0 .866-.058 1.273-.165l.007.007c2.92-.641 5.105-3.265 5.105-6.395A6.5 6.5 0 0010 3.5z"/>
            </svg>
          </span>
          {{ selectedLocation?.name }} Forest Products
        </h3>
      </div>

      <!-- Body -->
      <div class="p-6 overflow-y-auto max-h-[60vh]">
        <div v-if="paginatedProducts.length > 0" class="space-y-4">
          <div
            v-for="product in paginatedProducts"
            :key="product.id"
            class="group p-4 bg-white border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-md transition-all duration-200"
          >
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <h4 class="text-lg font-medium text-gray-800 group-hover:text-green-600 transition-colors">
                  {{ product.name }}
                </h4>
                <p class="mt-1 text-sm text-gray-600 leading-relaxed">{{ product.description }}</p>
              </div>
              <button 
                @click="goToForestProduct(product.id)"
                class="ml-4 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200"
              >
                View Details
              </button>
            </div>
            <div class="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
              <span class="flex items-center text-sm text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/>
                </svg>
                Quantity: {{ product.quantity }} per {{ product.measurement_unit_id ? product.measurement_units.unit_name : '' }}(s)
              </span>
              <span class="flex items-center text-sm font-medium text-green-700">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"/>
                </svg>
                ₱{{ product.price_based_on_measurement_unit }}
              </span>
            </div>
          </div>
        </div>
        <div v-else class="text-center text-gray-600">
          No Forest Products Found in this location.
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-100 bg-gray-50">
        <div class="flex justify-between items-center mb-4">
          <button 
            @click="prevPage" 
            :disabled="currentPage === 1"
            class="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            <span class="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              Previous
            </span>
          </button>

          <span class="text-sm font-medium text-gray-600">
            Page {{ currentPage }} of {{ Math.ceil(selectedLocationProducts.length / itemsPerPage) }}
          </span>

          <button 
            @click="nextPage" 
            :disabled="(currentPage * itemsPerPage) >= selectedLocationProducts.length"
            class="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            <span class="flex items-center gap-1">
              Next
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
              </svg>
            </span>
          </button>
        </div>

        <button 
          @click="showModal = false"
          class="w-full px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200"
        >
          Close
        </button>
      </div>
    </div>


  </div>
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
</style>