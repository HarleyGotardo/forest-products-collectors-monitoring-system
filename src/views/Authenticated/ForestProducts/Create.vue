<script setup>
import { CommonConstant } from "@/components/constants/common.constant";
import { DatabaseNamesConstant } from "@/components/constants/databaseNames.constant";
import { RouterNamesConstant } from "@/components/constants/routerNames.constant";
import { SeparatorConstant } from "@/components/constants/separators.constant";
import { ref, onMounted, nextTick, computed } from "vue";
import { useRouter } from "vue-router";
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import Swal from 'sweetalert2';
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import locationPeek from '@/assets/location-peek.png';

// Fix for Leaflet default marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

const router = useRouter();
const name = ref(SeparatorConstant.EMPTY_STRING);
const description = ref(SeparatorConstant.EMPTY_STRING);
const type = ref(CommonConstant.SINGLE_STRING.T);
const quantity = ref(SeparatorConstant.EMPTY_STRING);
const price_based_on_measurement_unit = ref(SeparatorConstant.EMPTY_STRING);
const image = ref(null);
const measurementUnits = ref(null);
const selectedMeasurementUnit = ref(null);
const error = ref(null);
const locations = ref([]);
const selectedLocations = ref([]);
const showLocationModal = ref(false);
const showMapModal = ref(false);
const mapInstance = ref(null);
const tempMarker = ref(null);
const currentLocation = ref(null);

const fetchLocations = async () => {
  const { data, error } = await supabase
    .from('location')
    .select('id, name, latitude, longitude')
    .order('name');

  if (error) {
    console.error('Error fetching locations:', error);
  } else {
    locations.value = data;
  }
};

const fetchAllMeasurementUnits = async () => {
  const { data, error } = await supabase
    .from('measurement_units')
    .select('*');

  if (error) {
    console.error('Error fetching measurement units:', error);

  } else {
    measurementUnits.value = data;
    console.log(measurementUnits.value);
  }
};

onMounted(() => {
  fetchLocations();
  fetchAllMeasurementUnits();
});

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
    });
};

const handleImageChange = (event) => {
  image.value = event.target.files[0];
};

const handleSubmit = async () => {
  if (selectedLocations.value.length === 0) {
    error.value = 'Please select at least one location';
    return;
  }

  const currentDate = new Date();
  const formattedDate = format(currentDate, CommonConstant.DATE_FORMAT.ISO_8601);

  let imageUrl = null;

  // Upload image to Supabase bucket using S3 protocol
  if (image.value) {
    const imageName = `${name.value.replace(/\s+/g, '_')}_${Date.now()}`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('nature_cart_images')
      .upload(`forest_products/${imageName}`, image.value, {
        cacheControl: '3600',
        upsert: false,
        contentType: image.value.type,
        endpoint: 'https://cikbihrqwkfgvkrdgmqi.supabase.co/storage/v1/s3',
        region: 'ap-southeast-1'
      });

    if (uploadError) {
      error.value = uploadError.message;
      return;
    }

    imageUrl = supabase
      .storage
      .from('nature_cart_images')
      .getPublicUrl(uploadData.path);
  }

  // Convert price_based_on_measurement_unit to a number
  const price = parseFloat(price_based_on_measurement_unit.value);

  // Insert forest product
  const { data: fpData, error: fpError } = await supabase
    .from('forest_products')
    .insert([{
      name: name.value,
      description: description.value,
      type: type.value,
      quantity: quantity.value,
      price_based_on_measurement_unit: isNaN(price) ? null : price,
      image_url: imageUrl, // Store image URL
      measurement_unit_id: selectedMeasurementUnit.value,
      created_at: formattedDate,
      updated_at: formattedDate,
    }])
    .select()
    .single();

  if (fpError) {
    error.value = fpError.message;
    return;
  }

  // Insert fp_and_location relationships
  for (const location of selectedLocations.value) {
    // Check for duplicate location
    const { data: existingFpLocation, error: existingFpLocationError } = await supabase
      .from('fp_and_location')
      .select('*')
      .eq('forest_product_id', fpData.id)
      .eq('location_id', location.id)
      .single();

    if (existingFpLocationError && existingFpLocationError.code !== 'PGRST116') {
      error.value = existingFpLocationError.message;
      return;
    }

    if (existingFpLocation) {
      error.value = `This forest product already has the location: ${location.name}.`;
      return;
    }

    const { error: fpLocationError } = await supabase
      .from('fp_and_location')
      .insert([{
        forest_product_id: fpData.id,
        location_id: location.id
      }]);

    if (fpLocationError) {
      error.value = fpLocationError.message;
      return;
    }
  }

  Swal.fire({
    icon: CommonConstant.SWAL.ICON,
    title: CommonConstant.SWAL.TITLE,
    text: CommonConstant.SWAL.TEXT,
    timer: CommonConstant.SWAL.TIMER,
    showConfirmButton: CommonConstant.SWAL.SHOW_CONFIRM_BUTTON
  }).then(() => {
    router.push(RouterNamesConstant.FOREST_PRODUCTS);
  });
};

const visualizeLocation = (location) => {
  currentLocation.value = location;
  showMapModal.value = true;
  nextTick(() => initializeMap(location.latitude, location.longitude, location.name));
};

const selectedLocationsNote = computed(() => {
  return selectedLocations.value.map(location => location.name).join(", ");
});

onMounted(() => {
  fetchLocations();
});
</script>
<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header Section -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Create Forest Product</h2>
        <p class="mt-1 text-sm text-gray-500">Fill in the details to create a new forest product</p>
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
        <label for="type" class="block text-sm font-medium text-gray-700">Type (Timber, Non-Timber)</label>
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

      <!-- Image input -->
      <div>
        <label for="image" class="block text-sm font-medium text-gray-700">Image</label>
        <input
          id="image"
          type="file"
          @change="handleImageChange"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>

      <!-- Location select with dropdown -->
      <div>
        <label class="block text-sm font-medium text-gray-700">Location</label>
        <button
          type="button"
          @click="showLocationModal = true"
          class="mt-1 w-full px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-left hover:bg-gray-50"
        >
          Select location(s)
        </button>
        <p v-if="selectedLocationsNote" class="mt-2 text-sm text-gray-500">
    <strong>Selected Locations:</strong> {{ selectedLocationsNote }}
    </p>
      </div>

      <!-- Price input -->
      <div>
        <label for="price" class="block text-sm font-medium text-gray-700">Price based on measurement unit</label>
        <input
          id="price"
          v-model="price_based_on_measurement_unit"
          type="number"
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
          Create
        </button>
      </div>
    </form>

    <!-- Location Modal -->
    <div v-if="showLocationModal" class="fixed inset-0 z-50 overflow-y-auto">
    <!-- Modal Backdrop -->
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

    <!-- Modal Container -->
    <div class="flex items-center justify-center min-h-screen px-4 py-8">
      <!-- Modal Content -->
      <div class="relative bg-white rounded-xl shadow-xl p-8 max-w-4xl w-full">
        <!-- Modal Header -->
        <header class="mb-6">
          <h3 class="text-xl font-semibold text-gray-900">
            Select Location(s)
          </h3>
        </header>

        <!-- Location List -->
        <div class="space-y-4 max-h-96 overflow-y-auto">
          <div 
            v-for="location in locations" 
            :key="location.id" 
            class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <!-- Checkbox and Label -->
            <div class="flex items-center flex-1">
              <input
                type="checkbox"
                :id="`location-${location.id}`"
                :value="location"
                v-model="selectedLocations"
                class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <label 
                :for="`location-${location.id}`" 
                class="ml-3 text-gray-700 font-medium"
              >
                {{ location.name }}
                <span class="text-gray-500 text-sm ml-2">
                  ({{ location.latitude }}, {{ location.longitude }})
                </span>
              </label>
            </div>

            <!-- Visualize Button -->
            <button
              type="button"
              @click="visualizeLocation(location)"
              class="ml-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
            >
              <img :src="locationPeek" alt="">
            </button>
          </div>
        </div>

        <!-- Modal Footer -->
        <footer class="mt-8 flex justify-end">
          <button
            type="button"
            @click="showLocationModal = false"
            class="px-6 py-2.5 bg-gray-100 text-gray-800 font-medium rounded-lg
                   hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300
                   transition-colors"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  </div>

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
  </div>
</template>