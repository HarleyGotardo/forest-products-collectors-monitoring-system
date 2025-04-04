<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'vue-sonner';

const route = useRoute();
const router = useRouter();
const requestId = route.params.id;
const forestProducts = ref([]);
const selectedForestProducts = ref([]);
const initialSelectedForestProducts = ref([]);
const collectionDate = ref('');
const initialCollectionDate = ref('');
const showModal = ref(false);
const error = ref(null);

const fetchForestProducts = async () => {
  const { data, error } = await supabase
    .from('forest_products')
    .select('id, name, measurement_unit_id (unit_name)');
  if (error) {
    console.error('Error fetching forest products:', error);
  } else {
    forestProducts.value = data;
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

    collectionDate.value = requestData.collection_date;
    initialCollectionDate.value = requestData.collection_date;

    const { data: itemsData, error: itemsError } = await supabase
      .from('collection_request_items')
      .select('*, forest_product_id (id, name, measurement_unit_id (unit_name))')
      .eq('collection_request_id', requestId);

    if (itemsError) {
      throw itemsError;
    }

    selectedForestProducts.value = itemsData.map(item => ({
      id: item.forest_product_id.id,
      name: item.forest_product_id.name,
      measurement_unit_id: item.forest_product_id.measurement_unit_id,
      quantity: item.requested_quantity,
    }));

    initialSelectedForestProducts.value = JSON.parse(JSON.stringify(selectedForestProducts.value));
  } catch (err) {
    error.value = err.message;
  }
};

const isFormComplete = computed(() => {
  return selectedForestProducts.value.length > 0 && 
         collectionDate.value && 
         selectedForestProducts.value.every(p => p.quantity && parseFloat(p.quantity) > 0);
});

const hasChanges = computed(() => {
  return JSON.stringify(selectedForestProducts.value) !== JSON.stringify(initialSelectedForestProducts.value) ||
         collectionDate.value !== initialCollectionDate.value;
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

  const collectionRequest = {
    collection_date: collectionDate.value,
  };

  const collectionRequestItems = selectedForestProducts.value.map(product => ({
    forest_product_id: product.id,
    requested_quantity: product.quantity,
  }));

  updateRequest(collectionRequest, collectionRequestItems);
};

const updateRequest = async (collectionRequest, collectionRequestItems) => {
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
      collectionRequestItems.map(item => ({
        ...item,
        collection_request_id: requestId,
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

const toggleProductSelection = (product) => {
  const index = selectedForestProducts.value.findIndex(p => p.id === product.id);
  if (index === -1) {
    selectedForestProducts.value.push({ 
      id: product.id, 
      name: product.name, 
      measurement_unit_id: product.measurement_unit_id, 
      quantity: '1' 
    });
  } else {
    selectedForestProducts.value.splice(index, 1);
  }
};

const isProductSelected = (productId) => {
  return selectedForestProducts.value.some(p => p.id === productId);
};

const increaseQuantity = (product) => {
  product.quantity = (parseFloat(product.quantity) || 0) + 1;
};

const decreaseQuantity = (product) => {
  if (product.quantity > 1) {
    product.quantity = parseFloat(product.quantity) - 1;
  }
};

onMounted(() => {
  fetchForestProducts();
  fetchRequestDetails();
});
</script>
<template>
    <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div class="max-w-lg w-full bg-white rounded-xl shadow-lg overflow-hidden">
        <!-- Header -->
        <div class="bg-gray-900 px-6 py-5 text-white">
          <h2 class="text-2xl font-bold">Edit Forest Product Collection Request</h2>
          <p class="text-green-100 mt-1">Update your request to harvest forest products</p>
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
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
            
            <!-- Selected Products with Quantities -->
            <div v-if="selectedForestProducts.length" class="mt-4 space-y-3">
              <div v-for="product in selectedForestProducts" :key="product.id" class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div class="flex justify-between items-center mb-2">
                  <span class="font-medium text-gray-800">{{ product.name }}</span>
                  <span class="text-xs text-gray-500">{{ product.measurement_unit_id.unit_name }}</span>
                </div>
                <div class="flex items-center">
                  <button 
                    type="button" 
                    @click="decreaseQuantity(product)" 
                    class="bg-gray-200 hover:bg-gray-300 rounded-l-lg p-2 focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                    </svg>
                  </button>
                  <input
                    type="number"
                    v-model="product.quantity"
                    :id="'quantity-' + product.id"
                    min="0.01"
                    step="0.01"
                    class="block w-full border-y border-gray-300 py-2 px-3 text-center focus:outline-none focus:ring-green-500 focus:border-green-500"
                    placeholder="0"
                  />
                  <button 
                    type="button" 
                    @click="increaseQuantity(product)" 
                    class="bg-gray-200 hover:bg-gray-300 rounded-r-lg p-2 focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
  
          <!-- Default Collection Date Info -->
          <div>
            <p class="text-sm text-gray-500">Collection Date:</p>
            <p class="text-gray-900">{{ new Date(collectionDate).toLocaleDateString() }}</p>
          </div>
  
          <!-- Collection Date Input -->
          <div>
            <label for="collectionDate" class="block text-sm font-medium text-gray-700 mb-2">Collection Date</label>
            <div class="relative">
              <input
                type="date"
                v-model="collectionDate"
                id="collectionDate"
                class="block w-full border border-gray-300 rounded-lg py-3 px-4 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
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
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            Update Collection Request
          </button>
        </form>
      </div>
  
      <!-- Modal -->
      <div v-if="showModal" class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex items-center justify-center min-h-screen px-4">
          <!-- Backdrop -->
          <div class="fixed inset-0 transition-opacity" aria-hidden="true" @click="showModal = false">
            <div class="absolute inset-0 bg-gray-500 bg-opacity-75"></div>
          </div>
          
          <!-- Modal Content -->
          <div class="relative bg-white rounded-xl overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full">
            <div class="bg-gray-900 px-6 py-4 text-white">
              <h3 class="text-lg font-bold">Select Forest Products</h3>
              <p class="text-green-100 text-sm">Choose products to harvest</p>
            </div>
            
            <div class="px-6 py-4 max-h-96 overflow-y-auto">
  <div class="space-y-2">
    <div v-for="product in forestProducts" :key="product.id" class="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
      <input
        type="checkbox"
        :id="'product-' + product.id"
        :checked="isProductSelected(product.id)"
        @change="toggleProductSelection(product)"
        class="h-5 w-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
      />
      <label :for="'product-' + product.id" class="ml-3 flex justify-between items-center w-full cursor-pointer">
        <span class="text-sm text-gray-700">{{ product.name }}</span>
        <span class="text-xs text-gray-500">{{ product.measurement_unit_id.unit_name }}</span>
      </label>
    </div>
  </div>
</div>
            
            <div class="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <button 
                type="button" 
                @click="showModal = false" 
                class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Cancel
              </button>
              <button 
                type="button" 
                @click="showModal = false" 
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