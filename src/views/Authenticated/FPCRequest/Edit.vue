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

const fetchForestProducts = async () => {
  const { data, error } = await supabase
    .from('fp_and_locations')
    .select(`
      id,
      forest_product_id,
      location_id,
      quantity,
      forest_products (
        id,
        name,
        price_based_on_measurement_unit,
        measurement_unit_id,
        measurement_units (unit_name)
      ),
      locations (name)
    `);
  if (error) {
    console.error('Error fetching forest products:', error);
    toast.error('Failed to load forest products');
  } else {
    forestProducts.value = data.map(item => ({
      id: item.id,
      forest_product_id: item.forest_product_id,
      forest_product_name: item.forest_products.name,
      location_id: item.location_id,
      location_name: item.locations.name,
      price: item.forest_products.price_based_on_measurement_unit,
      unit_name: item.forest_products.measurement_units.unit_name,
      quantity: item.quantity,
      requested_quantity: 0,
      quantityError: false
    }));
    filteredForestProducts.value = forestProducts.value;

    // Now fetch the request details after products are loaded
    fetchRequestDetails();
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

    // Format the date to YYYY-MM-DD
    const formattedDate = new Date(requestData.collection_date).toISOString().split('T')[0];

    // Validate that the date is not in the past before setting it
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const requestDate = new Date(formattedDate);
    requestDate.setHours(0, 0, 0, 0);

    if (requestDate < today) {
      // If the existing date is in the past, set it to today
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

    // Map selected products based on the items from the request
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
// Add this watch effect at the top with your other watchers
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
});
// Add a watch effect for the collectionDate
watch(collectionDate, (newDate) => {
  if (newDate && !isCollectionDateValid.value) {
    toast.error('Past dates are not allowed. Please select today or a future date.');
  }
});
// Add validation function to check quantity
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
  const dateInput = document.getElementById('collectionDate');
  const dateValue = dateInput ? dateInput.value : '';

  return (
    selectedForestProducts.value.length > 0 &&
    dateValue &&
    selectedForestProducts.value.every(p => p.requested_quantity > 0) &&
    !hasQuantityErrors.value
  );
});

// First, let's ensure isCollectionDateValid is working correctly
const isCollectionDateValid = computed(() => {
  if (!collectionDate.value) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDate = new Date(collectionDate.value);
  selectedDate.setHours(0, 0, 0, 0);

  return selectedDate.getTime() >= today.getTime();
});

// Next, ensure the submit button properly respects this validation

const hasChanges = computed(() => {
  // Check if the collection date has changed
  const currentDate = collectionDate.value?.split('T')[0];
  const initialDate = initialCollectionDate.value?.split('T')[0];

  if (currentDate !== initialDate) {
    return true;
  }

  // Check if the selected forest products have changed
  if (selectedForestProducts.value.length !== initialSelectedForestProducts.value.length) {
    return true;
  }

  // Check if any selected product has changed quantity
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
  // Check for valid date first
  if (!isCollectionDateValid.value) {
    toast.error('Collection date cannot be in the past');
    return;
  }

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

  if (!hasChanges.value) {
    toast.info('No changes to update');
    return;
  }

  showConfirmDialog.value = true;
};

const confirmSubmit = async () => {
  // Update the collection request
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

  // Delete existing items
  const { error: deleteItemsError } = await supabase
    .from('collection_request_items')
    .delete()
    .eq('collection_request_id', requestId);

  if (deleteItemsError) {
    console.error('Error deleting old collection request items:', deleteItemsError);
    toast.error('Error deleting old collection request items - ' + deleteItemsError.message);
    return;
  }

  // Insert new items
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

// Helper function to check if a product is selected
const isProductSelected = (productId) => {
  return selectedForestProducts.value.some(p => p.id === productId);
};

// Helper function to toggle product selection
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
      // Reset to today's date if a past date was somehow selected
      collectionDate.value = new Date().toISOString().split('T')[0];
      toast.error('Past dates are not allowed. Date has been reset to today.');
    }
  }
};

onMounted(() => {
  fetchForestProducts();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="max-w-lg w-full bg-white rounded-xl shadow-lg overflow-hidden">
      <!-- Header -->
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

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
        <!-- Forest Products Selection -->
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

        <!-- Selected Products Summary -->
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
              <!-- Error message for quantity validation -->
              <div
                v-if="product.quantityError"
                class="text-red-500 text-xs mt-1"
              >
                Requested quantity exceeds available amount
              </div>
              <!-- Error message for 0 quantity validation -->
              <div
                v-if="product.requested_quantity === 0"
                class="text-red-500 text-xs mt-1"
              >
                Please enter a valid quantity.
              </div>
            </div>
          </div>
          <!-- Display warning if there are any quantity errors -->
          <div
            v-if="hasQuantityErrors"
            class="text-red-500 text-sm font-medium"
          >
            Please correct the requested quantities before submitting
          </div>
          <!-- Display warning if no quantity is entered for selected products -->
          <div
            v-if="!selectedForestProducts.some(p => p.requested_quantity > 0)"
            class="text-yellow-500 text-sm font-medium"
          >
            Please enter a quantity for your selected forest product(s)
          </div>
        </div>

        <!-- Collection Date Input -->
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

        <!-- Submit Button -->
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

    <!-- Forest Product Modal -->
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
          <div
            v-if="filteredForestProducts.length === 0"
            class="text-center py-8 text-gray-500"
          >
            No forest products found matching your search
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="product in filteredForestProducts"
              :key="product.id"
              class="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg border border-gray-100"
            >
              <input
                type="checkbox"
                :id="'product-' + product.id"
                :checked="isProductSelected(product.id)"
                @change="toggleProductSelection(product)"
                class="form-checkbox h-5 w-5 text-green-600 rounded"
              />
              <div class="flex-1">
                <div class="font-medium">{{ product.forest_product_name }}</div>
                <div class="text-sm text-gray-500">
                  Location: {{ product.location_name }} | Price: ₱{{ product.price }}
                  per {{ product.unit_name }} | Available:
                  {{ product.quantity }} {{ product.unit_name }}(s)
                </div>
              </div>
              <div v-if="isProductSelected(product.id)" class="flex flex-col">
                <div class="flex items-center space-x-2">
                  <label class="text-sm text-gray-600">Quantity:</label>
                  <input
                    type="number"
                    v-model="selectedForestProducts.find(p => p.id === product.id).requested_quantity"
                    min="0"
                    :max="product.quantity"
                    placeholder="Qty"
                    @input="validateProductQuantity(selectedForestProducts.find(p => p.id === product.id))"
                    :class="[
                      'w-24 text-center border rounded p-1',
                      selectedForestProducts.find(p => p.id === product.id).quantityError || 
                      selectedForestProducts.find(p => p.id === product.id).requested_quantity === 0 
                        ? 'border-red-500 bg-red-50' 
                        : 'border-gray-300'
                    ]"
                  />
                </div>
                <!-- Warning for zero quantity -->
                <div
                  v-if="selectedForestProducts.find(p => p.id === product.id).requested_quantity === 0"
                  class="text-red-500 text-xs mt-1 text-right"
                >
                  Please enter a valid quantity.
                </div>
                <!-- Inline error message -->
                <div
                  v-if="selectedForestProducts.find(p => p.id === product.id).quantityError"
                  class="text-red-500 text-xs mt-1 text-right"
                >
                  Max: {{ product.quantity }}
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
      <AlertDialogContent class="rounded-lg shadow-lg border border-gray-200">
        <AlertDialogHeader
          class="bg-gray-900 text-white px-6 py-4 rounded-t-lg"
        >
          <AlertDialogTitle class="text-lg font-bold"
            >Confirm Collection Request Update</AlertDialogTitle
          >
        </AlertDialogHeader>
        <AlertDialogDescription class="px-6 py-4 bg-gray-50">
          <p class="text-sm text-gray-700 mb-4">
            Please review your changes to this collection request before
            submitting:
          </p>
          <ul
            class="text-sm text-gray-700 space-y-2 bg-white p-4 rounded-lg shadow-inner border border-gray-200"
          >
            <li
              v-for="product in selectedForestProducts.filter(p => p.requested_quantity > 0)"
              :key="product.id"
              class="flex justify-between"
            >
              <span
                ><strong>{{ product.forest_product_name }}</strong>
                ({{ product.location_name }})</span
              >
              <span
                >{{ product.requested_quantity }} {{ product.unit_name }}</span
              >
            </li>
          </ul>
          <p class="text-sm text-gray-700 mt-4">
            <strong>Collection Date:</strong> {{ collectionDate }}
          </p>
        </AlertDialogDescription>
        <AlertDialogFooter
          class="bg-gray-100 px-6 py-4 flex justify-end space-x-3 rounded-b-lg"
        >
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
