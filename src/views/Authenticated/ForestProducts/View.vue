<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Swal from 'sweetalert2'
import { toast, Toaster } from 'vue-sonner'
import { format } from 'date-fns'
import {isFPCollector ,isVSUAdmin, isFPUAdmin, isForestRanger, fetchUserDetails } from '@/router/routeGuard';

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
const forestProduct = ref(null)
const locations = ref([])
const allLocations = ref([]) // Store all existing locations
const error = ref(null)
const mapInstance = ref(null)
const showLocationModal = ref(false)
const showImageModal = ref(false)
const selectedLocation = ref(null)
const tempMarker = ref(null)
const newImage = ref(null)
const showEditLocationModal = ref(false)
const editLocationQuantity = ref(null)
const locationToEdit = ref(null)

const cancelMapModal = () => {
  showLocationModal.value = false
  initializeMap();
}

const editLocation = (location) => {
  locationToEdit.value = location
  editLocationQuantity.value = location.quantity
  showEditLocationModal.value = true
}

const updateLocationQuantity = async () => {
  if (!locationToEdit.value) {
    toast.error('No location selected', { duration: 2000 })
    return
  }

  const { error: updateError } = await supabase
    .from('fp_and_location')
    .update({ quantity: editLocationQuantity.value })
    .eq('forest_product_id', forestProduct.value.id)
    .eq('location_id', locationToEdit.value.id)

  if (updateError) {
    toast.error(updateError.message, { duration: 2000 })
    return
  }

  toast.success('Location quantity updated successfully', { duration: 2000 })
  showEditLocationModal.value = false
  fetchLocations()
}

const deleteLocation = async (locationId) => {
  const result = await Swal.fire({
    title: 'Delete Location?',
    text: 'Delete this location of the forest product?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel'
  });

  if (result.isConfirmed) {
    const { error: deleteError } = await supabase
      .from('fp_and_location')
      .delete()
      .eq('forest_product_id', forestProduct.value.id)
      .eq('location_id', locationId);

    if (deleteError) {
      toast.error(deleteError.message, { duration: 2000 });
      return;
    }

    toast.success('Location deleted successfully', { duration: 2000 });
    fetchLocations();
  }
};

const fetchForestProduct = async () => {
  let { data, error: fetchError } = await supabase
    .from('forest_products')
    .select(`
      *,
      measurement_units:measurement_unit_id (
        unit_name
      )
    `)
    .eq('id', productId)
    .single()

  if (fetchError) {
    error.value = fetchError.message
  } else {
    if (data.image_url) {
      try {
        const imageUrlData = JSON.parse(data.image_url)
        data.image_url = imageUrlData.data.publicUrl
      } catch (e) {
        console.error('Error parsing image_url:', e)
      }
    }
    data.created_at = format(new Date(data.created_at), 'MMMM dd, yyyy')
    data.updated_at = format(new Date(data.updated_at), 'MMMM dd, yyyy')
    forestProduct.value = data
    fetchLocations()
  }
}
const fetchLocations = async () => {
  let { data, error: fetchError } = await supabase
    .from('fp_and_location')
    .select('location (id, name, latitude, longitude), quantity')
    .eq('forest_product_id', productId)

  if (fetchError) {
    error.value = fetchError.message
  } else {
    locations.value = data.map(fp => ({
      ...fp.location,
      quantity: fp.quantity
    }))
    nextTick(() => {
      initializeMap()
    })
  }
}

const fetchAllLocations = async () => {
  let { data, error: fetchError } = await supabase
    .from('location')
    .select('*')

  if (fetchError) {
    error.value = fetchError.message
  } else {
    allLocations.value = data
  }
}

const initializeMap = () => {
  if (!document.getElementById('locationMap')) {
    console.error('Map container not found.')
    return
  }

  if (mapInstance.value) {
    mapInstance.value.remove()
  }

  mapInstance.value = L.map('locationMap')

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapInstance.value)

  const bounds = L.latLngBounds(locations.value.map(location => [location.latitude, location.longitude]))

  locations.value.forEach(location => {
    L.marker([location.latitude, location.longitude])
      .addTo(mapInstance.value)
      .bindTooltip(location.name, {
        permanent: true,
        direction: 'top',
        className: 'bg-white px-2 py-1 rounded shadow-lg'
      })
  })

  mapInstance.value.fitBounds(bounds)
}

const initializeModalMap = () => {
  if (mapInstance.value) {
    mapInstance.value.remove()
  }

  mapInstance.value = L.map("modalMap").setView([10.744340, 124.791995], 16);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(mapInstance.value);

  // Add existing location markers with tooltips
  allLocations.value.forEach(location => {
    L.marker([location.latitude, location.longitude])
      .addTo(mapInstance.value)
      .bindTooltip(location.name, {
        permanent: true,
        direction: 'top',
        className: 'bg-white px-2 py-1 rounded shadow-lg'
      })
      .on('click', async () => {
        // Check if the location is already added for the forest product
        const existingLocation = locations.value.find(loc => loc.id === location.id);
        if (existingLocation) {
          toast.error('Location already added for this forest product', { duration: 2000 });
          return;
        }

        const { value: quantity } = await Swal.fire({
          title: "Forest Product's Quantity",
          input: 'number',
          inputLabel: `Enter quantity (${forestProduct.value.measurement_units.unit_name})`,
          showCancelButton: true,
          inputValidator: (value) => {
            if (!value) return 'Quantity is required';
          }
        });

        if (quantity) {
          selectedLocation.value = location;
          selectedLocation.value.quantity = quantity; // Add quantity to selectedLocation
          showLocationModal.value = false;
          await upsertLocation();
        }
      });
  });

  // Handle map click for new location
  mapInstance.value.on('click', async (e) => {
    if (tempMarker.value) {
      mapInstance.value.removeLayer(tempMarker.value);
    }

    const { value: locationName } = await Swal.fire({
      title: 'New Location',
      input: 'text',
      inputLabel: 'Enter location name',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return 'Location name is required';
      }
    });

    if (locationName) {
      const { value: quantity } = await Swal.fire({
        title: 'Quantity',
        input: 'number',
        inputLabel: `Enter quantity (${forestProduct.value.measurement_units.unit_name})`,
        showCancelButton: true,
        inputValidator: (value) => {
          if (!value) return 'Quantity is required';
        }
      });

      if (quantity) {
        const newLocation = {
          name: locationName,
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        };

        const { data, error } = await supabase
          .from('location')
          .insert([newLocation])
          .select()
          .single();

        if (error) {
          toast.error(error.message, { duration: 2000 });
        } else {
          selectedLocation.value = data;
          selectedLocation.value.quantity = quantity; // Add quantity to selectedLocation
          showLocationModal.value = false;
          await upsertLocation();
        }
      }
    }
  });
};

const upsertLocation = async () => {
  if (!selectedLocation.value) {
    error.value = 'Please select a location';
    return;
  }

  const { error: fpLocationError } = await supabase
    .from('fp_and_location')
    .upsert([{
      forest_product_id: forestProduct.value.id,
      location_id: selectedLocation.value.id,
      quantity: selectedLocation.value.quantity // Include quantity
    }]);

  if (fpLocationError) {
    toast.error(fpLocationError.message, { duration: 2000 });
    return;
  }

  toast.success('Location added successfully', { duration: 2000 });
  fetchLocations();
};

const handleImageChange = (event) => {
  newImage.value = event.target.files[0]
}

const handleImageSubmit = async () => {
  if (!newImage.value) {
    error.value = 'Please select an image'
    return
  }

  const currentDate = new Date()
  const formattedDate = format(currentDate, 'yyyy-MM-dd HH:mm:ss')

  // Upload image to Supabase bucket using S3 protocol
  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('nature_cart_images')
    .upload(`forest_products/${Date.now()}_${newImage.value.name}`, newImage.value, {
      cacheControl: '3600',
      upsert: false,
      contentType: newImage.value.type,
      endpoint: 'https://cikbihrqwkfgvkrdgmqi.supabase.co/storage/v1/s3',
      region: 'ap-southeast-1'
    })

  if (uploadError) {
    error.value = uploadError.message
    return
  }

  const imageUrl = supabase
    .storage
    .from('nature_cart_images')
    .getPublicUrl(uploadData.path)

  // Update forest product with new image URL
  const { error: updateError } = await supabase
    .from('forest_products')
    .update({ image_url: imageUrl, updated_at: formattedDate })
    .eq('id', productId)

  if (updateError) {
    error.value = updateError.message
    return
  }

  toast.success('Image updated successfully', { duration: 2000 })
  showImageModal.value = false
  fetchForestProduct()
}

onMounted(() => {
  fetchForestProduct()
  fetchAllLocations()
  fetchUserDetails()
})
</script>
<template>
  <div class="max-w-4xl mx-auto p-6">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 mt-2 space-y-4 sm:space-y-0">
      <h2 class="text-3xl font-bold text-gray-900">Forest Product Details</h2>
      <div
      v-if="forestProduct"
      class="px-3 py-1 rounded-full text-sm font-medium"
      :class="forestProduct.type === 'Timber' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'"
      >
      {{ forestProduct.type === 'Timber' ? 'Timber' : 'Non-Timber' }}
      </div>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error"
      class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700"
    >
      <div class="flex flex-col sm:flex-row items-start sm:items-center">
      <svg
        class="h-5 w-5 text-red-400 flex-shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
        fill-rule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clip-rule="evenodd"
        />
      </svg>
      <p class="ml-3 mt-2 sm:mt-0">{{ error }}</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-if="forestProduct" class="space-y-6">
      <!-- Product Information Card -->
      <div
      class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
      <div class="p-6">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
        <h3 class="text-2xl font-semibold text-gray-900">
          {{ forestProduct.name }}
        </h3>
        <span class="text-sm text-gray-500 mt-2 sm:mt-0"
          >ID: {{ forestProduct.id }}</span
        >
        </div>

        <!-- Image Section -->
        <div v-if="forestProduct.image_url" class="relative mb-6">
        <img
          :src="forestProduct.image_url"
          alt="Forest Product Image"
          class="w-full h-auto rounded-lg shadow-sm"
        />
        <button
          v-if="isForestRanger || isFPUAdmin"
          @click="showImageModal = true"
          class="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 focus:outline-none"
        >
          <div class="flex justify-between">
          <img src="@/assets/edit.png" alt="Edit" class="w-5 h-5" />
          <p class="ml-1 text-sm text-gray-500">Edit</p>
          </div>
        </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Left Column -->
        <div class="space-y-4">
          <div class="flex items-center space-x-3">
          <div class="p-2 bg-gray-50 rounded-lg">
            <svg
            class="w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
            </svg>
          </div>
          <div>
            <p class="text-sm text-gray-500">Created At</p>
            <p class="text-gray-900">{{ forestProduct.created_at }}</p>
          </div>
          </div>

          <div class="flex items-center space-x-3">
          <div class="p-2 bg-gray-50 rounded-lg">
            <svg
            class="w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
            </svg>
          </div>
          <div>
            <p class="text-sm text-gray-500">Updated At</p>
            <p class="text-gray-900">{{ forestProduct.updated_at }}</p>
          </div>
          </div>
        </div>

        <!-- Right Column -->
        <div class="space-y-4">
          <div class="flex items-center space-x-3">
          <div class="p-2 bg-gray-50 rounded-lg">
            <svg
            class="w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
            </svg>
          </div>
          <div>
            <p class="text-sm text-gray-500">
            Price Based on Measurement Unit
            </p>
            <p class="text-xl font-semibold text-gray-900">
            ₱{{ forestProduct.price_based_on_measurement_unit ? forestProduct.price_based_on_measurement_unit.toLocaleString() : 'N/A' }}
            per {{ forestProduct.measurement_units.unit_name }}
            </p>
          </div>
          </div>

          <div class="flex items-center space-x-3">
          <div class="p-2 bg-gray-50 rounded-lg">
            <svg
            class="w-5 h-5 text-gray-500"
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
          </div>
          <div>
            <p class="text-sm text-gray-500">Locations Available</p>
            <p class="text-xl font-semibold text-gray-900">
            {{ locations.length }} Locations
            </p>
          </div>
          </div>
        </div>
        </div>

        <!-- Description Section -->
        <div class="mt-6 pt-6 border-t border-gray-100">
        <h4 class="text-sm font-medium text-gray-500 mb-2">Description</h4>
        <p class="text-gray-700">{{ forestProduct.description }}</p>
        </div>
      </div>
      </div>

      <!-- Locations Section -->
      <div
        class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <!-- Header -->
        <div class="p-6 border-b border-gray-100">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div class="flex items-center space-x-2">
          <svg
            class="w-6 h-6 text-gray-500"
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
          <h3 class="text-xl font-semibold text-gray-900">
            Product Locations
          </h3>
        </div>

        <button
          @click="showLocationModal = true; $nextTick(() => initializeModalMap())"
          class="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
        >
          <svg
            class="w-5 h-5 mr-2"
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
          Add Location
        </button>
          </div>
        </div>

        <!-- Locations List -->
        <div class="divide-y divide-gray-100">
          <div
        v-for="location in locations"
        :key="location.id"
        class="p-4 hover:bg-gray-50 transition-all duration-200"
          >
        <div class="flex flex-col sm:flex-row items-start sm:items-center">
          <div class="p-2 bg-gray-100 rounded-lg">
            <svg
          class="w-5 h-5 text-gray-600"
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
            d="M15 11a3 3 0 11-6 0 3 3 0z"
          />
            </svg>
          </div>

          <div class="ml-4 flex-grow mt-2 sm:mt-0">
            <h4 class="font-medium text-gray-900">{{ location.name }}</h4>
            <div class="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600">
          <div class="flex items-center space-x-1">
            <span class="font-medium">Lat:</span>
            <span>{{ location.latitude }}</span>
          </div>
          <div class="flex items-center space-x-1">
            <span class="font-medium">Long:</span>
            <span>{{ location.longitude }}</span>
          </div>
          <div class="flex items-center space-x-1">
            <span class="font-medium">Quantity:</span>
            <span
              >{{ location.quantity ? location.quantity : 'N/A' }}
              {{ forestProduct.measurement_units.unit_name }}(s)</span
            >
          </div>
            </div>
          </div>

          <div class="ml-4 flex items-center space-x-2 mt-2 sm:mt-0">
            <button
          @click="editLocation(location)"
          class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          title="Edit Location"
            >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
            </button>
            <button
          @click="deleteLocation(location.id)"
          class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          title="Delete Location"
            >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
            </button>
          </div>
        </div>
          </div>
        </div>

        <!-- Edit Location Modal -->
        <div
          v-if="showEditLocationModal"
          class="fixed inset-0 z-50 overflow-y-auto"
        >
          <div
            class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0"
          >
            <!-- Background overlay -->
            <div
              class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              @click="showEditLocationModal = false"
            ></div>

            <!-- Modal panel -->
            <div
              class="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
            >
              <div class="sm:flex sm:items-start">
          <div
            class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10"
          >
            <svg
              class="h-6 w-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </div>
          <div class="mt-3 w-full sm:mt-0 sm:ml-4">
            <h3 class="text-lg font-medium leading-6 text-gray-900">
              Edit Forest Product's Quantity in this Location ({{ forestProduct.measurement_units.unit_name }})
            </h3>
            <div class="mt-4">
              <input
                type="number"
                v-model="editLocationQuantity"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                :placeholder="`Enter quantity (${forestProduct.measurement_units.unit_name})`"
              />
            </div>
          </div>
              </div>
              <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            @click="updateLocationQuantity"
            class="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Update
          </button>
          <button
            type="button"
            @click="showEditLocationModal = false"
            class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
          >
            Cancel
          </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Map Container -->
        <div
          v-if="locations.length != 0"
          id="locationMap"
          class="mt-6 h-[400px] w-full rounded-lg overflow-hidden border border-gray-200 shadow-inner"
          style="z-index: 1;"
        ></div>
      </div>
    </div>

 <!-- Map Modal -->
 <div v-if="showLocationModal" class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="showLocationModal = false"></div>

      <!-- Modal panel -->
      <div class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle">
        <div class="px-6 pt-5 pb-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2">
              <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 class="text-lg font-medium text-gray-900">Select Location</h3>
            </div>
            <button 
              @click="showLocationModal = false"
              class="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div id="modalMap" class="h-[400px] w-full rounded-lg border border-gray-200 shadow-inner mb-4"></div>
          
          <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              @click="cancelMapModal"
              class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showImageModal" class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="showImageModal = false"></div>

      <!-- Modal panel -->
      <div class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
        <div class="px-6 pt-5 pb-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2">
              <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 class="text-lg font-medium text-gray-900">Update Image</h3>
            </div>
            <button 
              @click="showImageModal = false"
              class="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="mt-2">
            <label class="block text-sm font-medium text-gray-700 mb-2">Choose an image</label>
            <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
              <div class="space-y-1 text-center">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div class="flex text-sm text-gray-600">
                  <label class="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
                    <span>Upload a file</span>
                    <input 
                      type="file" 
                      @change="handleImageChange"
                      class="sr-only"
                    />
                  </label>
                  <p class="pl-1">(image files only)</p>
                </div>
                <!-- <p class="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p> -->
              </div>
            </div>
          </div>

          <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              @click="handleImageSubmit"
              class="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Update
            </button>
            <button
              type="button"
              @click="showImageModal = false"
              class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
    <Toaster />
  </div>
</template>

<style>
@import "leaflet/dist/leaflet.css";
</style>
