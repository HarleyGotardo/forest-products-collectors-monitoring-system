<template>
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header Section -->
      <div class="flex justify-between items-center mb-8">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Deleted Locations</h2>
          <p class="mt-1 text-sm text-gray-500">View and manage all deleted locations</p>
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
  
      <!-- Locations Table -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coordinates</th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-if="filteredLocations.length === 0">
                <td colspan="4" class="px-6 py-12 text-center">
                  <div class="flex flex-col items-center">
                    <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p class="text-gray-500 text-sm">No deleted locations found</p>
                  </div>
                </td>
              </tr>
              <tr v-for="location in paginatedLocations" 
                  :key="location.id" 
                  class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                  @click="viewLocation(location.id)">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  #{{ location.id }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-blue-50">
                      <svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900">{{ location.name }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {{ location.latitude }}, {{ location.longitude }}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div class="flex items-center justify-end space-x-3">
                    <button 
                      @click.stop="restoreLocation(location.id)" 
                      class="p-1 rounded-lg hover:bg-green-50 transition-colors duration-200 text-green-600 hover:text-green-700">
                      <img src="@/assets/restore.png" alt="Restore" class="w-5 h-5" />
                    </button>
                    <button 
                      @click.stop="deletePermanently(location.id)"
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
              :disabled="paginatedLocations.length < itemsPerPage"
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
  import { useRouter } from 'vue-router'
  import { supabase } from '@/lib/supabaseClient'
  import Swal from 'sweetalert2'
  
  const router = useRouter()
  const locations = ref([]) // Store all deleted locations
  const paginatedLocations = ref([]) // Store paginated locations
  const error = ref(null)
  const currentPage = ref(1)
  const itemsPerPage = 7
  
  const fetchDeletedLocations = async () => {
    let { data, error: fetchError } = await supabase
      .from('location')
      .select('*')
      .not('deleted_at', 'is', null) // Fetch only locations with non-null deleted_at
  
    if (fetchError) {
      error.value = fetchError.message
    } else {
      locations.value = data
      paginateLocations()
    }
  }
  
  const paginateLocations = () => {
    const start = (currentPage.value - 1) * itemsPerPage
    const end = start + itemsPerPage
    paginatedLocations.value = filteredLocations.value.slice(start, end)
  }
  
  const filteredLocations = computed(() => {
    return locations.value
  })
  
  const nextPage = () => {
    if ((currentPage.value * itemsPerPage) < filteredLocations.value.length) {
      currentPage.value++
      paginateLocations()
    }
  }
  
  const prevPage = () => {
    if (currentPage.value > 1) {
      currentPage.value--
      paginateLocations()
    }
  }
  
  const viewLocation = (locationId) => {
    router.push(`/authenticated/locations/${locationId}`)
  }
  
  const restoreLocation = async (locationId) => {
    const result = await Swal.fire({
      title: 'Restore Location?',
      text: "This location will be restored.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Restore'
    })
  
    if (result.isConfirmed) {
      const { error: restoreError } = await supabase
        .from('location')
        .update({ deleted_at: null })
        .eq('id', locationId)
  
      if (restoreError) {
        error.value = restoreError.message
      } else {
        fetchDeletedLocations()
        Swal.fire(
          'Restored!',
          'The location has been restored.',
          'success'
        )
      }
    }
  }
  
  const deletePermanently = async (locationId) => {
    const result = await Swal.fire({
      title: 'Delete Location Permanently?',
      text: "This action cannot be undone.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Delete Permanently'
    })
  
    if (result.isConfirmed) {
      const { error: deleteError } = await supabase
        .from('location')
        .delete()
        .eq('id', locationId)
  
      if (deleteError) {
        error.value = deleteError.message
      } else {
        fetchDeletedLocations()
        Swal.fire(
          'Deleted!',
          'The location has been permanently deleted.',
          'success'
        )
      }
    }
  }
  
  onMounted(() => {
    fetchDeletedLocations()
  })
  
  watch(currentPage, () => {
    paginateLocations()
  })
  </script>