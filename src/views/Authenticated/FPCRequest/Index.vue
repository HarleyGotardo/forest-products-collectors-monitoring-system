<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { getUser, fetchUserDetails } from '@/router/routeGuard';
import { toast, Toaster } from 'vue-sonner';
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
} from '@/components/ui/alert-dialog';
import Button from '@/components/ui/button/Button.vue';

const router = useRouter();
const requests = ref([]); // Store all requests
const paginatedRequests = ref([]); // Store paginated requests
const error = ref(null);
const currentPage = ref(1);
const itemsPerPage = 7;
const searchQuery = ref('');
const requestToDelete = ref(null);
const loading = ref(true); // Add loading state

// Add filter states
const statusFilter = ref('all'); // 'all', 'approved', 'pending'
const recordedFilter = ref('all'); // 'all', 'recorded', 'unrecorded'

const fetchAllRequests = async () => {
  loading.value = true; // Set loading to true before fetching
  const user = getUser();
  let { data, error: fetchError } = await supabase
    .from('collection_requests')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null); // Fetch only requests with null deleted_at

  if (fetchError) {
    error.value = fetchError.message;
  } else {
    requests.value = data;
    paginateRequests();
  }
  loading.value = false; // Set loading to false after fetching
};

const paginateRequests = () => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  paginatedRequests.value = filteredRequests.value.slice(start, end);
};

const filteredRequests = computed(() => {
  // First filter by search query
  let filtered = requests.value;
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(request =>
      request.id.toString().includes(query)
    );
  }
  
  // Then filter by status
  if (statusFilter.value !== 'all') {
    if (statusFilter.value === 'approved') {
      filtered = filtered.filter(request => request.approved_at !== null);
    } else if (statusFilter.value === 'pending') {
      filtered = filtered.filter(request => request.approved_at === null);
    }
  }
  
  // Then filter by recorded status
  if (recordedFilter.value !== 'all') {
    if (recordedFilter.value === 'recorded') {
      filtered = filtered.filter(request => request.is_recorded === true);
    } else if (recordedFilter.value === 'unrecorded') {
      filtered = filtered.filter(request => request.is_recorded === false);
    }
  }
  
  return filtered;
});

const nextPage = () => {
  if ((currentPage.value * itemsPerPage) < filteredRequests.value.length) {
    currentPage.value++;
    paginateRequests();
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    paginateRequests();
  }
};

const editRequest = (requestId, event) => {
  event.stopPropagation();
  router.push(`/authenticated/collection-requests/${requestId}/edit`);
};

const viewRequest = (requestId) => {
  router.push(`/authenticated/collection-requests/${requestId}`);
};

const confirmDeleteRequest = (requestId) => {
  requestToDelete.value = requestId;
};

const deleteRequest = async () => {
  if (requestToDelete.value !== null) {
    const requestId = requestToDelete.value;
    const currentDate = new Date().toISOString();
    const { error: deleteError } = await supabase
      .from('collection_requests')
      .update({ deleted_at: currentDate })
      .eq('id', requestId);

    if (deleteError) {
      error.value = deleteError.message;
    } else {
      fetchAllRequests();
      toast.success('Request deleted successfully', { duration: 2000 });
    }
    requestToDelete.value = null;
  }
};

onMounted(() => {
  fetchUserDetails();
  fetchAllRequests();
});

// Reset page when filters change
watch([searchQuery, statusFilter, recordedFilter], () => {
  currentPage.value = 1;
  paginateRequests();
});

watch(currentPage, () => {
  paginateRequests();
});
</script>
<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0 mt-2">
      <div class="flex items-center space-x-2">
        <img src="@/assets/request.png" alt="Request Icon" class="w-12 h-12 group-hover:scale-110 transition-transform" />
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Collection Requests</h2>
          <p class="mt-1 text-sm">View and manage all your collection requests</p>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
        <div class="relative flex-1 sm:flex-none">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by ID..."
            class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
          />
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row justify-start items-start sm:items-center gap-3 mb-6">
      <div class="flex items-center">
        <label for="statusFilter" class="mr-2 text-sm font-medium text-gray-700">Status:</label>
        <select
          id="statusFilter"
          v-model="statusFilter"
          class="block w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
        </select>
      </div>
      
      <div class="flex items-center">
        <label for="recordedFilter" class="mr-2 text-sm font-medium text-gray-700">Recording:</label>
        <select
          id="recordedFilter"
          v-model="recordedFilter"
          class="block w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="all">All</option>
          <option value="recorded">Recorded</option>
          <option value="unrecorded">Unrecorded</option>
        </select>
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
                <th scope="col" class="px-6 py-3 h-10"></th>
                <th scope="col" class="px-6 py-3 h-10"></th>
                <th scope="col" class="px-6 py-3 h-10"></th>
                <th scope="col" class="px-6 py-3 h-10"></th>
                <th scope="col" class="px-6 py-3 h-10"></th>
                <th scope="col" class="px-6 py-3 h-10"></th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="n in 5" :key="n">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-10"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-5 bg-gray-200 rounded-full w-20"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-5 bg-gray-200 rounded-full w-20"></div>
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
    </div>

    <!-- Requests Table/Cards -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <!-- Desktop view (table) - hidden on small screens -->
      <div class="hidden sm:block overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-700">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">ID</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Requested At</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden md:table-cell">Collection Date</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Recording</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="filteredRequests.length === 0">
              <td colspan="6" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center">
                  <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p class="text-gray-500 text-sm">No requests found matching your criteria</p>
                </div>
              </td>
            </tr>
            <tr v-for="request in paginatedRequests" 
                :key="request.id" 
                class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                @click="viewRequest(request.id)">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                #{{ request.id }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ new Date(request.requested_at).toLocaleDateString() }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                {{ new Date(request.collection_date).toLocaleDateString() }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="request.approved_at ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                  {{ request.approved_at ? 'Approved' : 'Pending' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="request.is_recorded ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                  {{ request.is_recorded ? 'Recorded' : 'Unrecorded' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" @click.stop>
                <div class="flex items-center justify-end space-x-3">
                  <Button @click="editRequest(request.id, $event)" :disabled="request.approved_at">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Button>
                  <AlertDialog v-if="!request.approved_at">
                    <AlertDialogTrigger>
                      <Button @click="confirmDeleteRequest(request.id)">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Request?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This request will be transferred to the recycle bin.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction @click="deleteRequest">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile view (cards) - only shown on small screens -->
      <div class="sm:hidden px-4 py-4 space-y-4">
        <!-- Empty state when no requests are found -->
        <div v-if="filteredRequests.length === 0" class="bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center">
          <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p class="text-gray-500 text-sm">No requests found matching your criteria</p>
        </div>

        <!-- Card for each request -->
        <div 
          v-for="request in paginatedRequests" 
          :key="request.id"
          class="bg-white rounded-lg shadow border border-gray-100 overflow-hidden"
          @click="viewRequest(request.id)"
        >
          <!-- Card header with ID and status badges -->
          <div class="p-4 border-b border-gray-100 flex items-center justify-between">
            <div class="flex items-center">
              <span class="font-medium text-gray-800 mr-2">#{{ request.id }}</span>
            </div>
            <div class="flex space-x-2">
              <span
                :class="request.approved_at ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              >
                {{ request.approved_at ? 'Approved' : 'Pending' }}
              </span>
              <span
                :class="request.is_recorded ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              >
                {{ request.is_recorded ? 'Recorded' : 'Unrecorded' }}
              </span>
            </div>
          </div>
          
          <!-- Card body with request details -->
          <div class="p-4">
            <div class="space-y-3">
              <div class="flex justify-between">
                <div>
                  <div class="text-xs text-gray-500">Requested At</div>
                  <div class="font-medium text-sm">{{ new Date(request.requested_at).toLocaleDateString() }}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500">Collection Date</div>
                  <div class="font-medium text-sm">{{ new Date(request.collection_date).toLocaleDateString() }}</div>
                </div>
              </div>
              
              <div v-if="request.approved_at">
                <div class="text-xs text-gray-500">Approved At</div>
                <div class="font-medium text-sm">{{ new Date(request.approved_at).toLocaleDateString() }}</div>
              </div>
            </div>
          </div>
          
          <!-- Card actions -->
          <div v-if="!request.approved_at" class="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between" @click.stop>
            <Button class="text-sm" @click="editRequest(request.id, $event)">
              <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button class="text-sm" @click="confirmDeleteRequest(request.id)">
                  <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Request?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This request will be transferred to the recycle bin.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction @click="deleteRequest">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200" v-if="filteredRequests.length > 0">
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
          <span class="text-sm text-gray-700 hidden sm:inline">
            Page {{ currentPage }} of {{ Math.ceil(filteredRequests.length / itemsPerPage) || 1 }}
          </span>
          <span class="text-sm text-gray-700 inline sm:hidden">
            {{ currentPage }}/{{ Math.ceil(filteredRequests.length / itemsPerPage) || 1 }}
          </span>
          <button 
            @click="nextPage" 
            :disabled="currentPage * itemsPerPage >= filteredRequests.length"
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
    <Toaster/>
  </div>
</template>