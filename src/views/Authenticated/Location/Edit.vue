<script setup>
import { CommonConstant } from "@/components/constants/common.constant";
import { CoordinatesConstant } from "@/components/constants/coordinates.constant";
import { DatabaseNamesConstant } from "@/components/constants/databaseNames.constant";
import { RouterNamesConstant } from "@/components/constants/routerNames.constant";
import { SeparatorConstant } from "@/components/constants/separators.constant";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { nextTick, ref, watch, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'
import Button from "@/components/ui/button/Button.vue";

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
let originalCoordinatesObj = { lat: 0, lng: 0 };
const coordinates = ref("");
let mapInstance = null;
const allLocations = ref([]); // Store all existing locations

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

const fetchLocation = async () => {
  let { data, error: fetchError } = await supabase
    .from('location')
    .select('*')
    .eq('id', locationId)
    .single()

  if (fetchError) {
    error.value = fetchError.message
  } else {
    name.value = data.name
    originalName.value = data.name
    coordinatesObj.value = { lat: data.latitude, lng: data.longitude }
    originalCoordinatesObj = { lat: data.latitude, lng: data.longitude }
    coordinates.value = `${data.latitude}, ${data.longitude}`
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
    .from('location')
    .update(payload)
    .eq('id', locationId);

  if (updateError) {
    error.value = updateError.message
  } else {
    toast.success('Location updated successfully', { duration: 2000 })
    router.push('/authenticated/locations')
  }
};

const openModal = (field) => {
  modalField.value = field;
  modalValue.value = name.value;
  isModalOpen.value = true;

  nextTick(() => {
    initializeMap();
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
  name.value = modalValue.value;
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

  // Add existing location markers with tooltips (non-clickable)
  allLocations.value.forEach(location => {
    if (location.id !== locationId) {
      L.marker([location.latitude, location.longitude])
        .addTo(mapInstance)
        .bindTooltip(location.name, {
          permanent: true,
          direction: 'top',
          className: 'bg-white px-2 py-1 rounded shadow-lg'
        })
        .on('click', (e) => {
          e.originalEvent.stopPropagation();
          toast.error('Cannot select an existing location marker');
        });
    }
  });

  mapInstance.on("click", (mapEvent) => {
    const latLngObj = {
      lat: mapEvent.latlng.lat,
      lng: mapEvent.latlng.lng,
    };

    // Check if the clicked coordinates match any existing location
    const isExistingLocation = allLocations.value.some(location => 
      location.latitude === latLngObj.lat && location.longitude === latLngObj.lng
    );

    if (isExistingLocation) {
      toast.error('Cannot select an existing location marker');
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

const isFormChanged = computed(() => {
  return name.value !== originalName.value || 
         coordinatesObj.value.lat !== originalCoordinatesObj.lat || 
         coordinatesObj.value.lng !== originalCoordinatesObj.lng;
});

onMounted(() => {
  fetchLocation();
  fetchAllLocations();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-3xl mx-auto">
      <!-- Main Card -->
      <div class="bg-white rounded-xl shadow-lg p-8">
        <!-- Header -->
        <div class="mb-8">
          <h2 class="text-3xl font-bold text-gray-900">Edit Location</h2>
          <p class="mt-2 text-gray-600">Update your location details below</p>
        </div>

        <!-- Error Alert -->
        <div v-if="error" class="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-red-700">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Location Name Field -->
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700">
              Location Name
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="name"
                v-model="name"
                type="text"
                class="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="Enter location name"
              />
            </div>
          </div>

          <!-- Coordinates Field -->
          <div>
            <label for="coordinates" class="block text-sm font-medium text-gray-700">
              Coordinates
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                id="coordinates"
                type="text"
                readonly
                v-model="coordinates"
                @click="openModal('coordinates')"
                class="block w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                placeholder="Click to set coordinates"
              />
              <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="pt-4">
            <Button
              type="submit"
              :disabled="!isFormChanged"
            >
              Update Location
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Modal -->
  <div
    v-if="isModalOpen"
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    <!-- Background overlay -->
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

    <!-- Modal panel -->
    <div class="flex min-h-screen items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
        <!-- Modal header -->
        <div class="mb-4">
          <h3 class="text-xl font-semibold text-gray-900" id="modal-title">
            Set {{ modalField }}
          </h3>
        </div>

        <!-- Map container -->
        <div class="rounded-lg overflow-hidden border border-gray-200">
          <div id="map" class="h-[600px] w-full"></div>
        </div>

        <!-- Modal actions -->
        <div class="mt-6 flex justify-end space-x-3">
          <Button
            @click="closeModal"
          >
            Cancel
          </Button>
          <Button
            @click="saveModalValue"
          >
            Save Coordinates
          </Button>
        </div>
      </div>
    </div>
  </div>

  <Toaster />
</template>