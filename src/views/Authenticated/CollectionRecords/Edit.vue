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
      purchased_quantity: 0, // Initialize purchased_quantity
    }));
    filteredForestProducts.value = forestProducts.value;
  }
};

const fetchCollectionRequests = async () => {
  const { data, error } = await supabase
    .from('collection_requests')
    .select('id')
    .not('approved_at', 'is', null)
    .eq('is_recorded', false); // Include only requests where is_recorded is false

  if (error) {
    console.error('Error fetching collection requests:', error);
    toast.error('Failed to load collection requests');
  } else {
    collectionRequests.value = data;
  }
};

const fetchCollectionRecord = async () => {
  const { data, error } = await supabase
    .from('collection_records')
    .select(`
        id,
        user_id,
        collection_request_id,
        purpose,
        collection_record_items (
          fp_and_location_id,
          purchased_quantity
        )
      `)
    .eq('id', recordId)
    .single();

  if (error) {
    console.error('Error fetching collection record:', error);
    toast.error('Failed to load collection record');
    return;
  }

  selectedCollector.value = data.user_id;
  selectedRequest.value = data.collection_request_id;
  purpose.value = data.purpose === 'Official' || data.purpose === 'Personal' ? data.purpose : 'Others';
  customPurpose.value = purpose.value === 'Others' ? data.purpose : '';

  // Pre-fill selected forest products and their quantities
  selectedForestProducts.value = data.collection_record_items.map(item => {
    const product = forestProducts.value.find(fp => fp.id === item.fp_and_location_id);
    if (product) {
      return {
        ...product,
        purchased_quantity: item.purchased_quantity,
      };
    }
    return null;
  }).filter(Boolean);

  initialSelectedForestProducts.value = JSON.parse(JSON.stringify(selectedForestProducts.value));

  // Update filteredForestProducts to pre-select items and their quantity.
  filteredForestProducts.value = forestProducts.value.map(fp => {
    const selectedItem = selectedForestProducts.value.find(selected => selected.id === fp.id);
    if (selectedItem) {
      return {
        ...fp,
        purchased_quantity: selectedItem.purchased_quantity,
      };
    }
    return fp;
  });
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
  return selectedCollector.value &&
    selectedForestProducts.value.length > 0 &&
    selectedForestProducts.value.some(product => product.purchased_quantity > 0);
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
      if (initialProduct && initialProduct.purchased_quantity === product.purchased_quantity) {
        continue; // Skip if no changes
      }

      const { error: itemError } = await supabase
        .from('collection_record_items')
        .upsert({
          collection_record_id: recordId,
          fp_and_location_id: product.id,
          purchased_quantity: product.purchased_quantity,
          total_cost: product.purchased_quantity * product.price,
        });

      if (itemError) {
        console.error('Error updating collection record item:', itemError);
        toast.error('Error updating collection record item - ' + itemError.message);
        return;
      }
    }

    toast.success('Collection record updated successfully');
    router.push(`/authenticated/collection-records`);
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
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <div class="space-y-2">
            <Label for="collector" class="text-sm font-medium text-gray-700">Forest Product Collector</Label>
            <select
              v-model="selectedCollector"
              class="form-select w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="" disabled>Select a collector</option>
              <option v-for="collector in collectors" :key="collector.id" :value="collector.id">
                {{ collector.first_name }} {{ collector.last_name }}
              </option>
            </select>
          </div>

            <div class="space-y-2">
            <Label for="requestNumber" class="text-sm font-medium text-gray-700">Request Number</Label>
            <div v-if="collectionRequests.length === 0" class="text-sm text-gray-500">
              There are no approved and unrecorded collection requests.
            </div>
            <select
              v-else
              v-model="selectedRequest"
              class="form-select w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="" disabled>Select a request number</option>
              <option v-for="request in collectionRequests" :key="request.id" :value="request.id">
              {{ request.id }}
              </option>
            </select>
            </div>

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

          <div v-if="selectedForestProducts.length > 0" class="space-y-2">
            <Label class="text-sm font-medium text-gray-700">Selected Products ({{ selectedForestProducts.length }})</Label>
            <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div v-for="product in selectedForestProducts" :key="product.id" class="text-sm">
                {{ product.forest_product_name }} - {{ product.purchased_quantity > 0 ? product.purchased_quantity : 'No' }} {{ product.unit_name }}(s)
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              class="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg py-2.5 font-medium transition-colors flex items-center justify-center space-x-2"
              @click="isModalOpen = true"
            >
              <span class="text-lg">+</span>
              <span>Edit Forest Products</span>
            </button>
          </div>

          <button
            type="submit"
            :disabled="!isFormComplete"
            class="w-full bg-gray-800 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all text-white rounded-lg py-3 font-medium"
          >
            Update Collection Record
          </button>
        </form>
      </CardContent>
      <CardFooter class="bg-gray-50 px-6 py-4 rounded-b-lg">
        <p class="text-xs text-gray-500 text-center">
          Edit the collector and forest products to update the collection record
        </p>
      </CardFooter>
    </Card>

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
                :value="product"
                v-model="selectedForestProducts"
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
              <div v-if="selectedForestProducts.some(selected => selected.id === product.id)" class="flex items-center space-x-2">
                <label class="text-sm text-gray-600">Quantity:</label>
                <Input
                  type="number"
                  v-model="product.purchased_quantity"
                  min="0"
                  :max="product.quantity"
                  placeholder="Qty"
                  class="w-24 text-center"
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
  </div>
</template>