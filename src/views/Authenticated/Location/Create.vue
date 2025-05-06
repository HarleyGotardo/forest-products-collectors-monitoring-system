<script setup>
import { CommonConstant } from "@/components/constants/common.constant";
import { CoordinatesConstant } from "@/components/constants/coordinates.constant";
import { DatabaseNamesConstant } from "@/components/constants/databaseNames.constant";
import { RouterNamesConstant } from "@/components/constants/routerNames.constant";
import { SeparatorConstant } from "@/components/constants/separators.constant";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { nextTick, ref, watch, onMounted, computed, onBeforeUnmount } from "vue";
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
const tempCoordinatesObj = ref(null);
const tempCoordinates = ref("");
let previewMapInstance = null;
const isGettingLocation = ref(false);
const locationError = ref(null);

// Add mobile device detection
const isMobileDevice = computed(() => {
  // Check if the device is a mobile device
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
  
  // Also check screen size as an additional indicator
  const isSmallScreen = window.innerWidth <= 768;
  
  return isMobile || isSmallScreen;
});

const initializePreviewMap = () => {
  nextTick(() => {
    const previewMapContainer = document.getElementById("preview-map");
    if (!previewMapContainer || !coordinatesObj.value) return;

    // Clear existing preview map if it exists
    if (previewMapInstance) {
      previewMapInstance.remove();
      previewMapInstance = null;
    }

    // Create new preview map
    previewMapInstance = L.map("preview-map", {
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    }).setView(
      [coordinatesObj.value.lat, coordinatesObj.value.lng],
      CommonConstant.MAP_ZOOM_LEVEL.SIXTEEN
    );

    L.tileLayer(CommonConstant.MAP_LAYER, {
      maxZoom: CommonConstant.MAP_ZOOM_LEVEL.NINETEEN,
    }).addTo(previewMapInstance);

    // Add marker at selected location
    L.marker([coordinatesObj.value.lat, coordinatesObj.value.lng]).addTo(previewMapInstance);
  });
};

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

  if (field === 'coordinates') {
    // Initialize temporary coordinate from current coordinateObj
    tempCoordinatesObj.value = coordinatesObj.value ? { ...coordinatesObj.value } : null;
    tempCoordinates.value = coordinates.value || "";

    nextTick(() => {
      initializeMap();
    });
  }
};


const closeModal = () => {
  isModalOpen.value = false;
  modalField.value = "";
  modalValue.value = null;

  // Clear temporary coordinates on close
  tempCoordinatesObj.value = null;
  tempCoordinates.value = "";

  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
};


const saveModalValue = () => {
  if (modalField.value === 'coordinates' && tempCoordinatesObj.value) {
    coordinatesObj.value = { ...tempCoordinatesObj.value };
    coordinates.value = tempCoordinates.value;
  }
  closeModal();
};


const initializeMap = () => {
  const mapContainer = document.getElementById("map");
  let currentMark = null;

  if (!mapContainer || mapInstance || mapContainer.offsetHeight === 0) {
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
        toast.error('This location already exists. Please select a different one.', { duration: 3000 });
      });
  });

  // If there is a temporary coordinate, show marker on it
  if (tempCoordinatesObj.value) {
    currentMark = L.marker([tempCoordinatesObj.value.lat, tempCoordinatesObj.value.lng]).addTo(mapInstance);
    mapInstance.setView([tempCoordinatesObj.value.lat, tempCoordinatesObj.value.lng], CommonConstant.MAP_ZOOM_LEVEL.SIXTEEN);
  }

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

    // Update temporary coordinate only
    tempCoordinatesObj.value = latLngObj;
    tempCoordinates.value = `${latLngObj.lat}, ${latLngObj.lng}`;
  });
};

// Replace the existing clearTempCoordinates function with this:
const clearTempCoordinates = () => {
  // Clear both main and temporary coordinates
  coordinatesObj.value = null;
  coordinates.value = "";
  tempCoordinatesObj.value = null;
  tempCoordinates.value = "";

  // If we're in the modal, reset the map view
  if (mapInstance) {
    const markers = mapInstance.getLayers().filter(layer => layer instanceof L.Marker);
    markers.forEach(marker => mapInstance.removeLayer(marker));

    mapInstance.setView(
      CoordinatesConstant.VISAYAS_STATE_UNIVERSITY_COORDINATES,
      CommonConstant.MAP_ZOOM_LEVEL.SIXTEEN
    );
  }

  // If we have a preview map instance, clean it up
  if (previewMapInstance) {
    previewMapInstance.remove();
    previewMapInstance = null;
  }
};

const isFormValid = computed(() => {
  return name.value && coordinates.value;
});

watch(coordinatesObj, (newCoords) => {
  if (newCoords) {
    initializePreviewMap();
  } else if (previewMapInstance) {
    previewMapInstance.remove();
    previewMapInstance = null;
  }
});
// Add this lifecycle hook
onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.remove();
  }
  if (previewMapInstance) {
    previewMapInstance.remove();
  }
});

// Add this new function to get current location
const getCurrentLocation = () => {
  if (!navigator.geolocation) {
    locationError.value = "Geolocation is not supported by your browser";
    toast.error("Geolocation is not supported by your browser. Please use a modern browser like Chrome, Firefox, or Edge.", { duration: 5000 });
    return;
  }

  isGettingLocation.value = true;
  locationError.value = null;

  // First check if we're in a secure context (HTTPS or localhost)
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    isGettingLocation.value = false;
    locationError.value = "Geolocation requires a secure context (HTTPS)";
    toast.error("Geolocation requires a secure connection (HTTPS). Please ensure you're using HTTPS or running on localhost.", { duration: 5000 });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latLngObj = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      // Log the accuracy for debugging
      console.log('Location accuracy:', position.coords.accuracy, 'meters');

      // Check if the coordinates match any existing location
      const isDuplicateLocation = existingLocations.value.some(location =>
        location.latitude === latLngObj.lat && location.longitude === latLngObj.lng
      );

      if (isDuplicateLocation) {
        toast.error('A location already exists at these coordinates', { duration: 3000 });
        isGettingLocation.value = false;
        return;
      }

      // Update both temporary and main coordinates
      tempCoordinatesObj.value = latLngObj;
      tempCoordinates.value = `${latLngObj.lat.toFixed(6)}, ${latLngObj.lng.toFixed(6)}`;
      coordinatesObj.value = latLngObj;
      coordinates.value = tempCoordinates.value;

      // Initialize or update the map
      if (!mapInstance) {
        // If map is not initialized, open the modal and initialize the map
        openModal('coordinates');
        nextTick(() => {
          initializeMap();
        });
      } else {
        // Update existing map
        mapInstance.setView([latLngObj.lat, latLngObj.lng], CommonConstant.MAP_ZOOM_LEVEL.SIXTEEN);
        
        // Clear existing markers
        const markers = mapInstance.getLayers().filter(layer => layer instanceof L.Marker);
        markers.forEach(marker => mapInstance.removeLayer(marker));
        
        // Add new marker
        L.marker([latLngObj.lat, latLngObj.lng]).addTo(mapInstance);
      }

      // Initialize preview map
      initializePreviewMap();

      isGettingLocation.value = false;
      toast.success('Location coordinates retrieved successfully. You can now name and save this location.', { duration: 3000 });
    },
    (error) => {
      isGettingLocation.value = false;
      console.error('Geolocation error:', error);
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          locationError.value = "Location access was denied";
          toast.error("Please allow location access in your browser settings to use this feature. Click the lock icon in your browser's address bar to manage permissions.", { duration: 5000 });
          break;
        case error.POSITION_UNAVAILABLE:
          locationError.value = "Location information is unavailable";
          toast.error("Could not get your location. Please ensure your device's location services are enabled and you have a stable internet connection.", { duration: 5000 });
          break;
        case error.TIMEOUT:
          locationError.value = "Location request timed out";
          toast.error("Location request took too long. Please check your internet connection and try again.", { duration: 5000 });
          break;
        default:
          locationError.value = "An unknown error occurred";
          toast.error("An error occurred while getting your location. Please try again or use manual location selection.", { duration: 5000 });
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
};
</script>
<template>
  <div
    class="max-w-2xl mx-auto p-6 sm:p-8 bg-white rounded-xl shadow-md border border-gray-100 mt-8"
  >
    <!-- Back Button -->
    <div class="mb-6">
      <button
        @click="router.back()"
        class="inline-flex items-center px-3 sm:px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        <span class="hidden sm:inline">Back</span>
      </button>
    </div>

    <!-- Header with improved design -->
    <div class="flex items-center space-x-3 mb-8 pb-4 border-b border-gray-100">
      <div class="bg-green-100 p-2 rounded-full">
        <svg
          class="w-6 h-6 text-green-600"
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
      </div>
      <div>
        <h2 class="text-2xl font-bold text-green-800">Create Location</h2>
        <p class="text-sm text-gray-500 mt-1">Add a new location</p>
      </div>
    </div>

    <!-- Error Alert with improved styling -->
    <div
      v-if="error"
      class="mb-6 p-4 rounded-lg bg-red-50 border-l-4 border-red-500 flex items-center"
    >
      <svg
        class="w-5 h-5 text-red-500 mr-3 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
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
        <p class="text-xs text-gray-500 mt-1">
          Choose a clear, identifiable name for this forest location
        </p>
      </div>

      <!-- Coordinates with improved interaction design -->
      <div class="space-y-2">
        <Label for="coordinates" class="text-gray-700 font-medium">
          Coordinates
        </Label>
        <div class="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
          <button
            type="button"
            @click="openModal('coordinates')"
            class="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 hover:bg-gray-50 transition-colors flex justify-between items-center"
          >
            <span class="block truncate">
              {{ coordinates || "Click to set location coordinates" }}
            </span>
            <div class="flex items-center text-green-600">
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
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            </div>
          </button>
          <div class="relative group">
            <button
              type="button"
              @click="getCurrentLocation"
              :disabled="isGettingLocation || !isMobileDevice"
              class="mt-2 sm:mt-0 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              <svg
                v-if="isGettingLocation"
                class="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <svg
                v-else
                class="w-5 h-5"
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
              <span>{{ isGettingLocation ? 'Getting Location...' : 'Use Current Location' }}</span>
            </button>
            <div v-if="!isMobileDevice" class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-100 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
              This feature is only available on mobile devices
            </div>
            <div v-else class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
              Works best on mobile devices with GPS
            </div>
          </div>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          Click to open the map and select precise coordinates. For best results, use a mobile device with GPS.
        </p>
      </div>

      <!-- Replace the existing preview section -->
      <div
        v-if="coordinates"
        class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 relative z-0"
      >
        <h3 class="text-sm font-medium text-gray-700 mb-2">
          Selected Location Preview
        </h3>
        <div class="space-y-3">
          <!-- Map preview container -->
          <div
        id="preview-map"
        class="h-48 w-full rounded-lg border border-gray-200 overflow-hidden"
          ></div>
          <!-- Coordinates display -->
          <div
        class="flex items-center justify-between px-3 py-2 bg-green-50 rounded-md border border-green-100"
          >
        <div class="flex items-center space-x-2">
          <svg
            class="w-5 h-5 text-green-600"
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
          </svg>
          <span class="text-sm text-gray-600">{{ coordinates }}</span>
        </div>
        <button
          type="button"
          @click="clearTempCoordinates"
          class="text-red-600 hover:text-red-700 focus:outline-none"
          title="Clear coordinates"
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
          d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
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
              Create Location
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent class="rounded-lg">
            <AlertDialogHeader>
              <AlertDialogTitle class="text-xl"
                >Confirm Creation</AlertDialogTitle
              >
              <AlertDialogDescription class="text-gray-600">
                Are you sure you want to create this location with the following
                details?
                <div
                  class="mt-3 p-3 bg-gray-50 rounded border border-gray-200 text-sm"
                >
                  <p><span class="font-medium">Name:</span> {{ name }}</p>
                  <p>
                    <span class="font-medium">Coordinates:</span>
                    {{ coordinates }}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                class="bg-gray-100 hover:bg-gray-200 text-gray-800"
                >Cancel</AlertDialogCancel
              >
              <AlertDialogAction
                @click="handleSubmit"
                class="bg-green-600 hover:bg-green-700"
                >Create Location</AlertDialogAction
              >
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
    <div
      class="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0"
    >
      <!-- Background overlay with improved transition -->
      <div
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        @click="closeModal"
      ></div>

      <!-- Modal panel with improved styling and mobile responsiveness -->
      <div
        class="inline-block transform overflow-hidden rounded-xl bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle"
      >
        <div class="bg-white px-6 pt-5 pb-4">
          <div class="sm:flex sm:items-start">
        <div
          class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10"
        >
          <svg
            class="h-6 w-6 text-green-600"
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
          </svg>
        </div>
        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
          <h3
            class="text-lg font-medium leading-6 text-gray-900"
            id="modal-title"
          >
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
          <div
            id="map"
            class="h-[300px] sm:h-[450px] w-full rounded-lg border border-gray-200 shadow-inner"
          ></div>

          <div
            v-if="tempCoordinates"
            class="mt-3 p-3 bg-green-50 border border-green-100 rounded-md text-sm text-green-800 flex justify-between items-center"
          >
            <span>Selected coordinates: {{ tempCoordinates }}</span>
            <button
          type="button"
          @click="clearTempCoordinates"
          class="text-red-600 hover:text-red-800 focus:outline-none"
          title="Remove coordinates"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
            </button>
          </div>
        </div>
          </div>
        </div>

        <!-- Modal Footer with improved button styling -->
        <div
          class="bg-gray-50 px-6 py-4 sm:flex sm:flex-row-reverse sm:px-6 border-t border-gray-100"
        >
          <button
        v-if="tempCoordinatesObj"
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

  <Toaster
  theme="light"
  :toastOptions="{
    class: 'bg-[#ecfdf5] text-gray-800 border border-green-200 rounded-lg shadow-md',
    style: {
      padding: '1rem',
    }
  }"
/>

</template>
