<script setup>
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from '@/lib/supabaseClient'

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
const router = useRouter()
const route = useRoute()

const goToForestProduct = (forestProductId) => {
  router.push({
    name: 'ForestProductsView',
    params: { id: forestProductId },
  })
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
          price_based_on_measurement_unit
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

onMounted(async () => {
  await fetchLocationsWithProducts()

  const map = L.map("map", {
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
    <h2 class="text-2xl font-bold mb-4 ml-14 mt-1">Forest Product Map</h2>
    <!-- Map container -->
    <div id="map" class="h-[500px] w-full rounded-lg shadow-md"></div>

    <div v-if="showModal" class="fixed inset-0 flex items-center justify-center z-50">
    <!-- Backdrop with blur effect -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showModal = false"></div>
    
<!-- Modal Content -->
<div class="relative bg-white w-full max-w-lg rounded-lg shadow-md overflow-hidden">
  <!-- Header -->
  <div class="p-4 border-b border-gray-200 bg-gray-50">
    <h3 class="text-lg font-semibold text-gray-800">
      Forest Products at {{ selectedLocation?.name }}
    </h3>
  </div>

  <!-- Body -->
  <div class="p-4 overflow-y-auto max-h-[60vh]">
    <div class="space-y-3">
      <div
        v-for="product in paginatedProducts" 
        :key="product.id" 
        class="p-3 border border-gray-300 rounded-lg hover:shadow-sm transition"
      >
        <h4 class="text-md font-semibold text-gray-800">{{ product.name }}</h4>
        <p class="text-gray-600">{{ product.description }}</p>
        <div class="flex justify-between mt-2">
          <span class="text-sm text-gray-500">Qty: {{ product.quantity }}</span>
          <span class="text-sm font-medium text-gray-800">₱{{ product.price_based_on_measurement_unit }}</span>
          <button class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition" @click="goToForestProduct(product.id)">
            View
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="p-4 border-t border-gray-200 bg-gray-50">
    <div class="flex justify-between mb-2">
      <button 
        @click="prevPage" 
        :disabled="currentPage === 1"
        class="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
      >
        Previous
      </button>

      <span class="text-sm text-gray-600">
        Page {{ currentPage }} of {{ Math.ceil(selectedLocationProducts.length / itemsPerPage) }}
      </span>

      <button 
        @click="nextPage" 
        :disabled="(currentPage * itemsPerPage) >= selectedLocationProducts.length"
        class="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
      >
        Next
      </button>
    </div>

    <button 
      @click="showModal = false"
      class="w-full mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
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