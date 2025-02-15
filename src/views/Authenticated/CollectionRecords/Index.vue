<template>
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header Section -->
      <div class="flex justify-between items-center mb-8">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Forest Products Collection Records</h2>
          <p class="mt-1 text-sm text-black-500">View and manage all collection records</p>
        </div>
        <div class="flex space-x-4">
          <div class="relative">
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
          <button 
            v-if="isFPUAdmin || isForestRanger"
            @click="createCollectionRecord"
            class="px-4 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            +
          </button>
        </div>
      </div>
  
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
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">ID</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">Created At</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">User</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">Forest Product</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">Total Cost</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">Created By</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-if="paginatedRecords.length === 0">
                <td colspan="6" class="px-6 py-12 text-center">
                  <div class="flex flex-col items-center">
                    <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p class="text-black-500 text-sm">No collection records found matching your criteria</p>
                  </div>
                </td>
              </tr>
              <tr v-for="record in paginatedRecords" :key="record.id" class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-black-500">#{{ record.id }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-black-500">{{ record.formatted_created_at }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-black-500">{{ record.user_name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-black-500">{{ record.forest_product.name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-black-500">₱{{ record.total_cost }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-black-500">{{ record.created_by_name }}</td>
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
  
  <script setup>
  import { ref, onMounted, computed, watch } from 'vue'
  import { format } from 'date-fns'
  import { supabase } from '@/lib/supabaseClient'
  import { toast } from 'vue-sonner'
  import { isFPUAdmin, isForestRanger } from '@/router/routeGuard'
  import router from '@/router'
  
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
  
  onMounted(() => {
    fetchCollectionRecords()
  })
  
  watch(searchQuery, () => {
    currentPage.value = 1 // Reset to first page on search query change
    paginateRecords()
  })
  
  watch(currentPage, () => {
    paginateRecords()
  })
  </script>