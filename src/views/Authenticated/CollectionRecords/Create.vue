
<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { getUser } from '@/router/routeGuard';
import { toast } from 'vue-sonner';
import Button from '@/components/ui/button/Button.vue';
import Input from '@/components/ui/input/Input.vue';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Label from '@/components/ui/label/Label.vue';

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

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <Card class="max-w-lg w-full">
      <CardHeader>
        <CardTitle>Forest Product Collection</CardTitle>
        <CardDescription>Create a new collection record</CardDescription>
      </CardHeader>
      <CardContent>
        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-5">
          <!-- Collector Selection -->
          <div>
            <Label for="collector" >Forest Product Collector</Label>
            <Select v-model="selectedCollector">
              <SelectTrigger>
                <SelectValue placeholder="Select a collector" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem v-for="collector in collectors" :key="collector.id" :value="collector.id">
                    {{ collector.first_name }} {{ collector.last_name }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <!-- Forest Product Selection -->
          <div>
            <Label for="forestProduct">Forest Product</Label>
            <Select v-model="selectedForestProduct">
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem v-for="product in forestProducts" :key="product.forest_product_id" :value="product.forest_product_id">
                    {{ product.forest_product_name }} ({{ product.location_name }}) - ₱{{ product.price }}/{{ product.unit_name }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <!-- Quantity Input -->
          <div>
            <Label for="quantity">Quantity</Label>
            <Input
              type="number"
              v-model="quantity"
              id="quantity"
              min="0"
              step="0.01"
              placeholder="Enter quantity"
            />
          </div>

          <!-- Submit Button -->
          <Button type="submit">
            Create Collection Record
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>


<style scoped>
/* Add your styles here */
</style>