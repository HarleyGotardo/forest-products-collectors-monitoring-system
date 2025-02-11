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

const router = useRouter();
const name = ref(SeparatorConstant.EMPTY_STRING);
const error = ref(null);
const isModalOpen = ref(false);
const modalField = ref(SeparatorConstant.EMPTY_STRING);
const modalValue = ref(null);
let coordinatesObj = ref(null);
const coordinates = ref("");
let mapInstance = null;
const forestProducts = ref([]);
const selectedForestProducts = ref([]);
const currentPage = ref(1);
const itemsPerPage = 7;

const fetchForestProducts = async () => {
  const { data, error } = await supabase
    .from('forest_products')
    .select('*');

  if (error) {
    toast.error(error.message, { duration: 3000 });
  } else {
    forestProducts.value = data;
  }
};

onMounted(() => {
  fetchForestProducts();
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

  const { data: locationData, error: insertError } = await supabase
    .from('location')
    .insert([payload])
    .select();

  if (insertError) {
    error.value = insertError.message
    toast.error(insertError.message, { duration: 3000 })
  } else {
    const locationId = locationData[0].id;
    const fpAndLocationPayload = selectedForestProducts.value.map(fp => ({
      forest_product_id: fp.id,
      location_id: locationId,
      quantity: fp.quantity,
    }));

    const { error: fpAndLocationError } = await supabase
      .from('fp_and_location')
      .insert(fpAndLocationPayload);

    if (fpAndLocationError) {
      error.value = fpAndLocationError.message;
      toast.error(fpAndLocationError.message, { duration: 3000 });
    } else {
      toast.success('Location and forest products saved successfully', { duration: 2000 });
      router.push('/authenticated/locations');
    }
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

  mapInstance.on("click", (mapEvent) => {
    const latLngObj = {
      lat: mapEvent.latlng.lat,
      lng: mapEvent.latlng.lng,
    };

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

const paginatedForestProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return forestProducts.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(forestProducts.value.length / itemsPerPage);
});

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};
</script>
<template>
  <div class="max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-lg">
    <!-- Header -->
    <div class="flex items-center space-x-2 mb-8">
      <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <h2 class="text-2xl font-bold text-gray-900">Create Location</h2>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
      <div class="flex items-center">
        <svg class="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-red-700">{{ error }}</span>
      </div>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Location Name -->
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
          Location Name
        </label>
        <input
          id="name"
          v-model="name"
          type="text"
          class="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm"
          placeholder="Enter location name"
        />
      </div>

      <!-- Coordinates -->
      <div>
        <label for="coordinates" class="block text-sm font-medium text-gray-700 mb-1">
          Coordinates
        </label>
        <div class="relative">
          <input
            id="coordinates"
            type="text"
            readonly
            class="block w-full rounded-lg border-gray-300 bg-gray-50 pr-10 cursor-pointer hover:bg-gray-100 transition-colors sm:text-sm"
            @click="openModal('coordinates')"
            v-model="coordinates"
            placeholder="Click to set coordinates"
          />
          <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Forest Products -->
      <div>
        <label for="forest-products" class="block text-sm font-medium text-gray-700 mb-1">
          Forest Products
        </label>
        <div class="relative">
          <input
            id="forest-products"
            type="text"
            readonly
            class="block w-full rounded-lg border-gray-300 bg-gray-50 pr-10 cursor-pointer hover:bg-gray-100 transition-colors sm:text-sm"
            @click="openModal('forest-products')"
            value="Select Forest Products"
            placeholder="Click to select products"
          />
          <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Submit Button -->
      <div class="flex justify-end">
        <button
          type="submit"
          class="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Create Location
        </button>
      </div>
    </form>
  </div>

  <!-- Modal -->
  <div
    v-if="isModalOpen"
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    <div class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeModal"></div>

      <!-- Modal panel -->
      <div class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle">
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
              <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <h3 class="text-lg font-medium leading-6 text-gray-900" id="modal-title">
                Set {{ modalField }}
              </h3>
            </div>
          </div>

          <!-- Modal Content -->
          <div class="mt-4">
            <!-- Map View -->
            <div v-if="modalField === 'coordinates'" class="mt-4">
              <div id="map" class="h-[500px] w-full rounded-lg border border-gray-200 shadow-inner"></div>
            </div>

            <!-- Forest Products Selection -->
            <div v-else-if="modalField === 'forest-products'" class="mt-4">
              <div class="space-y-4 max-h-[400px] overflow-y-auto px-2">
                <div v-for="product in paginatedForestProducts" 
                     :key="product.id" 
                     class="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                  <div class="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      :id="`product-${product.id}`"
                      :value="product"
                      v-model="selectedForestProducts"
                      class="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <label :for="`product-${product.id}`" class="text-sm font-medium text-gray-700">
                      {{ product.name }}
                    </label>
                  </div>
                  <input
                    v-if="selectedForestProducts.includes(product)"
                    type="number"
                    v-model="product.quantity"
                    placeholder="Quantity"
                    class="w-24 rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                  />
                </div>
              </div>

              <!-- Pagination -->
              <div class="flex items-center justify-between mt-4 border-t border-gray-200 pt-4">
                <button
                  @click="prevPage"
                  :disabled="currentPage === 1"
                  :class="['px-4 py-2 rounded-md text-sm font-medium', 
                          currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300']"
                >
                  Previous
                </button>
                <span class="text-sm text-gray-700">
                  Page {{ currentPage }} of {{ totalPages }}
                </span>
                <button
                  @click="nextPage"
                  :disabled="currentPage === totalPages"
                  :class="['px-4 py-2 rounded-md text-sm font-medium',
                          currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300']"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
          <button
            type="button"
            @click="saveModalValue"
            class="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Save
          </button>
          <button
            type="button"
            @click="closeModal"
            class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>

  <Toaster />
</template>