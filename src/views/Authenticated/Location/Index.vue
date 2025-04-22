<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import { isFPCollector, isVSUAdmin, isFPUAdmin, isForestRanger, fetchUserDetails } from '@/router/routeGuard';
import { toast, Toaster } from 'vue-sonner'
import Button from '@/components/ui/button/Button.vue';
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

const router = useRouter()
const locations = ref([]) // Store all locations
const paginatedLocations = ref([]) // Store paginated locations
const error = ref(null)
const currentPage = ref(1)
const itemsPerPage = 7
const searchQuery = ref('')
const locationToDelete = ref(null)
const loading = ref(true) // Add loading state

const fetchAllLocations = async () => {
  loading.value = true // Set loading to true when fetching data

  let { data, error: fetchError } = await supabase
    .from('locations')
    .select('*')
    .is('deleted_at', null) // Fetch only locations with null deleted_at

  if (fetchError) {
    error.value = fetchError.message
  } else {
    locations.value = data
    paginateLocations()
  }

  loading.value = false // Set loading to false when data is fetched
}

const paginateLocations = () => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  paginatedLocations.value = filteredLocations.value.slice(start, end)
}

const filteredLocations = computed(() => {
  if (!searchQuery.value) {
    return locations.value
  }
  const query = searchQuery.value.toLowerCase()
  return locations.value.filter(location =>
    location.name.toLowerCase().includes(query) ||
    location.latitude.toString().includes(query) ||
    location.longitude.toString().includes(query)
  )
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

const editLocation = (locationId, event) => {
  event.stopPropagation()
  router.push(`/authenticated/locations/${locationId}/edit`)
}

const viewLocation = (locationId) => {
  router.push(`/authenticated/locations/${locationId}`)
}

const createLocation = () => {
  router.push('/authenticated/locations/create')
}

const confirmDeleteLocation = (locationId) => {
  locationToDelete.value = locationId
}

const deleteLocation = async () => {
  if (locationToDelete.value !== null) {
    const locationId = locationToDelete.value
    const currentDate = new Date().toISOString()
    const { error: deleteError } = await supabase
      .from('locations')
      .update({ deleted_at: currentDate })
      .eq('id', locationId)

    if (deleteError) {
      error.value = deleteError.message
    } else {
      fetchAllLocations()
      toast.success('Location deleted successfully', { duration: 2000 })
    }
    locationToDelete.value = null
  }
}

onMounted(() => {
  fetchUserDetails()
  fetchAllLocations()
})

watch(searchQuery, () => {
  currentPage.value = 1 // Reset to first page on search query change
  paginateLocations()
})

watch(currentPage, () => {
  paginateLocations()
})
</script>

<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header Section -->
    <div
      class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0 mt-2"
    >
      <div class="flex items-center space-x-2">
        <img
          src="@/assets/location2.png"
          alt="Forest Map"
          class="w-12 h-12 group-hover:scale-110 transition-transform"
        />
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-green-900">Locations</h2>
          <p class="mt-1 text-sm text-green-900">View and manage all registered locations</p>
        </div>
      </div>
      <div class="flex space-x-4">
        <div class="relative flex-1 sm:flex-none">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search locations..."
            class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
          />
          <div
            class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
          >
            <svg
              class="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
        <Button class="bg-green-900 text-white hover:bg-green-600" v-if="isFPUAdmin || isForestRanger" @click="createLocation">
          +
        </Button>
      </div>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error"
      class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg"
    >
      <div class="flex">
        <svg
          class="h-5 w-5 text-red-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <p class="ml-3">{{ error }}</p>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="animate-pulse">
      <!-- Desktop Table Skeleton -->
      <div class="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-green-900">
              <tr>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="n in 7" :key="n">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-12"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-blue-50">
                      <div class="h-5 w-5 bg-gray-200 rounded"></div>
                    </div>
                    <div class="ml-4">
                      <div class="h-4 bg-gray-200 rounded w-24"></div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-200 h-6 w-32"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <div class="flex items-center justify-end space-x-3">
                    <div class="h-8 w-8 bg-gray-200 rounded-md"></div>
                    <div class="h-8 w-8 bg-gray-200 rounded-md"></div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile Cards Skeleton -->
      <div class="block md:hidden">
        <div v-for="n in 7" :key="n" class="p-4 border-b border-gray-200">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center">
              <div class="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-blue-50 mr-3">
                <div class="h-4 w-4 bg-gray-200 rounded"></div>
              </div>
              <div class="h-4 bg-gray-200 rounded w-24"></div>
            </div>
            <div class="h-4 bg-gray-200 rounded w-12"></div>
          </div>
          <div class="flex items-center justify-between">
            <div class="inline-flex items-center px-3 py-1 rounded-xl bg-gray-200 h-6 w-32"></div>
            <div class="flex space-x-2">
              <div class="h-8 w-8 bg-gray-200 rounded-md"></div>
              <div class="h-8 w-8 bg-gray-200 rounded-md"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination Skeleton -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="h-4 bg-gray-200 rounded w-48 hidden sm:block"></div>
          <div class="flex items-center gap-2">
            <!-- Mobile Pagination Skeleton -->
            <div class="flex items-center gap-2 sm:hidden">
              <div class="h-12 w-12 bg-gray-200 rounded-lg"></div>
              <div class="h-4 bg-gray-200 rounded w-16"></div>
              <div class="h-12 w-12 bg-gray-200 rounded-lg"></div>
            </div>
            
            <!-- Desktop Pagination Skeleton -->
            <div class="hidden sm:flex items-center gap-1">
              <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
              <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
              <div class="flex items-center gap-1">
                <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
                <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
                <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
              </div>
              <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
              <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

<!-- Responsive Locations Table/Cards -->
<div v-show="!loading" class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
  <!-- Desktop Table View - Hidden on mobile -->
  <div class="hidden md:block overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-green-900">
        <tr>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
            ID
          </th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
            Name
          </th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
            Coordinates
          </th>
          <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
            Action
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr v-if="filteredLocations.length === 0">
          <td colspan="4" class="px-6 py-12 text-center">
            <div class="flex flex-col items-center">
              <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p class="text-gray-500 text-sm">
                No locations found matching your criteria
              </p>
            </div>
          </td>
        </tr>
        <tr v-for="location in paginatedLocations" :key="location.id" class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer" @click="viewLocation(location.id)">
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            #{{ location.id }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
              <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-green-50">
                <svg class="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div class="ml-4">
                <div class="text-sm font-medium text-gray-900">
                  {{ location.name }}
                </div>
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
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" @click.stop>
            <div class="flex items-center justify-end space-x-3">
              <Button
              class="bg-green-900 text-white hover:bg-green-600"
              v-if="isFPUAdmin || isForestRanger" @click="editLocation(location.id, $event)">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger>
                  <Button 
                  class="bg-red-900 text-white hover:bg-red-700"
                  v-if="isFPUAdmin || isForestRanger" @click="confirmDeleteLocation(location.id)">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Location?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This location will be transferred to the recycle bin.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction class="bg-red-900 hover:bg-red-700" @click="deleteLocation">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Mobile Card View - Only visible on mobile -->
  <div class="block md:hidden">
    <div v-if="filteredLocations.length === 0" class="px-4 py-12 text-center">
      <div class="flex flex-col items-center">
        <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <p class="text-gray-500 text-sm">
          No locations found matching your criteria
        </p>
      </div>
    </div>
    <div v-else>
      <div 
        v-for="location in paginatedLocations" 
        :key="location.id" 
        class="p-4 border-b border-gray-200 cursor-pointer"
        @click="viewLocation(location.id)"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center">
            <div class="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-blue-50 mr-3">
              <svg class="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div class="text-sm font-medium text-gray-900">{{ location.name }}</div>
          </div>
          <div class="text-xs text-gray-500">#{{ location.id }}</div>
        </div>
        <div class="flex items-center justify-between">
            <span class="inline-flex items-center px-3 py-1 rounded-xl text-xs font-medium text-gray-500 mr-8">
            <svg class="w-4 h-4 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {{ location.latitude }}, {{ location.longitude }}
            </span>
          <div class="flex space-x-2" @click.stop>
            <Button 
            class="bg-green-900 text-white hover:bg-green-600 p-1"
            v-if="isFPUAdmin || isForestRanger" @click="editLocation(location.id, $event)">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger>
                <Button 
                class="bg-red-900 text-white hover:bg-red-700 p-1"
                v-if="isFPUAdmin || isForestRanger" @click="confirmDeleteLocation(location.id)">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Location?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This location will be transferred to the recycle bin.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction class="bg-red-900 hover:bg-red-700" @click="deleteLocation">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Responsive Pagination -->
  <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="text-sm text-gray-600 hidden sm:block">
        Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentPage * itemsPerPage, filteredLocations.length) }} of {{ filteredLocations.length }} items
      </div>
      <Pagination
        v-slot="{ page }"
        :total="filteredLocations.length"
        :items-per-page="itemsPerPage"
        :sibling-count="1"
        show-edges
        :default-page="currentPage"
        @update:page="(newPage) => {
          currentPage = newPage;
          paginateLocations();
        }"
        class="w-full sm:w-auto"
      >
        <div class="flex items-center justify-center sm:justify-end gap-2">
          <!-- Mobile View -->
          <div class="flex items-center gap-2 sm:hidden">
            <PaginationPrev class="!w-12 !h-12" />
            <div class="text-sm font-medium">
              {{ currentPage }} / {{ Math.ceil(filteredLocations.length / itemsPerPage) }}
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
                    item.value === page ? 'bg-green-900 text-white' : 'hover:bg-gray-100'
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
    <Toaster
  theme="light"
  :toastOptions="{
    class: 'bg-[#ecfdf5] text-gray-800 border border-green-200 rounded-lg shadow-md',
    style: {
      padding: '1rem',
    }
  }"
/>

  </div>
</template>
