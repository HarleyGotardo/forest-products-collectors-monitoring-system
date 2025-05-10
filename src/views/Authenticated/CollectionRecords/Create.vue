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
const showNotes = ref(true); // Add showNotes state

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
      .is('forest_products.deleted_at', null) // Ensure forest products are not deleted
      .is('locations.deleted_at', null); // Ensure locations are not deleted
      
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
        user_id,
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
      
      // Only consider this request as pending if:
      // 1. It's not recorded AND doesn't have a paid record
      // 2. It's not the current user's own request (when selectedRequest is set)
      if (!hasPaidRecord && (!selectedRequest.value || request.id !== selectedRequest.value)) {
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
      // Skip items where forest_products or locations is null
      if (!item.forest_products || !item.locations) {
        return null;
      }

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
        purchased_quantity: 0,
        quantityError: false
      };
    }).filter(Boolean); // Remove any null items
    
    filteredForestProducts.value = forestProducts.value;
    
  } catch (error) {
    console.error('Error in fetchForestProducts:', error);
    toast.error('Failed to load forest products');
  }
};

const fetchCollectionRequests = async () => {
  const { data, error } = await supabase
    .from('collection_requests')
    .select(`
      id,
      user_id,
      collection_date,
      remarks,
      profiles!collection_requests_remarked_by_fkey(id, first_name, last_name)
    `)
    .eq('is_recorded', false)
    .eq('remarks', 'Approved');

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
      remarks,
      profiles!collection_requests_user_id_fkey(id, first_name, last_name)
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

  // Reset and populate selected products
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
  const invalidProducts = selectedForestProducts.value.filter(product => {
    // If this is from a selected request, allow the exact requested quantity
    if (isRequestSelected.value) {
      const requestItem = requestDetails.value.items.find(item => item.fp_and_location_id === product.id);
      if (requestItem && product.purchased_quantity === requestItem.requested_quantity) {
        return false; // Not invalid if it matches the requested quantity
      }
    }
    
    // Otherwise, validate against adjusted quantity
    return product.purchased_quantity > product.adjustedQuantity || product.purchased_quantity <= 0;
  });
  
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

    return {
      fp_and_location_id: product.id,
      forestProductName: product.forest_product_name,
      locationName: product.location_name,
      purchasedQuantity: product.purchased_quantity,
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
          collection_request_id: selectedRequest.value,
          purpose: finalPurpose,
          is_paid: isPaid,
          approved_by: isPaid ? user.id : null,
          approved_at: isPaid ? new Date().toISOString() : null,
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
            price_per_unit_during_purchase: item.price
          }
        ]);

      if (itemError) {
        console.error('Error creating collection record item:', itemError);
        toast.error('Error creating collection record item - ' + itemError.message);
        return;
      }
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

// Update validateProductQuantity to check against adjusted quantity rather than total quantity
const validateProductQuantity = (product) => {
  const selectedProduct = selectedForestProducts.value.find(p => p.id === product.id);
  if (!selectedProduct) return false;
  
  // Use adjustedQuantity instead of quantity for validation
  if (selectedProduct.purchased_quantity > product.adjustedQuantity) {
    selectedProduct.quantityError = true;
    return false;
  } else if (selectedProduct.purchased_quantity <= 0) {
    selectedProduct.quantityError = true;
    return false;
  } else {
    selectedProduct.quantityError = false;
    return true;
  }
};

// Add computed property to check for validation errors
const hasValidationErrors = computed(() => {
  return selectedForestProducts.value.some(product => 
    product.quantityError || product.purchased_quantity <= 0
  );
});

onMounted(() => {
  fetchCollectors();
  fetchForestProducts();
  fetchCollectionRequests();
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gray-50">
    <div class="relative max-w-lg w-full mt-7">
      <!-- Back Button -->
      <div class="absolute -top-12 left-0">
        <button
          @click="router.back()"
          class="inline-flex items-center px-3 sm:px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          <span class="hidden sm:inline">Back</span>
        </button>
      </div>

      <Card class="w-full shadow-lg">
        <CardHeader class="bg-gray-50 rounded-t-lg">
          <div class="flex items-center space-x-2">
            <img src="@/assets/add.png" alt="Forest Map" class="w-8 h-8 group-hover:scale-110 transition-transform" />
            <CardTitle class="text--800">Forest Product Collection</CardTitle>
          </div>
          <CardDescription class="text-gray-600">Create a new collection record for forest products</CardDescription>
        </CardHeader>
        <CardContent class="p-6">
          <!-- Info Notes -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-4">
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

            <div v-if="showNotes" class="space-y-4">
              <!-- Collection Process Note -->
              <div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <p class="text-sm text-blue-700">
                      <span class="font-medium">Collection Process:</span> When creating a collection record, you must select an approved and unrecorded request. The system will automatically populate the collector and products from the selected request.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Payment Process Note -->
              <div class="bg-emerald-50 border-l-4 border-green-400 p-4 rounded-r-lg">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <p class="text-sm text-green-700">
                      <span class="font-medium">Payment Process:</span> After successfully recording the collection, the Forest Product Collector can proceed to make the payment. Once payment is completed, a forest conservation permit will be generated and can be downloaded for collection.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
              <p v-if="collectionRequests.length === 0" class="text-sm text-orange-400 mt-2">
                You cannot record a forest product collection because a request number is required, and there are no approved and unrecorded collection requests available.
              </p>
              <p v-else="collectionRequests.length === 0" class="text-sm text-emerald-700 mt-2">
                Select a request number to record a forest product collection.
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

            <!-- Submit Button -->
            <button
              type="submit"
              :disabled="!isFormComplete"
              class="w-full bg-emerald-900 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all text-white rounded-lg py-3 font-medium"
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
                    <span v-if="product.hasPendingRequests" class="text-green-600">
                      Adjusted Stock: {{ product.adjustedQuantity }} {{ product.unit_name }}(s)
                    </span>
                    <span v-else class="text-blue-600">
                      Available: {{ product.quantity }} {{ product.unit_name }}(s)
                    </span>
                    <span v-if="product.hasPendingRequests" class="text-amber-600">
                      ({{ product.pendingQuantity }} {{ product.unit_name }}(s) approved for collection)
                    </span>
                  </div>
                </div>
                <div v-if="isProductSelected(product.id)" class="flex flex-col">
                  <div class="flex items-center space-x-2">
                    <label class="text-sm text-gray-600">Quantity:</label>
                      <input
                      type="number"
                      v-model.number="selectedForestProducts.find(p => p.id === product.id).purchased_quantity"
                      min="1"
                      :max="product.adjustedQuantity"
                      placeholder="Qty"
                      @input="validateProductQuantity(product)"
                      @keydown="(e) => ['e', 'E', '-', '+', '.'].includes(e.key) && e.preventDefault()"
                      :class="['w-24 text-center border rounded p-1', 
                        selectedForestProducts.find(p => p.id === product.id).quantityError || 
                        selectedForestProducts.find(p => p.id === product.id).purchased_quantity <= 0 
                          ? 'border-red-500 bg-red-50' 
                          : 'border-gray-300']"
                      />
                  </div>
                  <!-- Warning for zero or invalid quantity -->
                  <div v-if="selectedForestProducts.find(p => p.id === product.id).purchased_quantity <= 0" class="text-red-500 text-xs mt-1 text-right">
                    Please enter a quantity greater than 0.
                  </div>
                  <!-- Inline error message for exceeding max quantity -->
                  <div v-else-if="selectedForestProducts.find(p => p.id === product.id).purchased_quantity > product.adjustedQuantity" class="text-red-500 text-xs mt-1 text-right">
                    Max: {{ product.adjustedQuantity }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-end p-4 border-t">
            <button
              class="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-6 py-2.5 font-medium"
              @click="isModalOpen = false"
              :disabled="hasValidationErrors"
            >
              Done
            </button>
          </div>
        </div>
      </div>

<!-- Receipt Preview Modal -->
<div
  v-if="showReceiptPreview"
  class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-0"
>
  <!-- Backdrop with smooth fade -->
  <div class="absolute inset-0 bg-gray-900 bg-opacity-75 transition-opacity duration-300"></div>
  
  <!-- Modal Container with animation -->
  <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col transform transition-all duration-300 ease-out">
    <!-- Header with improved spacing and typography -->
    <div class="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100">
      <img src="@/assets/records2.png" alt="View Records" class="w-6 h-6 group-hover:scale-110 transition-transform" />
      <h2 class="text-lg sm:text-xl font-semibold text-emerald-800">Confirm Collection Record</h2>
      <button 
        @click="cancelSubmit" 
        class="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors duration-200"
        aria-label="Close modal"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    
    <!-- Modal Content with better spacing -->
    <div class="p-4 sm:p-5 overflow-y-auto flex-1">
      <div class="space-y-4 sm:space-y-5">
        <!-- Collector Information Card -->
        <div class="bg-emerald-50 p-3 sm:p-4 rounded-lg border border-emerald-100">
          <h3 class="font-medium text-emerald-800 mb-2 flex items-center text-sm sm:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Collector Information
          </h3>
          <p class="text-gray-800 font-medium text-sm sm:text-base">
            {{ isRequestSelected 
              ? `${requestDetails?.profiles?.first_name} ${requestDetails?.profiles?.last_name}` 
              : `${collectors.find(c => c.id === selectedCollector)?.first_name} ${collectors.find(c => c.id === selectedCollector)?.last_name}` 
            }}
          </p>
          <p v-if="isRequestSelected" class="text-xs sm:text-sm text-emerald-600 mt-1 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 sm:h-4 sm:w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Request #: {{ selectedRequest }}
          </p>
        </div>
        
        <!-- Receipt Details Section -->
        <div>
          <h3 class="font-medium text-gray-800 mb-2 sm:mb-3 flex items-center text-sm sm:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Invoice Details
          </h3>
          
          <!-- Table with improved styling -->
          <div class="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div class="overflow-x-auto">
              <!-- Desktop Table (hidden on small screens) -->
              <table class="min-w-full divide-y divide-gray-200 hidden sm:table">
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
                  <tr 
                    v-for="item in receiptDetails" 
                    :key="item.fp_and_location_id"
                    class="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td class="px-4 py-3 text-sm text-gray-900">{{ item.forestProductName }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ item.locationName }}</td>
                    <td class="px-4 py-3 text-sm text-gray-900 text-right">
                      {{ item.purchasedQuantity }} {{ item.unitName }}(s)
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-900 text-right">
                      {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.price) }}
                    </td>
                    <td class="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.totalCost) }}
                    </td>
                  </tr>
                  <!-- Total row with distinct styling -->
                  <tr class="bg-emerald-50 font-medium border-t-2 border-emerald-200">
                    <td colspan="4" class="px-4 py-3 text-sm font-bold text-gray-800 text-right">Total Amount</td>
                    <td class="px-4 py-3 text-sm font-bold text-emerald-800 text-right">
                      {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(totalCost) }}
                    </td>
                  </tr>
                </tbody>
              </table>
              
              <!-- Mobile Card View (visible only on small screens) -->
              <div class="sm:hidden">
                <div 
                  v-for="item in receiptDetails" 
                  :key="item.fp_and_location_id"
                  class="border-b border-gray-200 p-3"
                >
                  <div class="font-medium text-gray-900">{{ item.forestProductName }}</div>
                  <div class="text-xs text-gray-600 mb-2">{{ item.locationName }}</div>
                  <div class="grid grid-cols-2 gap-2 text-xs">
                    <div class="text-gray-500">Quantity:</div>
                    <div class="text-right font-medium text-gray-900">{{ item.purchasedQuantity }} {{ item.unitName }}(s)</div>
                    
                    <div class="text-gray-500">Price:</div>
                    <div class="text-right font-medium text-gray-900">
                      {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.price) }}
                    </div>
                    
                    <div class="text-gray-500">Total:</div>
                    <div class="text-right font-medium text-gray-900">
                      {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.totalCost) }}
                    </div>
                  </div>
                </div>
                
                <!-- Mobile Total -->
                <div class="bg-emerald-50 p-3 border-t-2 border-emerald-200">
                  <div class="flex justify-between items-center">
                    <div class="font-bold text-gray-800 text-sm">Total Amount:</div>
                    <div class="font-bold text-emerald-800 text-sm">
                      {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(totalCost) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Footer with improved buttons -->
    <div class="flex flex-col-reverse sm:flex-row sm:justify-end space-y-reverse space-y-3 sm:space-y-0 sm:space-x-4 p-4 sm:p-5 border-t border-gray-100">
      <button
        class="w-full sm:w-auto px-4 sm:px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
        @click="cancelSubmit"
      >
        Cancel
      </button>
      <button
        class="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 sm:px-6 py-2 font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        @click="confirmSubmit"
        :disabled="isSubmitting"
      >
        <span v-if="isSubmitting" class="flex items-center justify-center">
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </span>
        <span v-else>Confirm & Submit</span>
      </button>
    </div>
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