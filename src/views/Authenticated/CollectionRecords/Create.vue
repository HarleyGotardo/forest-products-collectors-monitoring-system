<script setup>
// Create a new collection record for forest products
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { getUser } from '@/router/routeGuard';
import { toast } from 'vue-sonner';
import Input from '@/components/ui/input/Input.vue';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Label from '@/components/ui/label/Label.vue';
const collectionRequests = ref([]);
const selectedRequest = ref(null);
const purpose = ref('');
const customPurpose = ref('');
const collectors = ref([]);
const forestProducts = ref([]);
const filteredForestProducts = ref([]);
const searchQuery = ref('');
const selectedCollector = ref(null);
const selectedForestProducts = ref([]);
const isModalOpen = ref(false);
const router = useRouter();
const receiptDetails = ref([]);
const isSubmitting = ref(false);
const showReceiptPreview = ref(false);
const requestDetails = ref(null); // Added to store the selected request details
const isRequestSelected = computed(() => !!selectedRequest.value);

const fetchCollectors = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('role_id', 2) // Filter profiles with role_id == 2
    .not('approval_flag', 'is', null); // Ensure approval_flag is not null
  if (error) {
    console.error('Error fetching collectors:', error);
    toast.error('Failed to load collectors');
  } else {
    collectors.value = data;
  }
};

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
      purchased_quantity: 0,
    }));
    filteredForestProducts.value = forestProducts.value;
  }
};

const fetchCollectionRequests = async () => {
  const { data, error } = await supabase
    .from('collection_requests')
    .select(`
      id,
      user_id,
      collection_date,
      approved_at,
      profiles!collection_requests_approved_by_fkey(id, first_name, last_name)
    `)
    .eq('is_recorded', false)
    .not('approved_at', 'is', null);

  if (error) {
    console.error('Error fetching collection requests:', error);
    toast.error('Failed to load collection requests');
  } else {
    collectionRequests.value = data;
  }
};

const fetchRequestDetails = async (requestId) => {
  if (!requestId) return;

  // First, get the basic request data
  const { data: requestData, error: requestError } = await supabase
    .from('collection_requests')
    .select(`
      id,
      user_id,
      collection_date,
      approved_at,
      profiles!collection_requests_approved_by_fkey(id, first_name, last_name)
    `)
    .eq('id', requestId)
    .single();

  if (requestError) {
    console.error('Error fetching request details:', requestError);
    toast.error('Failed to load request details');
    return;
  }

  // Set collector based on the request
  selectedCollector.value = requestData.user_id;

  // Fetch the items associated with this request
  const { data: itemsData, error: itemsError } = await supabase
    .from('collection_request_items')
    .select(`
      id,
      fp_and_location_id,
      requested_quantity
    `)
    .eq('collection_request_id', requestId);

  if (itemsError) {
    console.error('Error fetching request items:', itemsError);
    toast.error('Failed to load request items');
    return;
  }

  // Reset and populate selected forest products
  selectedForestProducts.value = [];
  
  // Map the request items to the forest products
  itemsData.forEach(item => {
    const forestProduct = forestProducts.value.find(fp => fp.id === item.fp_and_location_id);
    
    if (forestProduct) {
      // Create a copy of the forest product with the requested quantity
      const productCopy = { ...forestProduct };
      // Use the requested_quantity from the collection_request_items
      productCopy.purchased_quantity = item.requested_quantity;
      
      // Add to selected products
      selectedForestProducts.value.push(productCopy);
    }
  });
  
  requestDetails.value = {
    ...requestData,
    items: itemsData
  };
};

// Watch for changes in the selected request and fetch the details
watch(selectedRequest, (newRequestId) => {
  if (newRequestId) {
    fetchRequestDetails(newRequestId);
  } else {
    // Reset selections if request is cleared
    selectedForestProducts.value = [];
    requestDetails.value = null;
    selectedCollector.value = null;
  }
});

watch(searchQuery, (newQuery) => {
  filteredForestProducts.value = forestProducts.value.filter(product =>
    product.forest_product_name.toLowerCase().includes(newQuery.toLowerCase()) ||
    product.location_name.toLowerCase().includes(newQuery.toLowerCase())
  );
});

// Update forest products in the modal with what's currently selected
const getModalForestProducts = computed(() => {
  return filteredForestProducts.value.map(product => {
    // Check if this product is in the selectedForestProducts array
    const selectedProduct = selectedForestProducts.value.find(p => p.id === product.id);
    if (selectedProduct) {
      // Return a copy with the purchased_quantity from the selected product
      return { ...product, purchased_quantity: selectedProduct.purchased_quantity };
    }
    // Return the original product
    return { ...product };
  });
});

const isFormComplete = computed(() => {
  return selectedCollector.value && 
         purpose.value && 
         (purpose.value !== 'Others' || (purpose.value === 'Others' && customPurpose.value)) &&
         selectedForestProducts.value.length > 0 && 
         selectedForestProducts.value.some(product => product.purchased_quantity > 0);
});

const totalCost = computed(() => {
  return receiptDetails.value.reduce((sum, item) => sum + item.totalCost, 0);
});

const handleSubmit = () => {
  // Validate purchased quantities
  const invalidProducts = selectedForestProducts.value.filter(
    product => product.purchased_quantity > product.quantity || product.purchased_quantity <= 0
  );
  
  if (invalidProducts.length > 0) {
    toast.error('Please enter valid quantities for all selected products');
    return;
  }
  
  // Filter out products with zero quantity
  const validProducts = selectedForestProducts.value.filter(
    product => product.purchased_quantity > 0
  );
  
  if (validProducts.length === 0) {
    toast.error('Please enter quantities for at least one product');
    return;
  }
  
  receiptDetails.value = validProducts.map(product => {
    const totalCost = product.price * product.purchased_quantity;
    const remainingQuantity = product.quantity - product.purchased_quantity;

    return {
      fp_and_location_id: product.id,
      forestProductName: product.forest_product_name,
      locationName: product.location_name,
      currentQuantity: product.quantity,
      purchasedQuantity: product.purchased_quantity,
      remainingQuantity: remainingQuantity,
      price: product.price,
      unitName: product.unit_name,
      totalCost: totalCost,
    };
  });
  
  showReceiptPreview.value = true;
};

// In the confirmSubmit method, remove the quantity deduction logic
const confirmSubmit = async () => {
  if (isSubmitting.value) return;
  isSubmitting.value = true;

  try {
    const user = getUser();

    // Determine the final purpose
    const finalPurpose = purpose.value === 'Others' ? customPurpose.value : purpose.value;

    // Check if total cost is 0
    const isPaid = totalCost.value === 0;

    // Insert into collection_records
    const { data: collectionRecordData, error: collectionRecordError } = await supabase
      .from('collection_records')
      .insert([
        {
          user_id: selectedCollector.value,
          created_by: user.id,
          collection_request_id: selectedRequest.value, // Save the selected request number
          purpose: finalPurpose, // Save the selected or custom purpose
          is_paid: isPaid, // Automatically mark as paid if total cost is 0
          approved_by: isPaid ? user.id : null, // Save the authenticated user as the approver if isPaid
          approved_at: isPaid ? new Date().toISOString() : null, // Save the current timestamp as approved_at if isPaid
        }
      ])
      .select('id');

    if (collectionRecordError) {
      console.error('Error creating collection record:', collectionRecordError);
      toast.error('Error creating collection record - ' + collectionRecordError.message);
      return;
    }

    const collectionRecordId = collectionRecordData[0].id;

    // Insert into collection_record_items
    for (const item of receiptDetails.value) {
      const { error: itemError } = await supabase
        .from('collection_record_items')
        .insert([
          {
            fp_and_location_id: item.fp_and_location_id,
            collection_record_id: collectionRecordId,
            purchased_quantity: item.purchasedQuantity,
            total_cost: item.totalCost,
            deducted_quantity: item.purchasedQuantity,
            quantity_during_purchase: item.currentQuantity,
            price_per_unit_during_purchase: item.price,
            remaining_quantity_during_purchase: item.remainingQuantity,
          }
        ]);

      if (itemError) {
        console.error('Error creating collection record item:', itemError);
        toast.error('Error creating collection record item - ' + itemError.message);
        return;
      }

      // REMOVED: The quantity deduction code that was here
    }

    // Update the collection_requests table to set 'is_recorded' to true
    const { error: updateRequestError } = await supabase
      .from('collection_requests')
      .update({ is_recorded: true })
      .eq('id', selectedRequest.value);

    if (updateRequestError) {
      console.error('Error updating collection request:', updateRequestError);
      toast.error('Error updating collection request - ' + updateRequestError.message);
      return;
    }

    router.push(`/authenticated/collection-records/${collectionRecordId}`);
    toast.success('Collection record created successfully');
  } catch (error) {
    console.error('Unexpected error during submission:', error);
    toast.error('An unexpected error occurred');
  } finally {
    isSubmitting.value = false;
  }
};

const cancelSubmit = () => {
  showReceiptPreview.value = false;
};

// Function to toggle product selection in the modal
const toggleProductSelection = (product) => {
  const index = selectedForestProducts.value.findIndex(p => p.id === product.id);
  
  if (index === -1) {
    // Add to selected products
    selectedForestProducts.value.push({ ...product, purchased_quantity: 0 });
  } else {
    // Remove from selected products
    selectedForestProducts.value.splice(index, 1);
  }
};

// Function to check if a product is selected
const isProductSelected = (productId) => {
  return selectedForestProducts.value.some(p => p.id === productId);
};

// Function to update the purchased quantity
const updatePurchasedQuantity = (productId, quantity) => {
  const product = selectedForestProducts.value.find(p => p.id === productId);
  if (product) {
    product.purchased_quantity = quantity;
  }
};

onMounted(() => {
  fetchCollectors();
  fetchForestProducts();
  fetchCollectionRequests();
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gray-50">
    <Card class="max-w-lg w-full shadow-lg">
      <CardHeader class="bg-gray-50 rounded-t-lg">
        <div class="flex items-center space-x-2">
          <img src="@/assets/add.png" alt="Forest Map" class="w-8 h-8 group-hover:scale-110 transition-transform" />
          <CardTitle class="text--800">Forest Product Collection</CardTitle>
        </div>
        <CardDescription class="text-gray-600">Create a new collection record for forest products</CardDescription>
      </CardHeader>
      <CardContent class="p-6">
        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Request Number Selection -->
            <div class="space-y-2">
            <Label for="requestNumber" class="text-sm font-medium text-gray-700">Request Number</Label>
            <select
              id="requestNumber"
              v-model="selectedRequest"
              class="form-select w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              :disabled="collectionRequests.length === 0"
            >
              <option value="" disabled>Select a request number</option>
              <option v-for="request in collectionRequests" :key="request.id" :value="request.id">
              {{ request.id }}
              </option>
            </select>
            <p v-if="collectionRequests.length === 0" class="text-sm text-gray-500 mt-2">
              You cannot record a forest product collection because a request number is required, and there are no approved and unrecorded collection requests available.
            </p>
            </div>

            <!-- Collector Selection -->
            <div class="space-y-2">
            <Label for="collector" class="text-sm font-medium text-gray-700">Forest Product Collector</Label>
            <div v-if="isRequestSelected" class="p-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-700">
              {{ requestDetails?.profiles?.first_name }} {{ requestDetails?.profiles?.last_name }}
            </div>
            <select
              v-else
              id="collector"
              v-model="selectedCollector"
              class="form-select w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              :disabled="!selectedRequest"
            >
              <option value="" disabled>Select a collector</option>
              <option v-for="collector in collectors" :key="collector.id" :value="collector.id">
              {{ collector.first_name }} {{ collector.last_name }}
              </option>
            </select>
            </div>
              <!-- Purpose Selection -->
              <div class="space-y-2">
              <Label for="purpose" class="text-sm font-medium text-gray-700">Purpose</Label>
              <div class="space-y-2">
                <div>
                <input
                  type="radio"
                  id="official"
                  value="Official"
                  v-model="purpose"
                  class="form-radio"
                  :disabled="!selectedRequest"
                />
                <label for="official" class="ml-2 text-sm" :class="{ 'text-gray-400': !selectedRequest }">Official</label>
                </div>
                <div>
                <input
                  type="radio"
                  id="personal"
                  value="Personal"
                  v-model="purpose"
                  class="form-radio"
                  :disabled="!selectedRequest"
                />
                <label for="personal" class="ml-2 text-sm" :class="{ 'text-gray-400': !selectedRequest }">Personal</label>
                </div>
                <div>
                <input
                  type="radio"
                  id="others"
                  value="Others"
                  v-model="purpose"
                  class="form-radio"
                  :disabled="!selectedRequest"
                />
                <label for="others" class="ml-2 text-sm" :class="{ 'text-gray-400': !selectedRequest }">Others, specify:</label>
                <input
                  v-if="purpose === 'Others'"
                  type="text"
                  v-model="customPurpose"
                  placeholder="Specify purpose"
                  class="form-input mt-2 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  :disabled="!selectedRequest"
                />
                </div>
              </div>
              </div>

          <!-- Selected Products Summary -->
          <div v-if="selectedForestProducts.length > 0" class="space-y-2">
            <Label class="text-sm font-medium text-gray-700">Selected Products ({{ selectedForestProducts.length }})</Label>
            <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div v-for="product in selectedForestProducts" :key="product.id" class="text-sm">
                {{ product.forest_product_name }} - {{ product.purchased_quantity > 0 ? product.purchased_quantity : 'No' }} {{ product.unit_name }}(s)
              </div>
            </div>
            <p v-if="isRequestSelected" class="text-xs text-gray-500 mt-1">
              Products were populated from the selected request
            </p>
          </div>

            <!-- Forest Product Modal Trigger -->
            <div>
            <button
              type="button"
              class="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg py-2.5 font-medium transition-colors flex items-center justify-center space-x-2"
              @click="isModalOpen = true"
              :disabled="!selectedRequest"
              :class="{ 'opacity-50 cursor-not-allowed': !selectedRequest }"
            >
              <span class="text-lg">+</span>
              <span>{{ isRequestSelected ? 'Edit Selected Products' : 'Select Forest Products' }}</span>
            </button>
            </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="!isFormComplete"
            class="w-full bg-gray-800 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all text-white rounded-lg py-3 font-medium"
          >
            Create Collection Record
          </button>
        </form>
      </CardContent>
      <CardFooter class="bg-gray-50 px-6 py-4 rounded-b-lg">
        <p class="text-xs text-gray-500 text-center">
          Select a request to automatically populate products from that request
        </p>
      </CardFooter>
    </Card>

    <!-- Forest Product Modal -->
    <div
      v-if="isModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div class="bg-white rounded-lg shadow-xl w-11/12 max-w-2xl max-h-[80vh] flex flex-col">
        <div class="flex justify-between items-center p-4 border-b">
          <h2 class="text-lg font-semibold text-green-800">{{ isRequestSelected ? 'Edit Selected Products' : 'Select Forest Products' }}</h2>
          <button @click="isModalOpen = false" class="text-gray-500 hover:text-gray-700 p-1">
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
            <div v-for="product in filteredForestProducts" :key="product.id" 
                 class="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg border border-gray-100">
              <input
                type="checkbox"
                :checked="isProductSelected(product.id)"
                @change="toggleProductSelection(product)"
                class="form-checkbox h-5 w-5 text-green-600 rounded"
              />
              <div class="flex-1">
                <div class="font-medium">{{ product.forest_product_name }}</div>
                <div class="text-sm text-gray-500">
                  Location: {{ product.location_name }} | 
                  Price: ₱{{ product.price }} per {{ product.unit_name }} | 
                  Available: {{ product.quantity }} {{ product.unit_name }}(s)
                </div>
              </div>
              <div v-if="isProductSelected(product.id)" class="flex items-center space-x-2">
                <label class="text-sm text-gray-600">Quantity:</label>
                <!-- Fixed: Using v-model instead of :value and @input -->
                <input
                  type="number"
                  v-model.number="selectedForestProducts.find(p => p.id === product.id).purchased_quantity"
                  min="0"
                  :max="product.quantity"
                  placeholder="Qty"
                  class="w-24 text-center p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="flex justify-end p-4 border-t">
          <button
            class="bg-green-600 hover:bg-green-700 text-white rounded-lg px-6 py-2.5 font-medium"
            @click="isModalOpen = false"
          >
            Done
          </button>
        </div>
      </div>
    </div>

    <!-- Receipt Preview Modal -->
    <div
      v-if="showReceiptPreview"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div class="bg-white rounded-lg shadow-xl w-11/12 max-w-2xl max-h-[80vh] flex flex-col">
        <div class="flex justify-between items-center p-4 border-b">
          <h2 class="text-lg font-semibold text-gray-900">Confirm Collection Record</h2>
          <button @click="cancelSubmit" class="text-gray-500 hover:text-gray-700 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="p-4 overflow-y-auto flex-1">
          <div class="space-y-4">
            <div class="bg-gray-50 p-4 rounded-lg">
              <h3 class="font-medium text-gray-700 mb-2">Collector Information</h3>
              <p>
                {{ isRequestSelected 
                  ? `${requestDetails?.profiles?.first_name} ${requestDetails?.profiles?.last_name}` 
                  : `${collectors.find(c => c.id === selectedCollector)?.first_name} ${collectors.find(c => c.id === selectedCollector)?.last_name}` 
                }}
              </p>
              <p v-if="isRequestSelected" class="text-sm text-gray-600 mt-1">
                Request #: {{ selectedRequest }}
              </p>
            </div>
            
            <h3 class="font-medium text-gray-700">Receipt Details</h3>
            <div class="border rounded-lg overflow-hidden">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="item in receiptDetails" :key="item.fp_and_location_id">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{{ item.forestProductName }}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ item.locationName }}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                      {{ item.purchasedQuantity }} {{ item.unitName }}(s)
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                      ₱{{ item.price }}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      ₱{{ item.totalCost.toFixed(2) }}
                    </td>
                  </tr>
                  <tr class="bg-gray-50">
                    <td colspan="4" class="px-4 py-3 text-sm font-medium text-gray-900 text-right">Total</td>
                    <td class="px-4 py-3 text-sm font-bold text-gray-900 text-right">₱{{ totalCost.toFixed(2) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="flex justify-end space-x-3 p-4 border-t">
          <button
            class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            @click="cancelSubmit"
          >
            Cancel
          </button>
          <button
            class="bg-gray-900 hover:bg-gray-700 text-white rounded-lg px-6 py-2 font-medium"
            @click="confirmSubmit"
            :disabled="isSubmitting"
          >
            <span v-if="isSubmitting">Processing...</span>
            <span v-else>Confirm & Submit</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-select {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: 2.5rem;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

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
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
}

.form-checkbox:checked {
  background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
  border-color: transparent;
  background-color: currentColor;
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
}

.form-checkbox:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
  border-color: #2563eb;
}

.form-radio {
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
  border: 1px solid #d1d5db;
  border-radius: 50%;
}

.form-radio:checked {
  background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='8' cy='8' r='3'/%3e%3c/svg%3e");
  border-color: transparent;
  background-color: currentColor;
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
}

.form-radio:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
  border-color: #2563eb;
}

.form-input {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-color: #fff;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  width: 100%;
}

.form-input:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
  border-color: #2563eb;
}
</style>