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
const showMeasurementUnitModal = ref(false);
const newMeasurementUnit = ref({
  unit_name: ''
});

const fetchLocations = async () => {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, latitude, longitude')
    .order('name');

  if (error) {
    console.error('Error fetching locations:', error);
  } else {
    // Initialize each location with a quantity property set to 0
    locations.value = data.map(loc => ({
      ...loc,
      quantity: 0
    }));
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

const updateLocationQuantity = (location, event) => {
  const value = parseFloat(event.target.value);
  const index = locations.value.findIndex(loc => loc.id === location.id);

  if (index !== -1) {
    locations.value[index].quantity = isNaN(value) ? 0 : value;
  }

  // If this location is selected, update its quantity in selectedLocations as well
  const selectedIndex = selectedLocations.value.findIndex(loc => loc.id === location.id);
  if (selectedIndex !== -1) {
    selectedLocations.value[selectedIndex].quantity = isNaN(value) ? 0 : value;
  }
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
  // Check if all required fields are filled
  const hasBasicInfo = name.value && description.value && type.value && selectedMeasurementUnit.value;

  // Check if at least one location is selected with a quantity greater than 0
  const hasValidLocations = selectedLocations.value.length > 0 &&
    selectedLocations.value.some(loc => loc.quantity > 0);

  // Return true only if all conditions are met
  return hasBasicInfo && hasValidLocations;
});

// Add a computed property to check for zero-quantity locations
const hasZeroQuantityLocations = computed(() => {
  return selectedLocations.value.some(loc => !loc.quantity || loc.quantity <= 0);
});

const handleAddMeasurementUnit = async () => {
  if (!newMeasurementUnit.value.unit_name) {
    toast.error('Please enter a unit name');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('measurement_units')
      .insert([{
        unit_name: newMeasurementUnit.value.unit_name
      }])
      .select()
      .single();

    if (error) throw error;

    // Add the new unit to the local list
    measurementUnits.value.push(data);
    
    // Reset the form
    newMeasurementUnit.value = {
      unit_name: ''
    };
    
    // Close the modal
    showMeasurementUnitModal.value = false;
    
    toast.success('Measurement unit added successfully');
  } catch (error) {
    console.error('Error adding measurement unit:', error);
    toast.error(error.message || 'Failed to add measurement unit');
  }
};

onMounted(() => {
  fetchLocations();
});
</script>
<template>
  <div class="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
    <!-- Header Section with subtle gradient background -->
    <div
      class="mb-8 bg-gradient-to-r bg-gray-100 rounded-xl p-6 shadow-sm border border-green-100"
    >
      <div class="flex flex-col sm:flex-row items-center sm:items-start">
      <div class="flex-shrink-0 bg-gray-50 rounded-full p-3 flex space-x-2 mb-4 sm:mb-0">
        <img
        src="@/assets/add.png"
        alt="Add"
        class="w-8 h-8 transition-all duration-300 group-hover:scale-110"
        />
        <img
        src="@/assets/forest-product.png"
        alt="Forest Map"
        class="w-8 h-8 transition-all duration-300 group-hover:scale-110"
        />
      </div>
      <div class="sm:ml-5 text-center sm:text-left">
        <h2 class="text-2xl font-bold text-green-800">
        Create Forest Product
        </h2>
        <p class="mt-1 text-sm text-green-600">
        Complete the form below to add a new forest product to the system
        </p>
      </div>
      </div>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error"
      class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-md flex items-center"
    >
      <svg
        class="h-5 w-5 text-red-400 mr-3 flex-shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
      <p>{{ error }}</p>
    </div>

    <!-- Form with better spacing and organization -->
    <form
      @submit.prevent="showConfirmationDialog"
      class="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden"
    >
      <!-- Form content with sections -->
      <div class="p-6 space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Basic Information Section -->
          <div class="md:col-span-2">
            <h3
              class="text-lg font-medium text-gray-800 mb-4 pb-2 border-b border-gray-100"
            >
              Basic Information
            </h3>
          </div>

          <!-- Name input -->
          <div class="space-y-2">
            <Label for="name" class="text-gray-700">Product Name</Label>
            <Input
              id="name"
              v-model="name"
              type="text"
              class="w-full"
              placeholder="Enter product name"
              required
            />
          </div>

          <!-- Type select -->
          <div class="space-y-2">
            <Label for="type" class="text-gray-700">Product Type</Label>
            <Select v-model="type" required>
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select product type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="Timber">Timber</SelectItem>
                  <SelectItem value="Non-Timber">Non-Timber</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <!-- Description input - full width -->
          <div class="md:col-span-2 space-y-2">
            <Label for="description" class="text-gray-700">Description</Label>
            <Textarea
              id="description"
              v-model="description"
              required
              placeholder="Describe the forest product"
              class="min-h-24"
            ></Textarea>
          </div>

          <!-- Measurement section -->
          <div class="md:col-span-2 pt-4">
            <h3
              class="text-lg font-medium text-gray-800 mb-4 pb-2 border-b border-gray-100"
            >
              Measurement & Pricing
            </h3>
          </div>

          <!-- Measurement Unit select -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <Label for="measurementUnit" class="text-gray-700">Measurement Unit</Label>
              <button
                type="button"
                @click="showMeasurementUnitModal = true"
                class="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>
                Add New Unit
              </button>
            </div>
            <Select v-model="selectedMeasurementUnit" required>
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select unit of measurement" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="unit in measurementUnits"
                    :key="unit.id"
                    :value="unit.id"
                  >
                    {{ unit.unit_name }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <!-- Price input -->
          <div class="space-y-2">
            <Label for="price" class="text-gray-700">Price per Unit</Label>
            <div class="relative">
              <span
                class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500"
                >₱
              </span>
              <input
                id="price"
                v-model="price_based_on_measurement_unit"
                type="number"
                required
                placeholder="0.00"
                class="pl-8 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                @input="(e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, ''); quantity.value = parseFloat(e.target.value) || 0; }"
              />
            </div>
            <p
              v-if="!price_based_on_measurement_unit || parseFloat(price_based_on_measurement_unit) === 0"
              class="text-sm text-gray-500 mt-1"
            >
              Setting the price to 0 or leaving it blank indicates that this
              product is free.
            </p>
          </div>

          <!-- Location & Image section -->
          <div class="md:col-span-2 pt-4">
            <h3
              class="text-lg font-medium text-gray-800 mb-4 pb-2 border-b border-gray-100"
            >
              Location & Image
            </h3>
          </div>

          <!-- Location select -->
          <div class="space-y-2">
            <Label class="text-gray-700">Location</Label>
            <button
              type="button"
              @click="showLocationModal = true"
              class="w-full flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <span
                class="text-gray-700"
                >{{ selectedLocations.length ? `${selectedLocations.length} location(s) selected` : 'Select location(s)' }}</span
              >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-gray-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <p v-if="selectedLocationsNote" class="mt-2 text-sm text-gray-500">
              <span class="font-medium">Selected:</span>
              {{ selectedLocationsNote }}
            </p>
            <!-- Add this below the selected locations section -->
            <div
              v-if="hasZeroQuantityLocations && selectedLocations.length > 0"
              class="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 rounded-md"
            >
              <div class="flex items-start">
                <svg
                  class="h-5 w-5 text-yellow-400 mr-3 flex-shrink-0 mt-0.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
                <p>
                  One or more locations have no quantity. Please enter a
                  quantity greater than 0 for each selected location.
                </p>
              </div>
            </div>
          </div>

          <!-- Image input with confirmation text -->
          <div class="space-y-2">
            <Label for="image" class="text-gray-700">Product Image</Label>
            <div
              class="border-2 border-dashed border-gray-300 rounded-md p-4 hover:border-emerald-300 transition-colors"
            >
              <input
                id="image"
                type="file"
                @change="handleImageChange"
                class="hidden"
              />
              <label
                for="image"
                class="cursor-pointer flex flex-col items-center justify-center space-y-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span class="text-sm text-gray-500"
                  >Click to upload product image</span
                >
              </label>
            </div>
            <!-- Show confirmation text if image is uploaded -->
            <div v-if="image" class="mt-4 flex items-center space-x-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-emerald-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
              <p class="text-sm text-gray-600">
                Image uploaded. Upload again to replace the image.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-4 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-md">
        <p class="text-sm text-blue-700">
          Complete the form and select at least one location with a quantity to enable the "Create Product" button.
        </p>
      </div>
      <!-- Submit button section -->
      <div class="bg-gray-50 px-6 py-4 flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger>
        <button
          type="button"
          :disabled="!isFormValid"
          :class="[
          'font-medium py-2 px-6 rounded-md shadow transition-colors duration-300',
          isFormValid 
        ? 'bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500' 
        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        ]"
        >
          Create Product
        </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Creation</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to create this forest product with the
            provided information?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            class="bg-gray-100 hover:bg-gray-200 text-gray-800"
            >Cancel</AlertDialogCancel
          >
          <AlertDialogAction
            @click="handleSubmit"
            class="bg-emerald-600 hover:bg-emerald-700"
            >Create</AlertDialogAction
          >
        </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </form>

    <!-- Location Modal -->
    <div v-if="showLocationModal" class="fixed inset-0 z-50 overflow-y-auto">
      <!-- Modal Backdrop -->
      <div
        class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
      ></div>

      <!-- Modal Container -->
      <div class="flex items-center justify-center min-h-screen px-4 py-8">
        <!-- Modal Content -->
        <div class="relative bg-white rounded-xl shadow-xl max-w-4xl w-full">
          <!-- Modal Header -->
          <header class="px-6 py-4 border-b border-gray-100">
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-medium text-gray-800">
                Select Locations
              </h3>
              <button
                @click="showLocationModal = false"
                class="text-gray-400 hover:text-gray-500"
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
          </header>

          <!-- Location List -->
          <div class="p-6">
            <div class="max-h-96 overflow-y-auto">
              <div
                v-for="location in locations"
                :key="location.id"
                class="flex items-center justify-between p-4 mb-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <!-- Checkbox and Label -->
                <div class="flex items-center flex-1">
                  <input
                    type="checkbox"
                    :id="`location-${location.id}`"
                    :value="location"
                    v-model="selectedLocations"
                    class="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <label
                    :for="`location-${location.id}`"
                    class="ml-3 cursor-pointer"
                  >
                    <span
                      class="font-medium text-gray-800"
                      >{{ location.name }}</span
                    >
                    <span class="text-gray-500 text-sm block">
                      Coordinates: {{ location.latitude }},
                      {{ location.longitude }}
                    </span>
                  </label>
                </div>
                <!-- Quantity Input -->
                <div class="ml-4 flex items-center">
                  <label class="mr-2 text-sm text-gray-600"
                    >Quantity ({{ selectedMeasurementUnit ? measurementUnits.find(unit => unit.id === selectedMeasurementUnit)?.unit_name : ''

                    }}):</label
                  >
                  <input
                    type="number"
                    v-model="location.quantity"
                    :disabled="!selectedLocations.includes(location)"
                    placeholder="0"
                    class="w-20 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <!-- Visualize Button -->
                <button
                  type="button"
                  @click="visualizeLocation(location)"
                  class="ml-4 flex items-center justify-center px-3 py-1 text-sm font-medium text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  View Map
                </button>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <footer
            class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end"
          >
            <Button
              type="button"
              @click="showLocationModal = false"
              class="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Done
            </Button>
          </footer>
        </div>
      </div>
    </div>

    <!-- Map Modal -->
    <div v-if="showMapModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div
        class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center"
      >
        <div
          class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        ></div>
        <div
          class="relative bg-white rounded-xl shadow-xl p-6 max-w-4xl w-full"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-800">Location Map</h3>
            <button
              type="button"
              @click="showMapModal = false"
              class="text-gray-400 hover:text-gray-500"
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
          <div
            id="map"
            class="h-96 w-full rounded-lg border border-gray-200 mb-4"
          ></div>
          <div class="flex justify-end">
            <button
              type="button"
              @click="showMapModal = false"
              class="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Measurement Unit Modal -->
    <div v-if="showMeasurementUnitModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"></div>
      <div class="flex items-center justify-center min-h-screen px-4 py-8">
        <div class="relative bg-white rounded-xl shadow-xl max-w-md w-full">
          <header class="px-6 py-4 border-b border-gray-100">
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-medium text-gray-800">Add New Measurement Unit</h3>
              <button
                @click="showMeasurementUnitModal = false"
                class="text-gray-400 hover:text-gray-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </header>

          <div class="p-6">
            <div class="space-y-4">
              <div class="space-y-2">
                <Label for="unitName" class="text-gray-700">Unit Name</Label>
                <Input
                  id="unitName"
                  v-model="newMeasurementUnit.unit_name"
                  type="text"
                  placeholder="Enter unit name (e.g., kg, pieces, etc.)"
                  required
                />
              </div>
            </div>
          </div>

          <footer class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
            <Button
              type="button"
              @click="showMeasurementUnitModal = false"
              class="bg-gray-100 hover:bg-gray-200 text-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              @click="handleAddMeasurementUnit"
              class="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Add Unit
            </Button>
          </footer>
        </div>
      </div>
    </div>

    <Toaster
  theme="light"
  :toastOptions="{
    class: 'bg-[#ecfdf5] text-gray-800 border border-green-200 rounded-lg shadow-md',
    style: {
      padding: '1rem',
    }
  }"
/>

  </div>
</template>
