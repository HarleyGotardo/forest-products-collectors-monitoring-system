<script setup>
import { ref, onMounted } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from '@/lib/supabaseClient'
import { computed } from 'vue'

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

const fetchLocationsWithProducts = async () => {
  let { data, error } = await supabase
    .from('location')
    .select(`
      id,
      name,
      latitude,
      longitude,
      fp_and_location (
        forest_products (
          id,
          name,
          description,
          type,
          quantity,
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
    .map(fp => fp.forest_products)
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
});
</script>

<template>
  <div>
    <h2 class="text-2xl font-bold mb-4 ml-14 mt-1">Forest Product Map</h2>
    <!-- Map container -->
    <div id="map" class="h-[500px] w-full rounded-lg shadow-md"></div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h3 class="text-xl font-bold mb-4">Forest Products at {{ selectedLocation?.name }}</h3>
        <div class="space-y-4">
          <div v-for="product in paginatedProducts" :key="product.id" class="border-b pb-4">
            <h4 class="font-semibold">{{ product.name }}</h4>
            <p class="text-gray-600">{{ product.description }}</p>
            <div class="mt-2 grid grid-cols-2 gap-4">
              <p><span class="font-medium">Type:</span> {{ product.type === 'Timber' ? 'Timber' : 'Non-Timber' }}</p>
              <p><span class="font-medium">Quantity:</span> {{ product.quantity }}</p>
              <p><span class="font-medium">Price:</span> ₱{{ product.price_based_on_measurement_unit }}</p>
            </div>
          </div>
        </div>
        <div class="flex justify-between mt-4">
          <button 
            @click="prevPage" 
            :disabled="currentPage === 1"
            class="px-4 py-2 bg-gray-300 rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <button 
            @click="nextPage" 
            :disabled="(currentPage * itemsPerPage) >= selectedLocationProducts.length"
            class="px-4 py-2 bg-gray-300 rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <button 
          @click="showModal = false"
          class="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Close
        </button>
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