<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
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

const route = useRoute();
const router = useRouter();
const recordId = route.params.id;
const showNotes = ref(true);

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
const initialSelectedForestProducts = ref([]); // Store initial selected products
const isSubmitting = ref(false);
const isModalOpen = ref(false);

// Add initial variables to track the original purpose values
const initialPurpose = ref('');
const initialCustomPurpose = ref('');

// Add these functions for product selection
const isProductSelected = (productId) => {
  return selectedForestProducts.value.some(p => p.id === productId);
};

const toggleProductSelection = (product) => {
  const index = selectedForestProducts.value.findIndex(p => p.id === product.id);
  if (index === -1) {
    // Add to selected products with purchased_quantity = 1 as default
    selectedForestProducts.value.push({
      ...product,
      purchased_quantity: 1
    });
  } else {
    // Remove from selected products
    selectedForestProducts.value.splice(index, 1);
  }
};

const validateProductQuantity = (product) => {
  const selectedProduct = selectedForestProducts.value.find(p => p.id === product.id);
  if (!selectedProduct) return;

  // Get the maximum allowed quantity (use quantity as default if adjustedQuantity is not defined)
  const maxQuantity = product.adjustedQuantity || product.quantity;
  
  // Validate the quantity
  if (selectedProduct.purchased_quantity > maxQuantity) {
    selectedProduct.purchased_quantity = maxQuantity;
    product.quantityError = true;
  } else {
    product.quantityError = false;
  }

  // Ensure the quantity is at least 1
  if (selectedProduct.purchased_quantity < 1) {
    selectedProduct.purchased_quantity = 0;
  }
};

const fetchCollectors = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('role_id', 2)
    .not('approval_flag', 'is', null); // Fetch only profiles where role is 2 and approval_flag is not null
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
      .is('forest_products.deleted_at', null)  // Only get non-deleted forest products
      .is('locations.deleted_at', null);       // Only get non-deleted locations
      
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
      .eq('is_recorded', false);
      
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
      if (!request.is_recorded && !hasPaidRecord) {
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
        purchased_quantity: 0,
        quantityError: false
      };
    });
    
    filteredForestProducts.value = forestProducts.value;
    
  } catch (error) {
    console.error('Error in fetchForestProducts:', error);
    toast.error('Failed to load forest products');
  }
};

const fetchCollectionRequests = async () => {
  const { data, error } = await supabase
    .from('collection_requests')
    .select('id')
    .is('deleted_at', null)
    .eq('remarks', 'Approved')
    .eq('is_recorded', false);

  if (error) {
    console.error('Error fetching collection requests:', error);
    toast.error('Failed to load collection requests');
  } else {
    collectionRequests.value = data;
  }
};

const fetchCollectionRecord = async () => {
  // First, get the collection record details
  const { data, error } = await supabase
    .from('collection_records')
    .select(`
      id,
      user_id,
      collection_request_id,
      purpose,
      collection_record_items (
        id,
        fp_and_location_id,
        purchased_quantity,
        deducted_quantity,
        total_cost,
        quantity_during_purchase,
        price_per_unit_during_purchase
      )
    `)
    .eq('id', recordId)
    .single();

  if (error) {
    console.error('Error fetching collection record:', error);
    toast.error('Failed to load collection record');
    return;
  }

  // Set basic record details
  selectedCollector.value = data.user_id;
  selectedRequest.value = data.collection_request_id;
  purpose.value = data.purpose === 'Official' || data.purpose === 'Personal' ? data.purpose : 'Others';
  customPurpose.value = purpose.value === 'Others' ? data.purpose : '';
  
  // Store initial purpose values for change detection
  initialPurpose.value = purpose.value;
  initialCustomPurpose.value = customPurpose.value;

  // Create a map of existing forest products for easy lookup
  const existingProductsMap = {};
  data.collection_record_items.forEach(item => {
    existingProductsMap[item.fp_and_location_id] = item;
  });

  // Pre-fill selected forest products with their quantities
  selectedForestProducts.value = data.collection_record_items.map(item => {
    const product = forestProducts.value.find(fp => fp.id === item.fp_and_location_id);
    
    if (product) {
      // Use the existing product data but update the purchased quantity
      return {
        ...product,
        purchased_quantity: item.purchased_quantity,
        original_record_item_id: item.id, // Store the original record item ID for reference
        // Also store other important values from the item
        deducted_quantity: item.deducted_quantity,
        total_cost: item.total_cost,
        quantity_during_purchase: item.quantity_during_purchase,
        price_per_unit_during_purchase: item.price_per_unit_during_purchase
      };
    }
    return null;
  }).filter(Boolean);

  // Store a deep copy of the initial selection for comparison
  initialSelectedForestProducts.value = JSON.parse(JSON.stringify(selectedForestProducts.value));

  // Update filteredForestProducts to reflect current selection status
  filteredForestProducts.value = forestProducts.value.map(fp => {
    const existingItem = existingProductsMap[fp.id];
    
    if (existingItem) {
      // This is a selected product
      return {
        ...fp,
        purchased_quantity: existingItem.purchased_quantity,
      };
    }
    return fp;
  });

  console.log('Initial selected forest products:', initialSelectedForestProducts.value);
  console.log('Current selected forest products:', selectedForestProducts.value);
};

watch(searchQuery, (newQuery) => {
  filteredForestProducts.value = forestProducts.value.filter(product =>
    product.forest_product_name.toLowerCase().includes(newQuery.toLowerCase()) ||
    product.location_name.toLowerCase().includes(newQuery.toLowerCase())
  );

  // Maintain selected quantities during search
  filteredForestProducts.value = filteredForestProducts.value.map(fp => {
    const selectedItem = selectedForestProducts.value.find(selected => selected.id === fp.id);
    if (selectedItem) {
      return {
        ...fp,
        purchased_quantity: selectedItem.purchased_quantity,
      };
    }
    return fp;
  });
});

const isFormComplete = computed(() => {
  // Basic requirements: must have a collector and at least one product with quantity > 0
  const hasValidSelection = selectedCollector.value &&
    selectedForestProducts.value.length > 0 &&
    selectedForestProducts.value.some(product => product.purchased_quantity > 0);
  
  // Don't disable the button if there are valid changes
  return hasValidSelection && !hasValidationErrors.value;
});

// Add computed property to check for validation errors
const hasValidationErrors = computed(() => {
  return selectedForestProducts.value.some(product => 
    product.quantityError || product.purchased_quantity <= 0
  );
});

const havePurposeChanged = computed(() => {
  // Get the initial purpose from the database record
  // Since we don't know the initial value directly, we need to infer it
  // when the component loads
  if (!initialPurpose.value) return false;
  
  // Check if purpose type changed
  if (purpose.value !== initialPurpose.value) return true;
  
  // If purpose is "Others", also check if the custom purpose changed
  if (purpose.value === 'Others' && customPurpose.value !== initialCustomPurpose.value) {
    return true;
  }
  
  return false;
});

// Add a function to check if there are changes in the selected products
const haveProductsChanged = computed(() => {
  // Different number of products indicates a change
  if (selectedForestProducts.value.length !== initialSelectedForestProducts.value.length) {
    return true;
  }
  
  // Check each selected product for quantity changes
  for (const current of selectedForestProducts.value) {
    const original = initialSelectedForestProducts.value.find(p => p.id === current.id);
    // If this product wasn't in the original selection, or its quantity changed
    if (!original || original.purchased_quantity !== current.purchased_quantity) {
      return true;
    }
  }
  
  // Check if any originally selected products were removed
  for (const original of initialSelectedForestProducts.value) {
    const current = selectedForestProducts.value.find(p => p.id === original.id);
    if (!current) {
      return true;
    }
  }
  
  // No changes detected
  return false;
});

const handleSubmit = async () => {
  if (isSubmitting.value) return;
  isSubmitting.value = true;

  try {
    // Determine the final purpose
    const finalPurpose = purpose.value === 'Others' ? customPurpose.value : purpose.value;

    // Update collection record
    const { error: updateError } = await supabase
      .from('collection_records')
      .update({
        user_id: selectedCollector.value,
        collection_request_id: selectedRequest.value,
        purpose: finalPurpose,
      })
      .eq('id', recordId);

    if (updateError) {
      console.error('Error updating collection record:', updateError);
      toast.error('Error updating collection record - ' + updateError.message);
      return;
    }

    // Handle removed products
    const existingProductIds = initialSelectedForestProducts.value.map(product => product.id);
    const selectedProductIds = selectedForestProducts.value.map(product => product.id);

    const removedProductIds = existingProductIds.filter(id => !selectedProductIds.includes(id));

    for (const removedId of removedProductIds) {
      const { error: deleteError } = await supabase
        .from('collection_record_items')
        .delete()
        .eq('collection_record_id', recordId)
        .eq('fp_and_location_id', removedId);

      if (deleteError) {
        console.error('Error deleting collection record item:', deleteError);
        toast.error('Error deleting collection record item - ' + deleteError.message);
        return;
      }
    }

    // Update or insert collection record items
    for (const product of selectedForestProducts.value) {
      const initialProduct = initialSelectedForestProducts.value.find(initial => initial.id === product.id);
      
      // If the product hasn't changed, skip it
      if (initialProduct && initialProduct.purchased_quantity === product.purchased_quantity) {
        continue;
      }
      
      // Get current quantity from fp_and_locations
      const { data: fpLocationData, error: fpLocationError } = await supabase
        .from('fp_and_locations')
        .select('quantity')
        .eq('id', product.id)
        .single();
        
      if (fpLocationError) {
        console.error('Error fetching fp_and_location:', fpLocationError);
        toast.error('Error fetching product quantity - ' + fpLocationError.message);
        continue;
      }
      
      const totalCost = product.purchased_quantity * product.price;
      
      // Create record item values - different for new vs existing items
      const recordItemValues = {
        collection_record_id: recordId,
        fp_and_location_id: product.id,
        purchased_quantity: product.purchased_quantity,
        deducted_quantity: product.purchased_quantity, // Set both the same for consistency
        total_cost: totalCost,
        quantity_during_purchase: fpLocationData.quantity,
        price_per_unit_during_purchase: product.price,
        remaining_quantity_during_purchase: fpLocationData.quantity // This will be updated when paid
      };

      // If this is a new product (not in initialSelectedForestProducts)
      if (!initialProduct) {
        const { error: insertError } = await supabase
          .from('collection_record_items')
          .insert([recordItemValues]);

        if (insertError) {
          console.error('Error inserting collection record item:', insertError);
          toast.error('Error adding new forest product - ' + insertError.message);
          return;
        }
      } else {
        // This is an update to an existing product
        const { error: updateItemError } = await supabase
          .from('collection_record_items')
          .update(recordItemValues)
          .eq('collection_record_id', recordId)
          .eq('fp_and_location_id', product.id);

        if (updateItemError) {
          console.error('Error updating collection record item:', updateItemError);
          toast.error('Error updating forest product - ' + updateItemError.message);
          return;
        }
      }
    }

    toast.success('Collection record updated successfully');
    router.push(`/authenticated/collection-records/${recordId}`);
  } catch (error) {
    console.error('Unexpected error during submission:', error);
    toast.error('An unexpected error occurred');
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(async () => {
  try {
    await fetchForestProducts(); // Load forest products first
    await fetchCollectionRecord(); // Then fetch the collection record
    fetchCollectors(); // Fetch collectors
    fetchCollectionRequests(); // Fetch collection requests
  } catch (error) {
    console.error('Error during initialization:', error);
    toast.error('Failed to load data for editing the collection record.');
  }
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gray-50">
    <Card class="max-w-lg w-full shadow-lg">
      <CardHeader class="bg-gray-50 rounded-t-lg">
        <div class="flex items-center space-x-2">
          <img src="@/assets/edit.png" alt="Edit Icon" class="w-8 h-8 group-hover:scale-110 transition-transform" />
          <CardTitle class="text--800">Edit Collection Record</CardTitle>
        </div>
        <CardDescription class="text-gray-600">Edit the details of the collection record</CardDescription>
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
            <!-- Edit Restrictions Note -->
            <div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-blue-700">
                    <span class="font-medium">Edit Restrictions:</span> The request number and Forest Product Collector cannot be changed. You can only modify the forest products and their quantities.
                  </p>
                </div>
              </div>
            </div>

            <!-- Payment Process Note -->
            <div class="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
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

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Request Number (Read-only) -->
          <div class="space-y-2">
            <Label for="requestNumber" class="text-sm font-medium text-gray-700">Request Number</Label>
            <div class="p-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-700">
              {{ selectedRequest }}
            </div>
          </div>

          <!-- Collector (Read-only) -->
          <div class="space-y-2">
            <Label for="collector" class="text-sm font-medium text-gray-700">Forest Product Collector</Label>
            <div class="p-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-700">
              {{ collectors.find(c => c.id === selectedCollector)?.first_name }} {{ collectors.find(c => c.id === selectedCollector)?.last_name }}
            </div>
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
                />
                <label for="official" class="ml-2 text-sm">Official</label>
              </div>
              <div>
                <input
                  type="radio"
                  id="personal"
                  value="Personal"
                  v-model="purpose"
                  class="form-radio"
                />
                <label for="personal" class="ml-2 text-sm">Personal</label>
              </div>
              <div>
                <input
                  type="radio"
                  id="others"
                  value="Others"
                  v-model="purpose"
                  class="form-radio"
                />
                <label for="others" class="ml-2 text-sm">Others, specify:</label>
                <input
                  v-if="purpose === 'Others'"
                  type="text"
                  v-model="customPurpose"
                  placeholder="Specify purpose"
                  class="form-input mt-2 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
          </div>

          <!-- Forest Product Modal Trigger
          <div>
            <button
              type="button"
              class="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg py-2.5 font-medium transition-colors flex items-center justify-center space-x-2"
              @click="isModalOpen = true"
            >
              <span class="text-lg">+</span>
              <span>Edit Forest Products</span>
            </button>
          </div> -->

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="!isFormComplete || (!haveProductsChanged && !havePurposeChanged)"
            class="w-full bg-gray-800 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all text-white rounded-lg py-3 font-medium"
          >
            Update Collection Record
          </button>
        </form>
      </CardContent>
      <CardFooter class="bg-gray-50 px-6 py-4 rounded-b-lg">
        <p class="text-xs text-gray-500 text-center">
          You can only modify the forest products and their quantities
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
          <h2 class="text-lg font-semibold text-green-800">Edit Forest Products</h2>
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
                  Price: ₱{{ product.price }} per {{ product.unit_name }}
                </div>
                <div class="text-sm mt-1">
                  <span class="text-blue-600 font-medium">
                    Available: {{ product.quantity }} {{ product.unit_name }}(s)
                  </span>
                  <span v-if="product.hasPendingRequests" class="ml-2 text-amber-600">
                    • <span class="font-medium">{{ product.adjustedQuantity }}</span> {{ product.unit_name }}(s) after pending requests
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
                    :max="product.adjustedQuantity || product.quantity"
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
                <div v-else-if="selectedForestProducts.find(p => p.id === product.id).quantityError" class="text-red-500 text-xs mt-1 text-right">
                  Max: {{ product.adjustedQuantity || product.quantity }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex justify-end p-4 border-t">
          <button
            class="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-6 py-2.5 font-medium"
            @click="isModalOpen = false"
            :disabled="hasValidationErrors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </div>
</template>