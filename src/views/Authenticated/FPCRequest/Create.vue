<script setup>
// FPC Request Create Component
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { getUser } from '@/router/routeGuard';
import { toast } from 'vue-sonner';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

const forestProducts = ref([]);
const filteredForestProducts = ref([]); // For search functionality
const selectedForestProducts = ref([]);
const collectionDate = ref('');
const showModal = ref(false);
const searchQuery = ref(''); // Search query for filtering
const showConfirmDialog = ref(false); // State for showing the confirmation dialog
const router = useRouter();
const selectAll = ref(false); // Add this line for select all state
const showNotes = ref(true); // Add this line for show notes state

// Updated fetchForestProducts function with snapshot availability
const fetchForestProducts = async () => {
  try {
    // First, get the forest products with their locations and quantities
    const { data, error } = await supabase
      .from('fp_and_locations')
      .select(`
        id,
        forest_product_id,
        location_id,
        quantity,
        forest_products!inner (
          id,
          name,
          price_based_on_measurement_unit,
          measurement_unit_id,
          measurement_units (unit_name),
          deleted_at
        ),
        locations!inner (
          id,
          name,
          deleted_at
        )
      `)
      .is('forest_products.deleted_at', null)
      .is('locations.deleted_at', null);

    if (error) {
      console.error('Error fetching forest products:', error);
      throw error;
    }

    // Get approved but unrecorded collection requests
    const { data: approvedRequests, error: approvedRequestsError } = await supabase
      .from('collection_requests')
      .select(`
        id,
        is_recorded,
        remarks,
        collection_request_items (
          id,
          requested_quantity,
          fp_and_location_id
        ),
        collection_records (
          id,
          is_paid
        )
      `)
      .is('deleted_at', null)
      .eq('remarks', 'Approved')
      .eq('is_recorded', false);

    if (approvedRequestsError) {
      console.error('Error fetching approved requests:', approvedRequestsError);
      throw approvedRequestsError;
    }

    // Get unapproved collection requests
    const { data: unapprovedRequests, error: unapprovedRequestsError } = await supabase
      .from('collection_requests')
      .select(`
        id,
        collection_request_items (
          id,
          requested_quantity,
          fp_and_location_id
        )
      `)
      .is('deleted_at', null)
      .eq('remarks', 'Pending');

    if (unapprovedRequestsError) {
      console.error('Error fetching unapproved requests:', unapprovedRequestsError);
      throw unapprovedRequestsError;
    }

    // Calculate approved and unapproved quantities for each forest product location
    const approvedQuantities = {};
    const unapprovedQuantities = {};

    // Process approved requests
    approvedRequests.forEach(request => {
      const hasPaidRecord = request.collection_records &&
                          request.collection_records.some(record => record.is_paid === true);

      if (!request.is_recorded && !hasPaidRecord) {
        request.collection_request_items.forEach(item => {
          const fpLocationId = item.fp_and_location_id;
          if (!approvedQuantities[fpLocationId]) {
            approvedQuantities[fpLocationId] = 0;
          }
          approvedQuantities[fpLocationId] += item.requested_quantity;
        });
      }
    });

    // Process unapproved requests
    unapprovedRequests.forEach(request => {
      request.collection_request_items.forEach(item => {
        const fpLocationId = item.fp_and_location_id;
        if (!unapprovedQuantities[fpLocationId]) {
          unapprovedQuantities[fpLocationId] = 0;
        }
        unapprovedQuantities[fpLocationId] += item.requested_quantity;
      });
    });

    // Map the products with adjusted quantities
    forestProducts.value = data.map(item => {
      const approvedAmount = approvedQuantities[item.id] || 0;
      const unapprovedAmount = unapprovedQuantities[item.id] || 0;
      const totalReserved = approvedAmount + unapprovedAmount;
      const adjustedQuantity = Math.max(0, item.quantity - totalReserved);

      return {
        id: item.id,
        forest_product_id: item.forest_product_id,
        forest_product_name: item.forest_products.name,
        location_id: item.location_id,
        location_name: item.locations.name,
        price: item.forest_products.price_based_on_measurement_unit,
        unit_name: item.forest_products.measurement_units.unit_name,
        quantity: item.quantity,
        adjustedQuantity: adjustedQuantity,
        approvedQuantity: approvedAmount,
        unapprovedQuantity: unapprovedAmount,
        hasRequests: totalReserved > 0,
        requested_quantity: 0,
        quantityError: false
      };
    });

    filteredForestProducts.value = forestProducts.value;

  } catch (error) {
    console.error('Error in fetchForestProducts:', error);
    toast.error('Failed to load forest products');
  }
};

// Update validateProductQuantity to check against adjusted quantity rather than total quantity
const validateProductQuantity = (product) => {
  // Use adjustedQuantity instead of quantity for validation
  if (product.requested_quantity > product.adjustedQuantity) {
    product.quantityError = true;
    return false;
  } else if (product.requested_quantity < 0) {
    product.quantityError = true;
    return false;
  } else {
    product.quantityError = false;
    return true;
  }
};

// Update the toggleSelectAll function
const toggleSelectAll = () => {
  const filteredIds = new Set(filteredForestProducts.value.map(p => p.id));

  if (selectAll.value) {
    // Add all filtered products that aren't already selected
    const newProducts = filteredForestProducts.value.filter(
      product => !selectedForestProducts.value.some(p => p.id === product.id)
    );
    selectedForestProducts.value = [...selectedForestProducts.value, ...newProducts];
  } else {
    // Remove only filtered products from selection
    selectedForestProducts.value = selectedForestProducts.value.filter(
      product => !filteredIds.has(product.id)
    );
  }
};

// Update the watch for selectedForestProducts
watch(selectedForestProducts, (newValue) => {
  const filteredIds = new Set(filteredForestProducts.value.map(p => p.id));
  const selectedInFilter = newValue.filter(p => filteredIds.has(p.id));

  selectAll.value = filteredForestProducts.value.length > 0 &&
                   selectedInFilter.length === filteredForestProducts.value.length;
}, { deep: true });

// Update the watch for searchQuery
watch(searchQuery, (newQuery) => {
  filteredForestProducts.value = forestProducts.value.filter(product =>
    product.forest_product_name.toLowerCase().includes(newQuery.toLowerCase()) ||
    product.location_name.toLowerCase().includes(newQuery.toLowerCase())
  );

  // Update select all state
  const filteredIds = new Set(filteredForestProducts.value.map(p => p.id));
  const selectedInFilter = selectedForestProducts.value.filter(p => filteredIds.has(p.id));

  selectAll.value = filteredForestProducts.value.length > 0 &&
                   selectedInFilter.length === filteredForestProducts.value.length;
});

// Update the watch for filteredForestProducts
watch(filteredForestProducts, (newFiltered) => {
  const filteredIds = new Set(newFiltered.map(p => p.id));
  const selectedInFilter = selectedForestProducts.value.filter(p => filteredIds.has(p.id));

  selectAll.value = newFiltered.length > 0 &&
                   selectedInFilter.length === newFiltered.length;
}, { deep: true });

// Watch changes to requested quantities and validate them
watch(() => [...selectedForestProducts.value], (products) => {
  products.forEach(product => {
    validateProductQuantity(product);
  });
}, { deep: true });

const hasQuantityErrors = computed(() => {
  return selectedForestProducts.value.some(product => product.quantityError);
});

const hasZeroQuantityError = computed(() => {
  return selectedForestProducts.value.some(product => product.requested_quantity === 0);
});

const isFormComplete = computed(() => {
  return (
    selectedForestProducts.value.length > 0 &&
    collectionDate.value &&
    selectedForestProducts.value.every(p => p.requested_quantity > 0) &&
    !hasQuantityErrors.value
  );
});

const isCollectionDateValid = computed(() => {
  const today = new Date();
  const collectionDateTime = new Date(collectionDate.value);

  if (collectionDateTime.toDateString() === today.toDateString()) {
    // If the collection date is today, check if the current time is before 4 PM
    const currentHour = today.getHours();
    return currentHour < 16;
  }

  // Otherwise, ensure the collection date is in the future
  return collectionDateTime >= today;
});

const handleSubmit = () => {
  // Validate all quantities
  selectedForestProducts.value.forEach(product => {
    validateProductQuantity(product);
  });

  if (hasQuantityErrors.value) {
    toast.error('Some requested quantities exceed available amounts');
    return;
  }

  if (!isFormComplete.value) {
    toast.error('Please complete the form');
    return;
  }

  if (!isCollectionDateValid.value) {
    toast.error('Collection date cannot be in the past');
    return;
  }

  showConfirmDialog.value = true; // Show the confirmation dialog
};

const confirmSubmit = async () => {
  const user = getUser();
  const collectionRequest = {
    user_id: user.id,
    collection_date: collectionDate.value,
  };

  // Filter out items with requested_quantity = 0
  const validProducts = selectedForestProducts.value.filter(
    product => product.requested_quantity > 0
  );

  if (validProducts.length === 0) {
    toast.error('Please enter quantities for at least one product');
    return;
  }

  // Final validation check
  const invalidProducts = validProducts.filter(
    product => product.requested_quantity > product.adjustedQuantity || product.requested_quantity <= 0
  );

  if (invalidProducts.length > 0) {
    toast.error('Please enter valid quantities for all selected products');
    return;
  }

  const { data: requestData, error: requestError } = await supabase
    .from('collection_requests')
    .insert([collectionRequest])
    .select('id');

  if (requestError) {
    console.error('Error creating collection request:', requestError);
    toast.error('Error creating collection request - ' + requestError.message);
    return;
  }

  const collectionRequestId = requestData[0].id;

  const { error: itemsError } = await supabase
    .from('collection_request_items')
    .insert(
      validProducts.map((item) => ({
        fp_and_location_id: item.id,
        collection_request_id: collectionRequestId,
        requested_quantity: item.requested_quantity,
      }))
    );

  if (itemsError) {
    console.error('Error creating collection request items:', itemsError);
    toast.error('Error creating collection request items - ' + itemsError.message);
    return;
  }

  toast.success('Collection request created successfully');
  router.push('/authenticated/collection-requests');
};

// Add a new computed property to show unapproved requests
const unapprovedRequests = computed(() => {
  return forestProducts.value.filter(product => product.hasRequests);
});

onMounted(() => {
  fetchForestProducts();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="relative max-w-lg w-full mt-7">
      <!-- Back Button -->
      <div class="absolute -top-12 left-0">
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
      </div>

      <div class="w-full bg-white rounded-xl shadow-lg overflow-hidden">
        <!-- Header -->
        <div
          class="bg-gray-200 px-6 py-5 text-black flex items-center space-x-4"
        >
          <img
            src="@/assets/request2.png"
            alt="Forest Map"
            class="w-6 h-6 group-hover:scale-110 transition-transform"
          />
          <div>
            <h2 class="text-2xl font-bold text-green-900">
              Forest Product Collection Request
            </h2>
            <p class="text-black-100 mt-1 text-green-800">
              Request permission to harvest forest products
            </p>
          </div>
        </div>

        <!-- Info Notes Toggle -->
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <h3 class="text-lg font-medium text-gray-900">
              Important Information
              </h3>
            </div>
            <button
              @click="showNotes = !showNotes"
              class="flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <span>{{ showNotes ? 'Hide Notes' : 'Show Notes' }}</span>
              <svg
                class="w-4 h-4 ml-1 transform transition-transform"
                :class="{ 'rotate-180': showNotes }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Info Notes -->
        <div v-if="showNotes" class="px-6 py-4 space-y-4 bg-gray-50">
          <!-- Request Process Note -->
          <div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg
                  class="h-5 w-5 text-blue-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-blue-700">
                  <span class="font-medium">Request Process:</span> Select the
                  forest products you wish to collect, specify the quantities,
                  and choose your preferred collection date. Your request will
                  be reviewed by the Forest Protection Unit.
                </p>
              </div>
            </div>
          </div>

          <!-- Quantity Note -->
          <div class="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg
                  class="h-5 w-5 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-green-700">
                  <span class="font-medium">Quantity Guidelines:</span> The
                  available quantities shown include pending requests. Make sure
                  to check the snapshot availability before requesting
                  quantities. You cannot request more than what is currently
                  available.
                </p>
              </div>
            </div>
          </div>

          <!-- Collection Date Note -->
          <div class="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg
                  class="h-5 w-5 text-amber-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-amber-700">
                  <span class="font-medium">Collection Date:</span> Choose a
                  date for collection. Same-day collections must be requested before 4:00 PM. (This is a tentative date)
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
          <!-- Forest Products Selection -->
          <div>
            <label
              for="forestProducts"
              class="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"
            >
              <img src="@/assets/forest-product.png" class="w-5 h-5" alt="Forest Product Icon" />
              Forest Products
            </label>
            <button
              type="button"
              @click="showModal = true"
              class="w-full flex items-center justify-between bg-white border border-gray-300 rounded-full py-3 px-4 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <span class="text-gray-700">
                {{ selectedForestProducts.length ? `${selectedForestProducts.length} products selected` : 'Select forest products' }}
              </span>
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
          </div>

          <!-- Selected Products Summary -->
          <div v-if="selectedForestProducts.length > 0" class="space-y-3">
            <!-- Header with count badge -->
            <div class="flex items-center">
              <h3 class="text-base font-medium text-gray-900">
                Selected Products
              </h3>
              <span
                class="ml-2 px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full"
              >
                {{ selectedForestProducts.length }}
              </span>
            </div>

            <!-- Products List Container -->
            <div
              class="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <!-- Each Selected Product -->
              <div
                v-for="(product, index) in selectedForestProducts"
                :key="product.id"
                class="border-b border-gray-100 last:border-b-0"
              >
                <div
                  class="p-4 hover:bg-gray-50 transition-colors duration-150"
                >
                  <!-- Product Info Row -->
                  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <!-- Product Name and Quantity -->
                    <div class="flex items-center">
                      <div
                        class="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 mr-3"
                      >
                        <img
                          src="@/assets/forest-product.png"
                          class="h-6 w-6"
                          alt=""
                        />
                      </div>
                      <div>
                        <span
                          class="font-medium text-gray-800"
                          >{{ product.forest_product_name }}</span
                        >
                        <div class="flex items-center mt-1">
                          <span class="text-sm font-medium text-gray-700">
                            {{ product.requested_quantity > 0 ? product.requested_quantity : 'No' }}
                            {{ product.unit_name }}(s)
                          </span>
                          <!-- Quantity Status Indicator -->
                          <span
                            v-if="product.requested_quantity > 0"
                            class="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded"
                          >
                            Requesting
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Availability Info -->
                    <div
                      class="flex items-center text-sm text-gray-600 mt-2 sm:mt-0"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 text-gray-500 mr-1 flex-shrink-0"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <span class="text-right">
                        Available:
                        <span
                          class="font-medium text-blue-600"
                          >{{ product.adjustedQuantity }}</span
                        >
                        / {{ product.quantity }} {{ product.unit_name }}(s)
                      </span>
                    </div>
                  </div>

                  <!-- Error Messages - Simplified -->
                  <div
                    v-if="product.quantityError || product.requested_quantity === 0"
                    class="mt-2"
                  >
                    <div
                      v-if="product.quantityError"
                      class="text-red-500 text-xs"
                    >
                      Requested quantity exceeds available amount
                    </div>
                    <div
                      v-if="product.requested_quantity === 0"
                      class="text-red-500 text-xs"
                    >
                      Please enter a valid quantity
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Warning Messages - Simplified -->
            <div
              v-if="hasQuantityErrors || !selectedForestProducts.some(p => p.requested_quantity > 0)"
              class="mt-2"
            >
              <div v-if="hasQuantityErrors" class="text-red-600 text-sm">
                Please correct the requested quantities before submitting
              </div>

              <div
                v-if="!selectedForestProducts.some(p => p.requested_quantity > 0)"
                class="text-amber-600 text-sm"
              >
                Please enter a quantity for your selected forest product(s)
              </div>
            </div>
          </div>

          <!-- Collection Date Input -->
            <div>
            <label
              for="collectionDate"
              class="flex flex-col text-sm font-medium text-gray-700 mb-2"
            >
              <div class="flex items-center gap-2">
                <img src="@/assets/calendar.png" class="w-5 h-5" alt="Calendar Icon" />
                <span>Preferred Collection Date</span>
              </div>
              <span class="text-orange-400 text-xs mt-1">
                Note: The selected date is your preferred collection date. Actual collection may occur on or after this date depending on the Forest Protection Unit's approval timeline. So make sure your time is flexible.
              </span>
            </label>
            <input
              type="date"
              v-model="collectionDate"
              id="collectionDate"
              :min="new Date().toISOString().split('T')[0]"
              class="block w-full border border-gray-300 rounded-full py-3 px-4 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="!isFormComplete || !isCollectionDateValid"
            :class="[isFormComplete && isCollectionDateValid ? 'bg-emerald-900 hover:bg-emerald-700' : 'bg-gray-400 cursor-not-allowed']"
            class="w-full py-3 px-4 rounded-full transition-all text-white font-medium flex items-center justify-center"
          >
            Submit Collection Request
          </button>
        </form>
      </div>

      <!-- Forest Product Modal -->
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      >
        <div
          class="bg-white rounded-lg shadow-xl w-11/12 max-w-2xl max-h-[80vh] flex flex-col"
        >
          <div class="flex justify-between items-center p-4 border-b">
            <div class="flex items-center space-x-2">
              <img
                src="@/assets/forest-product.png"
                alt="Logo"
                class="w-6 h-6"
              />
              <h2 class="text-lg font-semibold text-green-800">
                Select Forest Products
              </h2>
            </div>
            <button
              @click="showModal = false"
              class="text-gray-500 hover:text-gray-700 p-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
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
          <div class="p-4 border-b">
            <div class="relative">
              <input
                type="text"
                v-model="searchQuery"
                placeholder="Search forest products..."
                class="w-full p-2.5 border border-gray-300 rounded-lg pl-10 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 absolute left-3 top-3 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
          <div class="p-4 overflow-y-auto flex-1">
            <div
              v-if="filteredForestProducts.length === 0"
              class="text-center py-8 text-gray-500"
            >
              No forest products found matching your search
            </div>
            <div v-else class="space-y-3">
              <!-- Requests Warning -->
              <div
                v-if="unapprovedRequests.length > 0"
                class="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg mb-4"
              >
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg
                      class="h-5 w-5 text-amber-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <p class="text-sm text-amber-700">
                      <span class="font-medium">Requests Status:</span> Some
                      forest products have approved and pending requests. Please
                      check the snapshot availability before requesting.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Add Select All checkbox -->
              <div
                class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4"
              >
                <input
                  type="checkbox"
                  v-model="selectAll"
                  @change="toggleSelectAll"
                  class="form-checkbox h-5 w-5 text-green-600 rounded"
                />
                <div class="font-medium text-gray-700">
                  Select All Forest Products
                </div>
              </div>

              <div
                v-for="product in filteredForestProducts"
                :key="product.id"
                class="flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-green-200"
              >
                <!-- Card Header with Checkbox and Product Name -->
                <div
                  class="flex items-center p-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-transparent"
                >
                  <input
                    type="checkbox"
                    :value="product"
                    v-model="selectedForestProducts"
                    class="form-checkbox h-5 w-5 text-green-600 rounded focus:ring-green-500 focus:ring-2 focus:ring-offset-2"
                  />
                  <h3 class="ml-3 font-semibold text-gray-800">
                    {{ product.forest_product_name }}
                  </h3>
                </div>

                <!-- Card Body with Product Details -->
                <div class="p-4 space-y-3">
                  <!-- Product Info -->
                  <div class="flex flex-wrap gap-y-2">
                    <div class="w-full flex items-center text-sm text-gray-600">
                      <svg
                        class="w-4 h-4 mr-2 text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <span>{{ product.location_name }}</span>
                    </div>

                    <div class="w-1/2 flex items-center text-sm text-gray-600">
                      <svg
                        class="w-4 h-4 mr-2 text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <span>₱{{ product.price }}/{{ product.unit_name }}</span>
                    </div>

                    <div
                      class="w-1/2 flex items-center text-sm font-medium text-blue-600"
                    >
                      <svg
                        class="w-4 h-4 mr-2 text-blue-500"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"
                        />
                      </svg>
                      <span
                        >{{ product.quantity }} {{ product.unit_name }}(s)</span
                      >
                    </div>
                  </div>

                  <!-- Status Info -->
                  <div
                    v-if="product.hasRequests"
                    class="flex items-center space-x-1 text-xs text-amber-700 bg-amber-50 py-1 px-2 rounded"
                  >
                    <svg
                      class="w-4 h-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <span
                      >Approved: {{ product.approvedQuantity }}, Pending:
                      {{ product.unapprovedQuantity }}</span
                    >
                  </div>

                  <!-- Available for Request -->
                  <div
                    class="mt-2 py-2 px-3 bg-green-50 rounded-lg border border-green-100"
                  >
                    <div class="flex items-center text-green-700 font-medium">
                      <svg
                        class="w-5 h-5 mr-2 text-green-600"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      Available for Request: {{ product.adjustedQuantity }}
                      {{ product.unit_name }}(s)
                    </div>
                  </div>
                </div>

                <!-- Quantity Input Section -->
                <div
                  v-if="selectedForestProducts.includes(product)"
                  class="bg-gray-50 p-4 border-t border-gray-200"
                >
                  <div
                    class="flex flex-col sm:flex-row sm:items-center justify-between"
                  >
                    <label
                      class="text-sm font-medium text-gray-700 mb-2 sm:mb-0"
                      >Quantity to Request:</label
                    >
                    <div class="flex flex-col sm:flex-row sm:items-center">
                      <div class="flex items-center">
                        <div class="relative">
                          <input
                            type="number"
                            v-model="product.requested_quantity"
                            min="0"
                            :max="product.adjustedQuantity"
                            placeholder="Qty"
                            @input="validateProductQuantity(product)"
                            :class="['w-20 text-center border rounded-lg py-2 px-3 text-sm focus:ring-2 focus:outline-none', 
                product.quantityError || product.requested_quantity === 0
                  ? 'border-red-300 bg-red-50 focus:ring-red-200 focus:border-red-400'
                  : 'border-gray-300 focus:ring-green-200 focus:border-green-400']"
                          />
                        </div>
                        <span
                          class="ml-2 text-gray-500 text-sm whitespace-nowrap"
                          >{{ product.unit_name }}(s)</span
                        >
                      </div>

                      <!-- Error messages -->
                      <div class="mt-2 sm:mt-0 sm:ml-3">
                        <p
                          v-if="product.requested_quantity === 0"
                          class="flex items-center text-red-600 text-xs"
                        >
                          <svg
                            class="w-4 h-4 mr-1"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                              clip-rule="evenodd"
                            />
                          </svg>
                          Please enter a valid quantity
                        </p>
                        <p
                          v-if="product.quantityError"
                          class="flex items-center text-red-600 text-xs"
                        >
                          <svg
                            class="w-4 h-4 mr-1"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                              clip-rule="evenodd"
                            />
                          </svg>
                          Limit exceeded: Max {{ product.adjustedQuantity }}
                          {{ product.unit_name }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-end p-4 border-t">
            <button
              class="bg-green-600 hover:bg-green-700 text-white rounded-lg px-6 py-2.5 font-medium"
              @click="showModal = false"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      <!-- Confirmation Dialog -->
      <AlertDialog :open="showConfirmDialog">
        <AlertDialogContent
          class="rounded-lg shadow-lg border border-gray-200 max-h-[80vh] flex flex-col"
        >
          <AlertDialogHeader
            class="bg-gray-900 text-white px-6 py-4 rounded-t-lg"
          >
            <AlertDialogTitle class="text-lg font-bold"
              >Confirm Collection Request</AlertDialogTitle
            >
          </AlertDialogHeader>
          <AlertDialogDescription
            class="px-6 py-4 bg-gray-50 flex-1 overflow-y-auto"
          >
            <p class="text-sm text-gray-700 mb-4">
              Please review the details of your collection request before
              submitting:
            </p>
            <div
              class="bg-white p-4 rounded-lg shadow-inner border border-gray-200 max-h-[40vh] overflow-y-auto"
            >
              <ul class="text-sm text-gray-700 space-y-2">
                <li
                  v-for="product in selectedForestProducts.filter(p => p.requested_quantity > 0)"
                  :key="product.id"
                  class="flex justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <span
                    class="font-medium"
                    >{{ product.forest_product_name }}</span
                  >
                  <div class="text-right">
                    <div class="text-gray-500 text-xs">
                      {{ product.location_name }}
                    </div>
                    <div>
                      {{ product.requested_quantity }} {{ product.unit_name }}
                    </div>
                  </div>
                </li>
              </ul>
            </div>
            <div class="mt-4 bg-white p-4 rounded-lg border border-gray-200">
              <p class="text-sm text-gray-700">
                <span class="font-medium">Collection Date:</span>
                {{ collectionDate }}
              </p>
            </div>
          </AlertDialogDescription>
          <AlertDialogFooter
            class="bg-gray-100 px-6 py-4 flex justify-end space-x-3 rounded-b-lg border-t border-gray-200"
          >
            <AlertDialogCancel
              @click="showConfirmDialog = false"
              class="px-4 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              @click="confirmSubmit"
              class="px-4 py-2 bg-emerald-900 border border-transparent rounded-full text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </div>
</template>

<style scoped>
.form-checkbox {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  padding: 0;
  print-color-adjust: exact;
  display: inline-block;
  vertical-align: middle;
  background-origin: border-box;
  -webkit-user-select: none;
  -moz-user-select: none;
  user-select: none;
  flex-shrink: 0;
  height: 1rem;
  width: 1rem;
  color: #2563eb;
  background-color: #fff;
  border-color: #6b7280;
  border-width: 1px;
  --tw-shadow: 0 0 #0000;
}

.form-checkbox:checked {
  background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
  border-color: transparent;
  background-color: currentColor;
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
}
</style>
