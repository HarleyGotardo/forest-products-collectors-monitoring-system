<script setup>
import { CommonConstant } from "@/components/constants/common.constant";
import { DatabaseNamesConstant } from "@/components/constants/databaseNames.constant";
import { RouterNamesConstant } from "@/components/constants/routerNames.constant";
import { SeparatorConstant } from "@/components/constants/separators.constant";
import { ref, onMounted, nextTick, computed } from "vue";
import { useRouter } from "vue-router";
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import locationPeek from '@/assets/location-peek.png';
import {toast, Toaster} from 'vue-sonner';
import Button from "@/components/ui/button/Button.vue";
import Input from "@/components/ui/input/Input.vue";
import Label from "@/components/ui/label/Label.vue";
import Textarea from "@/components/ui/textarea/Textarea.vue";
import 
{
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    .from('locations')
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
      .from('fp_and_locations')
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
      .from('fp_and_locations')
      .insert([{
        forest_product_id: fpData.id,
        location_id: location.id,
        quantity: location.quantity // Save quantity
      }]);

    if (fpLocationError) {
      error.value = fpLocationError.message;
      return;
    }
  }

  toast.success('Forest product created successfully', { duration: 2000 });
  router.push(RouterNamesConstant.FOREST_PRODUCTS);
};

const visualizeLocation = (location) => {
  currentLocation.value = location;
  showMapModal.value = true;
  nextTick(() => initializeMap(location.latitude, location.longitude, location.name));
};

const selectedLocationsNote = computed(() => {
  return selectedLocations.value.map(location => location.name).join(", ");
});

const isFormValid = computed(() => {
  return name.value && description.value && type.value && selectedMeasurementUnit.value && price_based_on_measurement_unit.value && selectedLocations.value.length > 0;
});

onMounted(() => {
  fetchLocations();
});
</script>
<template>
  <div class="max-w-7xl mx-auto p-6">
    
    <!-- Header Section -->
    <div class="flex justify-between items-center mb-8">
      <div class="flex items-center space-x-4">
      <img src="@/assets/add.png" alt="Forest Map" class="w-12 h-12 group-hover:scale-110 transition-transform" />
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Create Forest Product</h2>
        <p class="mt-1 text-sm text-gray-500">Fill in the details to create a new forest product</p>
      </div>
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
    <form @submit.prevent="showConfirmationDialog" class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6 space-y-4">
      <!-- Name input -->
      <div>
        <Label for="name">Name</Label>
        <Input
          id="name"
          v-model="name"
          type="text"
          class="mt-1"
          required
        />
      </div>

      <!-- Description input -->
      <div>
        <Label for="description">Description</Label>
        <Textarea
          id="description"
          v-model="description"
          required
          class="mt-1"
        ></Textarea>
      </div>

      <!-- Type select -->
      <div>
        <Label for="type">Type (Timber, Non-Timber)</Label>
        <Select v-model="type" required>
          <SelectTrigger class="mt-1">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="Timber">Timber</SelectItem>
              <SelectItem value="Non-Timber">Non-Timber</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <!-- Measurement Unit select -->
      <div>
        <Label for="measurementUnit">Measurement Unit</Label>
        <Select v-model="selectedMeasurementUnit" required>
          <SelectTrigger class="mt-1">
            <SelectValue placeholder="Select measurement unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem v-for="unit in measurementUnits" :key="unit.id" :value="unit.id">
                {{ unit.unit_name }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <!-- Image input -->
      <div>
        <Label for="image">Image</Label>
        <Input
          id="image"
          type="file"
          @change="handleImageChange"
          class="mt-1"
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
          @input="(e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, ''); quantity.value = parseFloat(e.target.value) || 0; }"
        />
      </div>

      <!-- Submit button -->
      <div class="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger>
            <button 
              type="button"
              :disabled="!isFormValid"
              class="disabled:opacity-50 disabled:cursor-not-allowed bg-black text-white font-semibold py-2 px-4 rounded-md shadow hover:bg-green-700 transition-colors duration-300"
            >
              + Create
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Creation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to create this forest product?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction @click="handleSubmit">Create</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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

              <!-- Quantity Input -->
              <div class="ml-4">
                <input
                  type="number"
                  v-model="location.quantity"
                  placeholder="Quantity"
                  class="w-24 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
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
            <Button
              type="button"
              @click="showLocationModal = false"
            >
              Done
            </Button>
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
    <Toaster />
  </div>
</template>