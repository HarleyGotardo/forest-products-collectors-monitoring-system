<template>
  <div class="min-h-screen bg-gray-100 flex items-center justify-center px-4">
    <div class="max-w-lg w-full bg-white rounded-xl shadow-md p-6 sm:p-8">
      <!-- Header -->
      <div class="text-center mb-6">
        <h2 class="text-2xl font-semibold text-gray-900">Forest Product Collection</h2>
        <p class="text-gray-500 text-sm">Create a new collection record</p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="space-y-5">
        <!-- Collector Selection -->
        <div>
          <label for="collector" class="block text-sm font-medium text-gray-700">Forest Product Collector</label>
          <select
            v-model="selectedCollector"
            id="collector"
            class="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500 text-gray-900 p-3"
          >
            <option value="" disabled selected>Select a collector</option>
            <option v-for="collector in collectors" :key="collector.id" :value="collector.id">
              {{ collector.first_name }} {{ collector.last_name }}
            </option>
          </select>
        </div>

        <!-- Forest Product Selection -->
        <div>
          <label for="forestProduct" class="block text-sm font-medium text-gray-700">Forest Product</label>
          <select
            v-model="selectedForestProduct"
            id="forestProduct"
            class="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500 text-gray-900 p-3"
          >
            <option value="" disabled selected>Select a product</option>
            <option v-for="product in forestProducts" :key="product.forest_product_id" :value="product.forest_product_id">
              {{ product.forest_product_name }} ({{ product.location_name }}) - ₱{{ product.price }}/{{ product.unit_name }}
            </option>
          </select>
        </div>

        <!-- Quantity Input -->
        <div>
          <label for="quantity" class="block text-sm font-medium text-gray-700">Quantity</label>
          <input
            type="number"
            v-model="quantity"
            id="quantity"
            min="0"
            step="0.01"
            class="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500 text-gray-900 p-3"
            placeholder="Enter quantity"
          />
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          class="w-full bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg py-3 transition-colors duration-200 shadow-md"
        >
          Create Collection Record
        </button>
      </form>
    </div>
  </div>
</template>

  <script setup>
  import { ref, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { supabase } from '@/lib/supabaseClient';
  import { getUser } from '@/router/routeGuard';
  import { toast } from 'vue-sonner';
  
  const collectors = ref([]);
  const forestProducts = ref([]);
  const selectedCollector = ref(null);
  const selectedForestProduct = ref(null);
  const quantity = ref(0);
  const router = useRouter();
  
  const fetchCollectors = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name');
    if (error) {
      console.error('Error fetching collectors:', error);
    } else {
      collectors.value = data;
    }
  };
  
  const fetchForestProducts = async () => {
    const { data, error } = await supabase
      .from('fp_and_location')
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
        location (name)
      `);
    if (error) {
      console.error('Error fetching forest products:', error);
    } else {
      forestProducts.value = data.map(item => ({
        id: item.id,
        forest_product_id: item.forest_product_id,
        forest_product_name: item.forest_products.name,
        location_name: item.location.name,
        price: item.forest_products.price_based_on_measurement_unit,
        unit_name: item.forest_products.measurement_units.unit_name,
        quantity: item.quantity
      }));
    }
  };
  
  const handleSubmit = async () => {
    const user = getUser();
    const selectedProduct = forestProducts.value.find(product => product.forest_product_id === selectedForestProduct.value);
  
    if (!selectedProduct) {
      console.error('Selected product not found');
      toast.error('Selected product not found');
      return;
    }
  
    const totalCost = selectedProduct.price * quantity.value;
  
    const { data, error } = await supabase
      .from('collection_records')
      .insert([
        {
          user_id: selectedCollector.value,
          forest_product_id: selectedForestProduct.value,
          total_cost: totalCost,
          created_by: user.id
        }
      ])
      .select();
  
    if (error) {
      console.error('Error creating collection record:', error);
      toast.error('Error creating collection record');
    } else {
      // Deduct the quantity from the fp_and_location table
      const newQuantity = selectedProduct.quantity - quantity.value;
      await supabase
        .from('fp_and_location')
        .update({ quantity: newQuantity })
        .eq('id', selectedProduct.id);
      
      router.push('/authenticated/collection-records');
      toast.success('Collection record created successfully');
    }
  };
  
  onMounted(() => {
    fetchCollectors();
    fetchForestProducts();
  });
  </script>
  
  <style scoped>
  /* Add your styles here */
  </style>