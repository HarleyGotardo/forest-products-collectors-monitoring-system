<script setup>
import { CommonConstant } from "@/components/constants/common.constant";
import { CoordinatesConstant } from "@/components/constants/coordinates.constant";
import { DatabaseNamesConstant } from "@/components/constants/databaseNames.constant";
import { RouterNamesConstant } from "@/components/constants/routerNames.constant";
import { SeparatorConstant } from "@/components/constants/separators.constant";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { nextTick, ref, watch, onMounted, computed, onBeforeUnmount } from "vue";
import { useRouter, useRoute } from "vue-router";
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

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

const router = useRouter();
const route = useRoute();
const locationId = route.params.id;
const name = ref(SeparatorConstant.EMPTY_STRING);
const originalName = ref(SeparatorConstant.EMPTY_STRING);
const error = ref(null);
const isModalOpen = ref(false);
const modalField = ref(SeparatorConstant.EMPTY_STRING);
const modalValue = ref(null);
let coordinatesObj = ref({ lat: 0, lng: 0 });
let originalCoordinatesObj = ref({ lat: 0, lng: 0 });
const coordinates = ref("");
let mapInstance = null;
let previewMapInstance = null;
const existingLocations = ref([]);
const tempCoordinatesObj = ref(null);
const tempCoordinates = ref("");

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

const fetchLocation = async () => {
  let { data, error: fetchError } = await supabase
    .from('locations')
    .select('*')
    .eq('id', locationId)
    .single()

  if (fetchError) {
    error.value = fetchError.message
    toast.error(fetchError.message, { duration: 3000 })
  } else {
    name.value = data.name
    originalName.value = data.name
    coordinatesObj.value = { lat: data.latitude, lng: data.longitude }
    originalCoordinatesObj.value = { lat: data.latitude, lng: data.longitude }
    coordinates.value = `${data.latitude}, ${data.longitude}`

    nextTick(() => {
      initializePreviewMap();
    });
  }
}

const fetchLocations = async () => {
  const { data, error: fetchError } = await supabase
    .from('locations')
    .select('*');

  if (fetchError) {
    toast.error(fetchError.message, { duration: 3000 });
  } else {
    existingLocations.value = data;
  }
};

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
    updated_at: formattedDate,
  };

  const { error: updateError } = await supabase
    .from('locations')
    .update(payload)
    .eq('id', locationId);

  if (updateError) {
    error.value = updateError.message
    toast.error(updateError.message, { duration: 3000 })
  } else {
    toast.success('Location updated successfully', { duration: 2000 })
    router.push('/authenticated/locations')
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
    initializePreviewMap();
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
    [coordinatesObj.value.lat, coordinatesObj.value.lng],
    CommonConstant.MAP_ZOOM_LEVEL.SIXTEEN
  );

  L.tileLayer(CommonConstant.MAP_LAYER, {
    maxZoom: CommonConstant.MAP_ZOOM_LEVEL.NINETEEN,
  }).addTo(mapInstance);

  // Add existing location markers
  existingLocations.value.forEach(location => {
    if (location.id !== locationId) {
      L.marker([location.latitude, location.longitude])
        .addTo(mapInstance)
        .bindPopup(location.name)
        .on('click', () => {
          toast.error('This location already exists. Please select a different one.', { duration: 3000 });
        });
    }
  });

  // Add current location marker with different color
  const currentLocationIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  // If there is a temporary coordinate, show marker on it
  if (tempCoordinatesObj.value) {
    currentMark = L.marker([tempCoordinatesObj.value.lat, tempCoordinatesObj.value.lng]).addTo(mapInstance);
  }

  mapInstance.on("click", (mapEvent) => {
    const latLngObj = {
      lat: mapEvent.latlng.lat,
      lng: mapEvent.latlng.lng,
    };

    // Check if the clicked coordinates match any existing location
    const isDuplicateLocation = existingLocations.value.some(location =>
      location.id !== locationId &&
      location.latitude === latLngObj.lat &&
      location.longitude === latLngObj.lng
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

const clearCoordinates = () => {
  // Reset to original coordinates
  coordinatesObj.value = { ...originalCoordinatesObj.value };
  coordinates.value = `${originalCoordinatesObj.value.lat}, ${originalCoordinatesObj.value.lng}`;

  // Reinitialize preview map
  initializePreviewMap();
};

const isFormChanged = computed(() => {
  return name.value !== originalName.value ||
         coordinatesObj.value.lat !== originalCoordinatesObj.value.lat ||
         coordinatesObj.value.lng !== originalCoordinatesObj.value.lng;
});

onMounted(() => {
  fetchLocation();
  fetchLocations();
});

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.remove();
  }
  if (previewMapInstance) {
    previewMapInstance.remove();
  }
});
</script>

<template>
  <div
    class="max-w-2xl mx-auto p-6 sm:p-8 bg-white rounded-xl shadow-md border border-gray-100 mt-8"
  >
    <!-- Header with improved design -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
      <div class="flex items-center space-x-4">
        <button
          @click="router.back()"
          class="inline-flex items-center px-3 sm:px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
        >
          <svg
            class="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            ></path>
          </svg>
          <span class="hidden sm:inline">Back</span>
        </button>

        <div class="flex items-center space-x-3">
          <div class="bg-emerald-100 p-2 rounded-full">
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
            <h2 class="text-xl sm:text-2xl font-bold text-gray-800">Edit Location</h2>
            <p class="text-sm text-gray-500 mt-1">
              Update location details of {{ name }}
            </p>
          </div>
        </div>
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
        </div>
        <p class="text-xs text-gray-500 mt-1">
          Click to open the map and select precise coordinates
        </p>
      </div>

      <!-- Preview section -->
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
            class="flex items-center justify-between px-3 py-2 bg-emerald-50 rounded-md border border-green-100"
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
              @click="clearCoordinates"
              class="text-red-600 hover:text-red-700 focus:outline-none"
              title="Reset coordinates"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
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
              :disabled="!isFormChanged"
              class="inline-flex items-center px-5 py-2.5 bg-emerald-600 border border-transparent rounded-md font-medium text-sm text-white hover:bg-emerald-700 active:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Update Location
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent class="rounded-lg">
            <AlertDialogHeader>
              <AlertDialogTitle class="text-xl"
                >Confirm Update</AlertDialogTitle
              >
              <AlertDialogDescription class="text-gray-600">
                Are you sure you want to update this location with the following
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
                class="bg-emerald-600 hover:bg-emerald-700"
                >Update Location</AlertDialogAction
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

      <!-- Modal panel with improved styling -->
      <div
        class="inline-block transform overflow-hidden rounded-xl bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle"
      >
        <div class="bg-white px-6 pt-5 pb-4">
          <div class="sm:flex sm:items-start">
            <div
              class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 sm:mx-0 sm:h-10 sm:w-10"
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
                class="h-[450px] w-full rounded-lg border border-gray-200 shadow-inner"
              ></div>

              <div
                v-if="tempCoordinates"
                class="mt-3 p-3 bg-emerald-50 border border-green-100 rounded-md text-sm text-green-800 flex justify-between items-center"
              >
                <span>Selected coordinates: {{ tempCoordinates }}</span>
                <button
                  type="button"
                  @click="clearCoordinates"
                  class="text-red-600 hover:text-red-800 focus:outline-none"
                  title="Reset coordinates"
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
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
            class="inline-flex w-full justify-center rounded-md border border-transparent bg-emerald-600 px-5 py-2 text-base font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
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
