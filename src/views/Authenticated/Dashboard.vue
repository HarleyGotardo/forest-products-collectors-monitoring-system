<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'vue-sonner'
import Chart from 'chart.js/auto'
import { getName, getUser, isFPCollector, isVSUAdmin, isFPUAdmin, isForestRanger, fetchUserDetails, subscribeToUserChanges, getUserRole } from '@/router/routeGuard'

const router = useRouter()
const totalCollectors = ref(0)
const mostCollectedProduct = ref('')
const totalRoutes = ref(0)
const totalProducts = ref(0)
const forestProductsData = ref([])
const currentPage = ref(1)
const itemsPerPage = 8
const loading = ref(true)

const fetchDashboardData = async () => {
  loading.value = true
  try {
    // Fetch total collectors
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .eq('role_id', 2)
      .not('approval_flag', 'is', null)
    
    if (profilesError) throw profilesError
    totalCollectors.value = profiles.length

    // First, get all collection_record_items with their purchased_quantity and fp_and_location_id
    console.log("Fetching collection record items...");
    const { data: collectionItems, error: collectionItemsError } = await supabase
      .from('collection_record_items')
      .select('id, fp_and_location_id, purchased_quantity');
    
    if (collectionItemsError) {
      console.error('Error fetching collection items:', collectionItemsError);
      throw collectionItemsError;
    }
    
    console.log(`Found ${collectionItems.length} collection items`);
    
    // Get all forest product locations
    console.log("Fetching fp_and_locations...");
    const { data: fpLocations, error: fpLocationsError } = await supabase
      .from('fp_and_locations')
      .select('id, forest_product_id');
    
    if (fpLocationsError) {
      console.error('Error fetching fp locations:', fpLocationsError);
      throw fpLocationsError;
    }
    
    console.log(`Found ${fpLocations.length} fp locations`);
    
    // Create a map of fp_and_location_id to forest_product_id
    const fpLocationMap = {};
    fpLocations.forEach(loc => {
      fpLocationMap[loc.id] = loc.forest_product_id;
    });
    
    // Get all forest products with their measurement units
    console.log("Fetching forest products with measurement units...");
    const { data: forestProducts, error: forestProductsError } = await supabase
      .from('forest_products')
      .select(`
        id, 
        name,
        measurement_unit_id,
        measurement_units:measurement_unit_id (
          unit_name
        )
      `)
      .is('deleted_at', null);
    
    if (forestProductsError) {
      console.error('Error fetching forest products:', forestProductsError);
      throw forestProductsError;
    }
    
    console.log(`Found ${forestProducts.length} forest products`);
    
    // Create maps for product name and measurement unit
    const productNameMap = {};
    const productUnitMap = {};
    
    forestProducts.forEach(product => {
      productNameMap[product.id] = product.name;
      productUnitMap[product.id] = product.measurement_units?.unit_name || 'N/A';
    });
    
    // Aggregate purchased quantities by forest product
    const productQuantities = {};
    
    collectionItems.forEach(item => {
      if (!item.fp_and_location_id || !item.purchased_quantity) return;
      
      const forestProductId = fpLocationMap[item.fp_and_location_id];
      if (!forestProductId) return;
      
      if (!productQuantities[forestProductId]) {
        productQuantities[forestProductId] = 0;
      }
      
      productQuantities[forestProductId] += item.purchased_quantity;
    });
    
    // Convert to array and sort by quantity
    const sortedProducts = Object.entries(productQuantities)
      .map(([id, quantity]) => ({
        id: parseInt(id),
        name: productNameMap[id] || `Product ID ${id}`,
        unit: productUnitMap[id] || 'N/A',
        quantity
      }))
      .sort((a, b) => b.quantity - a.quantity);
    
    console.log("Sorted products:", sortedProducts);
    
    // Prepare chart data
    const labels = sortedProducts.map(p => p.name);
    const quantities = sortedProducts.map(p => p.quantity);
    const units = sortedProducts.map(p => p.unit);
    
    // Set most collected product with its unit
    mostCollectedProduct.value = sortedProducts.length > 0 
      ? `${sortedProducts[0].name} ` 
      : 'N/A';
    console.log("Most collected product:", mostCollectedProduct.value);

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

    // Fetch forest products quantity distribution with unit_name
    const { data: fpAndLocation, error: fpAndLocationError } = await supabase
      .from('fp_and_locations')
      .select(`
        id,
        forest_product_id,
        location_id,
        quantity,
        forest_products (
          id,
          name,
          measurement_units:measurement_unit_id (
            unit_name
          )
        ),
        locations (
          name
        )
      `)
    
    if (fpAndLocationError) throw fpAndLocationError

    forestProductsData.value = fpAndLocation
      .filter(record => record.forest_products) // Filter out records with deleted products
      .map(record => ({
        id: record.id,
        productName: record.forest_products?.name || 'Unknown Product',
        locationName: record.locations?.name || 'Unknown Location',
        measurementUnit: record.forest_products?.measurement_units?.unit_name || 'N/A',
        fp_id: record.forest_product_id,
        quantity: record.quantity
      }));

    // Render charts
    renderCharts(labels, quantities, units); // Render charts after fetching data
  } catch (error) {
    console.error('Dashboard error:', error);
    toast.error(error.message || 'Failed to load dashboard data');
  } finally {
    loading.value = false; // Stop loading
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

const renderCharts = async (labels, quantities, units) => {
  try {
    const mostCollectedCtx = document.getElementById('mostCollectedChart')?.getContext('2d');
    if (mostCollectedCtx) {
      if (mostCollectedChartInstance) {
        mostCollectedChartInstance.destroy();
        mostCollectedChartInstance = null;
      }

      const displayLimit = 5;
      const displayLabels = Array.isArray(labels) ? labels.slice(0, displayLimit) : [];
      const displayQuantities = Array.isArray(quantities) ? quantities.slice(0, displayLimit) : [];
      const displayUnits = Array.isArray(units) ? units.slice(0, displayLimit) : [];

      for (let i = 0; i < displayLabels.length; i++) {
        if (!displayUnits[i] || displayUnits[i] === 'undefined') {
          displayUnits[i] = 'N/A';
        }
      }

      const formattedLabels = displayLabels.map((label, index) => 
        `${label} (${displayUnits[index]})`
      );

      mostCollectedChartInstance = new Chart(mostCollectedCtx, {
        type: 'bar',
        data: {
          labels: formattedLabels,
          datasets: [{
            label: 'Most Collected Forest Products',
            data: displayQuantities,
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Total Collected Quantity'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Forest Products'
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Most Collected Forest Products'
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const index = context.dataIndex;
                  const unit = displayUnits[index] || 'N/A';
                  return `Quantity: ${context.raw.toLocaleString()} ${unit}`;
                }
              }
            }
          }
        }
      });
    }
  } catch (error) {
    console.error('Chart rendering error:', error);
    toast.error(error.message || 'Failed to render charts');
  }
};

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

<template>
  <div class="min-h-screen bg-gray-50 p-3 sm:p-6">
        <!-- Loading Skeleton -->
        <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="relative">
        <div class="relative w-32 h-32">
          <div
            class="absolute w-full h-full rounded-full border-[3px] border-gray-100/10 border-r-[#0ff] border-b-[#0ff] animate-spin"
            style="animation-duration: 3s;"
          ></div>
          <div
            class="absolute w-full h-full rounded-full border-[3px] border-gray-100/10 border-t-[#0ff] animate-spin"
            style="animation-duration: 2s; animation-direction: reverse;"
          ></div>
        </div>
        <div
          class="absolute inset-0 bg-gradient-to-tr from-[#0ff]/10 via-transparent to-[#0ff]/5 animate-pulse rounded-full blur-sm"
        ></div>
      </div>
    </div>
    <!-- Header Section - Stacked layout on mobile -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div class="flex items-center gap-2">
      <img src="@/assets/dashboard.png" alt="Dashboard" class="w-6 h-6 group-hover:scale-110 transition-transform" />
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-800">Dashboard</h1>
      </div>
      <div class="flex flex-col sm:flex-row gap-2 sm:gap-4">
      <button v-if="isForestRanger || isFPUAdmin" @click="createCollectionRoute" 
          class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto">
        <span class="mr-2">+</span> New Collection
      </button>
      <button v-if="isForestRanger || isFPUAdmin" @click="createNewProduct" 
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
      <div class="bg-white rounded-xl shadow-sm p-4 sm:p-6 w-full">
  <h3 class="text-base sm:text-lg font-semibold text-gray-800 mb-4 sm:mb-6 text-center">Most Collected Forest Products</h3>
  <div class="w-full h-60 sm:h-80 md:h-96 lg:h-[400px]">
    <canvas id="mostCollectedChart"></canvas>
  </div>
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
              <span class="text-xs sm:text-sm font-medium text-gray-900">{{ item.quantity }} {{ item.measurementUnit }}</span>
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