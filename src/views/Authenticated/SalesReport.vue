<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'vue-sonner'
import Chart from 'chart.js/auto'
import { getName, isVSUAdmin, isFPUAdmin, isForestRanger } from '@/router/routeGuard'
import { nextTick } from 'vue'
import {
  Pagination,
  PaginationList,
  PaginationListItem,
  PaginationFirst,
  PaginationLast,
  PaginationNext,
  PaginationPrev,
  PaginationEllipsis,
} from '@/components/ui/pagination'
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
const salesData = ref([])
const monthlySalesData = ref([])
const productSalesData = ref([])
const collectorSalesData = ref([])
const loading = ref(true)
const currentPage = ref(1)
const itemsPerPage = 10
const totalSales = ref(0)
const totalCollections = ref(0)
const averageSaleAmount = ref(0)
const topSellingProduct = ref('')

// Filter options
const dateRange = ref({
  start: '',
  end: ''
})
const monthFilter = ref('')
const yearFilter = ref('')
const productFilter = ref('')
const collectorFilter = ref('')

// Available filters
const availableYears = ref([])
const availableMonths = ref([
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
])
const availableProducts = ref([])
const availableCollectors = ref([])

// Chart instances
let monthlySalesChartInstance = null
let productSalesChartInstance = null
let collectorSalesChartInstance = null

const fetchSalesReportData = async () => {
  loading.value = true
  try {
    // Fetch collection records with their items and related data
    const { data: collections, error: collectionsError } = await supabase
      .from('collection_records')
      .select(`
        id,
        created_at,
        is_paid,
        user_id,
        profiles:user_id (id, first_name, last_name, email_address),
        collection_record_items (
          id,
          purchased_quantity,
          total_cost,
          fp_and_location_id,
          fp_and_locations:fp_and_location_id (
            id,
            forest_product_id,
            forest_products:forest_product_id (
              id, 
              name,
              measurement_units:measurement_unit_id (
                unit_name
              )
            )
          )
        )
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    
    if (collectionsError) throw collectionsError

    // Process the data
    salesData.value = collections.map(record => {
      const totalAmount = record.collection_record_items.reduce((sum, item) => sum + (item.total_cost || 0), 0)
      const items = record.collection_record_items.map(item => ({
        id: item.id,
        productName: item.fp_and_locations?.forest_products?.name || 'Unknown Product',
        quantity: item.purchased_quantity || 0,
        unit: item.fp_and_locations?.forest_products?.measurement_units?.unit_name || 'N/A',
        cost: item.total_cost || 0
      }))
      
      return {
        id: record.id,
        date: new Date(record.created_at),
        formattedDate: new Date(record.created_at).toLocaleDateString(),
        year: new Date(record.created_at).getFullYear().toString(),
        month: (new Date(record.created_at).getMonth() + 1).toString().padStart(2, '0'),
        isPaid: record.is_paid,
        collectorId: record.user_id,
        collectorName: record.profiles?.first_name + ' ' + record.profiles?.last_name || 'Unknown',
        collectorEmail: record.profiles?.email_address || 'N/A',
        totalAmount,
        items
      }
    })

    // Generate available filters
    generateFilterOptions()
    
    // Calculate totals and statistics
    calculateStatistics()
    
    // Prepare data for charts
    prepareChartData()
    
    // Render charts
    await renderCharts()
    
  } catch (error) {
    console.error('Sales report error:', error)
    toast.error(error.message || 'Failed to load sales report data')
  } finally {
    loading.value = false
  }
}

const generateFilterOptions = () => {
  // Generate years from data
  const years = [...new Set(salesData.value.map(record => record.year))]
  availableYears.value = years.sort().map(year => ({ value: year, label: year }))
  
  // Generate products from data
  const products = new Map()
  salesData.value.forEach(record => {
    record.items.forEach(item => {
      if (!products.has(item.productName)) {
        products.set(item.productName, item.productName)
      }
    })
  })
  availableProducts.value = Array.from(products.entries()).map(([value, label]) => ({ value, label }))
  
  // Generate collectors from data
  const collectors = new Map()
  salesData.value.forEach(record => {
    if (!collectors.has(record.collectorId) && record.collectorId) {
      collectors.set(record.collectorId, record.collectorName)
    }
  })
  availableCollectors.value = Array.from(collectors.entries()).map(([value, label]) => ({ value, label }))
}

const calculateStatistics = () => {
  const filteredData = getFilteredData()
  
  // Calculate total sales
  totalSales.value = filteredData.reduce((sum, record) => {
    if (productFilter.value) {
      return sum + record.items
        .filter(item => item.productName === productFilter.value)
        .reduce((itemSum, item) => itemSum + item.cost, 0)
    }
    return sum + record.totalAmount
  }, 0).toFixed(2)
  
  // Calculate total collections
  totalCollections.value = filteredData.length
  
  // Calculate average sale amount
  averageSaleAmount.value = filteredData.length > 0 
    ? (totalSales.value / filteredData.length).toFixed(2)
    : '0.00'
  
  // Find top selling product
  const productSales = new Map()
  filteredData.forEach(record => {
    record.items.forEach(item => {
      const current = productSales.get(item.productName) || { quantity: 0, amount: 0 }
      productSales.set(item.productName, {
        quantity: current.quantity + item.quantity,
        amount: current.amount + item.cost
      })
    })
  })
  
  if (productSales.size > 0) {
    // Sort by total sales amount
    const sortedProducts = Array.from(productSales.entries())
      .sort((a, b) => b[1].amount - a[1].amount)
    
    topSellingProduct.value = sortedProducts[0][0]
  } else {
    topSellingProduct.value = 'N/A'
  }
}

const prepareChartData = () => {
  const filteredData = getFilteredData()
  
  // Prepare monthly sales data
  const monthlySales = new Map()
  filteredData.forEach(record => {
    const monthKey = `${record.year}-${record.month}`
    
    // If filtering by product, only include sales for that product
    if (productFilter.value) {
      const productSales = record.items
        .filter(item => item.productName === productFilter.value)
        .reduce((sum, item) => sum + item.cost, 0)
      const current = monthlySales.get(monthKey) || 0
      monthlySales.set(monthKey, current + productSales)
    } else {
      const current = monthlySales.get(monthKey) || 0
      monthlySales.set(monthKey, current + record.totalAmount)
    }
  })
  
  // Sort by date and format for display
  monthlySalesData.value = Array.from(monthlySales.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, amount]) => {
      const [year, monthNum] = month.split('-')
      const monthName = availableMonths.value.find(m => m.value === monthNum)?.label
      return {
        month: `${monthName} ${year}`,
        amount
      }
    })
  
  // Prepare product sales data
  const productSales = new Map()
  
  // If a specific product is selected, only show that product's data
  if (productFilter.value) {
    let totalSales = 0
    filteredData.forEach(record => {
      record.items
        .filter(item => item.productName === productFilter.value)
        .forEach(item => {
          totalSales += item.cost
        })
    })
    if (totalSales > 0) {
      productSales.set(productFilter.value, totalSales)
    }
  } else {
    // If no product filter, show all products
    filteredData.forEach(record => {
      record.items.forEach(item => {
        const current = productSales.get(item.productName) || 0
        productSales.set(item.productName, current + item.cost)
      })
    })
  }
  
  // Sort by sales amount and get top 5 (or just the selected product)
  productSalesData.value = Array.from(productSales.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, productFilter.value ? 1 : 5) // Only take top 1 if product is filtered, otherwise top 5
    .map(([product, amount]) => ({
      product,
      amount
    }))
  
  // Prepare collector sales data
  const collectorSales = new Map()
  filteredData.forEach(record => {
    let saleAmount = productFilter.value
      ? record.items
          .filter(item => item.productName === productFilter.value)
          .reduce((sum, item) => sum + item.cost, 0)
      : record.totalAmount
    
    if (saleAmount > 0) { // Only include collectors with sales for the selected product
      const current = collectorSales.get(record.collectorName) || 0
      collectorSales.set(record.collectorName, current + saleAmount)
    }
  })
  
  // Sort by sales amount and get top 5
  collectorSalesData.value = Array.from(collectorSales.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([collector, amount]) => ({
      collector,
      amount
    }))
}

const getFilteredData = () => {
  return salesData.value.filter(record => {
    // Filter by date range
    if (dateRange.value.start && dateRange.value.end) {
      const recordDate = record.date
      const startDate = new Date(dateRange.value.start)
      const endDate = new Date(dateRange.value.end)
      endDate.setHours(23, 59, 59, 999) // Set to end of day
      
      if (recordDate < startDate || recordDate > endDate) {
        return false
      }
    }
    
    // Filter by month
    if (monthFilter.value && record.month !== monthFilter.value) {
      return false
    }
    
    // Filter by year
    if (yearFilter.value && record.year !== yearFilter.value) {
      return false
    }
    
    // Filter by product - check if any item matches the selected product
    if (productFilter.value) {
      return record.items.some(item => item.productName === productFilter.value)
    }
    
    // Filter by collector
    if (collectorFilter.value && record.collectorId !== collectorFilter.value) {
      return false
    }
    
    return true
  })
}

const applyFilters = () => {
  calculateStatistics()
  prepareChartData()
  renderCharts()
}

const resetFilters = () => {
  dateRange.value = { start: '', end: '' }
  monthFilter.value = ''
  yearFilter.value = ''
  productFilter.value = ''
  collectorFilter.value = ''
  
  calculateStatistics()
  prepareChartData()
  renderCharts()
}

const downloadReport = () => {
  const filteredData = getFilteredData()
  
  let csvContent = "data:text/csv;charset=utf-8,"
  
  // Add header
  csvContent += "Date,Collector,Total Amount,Products,Paid Status\n"
  
  // Add data rows
  filteredData.forEach(record => {
    const productsList = record.items.map(item => `${item.productName} (${item.quantity} ${item.unit})`).join("; ")
    const row = [
      record.formattedDate,
      record.collectorName,
      record.totalAmount.toFixed(2),
      `"${productsList}"`,
      record.isPaid ? 'Paid' : 'Unpaid'
    ]
    csvContent += row.join(",") + "\n"
  })
  
  // Create download link
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement("a")
  link.setAttribute("href", encodedUri)
  link.setAttribute("download", `sales_report_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  toast.success('Report downloaded successfully')
}

const paginatedData = computed(() => {
  const filteredData = getFilteredData()
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredData.slice(start, end)
})

const totalPages = computed(() => {
  const filteredData = getFilteredData()
  return Math.ceil(filteredData.length / itemsPerPage)
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

const viewCollectionDetails = (id) => {
  router.push(`/authenticated/collection-records/${id}`)
}

const renderCharts = async () => {
  try {
    await nextTick()
    
    // Destroy existing chart instances before creating new ones
    if (monthlySalesChartInstance) {
      monthlySalesChartInstance.destroy()
      monthlySalesChartInstance = null
    }
    if (productSalesChartInstance) {
      productSalesChartInstance.destroy()
      productSalesChartInstance = null
    }
    if (collectorSalesChartInstance) {
      collectorSalesChartInstance.destroy()
      collectorSalesChartInstance = null
    }
    
    // Monthly Sales Chart
    const monthlyChartCtx = document.getElementById('monthlySalesChart')?.getContext('2d')
    if (monthlyChartCtx) {
      const labels = monthlySalesData.value.map(item => item.month)
      const data = monthlySalesData.value.map(item => item.amount)
      
      monthlySalesChartInstance = new Chart(monthlyChartCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: productFilter.value ? `Sales (${productFilter.value})` : 'Sales',
            data,
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true
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
                text: 'Sales Amount (₱)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Month'
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: productFilter.value ? `Monthly Sales Trend - ${productFilter.value}` : 'Monthly Sales Trend'
            }
          }
        }
      })
    }
    
    // Product Sales Chart
    const productChartCtx = document.getElementById('productSalesChart')?.getContext('2d')
    if (productChartCtx) {
      const labels = productSalesData.value.map(item => item.product)
      const data = productSalesData.value.map(item => item.amount)
      
      productSalesChartInstance = new Chart(productChartCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Sales',
            data,
            backgroundColor: productFilter.value 
              ? ['rgba(54, 162, 235, 0.6)']
              : [
                  'rgba(255, 99, 132, 0.6)',
                  'rgba(54, 162, 235, 0.6)',
                  'rgba(255, 206, 86, 0.6)',
                  'rgba(75, 192, 192, 0.6)',
                  'rgba(153, 102, 255, 0.6)'
                ],
            borderColor: productFilter.value
              ? ['rgba(54, 162, 235, 1)']
              : [
                  'rgba(255, 99, 132, 1)',
                  'rgba(54, 162, 235, 1)',
                  'rgba(255, 206, 86, 1)',
                  'rgba(75, 192, 192, 1)',
                  'rgba(153, 102, 255, 1)'
                ],
            borderWidth: 1
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
                text: 'Sales Amount (₱)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Product'
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: productFilter.value ? `Sales for ${productFilter.value}` : 'Top Products by Sales'
            }
          }
        }
      })
    }
    
    // Collector Sales Chart
    const collectorChartCtx = document.getElementById('collectorSalesChart')?.getContext('2d')
    if (collectorChartCtx) {
      const labels = collectorSalesData.value.map(item => item.collector)
      const data = collectorSalesData.value.map(item => item.amount)
      
      collectorSalesChartInstance = new Chart(collectorChartCtx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            label: 'Sales',
            data,
            backgroundColor: [
              'rgba(255, 99, 132, 0.6)',
              'rgba(54, 162, 235, 0.6)',
              'rgba(255, 206, 86, 0.6)',
              'rgba(75, 192, 192, 0.6)',
              'rgba(153, 102, 255, 0.6)'
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)'
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
              text: productFilter.value ? `Top Collectors by Sales - ${productFilter.value}` : 'Top Collectors by Sales'
            },
            legend: {
              position: 'right'
            }
          }
        }
      })
    }
  } catch (error) {
    console.error('Error rendering charts:', error)
    toast.error('Failed to render charts. Please try refreshing the page.')
  }
}

// Watch for filter changes
watch([yearFilter, monthFilter, productFilter, collectorFilter, dateRange], () => {
  currentPage.value = 1 // Reset to first page when filters change
  applyFilters()
}, { deep: true })

// Add validation for date range
watch([dateRange], () => {
  if (dateRange.value.start && dateRange.value.end) {
    const startDate = new Date(dateRange.value.start)
    const endDate = new Date(dateRange.value.end)
    
    if (endDate < startDate) {
      toast.error('End date cannot be before start date')
      dateRange.value.end = ''
      return
    }
  }
}, { deep: true })

onMounted(() => {
  fetchSalesReportData()
})
</script>

<template>
  <div class="relative min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6">
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
    >
      <div class="flex items-center gap-3">
        <img
          src="@/assets/sales-report-2.png"
          alt="Sales Report"
          class="w-8 h-8 group-hover:scale-110 transition-transform"
        />
        <h1 class="text-2xl sm:text-3xl font-extrabold text-green-800 tracking-tight">Sales Report</h1>
      </div>
      <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              class="inline-flex items-center justify-center px-4 py-2.5 bg-white text-black border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm w-full sm:w-auto"
              v-if="isFPUAdmin"
            >
              <svg class="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
              </svg>
              Download Report
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Download Sales Report</AlertDialogTitle>
              <AlertDialogDescription>
                This will download the current sales report data as a CSV file with the applied filters. Do you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction @click="downloadReport">
                Download
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <button 
          @click="fetchSalesReportData"
          class="inline-flex items-center justify-center px-4 py-2.5 bg-white text-black border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm w-full sm:w-auto"
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

    <!-- Loading Skeleton -->
    <div v-if="loading" class="animate-pulse">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <div class="h-28 bg-gray-200 rounded-xl"></div>
        <div class="h-28 bg-gray-200 rounded-xl"></div>
        <div class="h-28 bg-gray-200 rounded-xl"></div>
        <div class="h-28 bg-gray-200 rounded-xl"></div>
      </div>
      <div class="bg-gray-200 rounded-xl p-4 mb-6 h-20"></div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div class="h-80 bg-gray-200 rounded-xl"></div>
        <div class="h-80 bg-gray-200 rounded-xl"></div>
      </div>
      <div class="h-96 bg-gray-200 rounded-xl"></div>
    </div>

    <!-- Dashboard Content -->
    <div v-show="!loading">
      <!-- Key Metrics -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <div class="bg-white rounded-xl shadow-md p-5 transform hover:scale-102 hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden relative">
          <div class="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-500 mb-1">Total Sales</p>
              <p 
          class="text-2xl sm:text-3xl font-bold text-gray-900 truncate" 
          :title="new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(totalSales)"
              >
          {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(totalSales) }}
              </p>
            </div>
            <div class="p-3 bg-blue-100 rounded-lg">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl shadow-md p-5 transform hover:scale-102 hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden relative">
          <div class="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-500 mb-1">Total Collections</p>
              <p class="text-2xl sm:text-3xl font-bold text-gray-900">{{ totalCollections }}</p>
            </div>
            <div class="p-3 bg-emerald-100 rounded-lg"> <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl shadow-md p-5 transform hover:scale-102 hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden relative">
          <div class="absolute top-0 left-0 w-2 h-full bg-purple-500"></div>
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-500 mb-1">Average Sale</p>
              <p class="text-2xl sm:text-3xl font-bold text-gray-900">
                {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(averageSaleAmount) }}
              </p>
            </div>
            <div class="p-3 bg-purple-100 rounded-lg">
              <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl shadow-md p-5 transform hover:scale-102 hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden relative">
          <div class="absolute top-0 left-0 w-2 h-full bg-yellow-500"></div>
            <div class="flex items-center justify-between overflow-x-auto space-x-4">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-500 mb-1">Top Selling Product</p>
              <p class="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{{ topSellingProduct }}</p>
            </div>
            <div class="p-3 bg-yellow-100 rounded-lg flex-shrink-0">
              <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-xl shadow-md hover:shadow-lg p-4 sm:p-6 mb-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h3 class="text-lg font-semibold text-gray-800">Filters</h3>
          <button @click="resetFilters" class="text-sm text-blue-600 hover:text-blue-800">Reset All</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <!-- Date Range Filter -->
          <div class="space-y-2">
            <label for="start-date" class="block text-sm font-medium text-gray-700">Start Date</label>
            <input
              type="date"
              id="start-date"
              v-model="dateRange.start"
              class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div class="space-y-2">
            <label for="end-date" class="block text-sm font-medium text-gray-700">End Date</label>
            <input
            type="date"
              id="end-date"
              v-model="dateRange.end"
              class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          
          <!-- Month Filter -->
          <div class="space-y-2">
            <label for="month-filter" class="block text-sm font-medium text-gray-700">Month</label>
            <select
              id="month-filter"
              v-model="monthFilter"
              class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">All Months</option>
              <option v-for="month in availableMonths" :key="month.value" :value="month.value">{{ month.label }}</option>
            </select>
          </div>
          
          <!-- Year Filter -->
          <div class="space-y-2">
            <label for="year-filter" class="block text-sm font-medium text-gray-700">Year</label>
            <select
              id="year-filter"
              v-model="yearFilter"
              class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">All Years</option>
              <option v-for="year in availableYears" :key="year.value" :value="year.value">{{ year.label }}</option>
            </select>
          </div>
          
          <!-- Product Filter -->
          <div class="space-y-2">
            <label for="product-filter" class="block text-sm font-medium text-gray-700">Product</label>
            <select
              id="product-filter"
              v-model="productFilter"
              class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">All Products</option>
              <option v-for="product in availableProducts" :key="product.value" :value="product.value">{{ product.label }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <!-- Monthly Sales Chart -->
        <div class="bg-white rounded-xl shadow-md hover:shadow-lg p-4 sm:p-6">
          <div class="flex items-center justify-center mb-6">
            <div class="p-2 bg-emerald-100 rounded-lg">
              <img
                src="@/assets/trend3.png"
                alt="Forest Logo"
                class="w-6 h-6"
              />
            </div>
            <h3
              class="ml-3 text-lg font-semibold text-gray-800 text-center"
            >
              Monthly Sales Trend (₱)
            </h3>
          </div>
          <div class="w-full h-60 sm:h-80 md:h-80">
            <canvas id="monthlySalesChart"></canvas>
          </div>
        </div>
        
        <!-- Top Products Chart -->
        <div class="bg-white rounded-xl shadow-md hover:shadow-lg p-4 sm:p-6">
          <div class="flex items-center justify-center mb-6">
            <div class="p-2 bg-emerald-100 rounded-full">
              <img
                src="@/assets/trend2.png"
                alt="Forest Logo"
                class="w-6 h-6"
              />
            </div>
            <h3
              class="ml-3 text-lg font-semibold text-gray-800 text-center"
            >
              Top Products by Sales (₱)
            </h3>
          </div>
          <div class="w-full h-60 sm:h-80 md:h-80">
            <canvas id="productSalesChart"></canvas>
          </div>
        </div>
      </div>
      
      <!-- Top Collectors Chart -->
      <div class="bg-white rounded-xl shadow-md hover:shadow-lg p-4 sm:p-6 mb-6">
        <div class="flex items-center justify-center mb-6">
            <div class="p-2 bg-emerald-100 rounded-full">
              <img
                src="@/assets/profile.png"
                alt="Forest Logo"
                class="w-6 h-6"
              />
            </div>
            <h3
              class="ml-3 text-lg font-semibold text-gray-800 text-center"
            >
              Top Collectors by Sales
            </h3>
          </div>
        <div class="w-full h-60 sm:h-80 md:h-80 relative">
          <canvas id="collectorSalesChart"></canvas>
          <!-- No data message -->
          <div 
            v-if="!collectorSalesData.length"
            class="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 rounded-lg"
          >
            <img
              src="@/assets/chill.png"
              alt="No Data"
              class="w-24 h-24 mb-4 opacity-50"
            />
            <p class="text-gray-500 text-lg font-medium">No collector sales data available</p>
            <p class="text-gray-400 text-sm mt-2">Sales data will appear here once collectors make transactions</p>
          </div>
        </div>
      </div>

      <!-- Sales Data Table -->
      <div class="bg-white rounded-xl shadow-md hover:shadow-lg p-4 sm:p-6">
        <div class="flex items-center justify-center mb-6">
            <div class="p-2 bg-emerald-100 rounded-full">
              <img
                src="@/assets/bill.png"
                alt="Forest Logo"
                class="w-6 h-6"
              />
            </div>
            <h3
              class="ml-3 text-lg font-semibold text-gray-800 text-center"
            >
              Sales Transactions
            </h3>
          </div>
        
        <!-- Mobile Card View -->
        <div class="block sm:hidden space-y-4">
          <div v-if="paginatedData.length === 0" class="p-8 text-center">
            <div class="flex flex-col items-center">
              <svg
                class="w-12 h-12 text-gray-300 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <p class="text-gray-500 mb-1 text-sm">No sales data found</p>
              <p class="text-xs text-gray-400">
                Sales transactions will appear here
              </p>
            </div>
          </div>
          
          <div v-else>
            <div
              v-for="record in paginatedData"
              :key="record.id"
              class="bg-white border border-gray-100 rounded-lg p-4 hover:bg-blue-50 transition-colors duration-200 cursor-pointer"
              @click="viewCollectionDetails(record.id)"
            >
              <!-- Header with ID and Status -->
              <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <span class="font-medium text-blue-600">#{{ record.id }}</span>
                </div>
                <span
                  :class="[
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    record.isPaid ? 'bg-emerald-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  ]"
                >
                  {{ record.isPaid ? 'Paid' : 'Unpaid' }}
                </span>
              </div>

              <!-- Date and Amount -->
              <div class="flex justify-between items-center mb-3">
                <div class="flex items-center gap-2">
                  <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span class="text-sm text-gray-500">{{ record.formattedDate }}</span>
                </div>
                <span class="text-sm font-medium text-gray-900">
                  {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(record.totalAmount) }}
                </span>
              </div>

              <!-- Collector Info -->
              <div class="flex items-center gap-2 mb-3">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div>
                  <div class="text-sm font-medium text-gray-900">{{ record.collectorName }}</div>
                  <div class="text-xs text-gray-500">{{ record.collectorEmail }}</div>
                </div>
              </div>

              <!-- Products -->
              <div class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <div class="text-sm text-gray-500">
                  {{ record.items.map(item => item.productName).join(', ') }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Desktop Table View -->
        <div class="hidden sm:block overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-emerald-50">
              <tr>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Collector
                </th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Products
                </th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="record in paginatedData" :key="record.id" class="hover:bg-gray-50 cursor-pointer" @click="viewCollectionDetails(record.id)">
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {{ record.formattedDate }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{{ record.collectorName }}</div>
                  <div class="text-xs text-gray-500">{{ record.collectorEmail }}</div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-500">
                  <div class="max-w-xs truncate">
                    {{ record.items.map(item => item.productName).join(', ') }}
                  </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(record.totalAmount) }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span :class="[
                    record.isPaid ? 'bg-emerald-100 text-green-800' : 'bg-yellow-100 text-yellow-800',
                    'px-2 inline-flex text-xs leading-5 font-semibold rounded-full'
                  ]">
                    {{ record.isPaid ? 'Paid' : 'Unpaid' }}
                  </span>
                </td>
              </tr>
              <!-- Empty state -->
              <tr v-if="paginatedData.length === 0">
                <td colspan="5" class="px-4 py-6 text-center text-gray-500">
                  No sales data found for the selected filters.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
  
        <!-- Pagination -->
        <div class="bg-gray-50 px-4 sm:px-6 py-4 border-t border-gray-200">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="text-sm text-gray-600 hidden sm:block">
              Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentPage * itemsPerPage, getFilteredData().length) }} of {{ getFilteredData().length }} items
            </div>
            <Pagination
              v-slot="{ page }"
              :total="getFilteredData().length"
              :items-per-page="itemsPerPage"
              :sibling-count="1"
              show-edges
              :default-page="currentPage"
              @update:page="(newPage) => {
                currentPage = newPage;
              }"
              class="w-full sm:w-auto"
            >
              <div class="flex items-center justify-center sm:justify-end gap-2">
                <!-- Mobile View -->
                <div class="flex items-center gap-2 sm:hidden">
                  <PaginationPrev class="!w-12 !h-12" />
                  <div class="text-sm font-medium">
                    {{ currentPage }} / {{ Math.ceil(getFilteredData().length / itemsPerPage) }}
                  </div>
                  <PaginationNext class="!w-12 !h-12" />
                </div>

                <!-- Desktop View -->
                <div class="hidden sm:flex items-center gap-1">
                  <PaginationFirst />
                  <PaginationPrev />
                  <PaginationList v-slot="{ items }" class="flex items-center gap-1">
                    <template v-for="(item, index) in items">
                      <PaginationListItem
                        v-if="item.type === 'page'"
                        :key="index"
                        :value="item.value"
                        :class="[
                          'w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-colors',
                          item.value === page ? 'bg-emerald-900 text-white' : 'hover:bg-gray-100'
                        ]"
                      >
                        {{ item.value }}
                      </PaginationListItem>
                      <PaginationEllipsis
                        v-else
                        :key="item.type"
                        :index="index"
                      />
                    </template>
                  </PaginationList>
                  <PaginationNext />
                  <PaginationLast />
                </div>
              </div>
            </Pagination>
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