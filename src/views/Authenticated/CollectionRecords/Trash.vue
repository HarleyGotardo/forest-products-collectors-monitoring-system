<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import Swal from 'sweetalert2'
import { toast } from 'vue-sonner'

const collectionRecords = ref([])
const currentPage = ref(1)
const itemsPerPage = 8
const error = ref(null)
const searchQuery = ref('')

const fetchDeletedCollectionRecords = async () => {
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
    .not('deleted_at', 'is', null) // Only include records with non-null deleted_at

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

const restoreRecord = async (recordId) => {
  const result = await Swal.fire({
    title: 'Restore Collection Record?',
    text: "This collection record will be restored.",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Restore'
  })

  if (result.isConfirmed) {
    const { error: updateError } = await supabase
      .from('collection_records')
      .update({ deleted_at: null })
      .eq('id', recordId)

    if (updateError) {
      toast.error(updateError.message, { duration: 3000 })
    } else {
      toast.success('Collection record restored successfully', { duration: 3000 })
      fetchDeletedCollectionRecords()
    }
  }
}

const deleteRecordPermanently = async (recordId) => {
  const result = await Swal.fire({
    title: 'Delete Collection Record Permanently?',
    text: "This action cannot be undone.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Delete'
  })

  if (result.isConfirmed) {
    const { error: deleteError } = await supabase
      .from('collection_records')
      .delete()
      .eq('id', recordId)

    if (deleteError) {
      toast.error(deleteError.message, { duration: 3000 })
    } else {
      toast.success('Collection record deleted permanently', { duration: 3000 })
      fetchDeletedCollectionRecords()
    }
  }
}

onMounted(() => {
  fetchDeletedCollectionRecords()
})

watch(searchQuery, () => {
  currentPage.value = 1 // Reset to first page on search query change
  paginateRecords()
})

watch(currentPage, () => {
  paginateRecords()
})
</script>

<template>
  <div class="max-w-7xl mx-auto p-6">
    <h2 class="text-2xl font-bold mb-4 ml-14 mt-1">Forest Products Collection Records - Recycle Bin</h2>

    <!-- Error Alert -->
    <div v-if="error" class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg">
      <div class="flex">
        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <p class="ml-3">{{ error }}</p>
      </div>
    </div>

    <!-- Collection Records Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Forest Product</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="paginatedRecords.length === 0">
              <td colspan="7" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center">
                  <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p class="text-gray-500 text-sm">No collection records found in the recycle bin</p>
                </div>
              </td>
            </tr>
            <tr v-for="record in paginatedRecords" :key="record.id" class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{{ record.id }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ record.formatted_created_at }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ record.user_name }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ record.forest_product.name }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₱{{ record.total_cost }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ record.created_by_name }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div class="flex items-center justify-end space-x-3">
                    <button 
                      @click.stop="restoreRecord(record.id)" 
                      class="p-1 rounded-lg hover:bg-green-50 transition-colors duration-200 text-green-600 hover:text-green-700">
                      <img src="@/assets/restore.png" alt="Restore" class="w-5 h-5" />
                    </button>
                    <button 
                      @click.stop="deleteRecordPermanently(record.id)"
                      class="p-1 rounded-lg hover:bg-red-50 transition-colors duration-200 text-red-600 hover:text-red-700"
                    >
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
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
            <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          <button 
            @click="nextPage" 
            :disabled="paginatedRecords.length < itemsPerPage"
            class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <svg class="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>