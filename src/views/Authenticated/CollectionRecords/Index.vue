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
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-4 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">ID</th>
              <th scope="col" class="hidden sm:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">FOREST PRODUCT</th> <!-- Hidden on mobile -->
              <th scope="col" class="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">COLLECTOR</th>
              <th scope="col" class="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Total Cost</th>
              <th scope="col" class="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Processed By</th>
              <th scope="col" class="px-4 sm:px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Actions</th>
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
              <td class="hidden sm:table-cell px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">{{ record.forest_product.name }}</td>
              <!-- Hidden on mobile -->
              <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm">{{ record.formatted_created_at }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">{{ record.user_name }}</td>
              <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm">₱{{ record.total_cost }}</td>
              <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm">{{ record.created_by_name }}</td>
              <td class="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium" @click.stop>
                <div class="flex items-center justify-end space-x-3">
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
import { isFPUAdmin, isForestRanger } from '@/router/routeGuard'
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

const fetchCollectionRecords = async () => {
  let { data: records, error: fetchError } = await supabase
    .from('collection_records')
    .select(`
      id,
      created_at,
      user:profiles!forest_product_collection_records_user_id_fkey ( id, first_name, last_name ),
      forest_product:forest_products ( id, name ),
      total_cost,
      created_by:profiles!collection_records_created_by_fkey ( id, first_name, last_name ),
      deleted_at
    `)
    .is('deleted_at', null) // Exclude records with non-null deleted_at

  if (fetchError) {
    error.value = fetchError.message
  } else {
    collectionRecords.value = records.map(record => ({
      id: record.id,
      created_at: record.created_at,
      formatted_created_at: format(new Date(record.created_at), 'MMMM dd, yyyy'),
      user_name: `${record.user.first_name} ${record.user.last_name}`,
      forest_product: record.forest_product,
      total_cost: record.total_cost,
      created_by_name: `${record.created_by.first_name} ${record.created_by.last_name}`
    }))
    paginateRecords()
  }
}

const paginateRecords = () => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  paginatedRecords.value = filteredRecords.value.slice(start, end)
}

const filteredRecords = computed(() => {
  if (!searchQuery.value) {
    return collectionRecords.value
  }
  const query = searchQuery.value.toLowerCase()
  return collectionRecords.value.filter(record =>
    record.id.toString().includes(query) ||
    record.user_name.toLowerCase().includes(query) ||
    record.forest_product.name.toLowerCase().includes(query) ||
    record.created_by_name.toLowerCase().includes(query)
  )
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
</script>