<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import locationPeek from '@/assets/location-peek.png';
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

const route = useRoute()
const router = useRouter()
const productId = route.params.id
const name = ref('')
const description = ref('')
const type = ref('T')
const price_based_on_measurement_unit = ref('')
const measurementUnits = ref([])
const selectedMeasurementUnit = ref(null)
const error = ref(null)
const locations = ref([])
const selectedLocations = ref([])
const showLocationModal = ref(false)
const showMapModal = ref(false)
const mapInstance = ref(null)
const tempMarker = ref(null)
const currentLocation = ref(null)
const isFormChanged = ref(false)

const originalData = ref({})

// Fetch forest product data and populate selectedLocations
const fetchForestProduct = async () => {
  let { data, error: fetchError } = await supabase
    .from('forest_products')
    .select(`
      *,
      measurement_units:measurement_unit_id (
        unit_name
      ),
      fp_and_locations (
        locations (
          id,
          name,
          latitude,
          longitude
        ),
        quantity
      )
    `)
    .eq('id', productId)
    .single()

  if (fetchError) {
    error.value = fetchError.message
  } else {
    name.value = data.name
    description.value = data.description
    type.value = data.type
    price_based_on_measurement_unit.value = data.price_based_on_measurement_unit
    selectedMeasurementUnit.value = data.measurement_unit_id
    selectedLocations.value = data.fp_and_locations.map(fpLoc => ({
      ...fpLoc.location,
      quantity: fpLoc.quantity
    }))

    // Store original data for comparison
    originalData.value = {
      name: data.name,
      description: data.description,
      type: data.type,
      price_based_on_measurement_unit: data.price_based_on_measurement_unit,
      measurement_unit_id: data.measurement_unit_id,
      image_url: data.image_url,
      locations: data.fp_and_locations.map(fpLoc => ({
        ...fpLoc.locations,
        quantity: fpLoc.quantity
      }))
    }
  }
}

const selectedLocationsIds = computed({
  get() {
    return selectedLocations.value.map(loc => loc.id)
  },
  set(ids) {
    selectedLocations.value = ids.map(id => {
      const location = locations.value.find(loc => loc.id === id)
      const existingLocation = selectedLocations.value.find(loc => loc.id === id)
      return existingLocation || { ...location, quantity: 0 }
    })
  }
})

const getLocationQuantity = (locationId) => {
  const location = selectedLocations.value.find(loc => loc.id === locationId)
  return location ? location.quantity : 0
}

const updateLocationQuantity = (location, quantity) => {
  const selectedLocation = selectedLocations.value.find(loc => loc.id === location.id)
  if (selectedLocation) {
    selectedLocation.quantity = quantity
  }
}

const fetchLocations = async () => {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, latitude, longitude')
    .order('name')

  if (error) {
    console.error('Error fetching locations:', error)
  } else {
    locations.value = data
  }
}

const fetchAllMeasurementUnits = async () => {
  const { data, error } = await supabase
    .from('measurement_units')
    .select('*')

  if (error) {
    console.error('Error fetching measurement units:', error)
  } else {
    measurementUnits.value = data
  }
}

onMounted(() => {
  fetchForestProduct()
  fetchLocations()
  fetchAllMeasurementUnits()
})

const initializeMap = (latitude, longitude, name) => {
  if (mapInstance.value) {
    mapInstance.value.remove();
  }
  
  mapInstance.value = L.map("map").setView([latitude, longitude], 16);
  
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(mapInstance.value);

  L.marker([latitude, longitude])
    .addTo(mapInstance.value)
    .bindTooltip(name, {
      permanent: true,
      direction: 'top',
      className: 'bg-white px-2 py-1 rounded shadow-lg'
    })
}

const visualizeLocation = (location) => {
  currentLocation.value = location;
  showMapModal.value = true;
  nextTick(() => initializeMap(location.latitude, location.longitude, location.name));
}

const selectedLocationsNote = computed(() => {
  return selectedLocations.value.map(location => location.name).join(", ");
})

const handleSubmit = async () => {

  const currentDate = new Date()
  const formattedDate = format(currentDate, 'yyyy-MM-dd HH:mm:ss')

  let imageUrl = originalData.value.image_url
  // Convert price_based_on_measurement_unit to a number
  const price = parseFloat(price_based_on_measurement_unit.value)

  // Check for changes
  const updates = {}
  if (name.value !== originalData.value.name) updates.name = name.value
  if (description.value !== originalData.value.description) updates.description = description.value
  if (type.value !== originalData.value.type) updates.type = type.value
  if (price !== originalData.value.price_based_on_measurement_unit) updates.price_based_on_measurement_unit = isNaN(price) ? null : price
  if (selectedMeasurementUnit.value !== originalData.value.measurement_unit_id) updates.measurement_unit_id = selectedMeasurementUnit.value
  if (imageUrl !== originalData.value.image_url) updates.image_url = imageUrl

  updates.updated_at = formattedDate

  // Update forest product
  const { error: updateError } = await supabase
    .from('forest_products')
    .update(updates)
    .eq('id', productId)

  if (updateError) {
    error.value = updateError.message
    return
  }

  // Update fp_and_location relationships
  const originalLocationIds = originalData.value.locations.map(loc => loc.id)
  const newLocationIds = selectedLocations.value.map(loc => loc.id)

  // Remove old locations
  for (const locationId of originalLocationIds) {
    if (!newLocationIds.includes(locationId)) {
      const { error: deleteError } = await supabase
        .from('fp_and_locations')
        .delete()
        .eq('forest_product_id', productId)
        .eq('location_id', locationId)

      if (deleteError) {
        error.value = deleteError.message
        return
      }
    }
  }

  // Add new locations and update quantities
  for (const location of selectedLocations.value) {
    if (!originalLocationIds.includes(location.id)) {
      const { error: insertError } = await supabase
        .from('fp_and_locations')
        .insert([{
          forest_product_id: productId,
          location_id: location.id,
          quantity: location.quantity // Save quantity
        }])

      if (insertError) {
        error.value = insertError.message
        return
      }
    } else {
      // Update existing location quantity
      const { error: updateLocationError } = await supabase
        .from('fp_and_location')
        .update({ quantity: location.quantity })
        .eq('forest_product_id', productId)
        .eq('location_id', location.id)

      if (updateLocationError) {
        error.value = updateLocationError.message
        return
      }
    }
  }

  toast.success('Forest product updated successfully', { duration: 2000 })
  router.push('/authenticated/forest-products')
}

// Watch for changes in form fields to enable/disable the update button
watch([name, description, type, price_based_on_measurement_unit, selectedMeasurementUnit, selectedLocations], () => {
  isFormChanged.value = (
    name.value !== originalData.value.name ||
    description.value !== originalData.value.description ||
    type.value !== originalData.value.type ||
    parseFloat(price_based_on_measurement_unit.value) !== originalData.value.price_based_on_measurement_unit ||
    selectedMeasurementUnit.value !== originalData.value.measurement_unit_id ||
    JSON.stringify(selectedLocations.value) !== JSON.stringify(originalData.value.locations)
  )
})

// Reset form fields to original values
const handleCancel = () => {
  router.push('/authenticated/forest-products')
}
</script>
<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header Section -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Edit Forest Product</h2>
        <p class="mt-1 text-sm text-gray-500">Update the details of the forest product</p>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" 
         class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg">
      <div class="flex">
        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 101.414 1.414L10 11.414l1.293 1.293a1 1 001.414-1.414L11.414 10l1.293-1.293a1 1 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <p class="ml-3">{{ error }}</p>
      </div>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit" class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6 space-y-4">
      <!-- Name input -->
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700">Name</label>
        <input
          id="name"
          v-model="name"
          type="text"
          required
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>

      <!-- Description input -->
      <div>
        <label for="description" class="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          id="description"
          v-model="description"
          required
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        ></textarea>
      </div>

      <!-- Type select -->
      <div>
        <label for="type" class="block text-sm font-medium text-gray-700">Type</label>
        <select
          id="type"
          v-model="type"
          required
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        >
          <option value="Timber">Timber</option>
          <option value="Non-Timber">Non-Timber</option>
        </select>
      </div>

      <!-- Measurement Unit select -->
      <div>
        <label for="measurementUnit" class="block text-sm font-medium text-gray-700">Measurement Unit</label>
        <select
          id="measurementUnit"
          v-model="selectedMeasurementUnit"
          required
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        >
          <option v-for="unit in measurementUnits" :key="unit.id" :value="unit.id">
            {{ unit.unit_name }}
          </option>
        </select>
      </div>

      <!-- Price input -->
      <div>
        <label for="price" class="block text-sm font-medium text-gray-700">Price based on measurement unit</label>
        <input
          id="price"
          v-model="price_based_on_measurement_unit"
          type="number"
          step="0.01"
          required
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>

      <!-- Submit and Cancel buttons -->
      <div class="flex justify-end space-x-4">
        <Button
          type="button"
          @click="handleCancel"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          :disabled="!isFormChanged"
        >
          Update
        </Button>
      </div>
    </form>

    <!-- Map Modal -->
    <div v-if="showMapModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
        <div class="relative bg-white rounded-lg p-8 max-w-4xl w-full">
          <h3 class="text-lg font-medium mb-4">Location Map</h3>
          <div id="map" class="h-[400px] w-full mb-4"></div>
          <div class="flex justify-end">
            <button
              type="button"
              @click="showMapModal = false"
              class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
    <Toaster/>
  </div>
</template>