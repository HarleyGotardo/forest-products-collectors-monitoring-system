<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import Swal from 'sweetalert2'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

const route = useRoute()
const router = useRouter()
const locationId = route.params.id
const location = ref(null)
const error = ref(null)
const mapInstance = ref(null)

const fetchLocation = async () => {
  let { data, error: fetchError } = await supabase
    .from('location')
    .select('*')
    .eq('id', locationId)
    .single()

  if (fetchError) {
    error.value = fetchError.message
  } else {
    location.value = data
    nextTick(() => {
      initializeMap(data.latitude, data.longitude)
    })
  }
}

const initializeMap = (lat, lng) => {
  if (mapInstance.value) {
    mapInstance.value.remove()
  }

  mapInstance.value = L.map('locationMap').setView([lat, lng], 15)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapInstance.value)

  L.marker([lat, lng])
    .addTo(mapInstance.value)
    .bindTooltip(location.value.name, {
      permanent: true,
      direction: 'top',
      className: 'bg-white px-2 py-1 rounded shadow-lg'
    })
}

const restoreLocation = async () => {
  const result = await Swal.fire({
    title: 'Restore Location?',
    text: "This location will be restored.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Restore'
  })

  if (result.isConfirmed) {
    const { error: restoreError } = await supabase
      .from('location')
      .update({ deleted_at: null })
      .eq('id', locationId)

    if (restoreError) {
      error.value = restoreError.message
    } else {
      fetchLocation()
      Swal.fire(
        'Restored!',
        'The location has been restored.',
        'success'
      )
    }
  }
}

const deletePermanently = async () => {
  const result = await Swal.fire({
    title: 'Delete Location Permanently?',
    text: "This action cannot be undone.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Delete Permanently'
  })

  if (result.isConfirmed) {
    const { error: deleteError } = await supabase
      .from('location')
      .delete()
      .eq('id', locationId)

    if (deleteError) {
      error.value = deleteError.message
    } else {
      Swal.fire(
        'Deleted!',
        'The location has been permanently deleted.',
        'success'
      ).then(() => {
        router.push('/authenticated/locations/trash')
      })
    }
  }
}

const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  return new Date(dateString).toLocaleDateString(undefined, options)
}

onMounted(() => {
  fetchLocation()
})
</script>

<template>
  <div class="max-w-4xl mx-auto p-6">
    <!-- Header Section -->
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-gray-900">Location Details</h2>
      <p class="mt-2 text-gray-600">View detailed information about this location</p>
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

    <!-- Main Content -->
    <div v-if="location" class="space-y-6">
      <!-- Location Info Card -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-6">
          <div class="flex items-start space-x-4">
            <!-- Location Icon -->
            <div class="p-3 bg-blue-50 rounded-lg">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>

            <!-- Location Details -->
            <div class="flex-1">
              <div v-if="location.deleted_at" class="mt-4 flex items-center space-x-4">
                <h3 class="text-xl font-semibold text-gray-900">{{ location.name }}</h3>
                <div class="flex items-center space-x-2">
                  <p class="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">Deleted</p>
                  <p class="mt-1 font-mono text-gray-900">{{ formatDate(location.deleted_at) }}</p>
                  <button 
                  @click="restoreLocation"
                >
                  <img src="@/assets/restore.png" alt="Restore" class="w-5 h-5 mr-2 ml-5" />
                </button>
                <button 
                      @click.stop="deletePermanently(location.id)"
                      class="p-1 rounded-lg hover:bg-red-50 transition-colors duration-200 text-red-600 hover:text-red-700"
                    >
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                </div>
              </div>
              <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-3 bg-gray-50 rounded-lg">
                  <p class="text-sm text-gray-500">Latitude</p>
                  <p class="mt-1 font-mono text-gray-900">{{ location.latitude }}</p>
                </div>
                
                <div class="p-3 bg-gray-50 rounded-lg">
                  <p class="text-sm text-gray-500">Longitude</p>
                  <p class="mt-1 font-mono text-gray-900">{{ location.longitude }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Map Card -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Map View</h3>
            <div class="px-3 py-1 bg-blue-50 rounded-full">
              <span class="text-sm text-blue-700">Interactive Map</span>
            </div>
          </div>
          <div id="locationMap" 
               class="h-[500px] w-full rounded-lg overflow-hidden border border-gray-200">
          </div>
          <p class="mt-3 text-sm text-gray-500">
            Click and drag to pan, use scroll wheel to zoom
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.leaflet-container {
  font-family: inherit;
}

.leaflet-tooltip {
  @apply bg-white px-3 py-1.5 rounded-lg shadow-lg border-none text-sm font-medium !important;
}
</style>