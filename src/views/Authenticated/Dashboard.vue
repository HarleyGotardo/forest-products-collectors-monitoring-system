<template>
  <div>
    <h2 class="text-2xl font-bold mb-4 ml-14 mt-1">Dashboard</h2>

    <!-- Summary Section -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-2">Total Collectors</h3>
        <p class="text-2xl font-bold">{{ totalCollectors }}</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-2">Most Collected Product</h3>
        <p class="text-2xl font-bold">{{ mostCollectedProduct }}</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-2">Total Collection Records</h3>
        <p class="text-2xl font-bold">{{ totalRoutes }}</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-2">Total Forest Products</h3>
        <p class="text-2xl font-bold">{{ totalProducts }}</p>
      </div>
    </div>

    <!-- Quick Actions Section -->
    <div class="mb-8">
      <h3 class="text-xl font-semibold mb-4">Quick Actions</h3>
      <div class="flex space-x-4">
        <button @click="createCollectionRoute" class="bg-blue-500 text-white px-4 py-2 rounded-lg">Create Collection Route</button>
        <button @click="createNewProduct" class="bg-green-500 text-white px-4 py-2 rounded-lg">Create New Forest Product</button>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-4">Most Collected Forest Product</h3>
        <canvas id="mostCollectedChart"></canvas>
      </div>
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-4">Forest Products Quantity Distribution</h3>
        <canvas id="quantityDistributionChart"></canvas>
      </div>
    </div>
  </div>
  <Toaster/>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'vue-sonner'
import Chart from 'chart.js/auto'

const router = useRouter()
const totalCollectors = ref(0)
const mostCollectedProduct = ref('')
const totalRoutes = ref(0)
const totalProducts = ref(0)

const fetchDashboardData = async () => {
  try {
    // Fetch total collectors
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
    
    if (profilesError) throw profilesError
    totalCollectors.value = profiles.length

    // Fetch most collected product based on occurrence
    const { data: collectionRecords, error: collectionRecordsError } = await supabase
      .rpc('get_top_forest_products');

    if (collectionRecordsError) {
      console.error('Error fetching top forest products:', collectionRecordsError);
    } else {
      console.log('Top Forest Products:', collectionRecords);
    }
    
    if (collectionRecordsError) throw collectionRecordsError
    
    const productNames = {}
    for (const record of collectionRecords) {
      const { data: product, error: productError } = await supabase
        .from('forest_products')
        .select('name')
        .eq('id', record.forest_product_id)
        .single()
      if (productError) throw productError
      productNames[record.forest_product_id] = product.name
    }

    const labels = collectionRecords.map(record => productNames[record.forest_product_id])
    const quantities = collectionRecords.map(record => record.count)

    mostCollectedProduct.value = labels.length > 0 ? labels[0] : 'N/A'

    // Fetch total collection routes
    const { data: routes, error: routesError } = await supabase
      .from('collection_records')
      .select('id', { count: 'exact' })
    
    if (routesError) throw routesError
    totalRoutes.value = routes.length

    // Fetch total forest products
    const { data: products, error: productsError } = await supabase
      .from('forest_products')
      .select('id', { count: 'exact' })
    
    if (productsError) throw productsError
    totalProducts.value = products.length

    // Render charts
    renderCharts(labels, quantities)
  } catch (error) {
    toast.error(error.message)
  }
}

const createCollectionRoute = () => {
  router.push('/authenticated/collection-records/create')
}

const createNewProduct = () => {
  router.push('/authenticated/forest-products/create')
}

const renderCharts = async (labels, quantities) => {
  try {
    // Fetch data for charts with proper aggregation
    const { data: fpAndLocation, error: fpAndLocationError } = await supabase
      .from('fp_and_location')
      .select('forest_product_id, location_id, quantity')
    
    if (fpAndLocationError) throw fpAndLocationError

    // Fetch product names
    const productNames = {}
    for (const record of fpAndLocation) {
      const { data: product, error: productError } = await supabase
        .from('forest_products')
        .select('name')
        .eq('id', record.forest_product_id)
        .single()
      
      if (productError) throw productError
      productNames[record.forest_product_id] = product.name
    }

    // Prepare data for charts
    const quantityLabels = fpAndLocation.map(record => `${productNames[record.forest_product_id]} (Location ${record.location_id})`)
    const quantityData = fpAndLocation.map(record => record.quantity)

    // Most Collected Forest Product Chart
    const mostCollectedCtx = document.getElementById('mostCollectedChart')?.getContext('2d')
    if (mostCollectedCtx) {
      new Chart(mostCollectedCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Most Collected Forest Product',
            data: quantities,
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      })
    }

    // Forest Products Quantity Distribution Chart
    const quantityDistributionCtx = document.getElementById('quantityDistributionChart')?.getContext('2d')
    if (quantityDistributionCtx) {
      new Chart(quantityDistributionCtx, {
        type: 'pie',
        data: {
          labels: quantityLabels,
          datasets: [{
            label: 'Forest Products Quantity Distribution',
            data: quantityData,
            backgroundColor: [
              'rgba(255, 99, 132, 0.2)',
              'rgba(54, 162, 235, 0.2)',
              'rgba(255, 206, 86, 0.2)'
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)'
            ],
            borderWidth: 1
          }]
        }
      })
    }
  } catch (error) {
    toast.error(error.message)
  }
}

onMounted(() => {
  fetchDashboardData()
})
</script>

<style scoped>
#map {
  z-index: 0;
}
</style>