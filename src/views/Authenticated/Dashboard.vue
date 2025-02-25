<template>
  <div class="min-h-screen bg-gray-50 p-3 sm:p-6">
    <!-- Header Section - Stacked layout on mobile -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div class="flex items-center gap-2">
      <img src="@/assets/dashboard.png" alt="Dashboard" class="w-6 h-6 group-hover:scale-110 transition-transform" />
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-800">Dashboard</h1>
      </div>
      <div class="flex flex-col sm:flex-row gap-2 sm:gap-4">
      <button @click="createCollectionRoute" 
          class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto">
        <span class="mr-2">+</span> New Collection
      </button>
      <button @click="createNewProduct" 
          class="inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors w-full sm:w-auto">
        <span class="mr-2">+</span> New Product
      </button>
      <button @click="refreshData" 
          class="inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors w-full sm:w-auto">
        <span class="mr-2">🔄</span> Refresh
      </button>
      </div>
    </div>

    <!-- Stats Cards - Single column on mobile -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
      <div class="bg-white rounded-xl shadow-sm p-4 sm:p-6 transform hover:scale-105 transition-transform duration-200">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-500">Total Collectors</p>
            <p class="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{{ totalCollectors }}</p>
          </div>
          <div class="p-2 sm:p-3 bg-blue-100 rounded-lg">
            <svg class="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-4 sm:p-6 transform hover:scale-105 transition-transform duration-200">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-500">Most Collected Product</p>
            <p class="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{{ mostCollectedProduct }}</p>
          </div>
          <div class="p-2 sm:p-3 bg-green-100 rounded-lg">
            <svg class="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-4 sm:p-6 transform hover:scale-105 transition-transform duration-200">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-500">Total Collection Records</p>
            <p class="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{{ totalRoutes }}</p>
          </div>
          <div class="p-2 sm:p-3 bg-purple-100 rounded-lg">
            <svg class="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-4 sm:p-6 transform hover:scale-105 transition-transform duration-200">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-500">Total Forest Products</p>
            <p class="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{{ totalProducts }}</p>
          </div>
          <div class="p-2 sm:p-3 bg-yellow-100 rounded-lg">
            <svg class="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Section - Stack on mobile -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <div class="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <h3 class="text-base sm:text-lg font-semibold text-gray-800 mb-4 sm:mb-6">Most Collected Forest Products</h3>
        <canvas id="mostCollectedChart" class="w-full h-48 sm:h-64"></canvas>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <h3 class="text-base sm:text-lg font-semibold text-gray-800 mb-4 sm:mb-6">Products Distribution</h3>
        <div class="space-y-3 sm:space-y-4">
          <ul class="divide-y divide-gray-200">
            <li v-for="item in paginatedData" 
                :key="item.id" 
                class="py-2 sm:py-3 flex items-center justify-between cursor-pointer hover:bg-green-100 transition-colors rounded-lg px-3 sm:px-4"
                @click="viewFP_Details(item.fp_id)">
              <span class="text-xs sm:text-sm text-gray-600">
                {{ item.productName }} 
                <span class="text-gray-400">({{ item.locationName }})</span>
              </span>
              <span class="text-xs sm:text-sm font-medium text-gray-900">{{ item.quantity }}</span>
            </li>
          </ul>
          
          <div class="flex items-center justify-between pt-3 sm:pt-4">
            <button @click="prevPage" 
                :disabled="currentPage === 1"
                :class="{'opacity-50 cursor-not-allowed': currentPage === 1}"
                class="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Previous
            </button>
            <span class="text-xs sm:text-sm text-gray-600">
              Page {{ currentPage }} of {{ totalPages }}
            </span>
            <button @click="nextPage" 
                :disabled="currentPage === totalPages"
                :class="{'opacity-50 cursor-not-allowed': currentPage === totalPages}"
                class="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <Toaster/>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'vue-sonner'
import Chart from 'chart.js/auto'

const router = useRouter()
const totalCollectors = ref(0)
const mostCollectedProduct = ref('')
const totalRoutes = ref(0)
const totalProducts = ref(0)
const forestProductsData = ref([])
const currentPage = ref(1)
const itemsPerPage = 5

const fetchDashboardData = async (forceRefresh = false) => {
  try {
    if (!forceRefresh) {
      const cachedData = localStorage.getItem('dashboardData')
      if (cachedData) {
        const parsedData = JSON.parse(cachedData)
        totalCollectors.value = parsedData.totalCollectors
        mostCollectedProduct.value = parsedData.mostCollectedProduct
        totalRoutes.value = parsedData.totalRoutes
        totalProducts.value = parsedData.totalProducts
        forestProductsData.value = parsedData.forestProductsData
        renderCharts(parsedData.labels, parsedData.quantities)
        return
      }
    }

    // Fetch total collectors
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .eq('role_id', 2)
    
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
      .is('deleted_at', null)
    
    if (routesError) throw routesError
    totalRoutes.value = routes.length

    // Fetch total forest products
    const { data: products, error: productsError } = await supabase
      .from('forest_products')
      .select('id', { count: 'exact' })
      .is('deleted_at', null)
    
    if (productsError) throw productsError
    totalProducts.value = products.length

    // Fetch forest products quantity distribution
    const { data: fpAndLocation, error: fpAndLocationError } = await supabase
      .from('fp_and_location')
      .select('id, forest_product_id, location_id, quantity')
    
    if (fpAndLocationError) throw fpAndLocationError

    // Fetch product and location names
    const productNamesMap = {}
    const locationNamesMap = {}
    for (const record of fpAndLocation) {
      const { data: product, error: productError } = await supabase
      .from('forest_products')
      .select('name')
      .eq('id', record.forest_product_id)
      .is('deleted_at', null) // Ensure the product is not deleted
      .single()
      if (productError) continue // Skip this record if there's an error fetching the product
      productNamesMap[record.forest_product_id] = product.name

      const { data: location, error: locationError } = await supabase
      .from('location')
      .select('name')
      .eq('id', record.location_id)
      .single()
      if (locationError) throw locationError
      locationNamesMap[record.location_id] = location.name
    }

    forestProductsData.value = fpAndLocation
      .filter(record => productNamesMap[record.forest_product_id]) // Filter out records with deleted products
      .map(record => ({
      id: record.id,
      productName: productNamesMap[record.forest_product_id],
      locationName: locationNamesMap[record.location_id],
      fp_id: record.forest_product_id,
      quantity: record.quantity
      }))

    // Cache data
    const dashboardData = {
      totalCollectors: totalCollectors.value,
      mostCollectedProduct: mostCollectedProduct.value,
      totalRoutes: totalRoutes.value,
      totalProducts: totalProducts.value,
      forestProductsData: forestProductsData.value,
      labels,
      quantities
    }
    localStorage.setItem('dashboardData', JSON.stringify(dashboardData))

    // Render charts
    renderCharts(labels, quantities)
  } catch (error) {
    toast.error(error.message)
  }
}

const createCollectionRoute = () => {
  router.push('/authenticated/collection-records/create')
}

const viewFP_Details = (id) => {
  router.push(`/authenticated/forest-products/${id}`)
}

const createNewProduct = () => {
  router.push('/authenticated/forest-products/create')
}

const refreshData = () => {
  fetchDashboardData(true)
}

let mostCollectedChartInstance = null;

const renderCharts = async (labels, quantities) => {
  try {
    // Most Collected Forest Product Chart
    const mostCollectedCtx = document.getElementById('mostCollectedChart')?.getContext('2d')
    if (mostCollectedCtx) {
      if (mostCollectedChartInstance) {
        mostCollectedChartInstance.destroy();
        mostCollectedChartInstance = null;
      }
      mostCollectedChartInstance = new Chart(mostCollectedCtx, {
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
  } catch (error) {
    toast.error(error.message)
  }
}

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return forestProductsData.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(forestProductsData.value.length / itemsPerPage)
})

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
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
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 1rem;
}
.pagination button {
  margin: 0 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
}
.pagination button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
</style>