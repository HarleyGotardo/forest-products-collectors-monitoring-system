<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { format } from 'date-fns'
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
const productId = route.params.id
const name = ref('')
const description = ref('')
const type = ref('T')
const quantity = ref('')
const price_based_on_measurement_unit = ref('')
const measurementUnits = ref([])
const selectedMeasurementUnit = ref(null)
const error = ref(null)
const locations = ref([])
const selectedLocation = ref(null)
const showLocationModal = ref(false)
const mapInstance = ref(null)
const tempMarker = ref(null)

const originalData = ref({})

const fetchForestProduct = async () => {
  let { data, error: fetchError } = await supabase
    .from('forest_products')
    .select(`
      *,
      measurement_units:measurement_unit_id (
        unit_name
      ),
      fp_and_location (
        location (
          id,
          name,
          latitude,
          longitude
        )
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
    quantity.value = data.quantity
    price_based_on_measurement_unit.value = data.price_based_on_measurement_unit
    selectedMeasurementUnit.value = data.measurement_unit_id
    selectedLocation.value = data.fp_and_location[0]?.location || null

    // Store original data for comparison
    originalData.value = {
      name: data.name,
      description: data.description,
      type: data.type,
      quantity: data.quantity,
      price_based_on_measurement_unit: data.price_based_on_measurement_unit,
      measurement_unit_id: data.measurement_unit_id,
      image_url: data.image_url,
      location: data.fp_and_location[0]?.location || null
    }
  }
}

const fetchLocations = async () => {
  const { data, error } = await supabase
    .from('location')
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

const initializeMap = () => {
  if (mapInstance.value) {
    mapInstance.value.remove()
  }

  mapInstance.value = L.map('map').setView([10.744340, 124.791995], 16)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapInstance.value)

  // Add existing location markers with tooltips
  locations.value.forEach(location => {
    L.marker([location.latitude, location.longitude])
      .addTo(mapInstance.value)
      .bindTooltip(location.name, {
        permanent: true,
        direction: 'top',
        className: 'bg-white px-2 py-1 rounded shadow-lg'
      })
      .on('click', () => {
        selectedLocation.value = location
        showLocationModal.value = false
      })
  })

  // Handle map click for new location
  mapInstance.value.on('click', async (e) => {
    if (tempMarker.value) {
      mapInstance.value.removeLayer(tempMarker.value)
    }

    const { value: locationName } = await Swal.fire({
      title: 'New Location',
      input: 'text',
      inputLabel: 'Enter location name',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return 'Location name is required'
      }
    })

    if (locationName) {
      const newLocation = {
        name: locationName,
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      }

      const { data, error } = await supabase
        .from('location')
        .insert([newLocation])
        .select()
        .single()

      if (error) {
        Swal.fire('Error', error.message, 'error')
      } else {
        selectedLocation.value = data
        showLocationModal.value = false
      }
    }
  })
}

const handleImageChange = (event) => {
  image.value = event.target.files[0]
}

const handleSubmit = async () => {
  if (!selectedLocation.value) {
    error.value = 'Please select a location'
    return
  }

  const currentDate = new Date()
  const formattedDate = format(currentDate, 'yyyy-MM-dd HH:mm:ss')

  let imageUrl = originalData.value.image_url

  // Upload image to Supabase bucket using S3 protocol
  if (image.value && image.value !== originalData.value.image_url) {
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('forest_product_images')
      .upload(`public/${Date.now()}_${image.value.name}`, image.value, {
        cacheControl: '3600',
        upsert: false,
        contentType: image.value.type,
        endpoint: 'https://cikbihrqwkfgvkrdgmqi.supabase.co/storage/v1/s3',
        region: 'ap-southeast-1'
      })

    if (uploadError) {
      error.value = uploadError.message
      return
    }

    imageUrl = supabase
      .storage
      .from('forest_product_images')
      .getPublicUrl(uploadData.path)

    console.log('Image URL:', imageUrl)
  }

  // Convert price_based_on_measurement_unit to a number
  const price = parseFloat(price_based_on_measurement_unit.value)

  // Check for changes
  const updates = {}
  if (name.value !== originalData.value.name) updates.name = name.value
  if (description.value !== originalData.value.description) updates.description = description.value
  if (type.value !== originalData.value.type) updates.type = type.value
  if (quantity.value !== originalData.value.quantity) updates.quantity = quantity.value
  if (price !== originalData.value.price_based_on_measurement_unit) updates.price_based_on_measurement_unit = isNaN(price) ? null : price
  if (selectedMeasurementUnit.value !== originalData.value.measurement_unit_id) updates.measurement_unit_id = selectedMeasurementUnit.value
  if (imageUrl !== originalData.value.image_url) updates.image_url = imageUrl
  if (selectedLocation.value.id !== originalData.value.location.id) updates.location_id = selectedLocation.value.id

  if (Object.keys(updates).length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'No Changes',
      text: 'No changes were made to the forest product.',
      showCancelButton: true,
      cancelButtonText: 'Continue',
      confirmButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        router.push('/authenticated/forest-products')
      }
    })
    return
  }

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

  // Update fp_and_location relationship if location has changed
  if (selectedLocation.value.id !== originalData.value.location.id) {
    const { error: fpLocationError } = await supabase
      .from('fp_and_location')
      .upsert([{
        forest_product_id: productId,
        location_id: selectedLocation.value.id
      }])

    if (fpLocationError) {
      error.value = fpLocationError.message
      return
    }
  }

  Swal.fire({
    icon: 'success',
    title: 'Updated!',
    text: 'The forest product has been updated.',
    timer: 2000,
    showConfirmButton: false
  }).then(() => {
    router.push('/authenticated/forest-products')
  })
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
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
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

      <!-- Quantity input -->
      <div>
        <label for="quantity" class="block text-sm font-medium text-gray-700">Quantity</label>
        <input
          id="quantity"
          v-model="quantity"
          type="number"
          required
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
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

      <!-- Location select with map -->
      <div>
        <label class="block text-sm font-medium text-gray-700">Location</label>
        <button
          type="button"
          @click="showLocationModal = true; $nextTick(() => initializeMap())"
          class="mt-1 w-full px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-left hover:bg-gray-50"
        >
          {{ selectedLocation ? selectedLocation.name : 'Select location on map' }}
        </button>
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

      <!-- Submit button -->
      <div class="flex justify-end">
        <button
          type="submit"
          class="px-4 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          Update
        </button>
      </div>
    </form>

    <!-- Map Modal -->
    <div v-if="showLocationModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
        <div class="relative bg-white rounded-lg p-8 max-w-4xl w-full">
          <h3 class="text-lg font-medium mb-4">Select Location</h3>
          <div id="map" class="h-[400px] w-full mb-4"></div>
          <div class="flex justify-end">
            <button
              type="button"
              @click="showLocationModal = false"
              class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>