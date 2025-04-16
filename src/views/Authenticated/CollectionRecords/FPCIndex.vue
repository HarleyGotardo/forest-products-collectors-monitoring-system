<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'
import { user, isFPCollector, isVSUAdmin, isFPUAdmin, isForestRanger, fetchUserDetails, getUser } from '@/router/routeGuard'
import Button from '@/components/ui/button/Button.vue'
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

const loading = ref(true);
const router = useRouter()
const allCollectionRecords = ref([]) // Store all collection records
const collectionRecords = ref([]) // Store paginated collection records
const error = ref(null)
const currentPage = ref(1)
const itemsPerPage = 8
const searchQuery = ref('')
const selectedStatus = ref('') // New ref for selected status

const createCollectionRecord = () => {
  router.push('/authenticated/collection-records/create')
}

const fetchAllCollectionRecords = async () => {
  loading.value = true; // Start loading
  const currentUser = getUser();
  
  try {
    // First, fetch the collection records
    let { data: records, error: recordsError } = await supabase
      .from('collection_records')
      .select(`
        id,
        created_at,
        user_id,
        created_by,
        deleted_at,
        is_paid,
        approved_by,
        approved_at,
        purpose,
        collection_request_id
      `)
      .eq('user_id', currentUser.id) // Filter by authenticated user's ID
      .is('deleted_at', null); // Exclude records with non-null deleted_at

    if (recordsError) throw recordsError;
    
    // For each record, get its items with related forest products and locations
    const recordsWithDetails = await Promise.all(records.map(async (record) => {
      // Get items for this collection record
      const { data: items, error: itemsError } = await supabase
        .from('collection_record_items')
        .select(`
          id,
          purchased_quantity,
          total_cost,
          fp_and_location:fp_and_locations (
            id,
            quantity,
            forest_product:forest_products (
              id,
              name,
              image_url,
              type,
              price_based_on_measurement_unit,
              measurement_unit:measurement_units (
                id,
                unit_name
              )
            ),
            location:locations (
              id,
              name
            )
          )
        `)
        .eq('collection_record_id', record.id);
      
      if (itemsError) {
        console.error('Error fetching items for record', record.id, itemsError);
        return null;
      }
      
      // Format record with first item's details (if multiple items, you may need to adjust)
      if (items && items.length > 0) {
        const item = items[0]; // Use the first item
        const fp = item.fp_and_location.forest_product;
        const location = item.fp_and_location.location;
        
        return {
          ...record,
          product_name: fp?.name || 'N/A',
          product_type: fp?.type || 'N/A',
          product_price: fp?.price_based_on_measurement_unit || 0,
          unit_name: fp?.measurement_unit?.unit_name || 'N/A',
          location_name: location?.name || 'N/A',
          image_url: fp?.image_url ? JSON.parse(fp.image_url).data.publicUrl : null,
          quantity: item.purchased_quantity,
          total_value: item.total_cost || 0,
          status: record.is_paid ? 'Approved' : 'Pending' // Simplified status logic
        };
      }
      
      return {
        ...record,
        product_name: 'N/A',
        product_type: 'N/A',
        product_price: 0,
        unit_name: 'N/A',
        location_name: 'N/A',
        image_url: null,
        quantity: 0,
        total_value: 0,
        status: record.is_paid ? 'Approved' : 'Pending'
      };
    }));
    
    // Filter out any null records
    allCollectionRecords.value = recordsWithDetails.filter(record => record !== null);
    paginateCollectionRecords();
    
  } catch (error) {
    console.error('Error fetching collection records:', error);
    error.value = error.message || 'Failed to fetch collection records';
  } finally {
    loading.value = false;
  }
}

const paginateCollectionRecords = () => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  collectionRecords.value = filteredCollectionRecords.value.slice(start, end)
}

const filteredCollectionRecords = computed(() => {
  let records = allCollectionRecords.value;

  if (selectedStatus.value) {
    records = records.filter(record => record.status === selectedStatus.value);
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    records = records.filter(record =>
      record.id.toString().includes(query) ||
      (record.product_name && record.product_name.toLowerCase().includes(query)) ||
      (record.location_name && record.location_name.toLowerCase().includes(query))
    );
  }

  return records;
});

const nextPage = () => {
  if ((currentPage.value * itemsPerPage) < filteredCollectionRecords.value.length) {
    currentPage.value++
    paginateCollectionRecords()
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    paginateCollectionRecords()
  }
}

const viewRecord = (recordId) => {
  router.push(`/authenticated/collection-records/${recordId}`)
}

const editRecord = (recordId) => {
  router.push(`/authenticated/collection-records/${recordId}/edit`)
}

const deleteRecord = async (recordId) => {
  const currentDate = new Date()
  const formattedDate = format(currentDate, 'yyyy-MM-dd HH:mm:ss')

  const { error: updateError } = await supabase
    .from('collection_records')
    .update({ deleted_at: formattedDate })
    .eq('id', recordId)

  if (updateError) {
    toast.error(updateError.message, { duration: 3000 })
  } else {
    toast.success('Collection record deleted successfully', { duration: 3000 })
    fetchAllCollectionRecords() 
  }
}

onMounted(() => {
  fetchUserDetails()
  fetchAllCollectionRecords()
})

watch(searchQuery, () => {
  currentPage.value = 1 // Reset to first page on search query change
  paginateCollectionRecords()
})

watch(currentPage, () => {
  paginateCollectionRecords()
})

watch(selectedStatus, () => {
  currentPage.value = 1 // Reset to first page on status change
  paginateCollectionRecords()
})
</script>

<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0 mt-2">
      <div class="flex items-center space-x-2">
      <img src="@/assets/records2.png" alt="Collection Records" class="w-12 h-12 group-hover:scale-110 transition-transform" />
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">My Collection Records</h2>
        <p class="mt-1 text-sm">View and manage your forest product collection records</p>
      </div>
      </div>
      <div class="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
      <div class="relative flex-1 sm:flex-none">
        <input
        v-model="searchQuery"
        type="text"
        placeholder="ID, product, location"
        class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
        />
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        </div>
      </div>
      <div class="flex space-x-4">
        <select
        v-model="selectedStatus"
        class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
        >
        <option value="">All Status</option>
        <option value="Pending">Pending</option>
        <option value="Approved">Approved</option>
        <option value="Rejected">Rejected</option>
        </select>
        <Button 
        v-if="isFPCollector"
        @click="createCollectionRecord"
        >
        +
        </Button>
      </div>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" 
         class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg">
      <div class="flex">
        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <p class="ml-3">{{ error }}</p>
      </div>
    </div>

<!-- Loading Skeleton -->
<div v-if="loading" class="animate-pulse">
  <div class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-200">
          <tr>
            <th class="px-6 py-3 h-10"></th>
            <th class="px-6 py-3 h-10"></th>
            <th class="px-6 py-3 h-10"></th>
            <th class="px-6 py-3 h-10"></th>
            <th class="px-6 py-3 h-10"></th>
            <th class="px-6 py-3 h-10"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in 5" :key="n">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="h-4 bg-gray-200 rounded w-16"></div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div class="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-lg"></div>
                <div class="ml-4 w-24">
                  <div class="h-4 bg-gray-200 rounded"></div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="h-4 bg-gray-200 rounded w-20"></div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="h-4 bg-gray-200 rounded w-32"></div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="h-6 bg-gray-200 rounded-full w-16"></div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
              <div class="flex items-center justify-end space-x-3">
                <div class="h-8 w-8 bg-gray-200 rounded"></div>
                <div class="h-8 w-8 bg-gray-200 rounded"></div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

    <!-- Collection Records Table -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
  <table class="min-w-full border-collapse sm:border-separate sm:border-spacing-0 cursor-pointer">
    <thead class="bg-gray-700 hidden sm:table-header-group">
      <tr>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">ID</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Product</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Location</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Quantity</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Actions</th>
      </tr>
    </thead>

    <tbody class="bg-white">

      <tr v-if="filteredCollectionRecords.length === 0" class="block sm:table-row">
        <td colspan="6" class="px-6 py-12 text-center block sm:table-cell">
          <div class="flex flex-col items-center">
            <img
              src="@/assets/page-not-found.png"
              alt="No Records Found"
              class="w-24 h-24 mb-4"
            />
            <p class="text-gray-900 text-sm">No collection records found matching your criteria</p>
          </div>
        </td>
      </tr>

      <tr
        v-for="record in collectionRecords"
        :key="record.id"
        class="block mb-4 rounded-lg shadow-md border border-gray-200 bg-white sm:table-row sm:mb-0 sm:rounded-none sm:shadow-none sm:border-0 sm:border-b sm:border-gray-200 sm:hover:bg-gray-50 transition-colors duration-150"
        @click="viewRecord(record.id, $event)"
      >

        <td class="block p-4 sm:hidden" colspan="6">
          <div class="flex items-start space-x-4 mb-3">
             <div class="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-lg bg-blue-50">
               <img :src="record.image_url" alt="Product Image" class="h-12 w-12 rounded-lg object-cover" />
             </div>
             <div class="flex-grow min-w-0"> 
                <h3 class="text-base font-semibold text-gray-900 mb-0.5 truncate">{{ record.product_name }}</h3> 
                <p class="text-xs text-gray-500">ID: #{{ record.id }}</p>
             </div>
             <div class="flex-shrink-0 flex items-center space-x-1" @click.stop> 
                <Button
                  v-if="isFPCollector && record.status === 'Pending'"
                  @click="editRecord(record.id, $event)"
                  aria-label="Edit record"
                >
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                     <Button
                       v-if="isFPCollector && record.status === 'Pending'"
                       aria-label="Delete record"
                     >
                       <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                           d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                       </svg>
                     </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                     <AlertDialogHeader>
                       <AlertDialogTitle>Delete Collection Record?</AlertDialogTitle>
                       <AlertDialogDescription>
                         This collection record will be transferred to the recycle bin.
                       </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                       <AlertDialogCancel>Cancel</AlertDialogCancel>
                       <AlertDialogAction @click="deleteRecord(record.id)">Delete</AlertDialogAction>
                     </AlertDialogFooter>
                   </AlertDialogContent>
                </AlertDialog>
             </div>
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t border-gray-100 pt-3">
             <div>
               <span class="block text-xs text-gray-500 font-medium">Location</span>
               <p class="text-gray-800">{{ record.location_name }}</p>
             </div>
             <div>
               <span class="block text-xs text-gray-500 font-medium">Quantity</span>
               <p class="text-gray-800">
                 {{ record.quantity }}
                 <span class="text-gray-500 text-xs">{{ record.unit_name }}</span>
               </p>
             </div>
             <div>
               <span class="block text-xs text-gray-500 font-medium">Collection Date</span>
               <p class="text-gray-800">{{ new Date(record.created_at).toLocaleDateString() }}</p>
             </div>
             <div>
               <span class="block text-xs text-gray-500 font-medium">Status</span>
               <span 
                 class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                 :class="{
                   'bg-yellow-100 text-yellow-800': record.status === 'Pending',
                   'bg-green-100 text-green-800': record.status === 'Approved',
                   'bg-red-100 text-red-800': record.status === 'Rejected'
                 }"
               >
                 {{ record.status }}
               </span>
             </div>
          </div>
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
          #{{ record.id }}
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-blue-50">
              <img :src="record.image_url" alt="Product Image" class="h-10 w-10 rounded-lg object-cover" />
            </div>
            <div class="ml-4 min-w-0"> 
              <div class="text-sm font-medium text-gray-900 truncate">{{ record.product_name }}</div> 
              <div class="text-sm text-gray-500">{{ record.product_type }}</div>
            </div>
          </div>
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
          {{ record.location_name }}
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
           <span>
             {{ record.quantity }} <span class="text-gray-500 text-xs">{{ record.unit_name }}</span>
           </span>
           <div class="text-sm text-gray-500">
             Total: ₱{{ record.total_value.toFixed(2) }}
           </div>
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap border-b border-gray-200">
           <span 
             class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
             :class="{
               'bg-yellow-100 text-yellow-800': record.status === 'Pending',
               'bg-green-100 text-green-800': record.status === 'Approved',
               'bg-red-100 text-red-800': record.status === 'Rejected'
             }"
           >
             {{ record.status }}
           </span>
           <div class="text-xs text-gray-500 mt-1">
             {{ new Date(record.created_at).toLocaleDateString() }}
           </div>
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-right text-sm font-medium border-b border-gray-200" @click.stop>
           <div class="flex items-center justify-end space-x-2"> 
             <Button
               v-if="isFPCollector && record.status === 'Pending'"
               @click="editRecord(record.id, $event)"
               aria-label="Edit record"
             >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
             </Button>
             <AlertDialog>
               <AlertDialogTrigger asChild>
                  <Button
                    v-if="isFPCollector && record.status === 'Pending'"
                    aria-label="Delete record"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </Button>
               </AlertDialogTrigger>
               <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Collection Record?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This collection record will be transferred to the recycle bin.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction @click="deleteRecord(record.id)">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
             </AlertDialog>
           </div>
        </td>
        </tr>
    </tbody>
  </table>
</div>

      <!-- Pagination -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <button 
        @click="prevPage" 
        :disabled="currentPage === 1"
        class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        <span class="hidden sm:inline ml-2">Previous</span>
          </button>
          <div 
        class="text-sm text-gray-700"
        :class="{ 'hidden sm:block': true }"
          >
        Page {{ currentPage }} of {{ Math.ceil(filteredCollectionRecords.length / itemsPerPage) || 1 }}
          </div>
          <div 
        class="text-sm font-medium text-gray-700"
        :class="{ 'block sm:hidden': true }"
          >
        {{ currentPage }}/{{ Math.ceil(filteredCollectionRecords.length / itemsPerPage) || 1 }}
          </div>
          <button 
        @click="nextPage" 
        :disabled="collectionRecords.length < itemsPerPage"
        class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
        <span class="hidden sm:inline mr-2">Next</span>
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>