<script setup>
import { ref, onMounted, computed } from 'vue';
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
const selectAll = ref(false); // State for "Select All" checkbox
const showConfirmDialog = ref(false); // State for showing the confirmation dialog
const router = useRouter();

const fetchForestProducts = async () => {
  const { data, error } = await supabase
    .from('forest_products')
    .select('id, name, measurement_unit_id (unit_name)');
  if (error) {
    console.error('Error fetching forest products:', error);
  } else {
    forestProducts.value = data;
    filteredForestProducts.value = data; // Initialize filtered products
  }
};

const isFormComplete = computed(() => {
  return (
    selectedForestProducts.value.length > 0 &&
    collectionDate.value &&
    selectedForestProducts.value.every((p) => p.quantity && parseFloat(p.quantity) > 0)
  );
});

const isCollectionDateValid = computed(() => {
  return new Date(collectionDate.value) >= new Date();
});

const handleSubmit = () => {
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

  const collectionRequestItems = selectedForestProducts.value.map((product) => ({
    forest_product_id: product.id,
    requested_quantity: product.quantity,
  }));

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
      collectionRequestItems.map((item) => ({
        ...item,
        collection_request_id: collectionRequestId,
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

// Search functionality
const filterProducts = () => {
  filteredForestProducts.value = forestProducts.value.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
};

// Select All functionality
const toggleSelectAll = () => {
  if (selectAll.value) {
    selectedForestProducts.value = filteredForestProducts.value.map((product) => ({
      ...product,
      quantity: '1',
    }));
  } else {
    selectedForestProducts.value = [];
  }
};

// Toggle product selection
const toggleProductSelection = (product) => {
  const index = selectedForestProducts.value.findIndex((p) => p.id === product.id);
  if (index === -1) {
    selectedForestProducts.value.push({ ...product, quantity: '1' });
  } else {
    selectedForestProducts.value.splice(index, 1);
  }
};

// Check if a product is selected
const isProductSelected = (product) => {
  return selectedForestProducts.value.some((p) => p.id === product.id);
};

// Update quantity for a selected product
const updateQuantity = (product, quantity) => {
  const selectedProduct = selectedForestProducts.value.find((p) => p.id === product.id);
  if (selectedProduct) {
    selectedProduct.quantity = quantity;
  }
};

// Confirm selection in the modal
const confirmSelection = () => {
  if (selectedForestProducts.value.some((p) => !p.quantity || parseFloat(p.quantity) <= 0)) {
    toast.error('Please provide a valid quantity for all selected products');
    return;
  }
  showModal.value = false;
};

// Cancel selection in the modal
const cancelSelection = () => {
  showModal.value = false;
};

onMounted(() => {
  fetchForestProducts();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="max-w-lg w-full bg-white rounded-xl shadow-lg overflow-hidden">
      <!-- Header -->
      <div class="bg-gray-900 px-6 py-5 text-white">
        <h2 class="text-2xl font-bold">Forest Product Collection Request</h2>
        <p class="text-green-100 mt-1">Request permission to harvest forest products</p>
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
        <AlertDialog>
          <AlertDialogTrigger>
            <button
              type="submit"
              :disabled="!isFormComplete || !isCollectionDateValid"
              :class="[isFormComplete && isCollectionDateValid ? 'bg-gray-900 hover:bg-green-800' : 'bg-gray-400 cursor-not-allowed']"
              class="w-full py-3 px-4 rounded-lg transition-all text-white font-medium flex items-center justify-center"
            >
              Submit Collection Request
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent class="rounded-lg shadow-lg border border-gray-200">
            <AlertDialogHeader class="bg-gray-900 text-white px-6 py-4 rounded-t-lg">
              <AlertDialogTitle class="text-lg font-bold">Confirm Collection Request</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription class="px-6 py-4 bg-gray-50">
              <p class="text-sm text-gray-700 mb-4">
          Please review the details of your collection request before submitting:
              </p>
              <ul class="text-sm text-gray-700 space-y-2 bg-white p-4 rounded-lg shadow-inner border border-gray-200">
          <li v-for="product in selectedForestProducts" :key="product.id" class="flex justify-between">
            <span><strong>{{ product.name }}</strong></span>
            <span>{{ product.quantity }} {{ product.measurement_unit_id.unit_name }}</span>
          </li>
              </ul>
              <p class="text-sm text-gray-700 mt-4">
          <strong>Collection Date:</strong> {{ collectionDate }}
              </p>
            </AlertDialogDescription>
            <AlertDialogFooter class="bg-gray-100 px-6 py-4 flex justify-end space-x-3 rounded-b-lg">
              <AlertDialogCancel class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500">
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
      </form>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <!-- Backdrop -->
        <div class="fixed inset-0 transition-opacity" aria-hidden="true" @click="cancelSelection">
          <div class="absolute inset-0 bg-gray-500 bg-opacity-75"></div>
        </div>

        <!-- Modal Content -->
        <div class="relative bg-white rounded-xl overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full">
          <div class="bg-gray-900 px-6 py-4 text-white">
            <h3 class="text-lg font-bold">Select Forest Products</h3>
            <p class="text-green-100 text-sm">Choose products to harvest</p>
          </div>

          <div class="px-6 py-4 max-h-96 overflow-y-auto">
            <!-- Search Bar -->
            <div class="mb-4">
              <input
                type="text"
                v-model="searchQuery"
                @input="filterProducts"
                placeholder="Search forest products..."
                class="w-full border border-gray-300 rounded-lg py-2 px-4 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <!-- Select All -->
            <div class="mb-4">
              <label class="flex items-center">
                <input
                  type="checkbox"
                  v-model="selectAll"
                  @change="toggleSelectAll"
                  class="h-5 w-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span class="ml-2 text-sm text-gray-700">Select All</span>
              </label>
            </div>

            <!-- Product List -->
            <div class="space-y-2">
              <div
                v-for="product in filteredForestProducts"
                :key="product.id"
                class="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  :id="'product-' + product.id"
                  :value="product"
                  @change="toggleProductSelection(product)"
                  :checked="isProductSelected(product)"
                  class="h-5 w-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <label :for="'product-' + product.id" class="ml-3 flex justify-between items-center w-full cursor-pointer">
                  <span class="text-sm text-gray-700">{{ product.name }}</span>
                  <span class="text-xs text-gray-500">{{ product.measurement_unit_id.unit_name }}</span>
                </label>
                <input
                  v-if="isProductSelected(product)"
                  type="number"
                  v-model="selectedForestProducts.find((p) => p.id === product.id).quantity"
                  min="0.01"
                  step="0.01"
                  class="ml-4 w-20 border border-gray-300 rounded-lg py-1 px-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Qty"
                  @input="updateQuantity(product, $event.target.value)"
                />
              </div>
            </div>
          </div>

          <div class="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
            <button
              type="button"
              @click="cancelSelection"
              class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="confirmSelection"
              class="px-4 py-2 bg-gray-900 border border-transparent rounded-lg text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>