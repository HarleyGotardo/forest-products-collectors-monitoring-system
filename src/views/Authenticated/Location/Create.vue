<script setup>
import { CommonConstant } from "@/components/constants/common.constant";
import { CoordinatesConstant } from "@/components/constants/coordinates.constant";
import { DatabaseNamesConstant } from "@/components/constants/databaseNames.constant";
import { RouterNamesConstant } from "@/components/constants/routerNames.constant";
import { SeparatorConstant } from "@/components/constants/separators.constant";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { nextTick, ref, watch, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'
import Button from "@/components/ui/button/Button.vue";
import Input from "@/components/ui/input/Input.vue";
import Label from "@/components/ui/label/Label.vue";
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

const router = useRouter();
const name = ref(SeparatorConstant.EMPTY_STRING);
const error = ref(null);
const isModalOpen = ref(false);
const modalField = ref(SeparatorConstant.EMPTY_STRING);
const modalValue = ref(null);
let coordinatesObj = ref(null);
const coordinates = ref("");
let mapInstance = null;
const existingLocations = ref([]);

const fetchLocations = async () => {
  const { data, error } = await supabase
    .from('locations')
    .select('*');

  if (error) {
    toast.error(error.message, { duration: 3000 });
  } else {
    existingLocations.value = data;
  }
};

onMounted(() => {
  fetchLocations();
});

const handleSubmit = async () => {
  const currentDate = new Date();
  const formattedDate = format(
    currentDate,
    CommonConstant.DATE_FORMAT.ISO_8601
  );
  
  const payload = {
    name: name.value,
    latitude: coordinatesObj.value.lat,
    longitude: coordinatesObj.value.lng,
    created_at: formattedDate,
    updated_at: formattedDate,
  };

  const { error: insertError } = await supabase
    .from('locations')
    .insert([payload]);

  if (insertError) {
    error.value = insertError.message
    toast.error(insertError.message, { duration: 3000 })
  } else {
    toast.success('Location saved successfully', { duration: 2000 });
    router.push('/authenticated/locations');
  }
};

const openModal = (field) => {
  modalField.value = field;
  modalValue.value = name.value;
  isModalOpen.value = true;

  nextTick(() => {
    if (field === 'coordinates') {
      initializeMap();
    }
  });
};

const closeModal = () => {
  isModalOpen.value = false;
  modalField.value = "";
  modalValue.value = null;

  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
};

const saveModalValue = () => {
  if (modalField.value === 'coordinates') {
    name.value = modalValue.value;
  }
  closeModal();
};

const initializeMap = () => {
  const mapContainer = document.getElementById("map");
  let currentMark = null;

  if (!mapContainer || mapInstance || CommonConstant.INTEGERS.ZERO === mapContainer.offsetHeight) {
    return;
  }

  mapInstance = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: true,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    dragging: true,
  }).setView(
    CoordinatesConstant.VISAYAS_STATE_UNIVERSITY_COORDINATES,
    CommonConstant.MAP_ZOOM_LEVEL.SIXTEEN
  );

  L.tileLayer(CommonConstant.MAP_LAYER, {
    maxZoom: CommonConstant.MAP_ZOOM_LEVEL.NINETEEN,
  }).addTo(mapInstance);

  // Add existing location markers
  existingLocations.value.forEach(location => {
    L.marker([location.latitude, location.longitude])
      .addTo(mapInstance)
      .bindPopup(location.name)
      .on('click', () => {
        toast.error('A location already exists at these coordinates', { duration: 3000 });
      });
  });

  mapInstance.on("click", (mapEvent) => {
    const latLngObj = {
      lat: mapEvent.latlng.lat,
      lng: mapEvent.latlng.lng,
    };

    // Check if the clicked coordinates match any existing location
    const isDuplicateLocation = existingLocations.value.some(location => 
      location.latitude === latLngObj.lat && location.longitude === latLngObj.lng
    );

    if (isDuplicateLocation) {
      toast.error('A location already exists at these coordinates', { duration: 3000 });
      return;
    }

    if (currentMark) {
      mapInstance.removeLayer(currentMark);
    }

    currentMark = L.marker([latLngObj.lat, latLngObj.lng]).addTo(mapInstance);

    L.popup()
      .setLatLng(mapEvent.latlng)
      .setContent(
        `${CommonConstant.COMPONENT_TEXTS.YOU_CLICKED_THE_MAP_AT} 
        ${latLngObj.lat.toFixed(CommonConstant.INTEGERS.TWO)}, 
        ${latLngObj.lng.toFixed(CommonConstant.INTEGERS.TWO)}.`
      )
      .openOn(mapInstance);

    coordinatesObj.value = latLngObj;
    coordinates.value = `${latLngObj.lat}, ${latLngObj.lng}`;

    watch(coordinatesObj, (newValue) => {
      if (newValue) {
        const { lat, lng } = newValue;
        coordinates.value = `${lat}, ${lng}`;
      }
    });
  });
};

const isFormValid = computed(() => {
  return name.value && coordinates.value;
});
</script>
<template>
  <div class="max-w-2xl mx-auto p-6 sm:p-8 bg-white rounded-xl shadow-md border border-gray-100 mt-8">
    <!-- Header with improved design -->
    <div class="flex items-center space-x-3 mb-8 pb-4 border-b border-gray-100">
      <div class="bg-green-100 p-2 rounded-full">
        <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Create Location</h2>
        <p class="text-sm text-gray-500 mt-1">Add a new location</p>
      </div>
    </div>

    <!-- Error Alert with improved styling -->
    <div v-if="error" class="mb-6 p-4 rounded-lg bg-red-50 border-l-4 border-red-500 flex items-center">
      <svg class="w-5 h-5 text-red-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span class="text-red-700">{{ error }}</span>
    </div>

    <!-- Form with better spacing and visual hierarchy -->
    <form @submit.prevent="showConfirmationDialog" class="space-y-6">
      <!-- Location Name with helper text -->
      <div class="space-y-2">
        <Label for="name" class="text-gray-700 font-medium">
          Location Name
        </Label>
        <Input
          id="name"
          v-model="name"
          type="text"
          class="w-full focus:ring-green-500 focus:border-green-500"
          placeholder="Enter a descriptive name for this location"
        />
        <p class="text-xs text-gray-500 mt-1">Choose a clear, identifiable name for this forest location</p>
      </div>

      <!-- Coordinates with improved interaction design -->
      <div class="space-y-2">
        <Label for="coordinates" class="text-gray-700 font-medium">
          Coordinates
        </Label>
        <div class="relative">
          <button
            type="button"
            @click="openModal('coordinates')"
            class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 hover:bg-gray-50 transition-colors flex justify-between items-center"
          >
            <span class="block truncate">
              {{ coordinates || "Click to set location coordinates" }}
            </span>
            <div class="flex items-center text-green-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-1">Click to open the map and select precise coordinates</p>
      </div>

      <!-- Visual preview of the selected location (optional component) -->
      <div v-if="coordinates" class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 class="text-sm font-medium text-gray-700 mb-2">Selected Location Preview</h3>
        <div class="h-24 bg-green-50 rounded border border-green-100 flex items-center justify-center">
          <div class="text-center text-sm text-gray-500">
            <svg class="w-6 h-6 text-green-500 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {{ coordinates }}
          </div>
        </div>
      </div>

      <!-- Submit Button with improved styling -->
      <div class="flex justify-end pt-4">
        <AlertDialog>
          <AlertDialogTrigger>
            <button
              type="button"
              :disabled="!isFormValid"
              class="inline-flex items-center px-5 py-2.5 bg-green-600 border border-transparent rounded-md font-medium text-sm text-white hover:bg-green-700 active:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Location
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent class="rounded-lg">
            <AlertDialogHeader>
              <AlertDialogTitle class="text-xl">Confirm Creation</AlertDialogTitle>
              <AlertDialogDescription class="text-gray-600">
                Are you sure you want to create this location with the following details?
                <div class="mt-3 p-3 bg-gray-50 rounded border border-gray-200 text-sm">
                  <p><span class="font-medium">Name:</span> {{ name }}</p>
                  <p><span class="font-medium">Coordinates:</span> {{ coordinates }}</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel class="bg-gray-100 hover:bg-gray-200 text-gray-800">Cancel</AlertDialogCancel>
              <AlertDialogAction @click="handleSubmit" class="bg-green-600 hover:bg-green-700">Create Location</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </form>
  </div>

  <!-- Improved Modal -->
  <div
    v-if="isModalOpen"
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    <div class="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay with improved transition -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 backdrop-blur-sm transition-opacity" @click="closeModal"></div>
      
      <!-- Modal panel with improved styling -->
      <div class="inline-block transform overflow-hidden rounded-xl bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle">
        <div class="bg-white px-6 pt-5 pb-4">
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
              <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <h3 class="text-lg font-medium leading-6 text-gray-900" id="modal-title">
                {{ modalField === 'coordinates' ? 'Set Location Coordinates' : `Set ${modalField}` }}
              </h3>
              <p class="mt-1 text-sm text-gray-500">
                {{ modalField === 'coordinates' ? 'Click on the map to select precise coordinates for this location.' : '' }}
              </p>
            </div>
          </div>

          <!-- Modal Content with improved map container -->
          <div class="mt-6">
            <!-- Map View -->
            <div v-if="modalField === 'coordinates'" class="mt-4">
              <div id="map" class="h-[450px] w-full rounded-lg border border-gray-200 shadow-inner"></div>
              
              <!-- Selected coordinates display -->
              <div v-if="tempCoordinates" class="mt-3 p-3 bg-green-50 border border-green-100 rounded-md text-sm text-green-800">
                Selected coordinates: {{ tempCoordinates }}
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer with improved button styling -->
        <div class="bg-gray-50 px-6 py-4 sm:flex sm:flex-row-reverse sm:px-6 border-t border-gray-100">
          <button
            type="button"
            @click="saveModalValue"
            class="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-5 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Save Coordinates
          </button>
          <button
            type="button"
            @click="closeModal"
            class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-5 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>

  <Toaster />
</template>