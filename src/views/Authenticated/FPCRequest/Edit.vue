<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'vue-sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

const route = useRoute();
const router = useRouter();
const requestId = route.params.id;
const forestProducts = ref([]);
const filteredForestProducts = ref([]);
const selectedForestProducts = ref([]);
const initialSelectedForestProducts = ref([]);
const collectionDate = ref('');
const initialCollectionDate = ref('');
const showModal = ref(false);
const showConfirmDialog = ref(false);
const searchQuery = ref('');
const error = ref(null);
const selectAll = ref(false);
const showNotes = ref(true);

const fetchForestProducts = async () => {
  try {
    const { data, error } = await supabase
      .from('fp_and_locations')
      .select(`
        id,
        forest_product_id,
        location_id,
        quantity,
        forest_products!inner (
          name,
          deleted_at
        ),
        locations!inner (
          name,
          deleted_at
        )
      `)
      .is('forest_products.deleted_at', null)
      .is('locations.deleted_at', null);

    if (error) throw error;

    // Get approved but unrecorded requests
    const { data: approvedRequests, error: approvedRequestsError } = await supabase
      .from('collection_requests')
      .select(`
        id,
        collection_request_items (
          fp_and_location_id,
          requested_quantity
        )
      `)
      .is('deleted_at', null)
      .eq('remarks', 'Approved')
      .eq('is_recorded', false);

    if (approvedRequestsError) throw approvedRequestsError;

    // Get pending requests
    const { data: pendingRequests, error: pendingRequestsError } = await supabase
      .from('collection_requests')
      .select(`
        id,
        collection_request_items (
          fp_and_location_id,
          requested_quantity
        )
      `)
      .is('deleted_at', null)
      .eq('remarks', 'Pending');

    if (pendingRequestsError) throw pendingRequestsError;

    // Calculate reserved quantities
    const approvedQuantities = {};
    const pendingQuantities = {};

    // Calculate approved quantities
    approvedRequests.forEach(request => {
      request.collection_request_items.forEach(item => {
        approvedQuantities[item.fp_and_location_id] = (approvedQuantities[item.fp_and_location_id] || 0) + item.requested_quantity;
      });
    });

    // Calculate pending quantities (excluding current request)
    pendingRequests.forEach(request => {
      if (request.id !== requestId) {  // Don't count current request's quantities
        request.collection_request_items.forEach(item => {
          pendingQuantities[item.fp_and_location_id] = (pendingQuantities[item.fp_and_location_id] || 0) + item.requested_quantity;
        });
      }
    });

    // Map the products with calculated quantities
    forestProducts.value = data.map(item => {
      const approved = approvedQuantities[item.id] || 0;
      const pending = pendingQuantities[item.id] || 0;
      
      return {
        id: item.id,
        forest_product_name: item.forest_products.name,
        location_name: item.locations.name,
        quantity: item.quantity,
        approvedAmount: approved,
        unapprovedAmount: pending,
        adjustedQuantity: Math.max(0, item.quantity - approved - pending),
        requested_quantity: 0,
        quantityError: false
      };
    });

    filteredForestProducts.value = forestProducts.value;
    await fetchRequestDetails();
  } catch (error) {
    console.error('Error in fetchForestProducts:', error);
    toast.error('Failed to load forest products');
  }
};

const fetchRequestDetails = async () => {
  try {
    const { data: requestData, error: requestError } = await supabase
      .from('collection_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError) throw requestError;

    const formattedDate = new Date(requestData.collection_date).toISOString().split('T')[0];
    collectionDate.value = formattedDate;
    initialCollectionDate.value = formattedDate;

    const { data: itemsData, error: itemsError } = await supabase
      .from('collection_request_items')
      .select('*')
      .eq('collection_request_id', requestId);

    if (itemsError) throw itemsError;

    // Update selected forest products with the requested quantities
    selectedForestProducts.value = itemsData.map(item => {
      const product = forestProducts.value.find(p => p.id === item.fp_and_location_id);
      if (product) {
        return {
          ...product,
          requested_quantity: item.requested_quantity,
          adjustedQuantity: product.adjustedQuantity + item.requested_quantity // Add back this request's quantity
        };
      }
      return null;
    }).filter(Boolean);

    initialSelectedForestProducts.value = JSON.parse(JSON.stringify(selectedForestProducts.value));

  } catch (err) {
    error.value = err.message;
    toast.error('Error loading request details: ' + err.message);
  }
};

watch(collectionDate, (newDate) => {
  if (newDate && !isCollectionDateValid.value) {
    toast.error('Past dates are not allowed. Please select today or a future date.');
  }
});

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

const validateProductQuantity = (product) => {
  if (product.requested_quantity > product.quantity) {
    product.quantityError = true;
    return false;
  } else if (product.requested_quantity <= 0) {
    product.quantityError = true;
    return false;
  } else {
    product.quantityError = false;
    return true;
  }
};

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
  const dateInput = document.getElementById('collectionDate');
  const dateValue = dateInput ? dateInput.value : '';

  return (
    selectedForestProducts.value.length > 0 &&
    dateValue &&
    selectedForestProducts.value.every(p => p.requested_quantity > 0) &&
    !hasQuantityErrors.value
  );
});

const isCollectionDateValid = computed(() => {
  if (!collectionDate.value) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDate = new Date(collectionDate.value);
  selectedDate.setHours(0, 0, 0, 0);

  return selectedDate.getTime() >= today.getTime();
});

const hasChanges = computed(() => {
  const currentDate = collectionDate.value?.split('T')[0];
  const initialDate = initialCollectionDate.value?.split('T')[0];

  if (currentDate !== initialDate) {
    return true;
  }

  if (selectedForestProducts.value.length !== initialSelectedForestProducts.value.length) {
    return true;
  }

  for (const product of selectedForestProducts.value) {
    const initialProduct = initialSelectedForestProducts.value.find(p => p.id === product.id);
    if (!initialProduct || product.requested_quantity !== initialProduct.requested_quantity) {
      return true;
    }
  }

  return false;
});

const handleSubmit = () => {
  if (!isCollectionDateValid.value) {
    toast.error('Collection date cannot be in the past');
    return;
  }

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

  if (!hasChanges.value) {
    toast.info('No changes to update');
    return;
  }

  showConfirmDialog.value = true;
};

const confirmSubmit = async () => {
  const collectionRequest = {
    collection_date: collectionDate.value,
  };

  const { error: requestError } = await supabase
    .from('collection_requests')
    .update(collectionRequest)
    .eq('id', requestId);

  if (requestError) {
    console.error('Error updating collection request:', requestError);
    toast.error('Error updating collection request - ' + requestError.message);
    return;
  }

  const { error: deleteItemsError } = await supabase
    .from('collection_request_items')
    .delete()
    .eq('collection_request_id', requestId);

  if (deleteItemsError) {
    console.error('Error deleting old collection request items:', deleteItemsError);
    toast.error('Error deleting old collection request items - ' + deleteItemsError.message);
    return;
  }

  const { error: itemsError } = await supabase
    .from('collection_request_items')
    .insert(
      selectedForestProducts.value.map(item => ({
        fp_and_location_id: item.id,
        collection_request_id: requestId,
        requested_quantity: item.requested_quantity,
      }))
    );

  if (itemsError) {
    console.error('Error creating collection request items:', itemsError);
    toast.error('Error creating collection request items - ' + itemsError.message);
    return;
  }

  toast.success('Collection request updated successfully');
  router.push('/authenticated/collection-requests');
};

const isProductSelected = (productId) => {
  return selectedForestProducts.value.some(p => p.id === productId);
};

const toggleProductSelection = (product) => {
  const index = selectedForestProducts.value.findIndex(p => p.id === product.id);
  if (index === -1) {
    selectedForestProducts.value.push({
      ...product,
      requested_quantity: 1
    });
  } else {
    selectedForestProducts.value.splice(index, 1);
  }
};

const validateDate = () => {
  if (collectionDate.value) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDate = new Date(collectionDate.value);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      collectionDate.value = new Date().toISOString().split('T')[0];
      toast.error('Past dates are not allowed. Date has been reset to today.');
    }
  }
};

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

watch(selectedForestProducts, (newValue) => {
  const filteredIds = new Set(filteredForestProducts.value.map(p => p.id));
  const selectedInFilter = newValue.filter(p => filteredIds.has(p.id));

  selectAll.value = filteredForestProducts.value.length > 0 &&
                   selectedInFilter.length === filteredForestProducts.value.length;
}, { deep: true });

watch(filteredForestProducts, (newFiltered) => {
  const filteredIds = new Set(newFiltered.map(p => p.id));
  const selectedInFilter = selectedForestProducts.value.filter(p => filteredIds.has(p.id));

  selectAll.value = newFiltered.length > 0 &&
                   selectedInFilter.length === newFiltered.length;
}, { deep: true });

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
          @click="router.push('/authenticated/collection-requests')"
          class="flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <svg
            class="w-5 h-5 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Collection Requests
        </button>
      </div>

      <div class="w-full bg-white rounded-xl shadow-lg overflow-hidden">
        <!-- Header -->
        <div
          class="bg-gray-200 px-6 py-5 text-black flex items-center space-x-4"
        >
          <img
            src="@/assets/request2.png"
            alt="Request"
            class="w-6 h-6 group-hover:scale-110 transition-transform"
          />
          <div>
            <h2 class="text-2xl font-bold">Edit Collection Request</h2>
            <p class="text-black-100 mt-1">
              Update your forest products collection request details
            </p>
          </div>
        </div>

        <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
          <!-- Collection Date -->
          <div>
            <label
              for="collectionDate"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              Collection Date
            </label>
            <input
              id="collectionDate"
              v-model="collectionDate"
              type="date"
              @change="validateDate"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <!-- Forest Products Selection -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >Forest Products</label
            >
            <button
              type="button"
              @click="showModal = true"
              class="w-full flex items-center justify-between bg-white border border-gray-300 rounded-lg py-3 px-4 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <span class="text-gray-500"
                >{{ selectedForestProducts.length }} products selected</span
              >
              <svg
                class="w-5 h-5 text-gray-400"
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

          <!-- Selected Products List -->
          <div v-if="selectedForestProducts.length > 0" class="space-y-4">
            <div
              v-for="product in selectedForestProducts"
              :key="product.id"
              class="bg-gray-50 p-4 rounded-lg space-y-3"
            >
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="font-medium text-gray-900">
                    {{ product.forest_product_name }}
                  </h3>
                  <p class="text-sm text-gray-500">
                    Location: {{ product.location_name }}
                  </p>
                  <p class="text-sm text-gray-500">
                    Available: {{ product.adjustedQuantity }} kg
                  </p>
                </div>
                <button
                  type="button"
                  @click="toggleProductSelection(product)"
                  class="text-red-600 hover:text-red-800"
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
              <div>
                <label :for="'quantity-' + product.id" class="sr-only"
                  >Quantity</label
                >
                <input
                  :id="'quantity-' + product.id"
                  v-model.number="product.requested_quantity"
                  type="number"
                  min="1"
                  :max="product.adjustedQuantity"
                  class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  :class="{ 'border-red-500': product.quantityError }"
                  required
                />
                <p
                  v-if="product.quantityError"
                  class="mt-1 text-sm text-red-600"
                >
                  Requested quantity must be between 1 and
                  {{ product.adjustedQuantity }}
                </p>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="!isFormComplete || !hasChanges || !isCollectionDateValid"
            class="w-full py-3 px-4 rounded-lg transition-all text-white font-medium flex items-center justify-center"
            :class="isFormComplete && hasChanges && isCollectionDateValid ? 'bg-gray-900 hover:bg-emerald-800' : 'bg-gray-400 cursor-not-allowed'"
          >
            Update Request
          </button>
        </form>
      </div>

      <!-- Forest Products Modal -->
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      >
        <div
          class="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
        >
          <!-- Modal Header -->
          <div
            class="px-6 py-4 border-b border-gray-200 flex justify-between items-center"
          >
            <h3 class="text-xl font-semibold text-gray-900">
              Select Forest Products
            </h3>
            <button
              @click="showModal = false"
              class="text-gray-400 hover:text-gray-500"
            >
              <svg
                class="w-6 h-6"
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

          <!-- Search and Select All -->
          <div class="px-6 py-4 border-b border-gray-200 space-y-4">
            <div class="relative">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search forest products..."
                class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <svg
                class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <div class="flex items-center">
              <input
                type="checkbox"
                id="selectAll"
                v-model="selectAll"
                @change="toggleSelectAll"
                class="form-checkbox"
              />
              <label for="selectAll" class="ml-2 text-sm text-gray-700"
                >Select All</label
              >
            </div>
          </div>

          <!-- Products List -->
          <div class="flex-1 overflow-y-auto px-6 py-4">
            <div class="space-y-4">
              <div
                v-for="product in filteredForestProducts"
                :key="product.id"
                class="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div class="flex items-start space-x-4">
                  <input
                    type="checkbox"
                    :id="'product-' + product.id"
                    :checked="isProductSelected(product.id)"
                    @change="toggleProductSelection(product)"
                    class="form-checkbox mt-1"
                  />
                  <div>
                    <label
                      :for="'product-' + product.id"
                      class="block font-medium text-gray-900"
                    >
                      {{ product.forest_product_name }}
                    </label>
                    <p class="text-sm text-gray-500">
                      Location: {{ product.location_name }}
                    </p>
                    <div class="mt-1 space-y-1">
                      <p class="text-sm text-gray-600">
                        Total Stock: {{ product.quantity }} kg
                      </p>
                      <p v-if="product.approvedAmount > 0" class="text-sm text-amber-600">
                        Reserved (Approved): {{ product.approvedAmount }} kg
                      </p>
                      <p v-if="product.unapprovedAmount > 0" class="text-sm text-blue-600">
                        Reserved (Pending): {{ product.unapprovedAmount }} kg
                      </p>
                      <p class="text-sm font-medium text-emerald-600">
                        Available to Request: {{ product.adjustedQuantity }} kg
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="px-6 py-4 border-t border-gray-200">
            <button
              @click="showModal = false"
              class="w-full py-2 px-4 bg-gray-900 hover:bg-emerald-800 text-white rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      <!-- Confirmation Dialog -->
      <AlertDialog
        :open="showConfirmDialog"
        @update:open="showConfirmDialog = $event"
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Update</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to update this collection request?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel @click="showConfirmDialog = false"
              >Cancel</AlertDialogCancel
            >
            <AlertDialogAction @click="confirmSubmit">Update</AlertDialogAction>
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
