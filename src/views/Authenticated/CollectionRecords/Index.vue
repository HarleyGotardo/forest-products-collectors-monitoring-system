<template>
  <div class="max-w-7xl mx-auto p-4 sm:p-6">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0 mt-2">
      <div class="flex items-center space-x-2">
        <img src="@/assets/records2.png" alt="Forest Map" class="w-12 h-12 group-hover:scale-110 transition-transform" />
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Forest Products Collection Records</h2>
          <p class="mt-1 text-sm">View and manage all collection records</p>
        </div>
      </div>
      <div class="flex space-x-4">
        <div class="relative flex-1 sm:flex-none">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search records..."
            class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
          />
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <Button 
          v-if="isFPUAdmin || isForestRanger"
          @click="createCollectionRecord"
        >
          +
        </Button>
      </div>
    </div>

    <!-- Filter Section -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-6">
      <div class="flex items-center space-x-4">
        <!-- Payment Status Filter -->
        <select
          v-model="paymentFilter"
          class="block w-40 px-3 py-2 rounded-lg bg-white border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
        >
          <option value="all">All Records</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg">
      <div class="flex">
        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <p class="ml-3 text-sm">{{ error }}</p>
      </div>
    </div>

    <!-- Collection Records Table -->
    <div class="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-700">
            <tr>
              <th scope="col" class="px-4 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">ID</th>
              <th scope="col" class="hidden sm:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">LOCATION</th> <!-- Updated from FOREST PRODUCT -->
              <th scope="col" class="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Date</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">COLLECTOR</th>
              <th scope="col" class="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Total Cost</th>
              <th scope="col" class="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Processed By</th>
              <th scope="col" class="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Status</th>
              <th scope="col" class="px-4 sm:px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-white">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="paginatedRecords.length === 0">
              <td colspan="7" class="px-4 sm:px-6 py-8 sm:py-12 text-center">
                <div class="flex flex-col items-center">
                  <svg class="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mb-3 sm:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p class="text-sm">No collection records found matching your criteria</p>
                </div>
              </td>
            </tr>
            <tr v-for="record in paginatedRecords" :key="record.id" class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer" @click="viewCollectionRecord(record.id)">
              <td class="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">#{{ record.id }}</td>
              <td class="hidden sm:table-cell px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">{{ record.location_name }}</td>
              <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm">{{ record.formatted_created_at }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">{{ record.user_name }}</td>
              <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm">₱{{ record.total_cost }}</td>
              
              <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm">{{ record.created_by_name }}</td>
              <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                <span
                  :class="[
                    'px-3 py-1 rounded-full text-xs font-medium',
                    record.is_paid 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  ]"
                >
                  {{ record.is_paid ? 'Paid' : 'Unpaid' }}
                </span>
              </td>
              <td class="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium" @click.stop>
                <div class="flex items-center justify-end space-x-3">
                  <!-- Mark as Paid Button or Placeholder -->
                  <span v-if="!record.is_paid" class="inline-block">
                    <AlertDialog>
                      <AlertDialogTrigger>
                        <Button v-if="isVSUAdmin" class="p-1 sm:p-2">
                          <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M5 13l4 4L19 7" />
                          </svg>
                          Paid
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Mark as Paid?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will mark the collection record as paid.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction @click="markAsPaid(record.id)">Mark as Paid</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </span>
                  <span v-else class="inline-block w-[40px]"></span> <!-- Placeholder for alignment -->

                  <!-- Delete Button -->
                  <AlertDialog>
                    <AlertDialogTrigger>
                      <Button v-if="isFPUAdmin || isForestRanger" class="p-1 sm:p-2">
                        <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <AlertDialogAction @click="deleteCollectionRecord(record.id)">Delete</AlertDialogAction>
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
      <div class="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <button 
            @click="prevPage" 
            :disabled="currentPage === 1"
            class="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          <button 
            @click="nextPage" 
            :disabled="paginatedRecords.length < itemsPerPage"
            class="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <svg class="ml-1 sm:ml-2 h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'vue-sonner'
import { isFPUAdmin, isForestRanger, isVSUAdmin } from '@/router/routeGuard'
import router from '@/router'
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

const collectionRecords = ref([])
const currentPage = ref(1)
const itemsPerPage = 8
const error = ref(null)
const searchQuery = ref('')
const paymentFilter = ref('all') // 'all', 'paid', 'unpaid'

const fetchCollectionRecords = async () => {
  try {
    // First, fetch the collection records
    let { data: records, error: fetchError } = await supabase
      .from('collection_records')
      .select(`
        id,
        created_at,
        user_id,
        user:profiles!forest_product_collection_records_user_id_fkey (id, first_name, last_name),
        created_by,
        creator:profiles!collection_records_created_by_fkey (id, first_name, last_name),
        approved_by,
        approver:profiles!collection_records_approved_by_fkey (id, first_name, last_name),
        approved_at,
        deleted_at,
        is_paid,
        location_id,
        location:locations (id, name)
      `)
      .is('deleted_at', null)

    if (fetchError) {
      error.value = fetchError.message
      return
    }

    // For each record, fetch the collection_record_items to calculate the total cost
    const recordsWithItems = await Promise.all(records.map(async (record) => {
      // Fetch items for this collection record
      const { data: items, error: itemsError } = await supabase
        .from('collection_record_items')
        .select(`
          id,
          total_cost,
          fp_and_location_id,
          fp_and_location:fp_and_locations (
            id,
            forest_product:forest_products (id, name)
          )
        `)
        .eq('collection_record_id', record.id)

      if (itemsError) {
        console.error('Error fetching items:', itemsError)
        return null
      }

      // Calculate total cost from all items
      const totalCost = items.reduce((sum, item) => sum + (item.total_cost || 0), 0)

      // Format the record with all necessary data
      return {
        id: record.id,
        created_at: record.created_at,
        formatted_created_at: format(new Date(record.created_at), 'MMMM dd, yyyy'),
        user_name: `${record.user.first_name} ${record.user.last_name}`,
        location_id: record.location_id,
        location_name: record.location ? record.location.name : 'Unknown Location',
        items: items,
        total_cost: totalCost.toFixed(2),
        created_by_name: record.creator ? `${record.creator.first_name} ${record.creator.last_name}` : 'Unknown',
        approved_by_name: record.approver ? `${record.approver.first_name} ${record.approver.last_name}` : null,
        approved_at: record.approved_at ? format(new Date(record.approved_at), 'MMMM dd, yyyy') : null,
        is_paid: record.is_paid
      }
    }))

    // Filter out any null records (in case of errors)
    collectionRecords.value = recordsWithItems.filter(record => record !== null)
    paginateRecords()
  } catch (err) {
    console.error('Error in fetchCollectionRecords:', err)
    error.value = 'Failed to load collection records'
  }
}

const paginateRecords = () => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  paginatedRecords.value = filteredRecords.value.slice(start, end)
}

const filteredRecords = computed(() => {
  let records = collectionRecords.value

  // Apply payment filter
  if (paymentFilter.value !== 'all') {
    records = records.filter(record => 
      paymentFilter.value === 'paid' ? record.is_paid : !record.is_paid
    )
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    records = records.filter(record =>
      record.id.toString().includes(query) ||
      record.user_name.toLowerCase().includes(query) ||
      record.location_name.toLowerCase().includes(query) ||
      record.created_by_name.toLowerCase().includes(query)
    )
  }

  return records
})

const paginatedRecords = ref([])

const totalPages = computed(() => {
  return Math.ceil(filteredRecords.value.length / itemsPerPage)
})

const goToPage = (page) => {
  currentPage.value = page
  paginateRecords()
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    paginateRecords()
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    paginateRecords()
  }
}

const createCollectionRecord = () => {
  router.push('/authenticated/collection-records/create')
}

const markAsPaid = async (recordId) => {
  // Get the current user's ID from the auth session
  const { data: { user } } = await supabase.auth.getUser()
  
  const { error: updateError } = await supabase
    .from('collection_records')
    .update({ 
      is_paid: true,
      approved_by: user.id,
      approved_at: new Date().toISOString()
    })
    .eq('id', recordId)

  if (updateError) {
    error.value = updateError.message
  } else {
    fetchCollectionRecords()
    toast.success('Collection record marked as paid successfully', { duration: 2000 })
  }
}

const deleteCollectionRecord = async (recordId) => {
  const currentDate = new Date().toISOString()
  const { error: deleteError } = await supabase
    .from('collection_records')
    .update({ deleted_at: currentDate })
    .eq('id', recordId)

  if (deleteError) {
    error.value = deleteError.message
  } else {
    fetchCollectionRecords()
    toast.success('Collection record deleted successfully', { duration: 2000 })
  }
}

const viewCollectionRecord = (recordId) => {
  router.push({ name: 'CollectionRecordsView', params: { id: recordId } })
}

onMounted(() => {
  fetchCollectionRecords()
})

watch(searchQuery, () => {
  currentPage.value = 1 
  paginateRecords()
})

watch(currentPage, () => {
  paginateRecords()
})

watch(paymentFilter, () => {
  currentPage.value = 1
  paginateRecords()
})
</script>