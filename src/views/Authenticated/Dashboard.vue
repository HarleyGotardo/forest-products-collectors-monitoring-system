<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'vue-sonner'
import Chart from 'chart.js/auto'
import { getName, getUser, isFPCollector, isVSUAdmin, isFPUAdmin, isForestRanger, fetchUserDetails, subscribeToUserChanges, getUserRole } from '@/router/routeGuard'
import { nextTick } from 'vue'
import * as XLSX from 'xlsx'
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
} from '@/components/ui/alert-dialog'

const router = useRouter()
const totalCollectors = ref(0)
const mostCollectedProduct = ref('')
const totalLocations = ref(0)
const totalProducts = ref(0)
const forestProductsData = ref([])
const currentPage = ref(1)
const itemsPerPage = 8
const loading = ref(true)
const isApprovalChecked = ref(false)

// Cache key for localStorage
const APPROVAL_CACHE_KEY = 'user_approval_status'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// New refs for the additional features
const todayCollectionRequests = ref([])
const todayCollectionCount = ref(0)
const lowStockProducts = ref([])
const lowStockCount = ref(0)
const lowStockThreshold = 10 // Define a threshold for "low stock" - adjust as needed

// Updated fetchDashboardData function with adjusted quantity calculation
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
    // console.log("Fetching collection record items...");
    const { data: collectionItems, error: collectionItemsError } = await supabase
      .from('collection_record_items')
      .select('id, fp_and_location_id, purchased_quantity');

    if (collectionItemsError) {
      console.error('Error fetching collection items:', collectionItemsError);
      throw collectionItemsError;
    }

    // console.log(`Found ${collectionItems.length} collection items`);

    // Get all forest product locations
    // console.log("Fetching fp_and_locations...");
    const { data: fpLocations, error: fpLocationsError } = await supabase
      .from('fp_and_locations')
      .select('id, forest_product_id');

    if (fpLocationsError) {
      console.error('Error fetching fp locations:', fpLocationsError);
      throw fpLocationsError;
    }

    // console.log(`Found ${fpLocations.length} fp locations`);

    // Create a map of fp_and_location_id to forest_product_id
    const fpLocationMap = {};
    fpLocations.forEach(loc => {
      fpLocationMap[loc.id] = loc.forest_product_id;
    });

    // Get all forest products with their measurement units
    // console.log("Fetching forest products with measurement units...");
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

    // console.log(`Found ${forestProducts.length} forest products`);

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

    // console.log("Sorted products:", sortedProducts);

    // Prepare chart data
    const labels = sortedProducts.map(p => p.name);
    const quantities = sortedProducts.map(p => p.quantity);
    const units = sortedProducts.map(p => p.unit);

    // Set most collected product with its unit
    mostCollectedProduct.value = sortedProducts.length > 0
      ? `${sortedProducts[0].name} `
      : 'N/A';
    // console.log("Most collected product:", mostCollectedProduct.value);

    // Fetch total collection routes
    const { data: routes, error: routesError } = await supabase
      .from('locations')
      .select('id', { count: 'exact' })
      .is('deleted_at', null)

    if (routesError) throw routesError
    totalLocations.value = routes.length

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
        forest_products!inner (
          id,
          name,
          deleted_at,
          measurement_units:measurement_unit_id (
            unit_name
          )
        ),
        locations!inner (
          name,
          deleted_at
        )
      `)
      .is('forest_products.deleted_at', null)  // Only get non-deleted forest products
      .is('locations.deleted_at', null);       // Only get non-deleted locations

    if (fpAndLocationError) throw fpAndLocationError

    // NEW CODE: Fetch approved but unrecorded collection requests
    // console.log("Fetching approved but unrecorded collection requests...");
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
      .eq('is_recorded', false); // Only fetch unrecorded requests

    if (approvedRequestsError) {
      console.error('Error fetching approved requests:', approvedRequestsError);
      throw approvedRequestsError;
    }

    // console.log(`Found ${approvedRequests.length} approved but unrecorded requests`);

    // Create a map to track pending quantities by fp_and_location_id
    const pendingQuantities = {};

    // Process each approved request
    approvedRequests.forEach(request => {
      // Check if there's a related collection record that is paid
      const hasPaidRecord = request.collection_records && 
                            request.collection_records.some(record => record.is_paid === true);
      
      // Only consider this request as pending if it's not recorded AND doesn't have a paid record
      if (!hasPaidRecord) {
        request.collection_request_items.forEach(item => {
          const fpLocationId = item.fp_and_location_id;
          if (!pendingQuantities[fpLocationId]) {
            pendingQuantities[fpLocationId] = 0;
          }
          pendingQuantities[fpLocationId] += item.requested_quantity;
        });
      }
    });

    // console.log("Pending quantities by location:", pendingQuantities);

    // Create forestProductsData with adjusted quantities
    forestProductsData.value = fpAndLocation
      .filter(record => record.forest_products) // Filter out records with deleted products
      .map(record => {
        // Calculate adjusted quantity
        const currentQuantity = record.quantity || 0;
        const pendingAmount = pendingQuantities[record.id] || 0;
        const adjustedQuantity = Math.max(0, currentQuantity - pendingAmount);
        
        return {
          id: record.id,
          productName: record.forest_products?.name || 'Unknown Product',
          locationName: record.locations?.name || 'Unknown Location',
          measurementUnit: record.forest_products?.measurement_units?.unit_name || 'N/A',
          fp_id: record.forest_product_id,
          quantity: currentQuantity,
          adjustedQuantity: adjustedQuantity,
          pendingQuantity: pendingAmount,
          hasPendingRequests: pendingAmount > 0
        };
      });

    // Update low stock products with adjusted quantities
    lowStockProducts.value = forestProductsData.value
      .filter(product => product.adjustedQuantity <= lowStockThreshold)
      .sort((a, b) => a.adjustedQuantity - b.adjustedQuantity);

    lowStockCount.value = lowStockProducts.value.length;

    // NEW FEATURE: Fetch today's collection requests
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: todayRequests, error: todayRequestsError } = await supabase
      .from('collection_requests')
      .select(`
        id,
        collection_date,
        user_id,
        profiles:user_id (first_name, last_name),
        collection_request_items (
          id,
          requested_quantity,
          fp_and_location_id,
          fp_and_locations:fp_and_location_id (
            id,
            forest_product_id,
            forest_products:forest_product_id (
              name,
              measurement_units:measurement_unit_id (unit_name)
            )
          )
        )
      `)
      .gte('collection_date', today.toISOString())
      .lt('collection_date', tomorrow.toISOString())
      .is('deleted_at', null)
      .eq('remarks', 'Approved')
      .eq('is_recorded', false);

    if (todayRequestsError) throw todayRequestsError;

    todayCollectionRequests.value = todayRequests.map(request => ({
      id: request.id,
      user_id: request.user_id,
      collectionDate: new Date(request.collection_date).toLocaleDateString(),
      collectorName: `${request.profiles?.first_name || 'Unknown'} ${request.profiles?.last_name || 'Collector'}`,
      items: request.collection_request_items.map(item => ({
        productName: item.fp_and_locations?.forest_products?.name || 'Unknown Product',
        quantity: item.requested_quantity,
        unitName: item.fp_and_locations?.forest_products?.measurement_units?.unit_name || 'N/A'
      }))
    }));

    todayCollectionCount.value = todayCollectionRequests.value.length;

    // Render charts
    renderCharts(labels, quantities, units); // Render charts after fetching data
  } catch (error) {
    console.error('Dashboard error:', error);
    toast.error(error.message || 'Failed to load dashboard data');
  } finally {
    loading.value = false; // Stop loading
  }
}

const filteredTodayCollectionRequests = computed(() => {
  if (!isFPCollector.value) return todayCollectionRequests.value;

  const currentUser = getUser();
  return todayCollectionRequests.value.filter(request => {
    // Check if the request belongs to the current collector
    return request.user_id === currentUser?.id;
  });
});

const filteredTodayCollectionCount = computed(() => {
  return filteredTodayCollectionRequests.value.length;
});

const paginatedLowStockProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return lowStockProducts.value.slice(start, end);
});

const viewCollectionRequest = (id) => {
  router.push(`/authenticated/collection-requests/${id}`);
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
    // Wait for the DOM to ensure the chart container is available
    await nextTick();

    const mostCollectedCtx = document.getElementById('mostCollectedChart')?.getContext('2d');
    if (mostCollectedCtx) {
      // Destroy the existing chart instance if it exists
      if (mostCollectedChartInstance) {
        mostCollectedChartInstance.destroy();
        mostCollectedChartInstance = null;
      }

      const displayLimit = 8; // Limit the number of displayed items in the pie chart
      const displayLabels = Array.isArray(labels) ? labels.slice(0, displayLimit) : [];
      const displayQuantities = Array.isArray(quantities) ? quantities.slice(0, displayLimit) : [];
      const displayUnits = Array.isArray(units) ? units.slice(0, displayLimit) : [];

      // Ensure units are valid
      for (let i = 0; i < displayLabels.length; i++) {
        if (!displayUnits[i] || displayUnits[i] === 'undefined') {
          displayUnits[i] = 'N/A';
        }
      }

      const formattedLabels = displayLabels.map((label, index) =>
        `${label} (${displayUnits[index]})`
      );

      // Create the pie chart
      mostCollectedChartInstance = new Chart(mostCollectedCtx, {
        type: 'pie',
        data: {
          labels: formattedLabels,
          datasets: [{
            label: 'Most Collected Forest Products',
            data: displayQuantities,
            backgroundColor: [
              'rgba(255, 99, 132, 0.6)',
              'rgba(54, 162, 235, 0.6)',
              'rgba(255, 206, 86, 0.6)',
              'rgba(75, 192, 192, 0.6)',
              'rgba(153, 102, 255, 0.6)',
              'rgba(255, 159, 64, 0.6)',
              'rgba(201, 203, 207, 0.6)',
              'rgba(255, 99, 71, 0.6)',
              'rgba(60, 179, 113, 0.6)',
              'rgba(238, 130, 238, 0.6)'
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)',
              'rgba(255, 159, 64, 1)',
              'rgba(201, 203, 207, 1)',
              'rgba(255, 99, 71, 1)',
              'rgba(60, 179, 113, 1)',
              'rgba(238, 130, 238, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Most Collected Forest Products'
            },
            legend: {
              position: 'right',
              labels: {
                boxWidth: 12,
                padding: 10,
                font: {
                  size: 10
                }
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const index = context.dataIndex;
                  const unit = displayUnits[index] || 'N/A';
                  return `${context.label}: ${context.raw.toLocaleString()} ${unit}`;
                }
              }
            }
          }
        }
      });
    } else {
      console.warn('Chart container not found. Ensure the DOM is fully loaded.');
    }
  } catch (error) {
    console.error('Chart rendering error:', error);
    toast.error(error.message || 'Failed to render charts');
  }
};

const isExporting = ref(false)

const exportToExcel = async () => {
  try {
    isExporting.value = true

    // Create a new workbook
    const workbook = XLSX.utils.book_new()

    // Function to fetch and format data for a table
    const fetchTableData = async (tableName, query = '') => {
      const { data, error } = await supabase
        .from(tableName)
        .select(query)
      
      if (error) throw error
      return data
    }

    // List of tables and their queries
    const tables = [
      { name: 'collection_record_items', query: '*' },
      { name: 'collection_records', query: '*' },
      { name: 'collection_request_items', query: '*' },
      { name: 'collection_requests', query: '*' },
      { name: 'forest_product_images', query: '*' },
      { name: 'forest_products', query: '*' },
      { name: 'fp_and_locations', query: '*' },
      { name: 'locations', query: '*' },
      { name: 'measurement_units', query: '*' },
      { name: 'profiles', query: '*' },
      { name: 'roles', query: '*' }
    ]

    // Fetch and add each table to the workbook
    for (const table of tables) {
      const data = await fetchTableData(table.name, table.query)
      const worksheet = XLSX.utils.json_to_sheet(data)
      XLSX.utils.book_append_sheet(workbook, worksheet, table.name)
    }

    // Get current date for filename
    const date = new Date().toISOString().split('T')[0]
    const fileName = `nature_cart_backup_${date}.xlsx`

    // Write the workbook and trigger download
    XLSX.writeFile(workbook, fileName)

    toast.success('Backup completed successfully!', {
      description: `File saved as ${fileName}`,
      duration: 5000
    })
  } catch (error) {
    console.error('Export error:', error)
    toast.error('Failed to create backup', {
      description: error.message,
      duration: 5000
    })
  } finally {
    isExporting.value = false
  }
}

const checkUserApproval = async () => {
  try {
    const user = getUser()
    if (!user) {
      window.location.href = 'https://email-confirmed-zeta.vercel.app/'
      return
    }

    // Check cache first
    const cachedApproval = localStorage.getItem(APPROVAL_CACHE_KEY)
    if (cachedApproval) {
      const { approval_flag, timestamp, userId } = JSON.parse(cachedApproval)
      
      // Check if cache is still valid and for the same user
      if (userId === user.id && Date.now() - timestamp < CACHE_DURATION) {
        if (!approval_flag) {
          toast.error('Your account needs to be approved by an administrator.', {
            duration: 2000,
          })
          
          setTimeout(async () => {
            await supabase.auth.signOut()
            window.location.href = 'https://email-confirmed-zeta.vercel.app/'
          }, 2000)
          return
        }
        
        isApprovalChecked.value = true
        // Fetch dashboard data after approval check
        fetchDashboardData()
        return
      }
    }

    // If no valid cache, fetch from database
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('approval_flag')
      .eq('id', user.id)
      .single()

    if (error) throw error

    // Cache the result
    localStorage.setItem(APPROVAL_CACHE_KEY, JSON.stringify({
      approval_flag: profile.approval_flag,
      timestamp: Date.now(),
      userId: user.id
    }))

    if (!profile.approval_flag) {
      toast.error('Your account needs to be approved by an administrator.', {
        duration: 2000,
      })
      
      setTimeout(async () => {
        await supabase.auth.signOut()
        window.location.href = 'https://email-confirmed-zeta.vercel.app/'
      }, 2000)
      return
    }

    isApprovalChecked.value = true
    // Fetch dashboard data after approval check
    fetchDashboardData()
  } catch (error) {
    console.error('Error checking user approval:', error)
    toast.error('Error checking account approval status')
    window.location.href = 'https://email-confirmed-zeta.vercel.app/'
  }
}

// Add a function to clear the cache when needed (e.g., on logout)
const clearApprovalCache = () => {
  localStorage.removeItem(APPROVAL_CACHE_KEY)
}

// Listen for auth state changes to clear cache on logout
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    clearApprovalCache()
  }
})

onMounted(() => {
  checkUserApproval()
})
</script>

<template>
  <div class="relative min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6">
    <!-- Header Section - Always visible -->
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
    >
      <div class="flex items-center gap-3">
        <img
          src="@/assets/dashboard.png"
          alt="Dashboard"
          class="w-8 h-8 group-hover:scale-110 transition-transform"
        />
        <h1 class="text-2xl sm:text-3xl font-extrabold text-green-800 tracking-tight">Dashboard</h1>
      </div>
      <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <AlertDialog v-if="isVSUAdmin || isFPUAdmin">
          <AlertDialogTrigger asChild>
            <button
              :disabled="isExporting || loading || !isApprovalChecked"
              class="inline-flex items-center justify-center px-4 py-2.5 bg-white text-black border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                v-if="!isExporting"
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5 mr-2 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M12 15V3m0 12l-4-4m4 4l4-4"
                />
              </svg>
              <svg
                v-else
                class="animate-spin h-5 w-5 mr-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {{ isExporting ? 'Exporting...' : 'Backup Data' }}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Backup Database</AlertDialogTitle>
              <AlertDialogDescription>
                This will download all data from the database as an Excel file with multiple sheets. Each table will be in its own sheet. Do you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction @click="exportToExcel">
                Start Backup
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <button
          v-if="isForestRanger || isFPUAdmin"
          @click="createCollectionRoute"
          :disabled="loading || !isApprovalChecked"
          class="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all shadow-sm w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Collection Record
        </button>
        <button
          v-if="isForestRanger || isFPUAdmin"
          @click="createNewProduct"
          :disabled="loading || !isApprovalChecked"
          class="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all shadow-sm w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Forest Product
        </button>
        <button
          @click="refreshData"
          :disabled="loading || !isApprovalChecked"
          class="inline-flex items-center justify-center px-4 py-2.5 bg-white text-black border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            class="w-5 h-5 mr-2 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>
    </div>

    <!-- Loading Skeleton - Only for data cards -->
    <div v-if="loading || !isApprovalChecked" class="animate-pulse">
      <!-- First row of cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <div class="h-28 bg-gray-200 rounded-xl"></div>
        <div class="h-28 bg-gray-200 rounded-xl"></div>
        <div class="h-28 bg-gray-200 rounded-xl"></div>
        <div class="h-28 bg-gray-200 rounded-xl"></div>
      </div>

      <!-- Second row of cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div class="h-56 bg-gray-200 rounded-xl"></div>
        <div class="h-56 bg-gray-200 rounded-xl"></div>
      </div>

      <!-- Third row: Charts and product distribution -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <!-- Pie Chart Skeleton -->
        <div class="bg-gray-200 rounded-xl p-4 sm:p-6">
          <div class="flex items-center justify-center mb-4">
            <div class="w-8 h-8 bg-gray-300 rounded-full"></div>
            <div class="ml-2 w-32 h-6 bg-gray-300 rounded"></div>
          </div>
          <div class="w-full h-60 sm:h-80 md:h-96 lg:h-[400px] bg-gray-300 rounded-lg"></div>
        </div>

        <!-- Product Distribution Skeleton -->
        <div class="bg-gray-200 rounded-xl p-4 sm:p-6">
          <div class="flex items-center justify-center mb-4">
            <div class="w-8 h-8 bg-gray-300 rounded-full"></div>
            <div class="ml-2 w-48 h-6 bg-gray-300 rounded"></div>
          </div>
          <div class="space-y-3">
            <div class="h-12 bg-gray-300 rounded-lg"></div>
            <div class="h-12 bg-gray-300 rounded-lg"></div>
            <div class="h-12 bg-gray-300 rounded-lg"></div>
            <div class="h-12 bg-gray-300 rounded-lg"></div>
            <div class="h-12 bg-gray-300 rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dashboard Content -->
    <div v-show="!loading && isApprovalChecked">
      <!-- First row of cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <!-- Total Collectors Card -->
        <div
          class="bg-white rounded-xl shadow-md p-5 transform hover:scale-102 hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden relative"
        >
          <div class="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-500 mb-1">Total Collectors</p>
              <p class="text-2xl sm:text-3xl font-bold text-gray-900">
                {{ totalCollectors }}
              </p>
            </div>
            <div class="p-3 bg-blue-100 rounded-lg">
              <svg
                class="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
          </div>
        </div>
        
        <!-- Most Collected Product Card -->
        <div
          class="bg-white rounded-xl shadow-md p-5 transform hover:scale-102 hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden relative"
          :title="mostCollectedProduct"
        >
          <div class="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
            <div class="flex items-center justify-between overflow-x-auto space-x-4">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-500 mb-1">Most Collected Product</p>
              <p class="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{{ mostCollectedProduct }}</p>
            </div>
            <div class="p-3 bg-emerald-100 rounded-lg flex-shrink-0">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            </div>
        </div>
        
        <!-- Total Records Card -->
        <div
          class="bg-white rounded-xl shadow-md p-5 transform hover:scale-102 hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden relative"
        >
          <div class="absolute top-0 left-0 w-2 h-full bg-purple-500"></div>
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-500 mb-1">
                Registered Locations
              </p>
              <p class="text-2xl sm:text-3xl font-bold text-gray-900">
                {{ totalLocations }}
              </p>
            </div>
            <div class="p-3 bg-purple-100 rounded-lg">
              <svg
                class="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
          </div>
        </div>
        
        <!-- Total Forest Products Card -->
        <div
          class="bg-white rounded-xl shadow-md p-5 transform hover:scale-102 hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden relative"
        >
          <div class="absolute top-0 left-0 w-2 h-full bg-yellow-500"></div>
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-500 mb-1">
                Total Forest Products
              </p>
              <p class="text-2xl sm:text-3xl font-bold text-gray-900">
                {{ totalProducts }}
              </p>
            </div>
            <div class="p-3 bg-yellow-100 rounded-lg">
              <svg
                class="w-6 h-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Second row of cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <!-- Today's Collection Requests Card -->
        <div
          class="bg-white rounded-xl shadow-md p-5 transform hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="flex-1">
              <div class="flex items-center">
                <div class="p-2 bg-indigo-100 rounded-lg mr-3">
                  <svg
                    class="w-5 h-5 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-500">
                    {{ isFPCollector ? "Your Collection Requests Today" : "Today's Collection Requests" }}
                  </p>
                  <p class="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                    {{ isFPCollector ? filteredTodayCollectionCount : todayCollectionCount }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div class="overflow-auto max-h-56 rounded-lg border border-gray-100">
            <ul class="divide-y divide-gray-100">
              <li
                v-for="request in isFPCollector ? filteredTodayCollectionRequests : todayCollectionRequests"
                :key="request.id"
                class="py-3 flex flex-col cursor-pointer hover:bg-indigo-50 transition-colors px-4"
                @click="viewCollectionRequest(request.id)"
              >
                <div class="flex justify-between items-center">
                  <span
                    class="text-sm font-medium text-gray-900"
                    >{{ request.collectorName }}</span
                  >
                  <span
                    class="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full"
                    >{{ request.collectionDate }}</span
                  >
                </div>
                <div class="mt-2 text-xs text-gray-600 flex flex-wrap gap-2">
                  <span
                    v-for="(item, index) in request.items.slice(0, 2)"
                    :key="index"
                    class="inline-flex items-center px-2 py-1 bg-gray-100 rounded-full"
                  >
                    {{ item.productName }}: {{ item.quantity }}
                    {{ item.unitName }}
                  </span>
                  <span v-if="request.items.length > 2" class="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                    +{{ request.items.length - 2 }} more
                  </span>
                </div>
              </li>
            </ul>
            <div
              v-if="(isFPCollector ? filteredTodayCollectionRequests.length : todayCollectionRequests.length) === 0"
              class="py-8 text-center text-gray-500 flex flex-col items-center"
            >
              <img
                src="@/assets/chill.png"
                alt="No Records Found"
                class="w-24 h-24 mb-4"
              />
              <p class="text-gray-600 font-medium">No approved collection requests scheduled for today</p>
            </div>
          </div>
        </div>

        <!-- Low Stock Products Card -->
        <div
          class="bg-white rounded-xl shadow-md p-5 transform hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="flex-1">
              <div class="flex items-center">
                <div class="p-2 bg-red-100 rounded-lg mr-3">
                  <svg
                    class="w-5 h-5 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-500">
                    Low Stock Products
                  </p>
                  <p class="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                    {{ lowStockCount }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div class="overflow-auto max-h-56 rounded-lg border border-gray-100">
            <ul class="divide-y divide-gray-100">
              <li
                v-for="product in paginatedLowStockProducts"
                :key="product.id"
                class="py-3 flex justify-between items-center cursor-pointer hover:bg-red-50 transition-colors px-4"
                @click="viewFP_Details(product.fp_id)"
              >
                <div>
                  <span class="text-sm font-medium text-gray-900">{{ product.productName }}</span>
                  <span class="text-xs text-gray-500 ml-1">({{ product.locationName }})</span>
                </div>
                <div class="flex items-center">
                  <span
                    class="px-2 py-1 rounded-full text-xs font-medium"
                    :class="{
                      'bg-red-100 text-red-700': product.quantity <= 5,
                      'bg-yellow-100 text-yellow-700': product.quantity > 5
                    }"
                  >
                    {{ product.quantity }} {{ product.measurementUnit }}
                  </span>
                </div>
              </li>
            </ul>
            <div
              v-if="lowStockProducts.length === 0"
              class="py-8 text-center text-gray-500 flex flex-col items-center"
            >
              <img
                src="@/assets/full-stock.png"
                alt="No Records Found"
                class="w-24 h-24 mb-4"
              />
              <p class="text-gray-600 font-medium">No products are currently low in stock</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Third row: Charts and product distribution -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <!-- Charts Card -->
        <div class="bg-white rounded-xl shadow-md p-5 transform hover:shadow-lg transition-all duration-300 border border-gray-100">
          <div class="flex items-center justify-center mb-6">
            <div class="p-2 bg-emerald-100 rounded-full">
              <img
                src="@/assets/graph.png"
                alt="Forest Logo"
                class="w-6 h-6"
              />
            </div>
            <h3
              class="ml-3 text-lg font-semibold text-gray-800 text-center"
            >
              Most Collected Forest Products
            </h3>
          </div>
          <div class="w-full h-60 sm:h-80 md:h-96 lg:h-[400px] relative">
            <canvas id="mostCollectedChart"></canvas>
            <!-- No data message -->
            <div 
              v-if="!mostCollectedProduct || mostCollectedProduct === 'N/A'"
              class="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-gray-50 bg-opacity-80"
            >
              <img
                src="@/assets/chill.png"
                alt="No Data"
                class="w-28 h-28 mb-4 opacity-70"
              />
              <p class="text-gray-600 text-lg font-medium">No collection data available</p>
              <p v-if="isFPCollector" class="text-gray-500 text-sm mt-2 text-center px-4">Start collecting forest products to see statistics</p>
            </div>
          </div>
        </div>

        <!-- Forest Products Available Card -->
        <div class="bg-white rounded-xl shadow-md p-5 transform hover:shadow-lg transition-all duration-300 border border-gray-100">
          <div class="flex items-center justify-center mb-6">
            <div class="p-2 bg-emerald-100 rounded-full">
              <img
                src="@/assets/stocks.png"
                alt="Forest Logo"
                class="w-6 h-6"
              />
            </div>
            <h3
              class="ml-3 text-lg font-semibold text-gray-800 text-center"
            >
              Forest Products Available (Available | Snapshot)
            </h3>
          </div>
          <div class="overflow-auto max-h-96 rounded-lg border border-gray-100">
            <ul class="divide-y divide-gray-100">
              <li
                v-for="item in forestProductsData"
                :key="item.id"
                class="py-3 flex items-center justify-between cursor-pointer hover:bg-emerald-50 transition-colors px-4"
                @click="viewFP_Details(item.fp_id)"
              >
                <span class="text-sm text-gray-800 font-medium">
                  {{ item.productName }}
                  <span class="text-gray-500 text-xs ml-1">({{ item.locationName }})</span>
                </span>
                <div class="flex flex-col items-end">
                  <span class="text-sm font-medium text-gray-900 flex items-center">
                    <span class="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span>
                    {{ item.quantity }} {{ item.measurementUnit }}(s)
                  </span>
                  <span 
                    v-if="item.hasPendingRequests" 
                    class="text-xs font-medium flex items-center mt-1"
                    :class="item.adjustedQuantity < 5 ? 'text-red-600' : 'text-amber-600'"
                  >
                    <span 
                      class="w-2 h-2 rounded-full mr-1"
                      :class="item.adjustedQuantity < 5 ? 'bg-red-500' : 'bg-amber-500'"
                    ></span>
                    {{ item.adjustedQuantity }} available
                  </span>
                </div>
              </li>
            </ul>
            <div
              v-if="forestProductsData.length === 0"
              class="py-8 text-center text-gray-500 flex flex-col items-center"
            >
              <img
                src="@/assets/forest-product.png"
                alt="No Records Found"
                class="w-28 h-28 mb-4"
              />
                <p class="text-gray-600 font-medium">No forest products available at the moment.</p>
                <p v-if="isFPUAdmin || isForestRanger" class="text-gray-500 mt-2 text-center px-4">
                Start by adding new forest products to the inventory.
                </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <Toaster
    theme="light"
    :toastOptions="{
      class: 'bg-[#ecfdf5] text-gray-800 border border-green-200 rounded-lg shadow-md',
      style: {
        padding: '1rem',
      }
    }"
  />
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
