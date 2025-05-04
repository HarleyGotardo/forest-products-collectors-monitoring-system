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

    const approvedQuantities = {};
    const unapprovedQuantities = {};

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

    unapprovedRequests.forEach(request => {
      request.collection_request_items.forEach(item => {
        const fpLocationId = item.fp_and_location_id;
        if (!unapprovedQuantities[fpLocationId]) {
          unapprovedQuantities[fpLocationId] = 0;
        }
        unapprovedQuantities[fpLocationId] += item.requested_quantity;
      });
    });

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

    fetchRequestDetails();
  } catch (error) {
    console.error('Error in fetchForestProducts:', error);
    toast.error('Failed to load forest products');
  }
};

const fetchRequestDetails = async () => {
  try {
    const { data: requestData, error: requestError } = await supabase
      .from('collection_requests')
      .select('*, user_id')
      .eq('id', requestId)
      .single();

    if (requestError) {
      throw requestError;
    }

    const formattedDate = new Date(requestData.collection_date).toISOString().split('T')[0];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const requestDate = new Date(formattedDate);
    requestDate.setHours(0, 0, 0, 0);

    if (requestDate < today) {
      collectionDate.value = new Date().toISOString().split('T')[0];
      initialCollectionDate.value = collectionDate.value;
      toast.warning('The original collection date was in the past and has been updated to today.');
    } else {
      collectionDate.value = formattedDate;
      initialCollectionDate.value = formattedDate;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('collection_request_items')
      .select('*, fp_and_location_id')
      .eq('collection_request_id', requestId);

    if (itemsError) {
      throw itemsError;
    }

    selectedForestProducts.value = itemsData.map(item => {
      const productMatch = forestProducts.value.find(p => p.id === item.fp_and_location_id);

      if (productMatch) {
        return {
          ...productMatch,
          requested_quantity: item.requested_quantity,
          quantityError: item.requested_quantity > productMatch.quantity
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

watch(collectionDate, (newDate) => {
  if (newDate && !isCollectionDateValid.value) {
    toast.error('Past dates are not allowed. Please select today or a future date.');
  }
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

watch(collectionDate, (newDate) => {
  if (newDate && !isCollectionDateValid.value) {
    toast.error('Past dates are not allowed. Please select today or a future date.');
  }
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
    <div class="max-w-lg w-full bg-white rounded-xl shadow-lg overflow-hidden">
      <div class="bg-gray-200 px-6 py-5 text-black flex items-center space-x-4">
        <img
          src="@/assets/request2.png"
          alt="Forest Map"
          class="w-6 h-6 group-hover:scale-110 transition-transform"
        />
        <div>
          <h2 class="text-2xl font-bold">Edit Collection Request</h2>
          <p class="text-black-100 mt-1">
            Update your request to harvest forest products
          </p>
        </div>
      </div>

      <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
        <div>
          <label
            for="forestProducts"
            class="block text-sm font-medium text-gray-700 mb-2"
            >Forest Products</label
          >
          <button
            type="button"
            @click="showModal = true"
            class="w-full flex items-center justify-between bg-white border border-gray-300 rounded-lg py-3 px-4 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
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

        <div v-if="selectedForestProducts.length > 0" class="space-y-2">
          <label class="block text-sm font-medium text-gray-700"
            >Selected Products ({{ selectedForestProducts.length }})</label
          >
          <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div
              v-for="product in selectedForestProducts"
              :key="product.id"
              class="text-sm mb-2"
            >
              <div class="flex justify-between items-center">
                <span>
                  {{ product.forest_product_name }} -
                  {{ product.requested_quantity > 0 ? product.requested_quantity : 'No' }}
                  {{ product.unit_name }}(s)
                </span>
                <span class="text-gray-500 text-xs"
                  >Available: {{ product.quantity }}
                  {{ product.unit_name }}(s)</span
                >
              </div>
              <div
                v-if="product.quantityError"
                class="text-red-500 text-xs mt-1"
              >
                Requested quantity exceeds available amount
              </div>
              <div
                v-if="product.requested_quantity === 0"
                class="text-red-500 text-xs mt-1"
              >
                Please enter a valid quantity.
              </div>
            </div>
          </div>
          <div
            v-if="hasQuantityErrors"
            class="text-red-500 text-sm font-medium"
          >
            Please correct the requested quantities before submitting
          </div>
          <div
            v-if="!selectedForestProducts.some(p => p.requested_quantity > 0)"
            class="text-yellow-500 text-sm font-medium"
          >
            Please enter a quantity for your selected forest product(s)
          </div>
        </div>

        <div>
          <label
            for="collectionDate"
            class="block text-sm font-medium text-gray-700 mb-2"
            >Collection Date</label
          >
          <input
            type="date"
            id="collectionDate"
            v-model="collectionDate"
            :min="new Date().toISOString().split('T')[0]"
            @change="validateDate"
            class="block w-full border border-gray-300 rounded-lg py-3 px-4 focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
          <div
            v-if="collectionDate && !isCollectionDateValid"
            class="text-red-500 text-sm mt-1"
          >
            Past dates are not allowed. Please select today or a future date.
          </div>
        </div>

        <button
          type="submit"
          :disabled="!isFormComplete || !hasChanges || !isCollectionDateValid"
          :class="[
    'w-full py-3 px-4 rounded-lg transition-all text-white font-medium flex items-center justify-center',
    isFormComplete && hasChanges && isCollectionDateValid ? 'bg-gray-900 hover:bg-green-800' : 'bg-gray-400 cursor-not-allowed'
  ]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
          Update Collection Request
        </button>
      </form>
    </div>

    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div
        class="bg-white rounded-lg shadow-xl w-11/12 max-w-2xl max-h-[80vh] flex flex-col"
      >
        <div class="flex justify-between items-center p-4 border-b">
          <h2 class="text-lg font-semibold text-green-800">
            Select Forest Products
          </h2>
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
          <div v-if="filteredForestProducts.length === 0" class="text-center py-8 text-gray-500">
            No forest products found matching your search
          </div>
          <div v-else class="space-y-3">
            <!-- Requests Warning -->
            <div v-if="unapprovedRequests.length > 0" class="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg mb-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-amber-700">
                    <span class="font-medium">Requests Status:</span> Some forest products have approved and pending requests. Please check the snapshot availability before requesting.
                  </p>
                </div>
              </div>
            </div>

            <!-- Add Select All checkbox -->
            <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
              <input
                type="checkbox"
                v-model="selectAll"
                @change="toggleSelectAll"
                class="form-checkbox h-5 w-5 text-green-600 rounded"
              />
              <div class="font-medium text-gray-700">Select All Forest Products</div>
            </div>
            
            <div v-for="product in filteredForestProducts" :key="product.id" 
                 class="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg border border-gray-100">
              <input
                type="checkbox"
                :value="product"
                v-model="selectedForestProducts"
                class="form-checkbox h-5 w-5 text-green-600 rounded"
              />
              <div class="flex-1">
                <div class="font-medium">{{ product.forest_product_name }}</div>
                <div class="text-sm text-gray-500">
                  Location: {{ product.location_name }} | 
                  Price: ₱{{ product.price }} per {{ product.unit_name }} | 
                  <span class="text-blue-600">
                    Available: {{ product.quantity }} {{ product.unit_name }}(s)
                  </span>
                  <span v-if="product.hasRequests" class="text-amber-600">
                    (Approved: {{ product.approvedQuantity }}, Pending: {{ product.unapprovedQuantity }})
                  </span>
                  <div class="mt-1 text-sm">
                    <span class="font-medium text-green-600">
                      Available for Request: {{ product.adjustedQuantity }} {{ product.unit_name }}(s)
                    </span>
                  </div>
                </div>
              </div>
              <div v-if="selectedForestProducts.some(p => p.id === product.id)" class="flex flex-col">
                <div class="flex items-center space-x-2">
                  <label class="text-sm text-gray-600">Quantity:</label>
                  <input
                  type="number"
                  v-model="product.requested_quantity"
                  min="0"
                  :max="product.adjustedQuantity"
                  placeholder="Qty"
                  @input="validateProductQuantity(product)"
                  :class="['w-24 text-center border rounded p-1', product.quantityError || product.requested_quantity === 0 ? 'border-red-500 bg-red-50' : 'border-gray-300']"
                  />
                </div>
                <!-- Warning for zero quantity -->
                <div v-if="product.requested_quantity === 0" class="text-red-500 text-xs mt-1 text-right">
                  Please enter a valid quantity.
                </div>
                <!-- Inline error message -->
                <div v-if="product.quantityError" class="text-red-500 text-xs mt-1 text-right">
                  Max: {{ product.adjustedQuantity }}
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

    <AlertDialog :open="showConfirmDialog">
      <AlertDialogContent class="rounded-lg shadow-lg border border-gray-200 max-h-[80vh] flex flex-col">
        <AlertDialogHeader class="bg-gray-900 text-white px-6 py-4 rounded-t-lg">
          <AlertDialogTitle class="text-lg font-bold">Confirm Collection Request Update</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription class="px-6 py-4 bg-gray-50 flex-1 overflow-y-auto">
          <p class="text-sm text-gray-700 mb-4">
            Please review your changes to this collection request before submitting:
          </p>
          <div class="bg-white p-4 rounded-lg shadow-inner border border-gray-200 max-h-[40vh] overflow-y-auto">
            <ul class="text-sm text-gray-700 space-y-2">
              <li v-for="product in selectedForestProducts.filter(p => p.requested_quantity > 0)" :key="product.id" class="flex justify-between py-2 border-b border-gray-100 last:border-0">
                <span class="font-medium">{{ product.forest_product_name }}</span>
                <div class="text-right">
                  <div class="text-gray-500 text-xs">{{ product.location_name }}</div>
                  <div>{{ product.requested_quantity }} {{ product.unit_name }}</div>
                </div>
              </li>
            </ul>
          </div>
          <div class="mt-4 bg-white p-4 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-700">
              <span class="font-medium">Collection Date:</span> {{ collectionDate }}
            </p>
          </div>
        </AlertDialogDescription>
        <AlertDialogFooter class="bg-gray-100 px-6 py-4 flex justify-end space-x-3 rounded-b-lg border-t border-gray-200">
          <AlertDialogCancel
            @click="showConfirmDialog = false"
            class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            @click="confirmSubmit"
            class="px-4 py-2 bg-gray-900 border border-transparent rounded-lg text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Update
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

