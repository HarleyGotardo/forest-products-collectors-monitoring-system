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
      throw error;
    }
    
    // Then, get approved but unrecorded collection requests
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
      
    if (approvedRequestsError) {
      console.error('Error fetching approved requests:', approvedRequestsError);
      throw approvedRequestsError;
    }
    
    // Calculate pending quantities for each forest product location
    const pendingQuantities = {};
    
    // Process each approved request
    approvedRequests.forEach(request => {
      // Check if there's a related collection record that is paid
      const hasPaidRecord = request.collection_records && 
                            request.collection_records.some(record => record.is_paid === true);
      
      // Only consider this request as pending if it's not recorded AND doesn't have a paid record
      if (!hasPaidRecord) {
        request.collection_request_items.forEach(item => {
          const fpLocationId = item.fp_and_location_id;
          if (!pendingQuantities[fpLocationId]) {
            pendingQuantities[fpLocationId] = 0;
          }
          pendingQuantities[fpLocationId] += item.requested_quantity;
        });
      }
    });
    
    // Map the products with adjusted quantities
    forestProducts.value = data.map(item => {
      const pendingAmount = pendingQuantities[item.id] || 0;
      const adjustedQuantity = Math.max(0, item.quantity - pendingAmount);
      
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
        pendingQuantity: pendingAmount,
        hasPendingRequests: pendingAmount > 0,
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

// Add this new function for select all functionality
const toggleSelectAll = () => {
  if (selectAll.value) {
    // Select all filtered products
    selectedForestProducts.value = [...filteredForestProducts.value];
  } else {
    // Deselect all products
    selectedForestProducts.value = [];
  }
};

// Add this watch to handle select all state changes
watch(selectAll, (newValue) => {
  toggleSelectAll();
});

// Add this watch to update select all checkbox state
watch(selectedForestProducts, (newValue) => {
  selectAll.value = newValue.length === filteredForestProducts.value.length && filteredForestProducts.value.length > 0;
}, { deep: true });

// Update the watch for searchQuery to handle select all state
watch(searchQuery, (newQuery) => {
  filteredForestProducts.value = forestProducts.value.filter(product =>
    product.forest_product_name.toLowerCase().includes(newQuery.toLowerCase()) ||
    product.location_name.toLowerCase().includes(newQuery.toLowerCase())
  );
  // Reset select all when search changes
  selectAll.value = false;
});

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

onMounted(() => {
  fetchForestProducts();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="max-w-lg w-full bg-white rounded-xl shadow-lg overflow-hidden">
      <!-- Header -->
      <div class="bg-gray-200 px-6 py-5 text-black flex items-center space-x-4">
        <img src="@/assets/request2.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
        <div>
          <h2 class="text-2xl font-bold text-green-900">Forest Product Collection Request</h2>
          <p class="text-black-100 mt-1 text-green-800">Request permission to harvest forest products</p>
        </div>
      </div>

      <!-- Info Notes Toggle -->
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-gray-900">Important Information</h3>
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
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
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
              <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-blue-700">
                <span class="font-medium">Request Process:</span> Select the forest products you wish to collect, specify the quantities, and choose your preferred collection date. Your request will be reviewed by the Forest Protection Unit.
              </p>
            </div>
          </div>
        </div>

        <!-- Quantity Note -->
        <div class="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-green-700">
                <span class="font-medium">Quantity Guidelines:</span> The available quantities shown include pending requests. Make sure to check the snapshot availability before requesting quantities. You cannot request more than what is currently available.
              </p>
            </div>
          </div>
        </div>

        <!-- Collection Date Note -->
        <div class="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-amber-700">
                <span class="font-medium">Collection Date:</span> Choose a date for collection. Same-day collections must be requested before 4:00 PM. Future dates can be selected up to 30 days in advance.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
        <!-- Forest Products Selection -->
        <div>
          <label for="forestProducts" class="block text-sm font-medium text-gray-700 mb-2">Forest Products</label>
          <button
        type="button"
        @click="showModal = true"
        class="w-full flex items-center justify-between bg-white border border-gray-300 rounded-lg py-3 px-4 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
          >
        <span class="text-gray-700">
          {{ selectedForestProducts.length ? `${selectedForestProducts.length} products selected` : 'Select forest products' }}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
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
          <label class="block text-sm font-medium text-gray-700">Selected Products ({{ selectedForestProducts.length }})</label>
          <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
        <div v-for="product in selectedForestProducts" :key="product.id" class="text-sm mb-2">
          <div class="flex justify-between items-center">
            <span>
          {{ product.forest_product_name }} - {{ product.requested_quantity > 0 ? product.requested_quantity : 'No' }} {{ product.unit_name }}(s)
            </span>
            <span class="text-gray-500 text-xs">
              Available: {{ product.adjustedQuantity }} / {{ product.quantity }} {{ product.unit_name }}(s)
              <span v-if="product.hasPendingRequests" class="text-amber-600">({{ product.pendingQuantity }} pending)</span>
            </span>
          </div>
          <!-- Error message for quantity validation -->
          <div v-if="product.quantityError" class="text-red-500 text-xs mt-1">
            Requested quantity exceeds available amount
          </div>
          <!-- Error message for 0 quantity validation -->
          <div v-if="product.requested_quantity === 0" class="text-red-500 text-xs mt-1">
            Please enter a valid quantity.
          </div>
        </div>
          </div>
          <!-- Display warning if there are any quantity errors -->
          <div v-if="hasQuantityErrors" class="text-red-500 text-sm font-medium">
        Please correct the requested quantities before submitting
          </div>
          <!-- Display warning if no quantity is entered for selected products -->
          <div v-if="!selectedForestProducts.some(p => p.requested_quantity > 0)" class="text-yellow-500 text-sm font-medium">
        Please enter a quantity for your selected forest product(s)
          </div>
        </div>

        <!-- Collection Date Input -->
        <div>
          <label for="collectionDate" class="block text-sm font-medium text-gray-700 mb-2">Collection Date</label>
          <input
        type="date"
        v-model="collectionDate"
        id="collectionDate"
        class="block w-full border border-gray-300 rounded-lg py-3 px-4 focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="!isFormComplete || !isCollectionDateValid"
          :class="[isFormComplete && isCollectionDateValid ? 'bg-gray-900 hover:bg-green-800' : 'bg-gray-400 cursor-not-allowed']"
          class="w-full py-3 px-4 rounded-lg transition-all text-white font-medium flex items-center justify-center"
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
      <div class="bg-white rounded-lg shadow-xl w-11/12 max-w-2xl max-h-[80vh] flex flex-col">
        <div class="flex justify-between items-center p-4 border-b">
            <div class="flex items-center space-x-2">
            <img src="@/assets/forest-product.png" alt="Logo" class="w-6 h-6" />
            <h2 class="text-lg font-semibold text-green-800">Select Forest Products</h2>
            </div>
          <button @click="showModal = false" class="text-gray-500 hover:text-gray-700 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
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
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 absolute left-3 top-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <div class="p-4 overflow-y-auto flex-1">
          <div v-if="filteredForestProducts.length === 0" class="text-center py-8 text-gray-500">
            No forest products found matching your search
          </div>
          <div v-else class="space-y-3">
            <!-- Add Select All checkbox -->
            <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
              <input
                type="checkbox"
                v-model="selectAll"
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
                  <span v-if="product.hasPendingRequests" class="text-green-600">
                  Snapshot: {{ product.adjustedQuantity }} {{ product.unit_name }}(s)
                  </span>
                  <span v-else class="text-blue-600">
                  Available: {{ product.quantity }} {{ product.unit_name }}(s)
                  </span>
                  <span v-if="product.hasPendingRequests" class="text-amber-600">
                  ({{ product.pendingQuantity }} pending)
                  </span>
                </div>
              </div>
              <div v-if="selectedForestProducts.includes(product)" class="flex flex-col">
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

    <!-- Confirmation Dialog -->
    <AlertDialog :open="showConfirmDialog">
      <AlertDialogContent class="rounded-lg shadow-lg border border-gray-200 max-h-[80vh] flex flex-col">
        <AlertDialogHeader class="bg-gray-900 text-white px-6 py-4 rounded-t-lg">
          <AlertDialogTitle class="text-lg font-bold">Confirm Collection Request</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription class="px-6 py-4 bg-gray-50 flex-1 overflow-y-auto">
          <p class="text-sm text-gray-700 mb-4">
            Please review the details of your collection request before submitting:
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
            Submit
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