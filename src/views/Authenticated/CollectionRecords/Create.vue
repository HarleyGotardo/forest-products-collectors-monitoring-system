<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { getUser } from '@/router/routeGuard';
import { toast } from 'vue-sonner';
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
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Label from '@/components/ui/label/Label.vue';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const collectors = ref([]);
const forestProducts = ref([]);
const selectedCollector = ref(null);
const selectedForestProduct = ref(null);
const quantity = ref(0);
const router = useRouter();
const receiptDetails = ref(null);

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
  } else {
    forestProducts.value = data.map(item => ({
      id: item.id,
      forest_product_id: item.forest_product_id,
      forest_product_name: item.forest_products.name,
      location_id: item.location_id,
      location_name: item.locations.name,
      price: item.forest_products.price_based_on_measurement_unit,
      unit_name: item.forest_products.measurement_units.unit_name,
      quantity: item.quantity
    }));
  }
};

const isFormComplete = computed(() => {
  return selectedCollector.value && selectedForestProduct.value && quantity.value > 0;
});

const handleSubmit = () => {
  const selectedProduct = forestProducts.value.find(product => product.forest_product_id === selectedForestProduct.value);
  const selectedCollectorData = collectors.value.find(collector => collector.id === selectedCollector.value);

  if (!selectedProduct) {
    console.error('Selected product not found');
    toast.error('Selected product not found');
    return;
  }

  if (quantity.value > selectedProduct.quantity) {
    toast.error('Quantity exceeds available amount');
    return;
  }

  const totalCost = selectedProduct.price * quantity.value;
  const remainingQuantity = selectedProduct.quantity - quantity.value;

  receiptDetails.value = {
    collectorId: selectedCollector.value,
    collectorName: selectedCollectorData.first_name + ' ' + selectedCollectorData.last_name,
    forestProductId: selectedForestProduct.value,
    forestProductName: selectedProduct.forest_product_name,
    locationId: selectedProduct.location_id,
    locationName: selectedProduct.location_name,
    currentQuantity: selectedProduct.quantity,
    deductedQuantity: quantity.value,
    remainingQuantity: remainingQuantity,
    price: selectedProduct.price,
    unitName: selectedProduct.unit_name,
    totalCost: totalCost,
  };
};

const confirmSubmit = async () => {
  const user = getUser();
  const selectedProduct = forestProducts.value.find(product => product.forest_product_id === selectedForestProduct.value);

  const totalCost = selectedProduct.price * quantity.value;

  const { data, error } = await supabase
    .from('collection_records')
    .insert([
      {
        user_id: selectedCollector.value,
        forest_product_id: selectedForestProduct.value,
        total_cost: totalCost,
        created_by: user.id,
        deducted_quantity: receiptDetails.value.deductedQuantity,
        remaining_quantity: receiptDetails.value.remainingQuantity,
        quantity_during_purchase: receiptDetails.value.currentQuantity,
        price_per_unit_during_purchase: receiptDetails.value.price,
        location_id: receiptDetails.value.locationId,
      }
    ])
    .select('id');

  if (error) {
    console.error('Error creating collection record:', error);
    toast.error('Error creating collection record - ' + error.message);
  } else {
    // Deduct the quantity from the fp_and_locations table
    const newQuantity = selectedProduct.quantity - quantity.value;
    await supabase
      .from('fp_and_locations')
      .update({ quantity: newQuantity })
      .eq('id', selectedProduct.id);
    
    const newRecordId = data[0].id;
    router.push(`/authenticated/collection-records/${newRecordId}`);
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
        <div class="flex items-center space-x-2">
          <img src="@/assets/add.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
          <CardTitle>Forest Product Collection</CardTitle>
        </div>
        <div>
          <CardDescription>Create a new collection record</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-5">
          <!-- Collector Selection -->
          <div>
            <Label for="collector">Forest Product Collector</Label>
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
                    {{ product.forest_product_name }} ({{ product.location_name }}) - (₱{{ product.price }} per {{ product.unit_name }}) - {{ product.quantity }} {{ product.unit_name }}(s) Available
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
              @input="(e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, ''); quantity.value = parseFloat(e.target.value) || 0; }"
            />
          </div>

          <!-- Submit Button -->
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" :disabled="!isFormComplete" @click="handleSubmit" class="w-full bg-black hover:bg-gray-700 transition-all text-white rounded-lg py-2">
                Create Collection Record
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent v-if="receiptDetails">
              <AlertDialogHeader>
                <AlertDialogTitle>Invoice</AlertDialogTitle>
                <AlertDialogDescription>
                  <Card>
                    <CardHeader>
                      <CardTitle>Collection Record Receipt</CardTitle>
                      <CardDescription>Review the details before confirming</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p><strong>Collector ID:</strong> {{ receiptDetails.collectorId }}</p>
                      <p><strong>Collector Name:</strong> {{ receiptDetails.collectorName }}</p>
                      <p><strong>Forest Product ID:</strong> {{ receiptDetails.forestProductId }}</p>
                      <p><strong>Forest Product Name:</strong> {{ receiptDetails.forestProductName }}</p>
                      <p><strong>Forest Product Location:</strong> {{ receiptDetails.locationName }}</p>
                      <p><strong>Forest Product Quantity (Based on location):</strong> {{ receiptDetails.currentQuantity }}</p>
                      <p><strong>Deducted Quantity:</strong> {{ receiptDetails.deductedQuantity }}</p>
                      <p><strong>Remaining Quantity:</strong> {{ receiptDetails.remainingQuantity }}</p>
                      <p><strong>Price per {{ receiptDetails.unitName }}:</strong> ₱{{ receiptDetails.price }}</p>
                      <p><strong>Total Cost:</strong> ₱{{ receiptDetails.totalCost }} ({{ receiptDetails.price }} * {{ receiptDetails.deductedQuantity }})</p>
                    </CardContent>
                    <CardFooter>
                      <AlertDialogAction class="mr-3" @click="confirmSubmit">Confirm</AlertDialogAction>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                    </CardFooter>
                  </Card>
                </AlertDialogDescription>
              </AlertDialogHeader>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
/* Add your styles here */
</style>