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

const fetchAllRequests = async () => {
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
};

const paginateRequests = () => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  paginatedRequests.value = filteredRequests.value.slice(start, end);
};

const filteredRequests = computed(() => {
  if (!searchQuery.value) {
    return requests.value;
  }
  const query = searchQuery.value.toLowerCase();
  return requests.value.filter(request =>
    request.id.toString().includes(query) ||
    (request.approved_at ? 'approved' : 'unapproved').includes(query) ||
    request.requested_at.toString().includes(query) ||
    request.collection_date.toString().includes(query)
  );
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

watch(searchQuery, () => {
  currentPage.value = 1; // Reset to first page on search query change
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
      <div class="flex space-x-4">
        <div class="relative flex-1 sm:flex-none">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search requests..."
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

    <!-- Requests Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested At</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collection Date</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="filteredRequests.length === 0">
              <td colspan="5" class="px-6 py-12 text-center">
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
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ new Date(request.collection_date).toLocaleDateString() }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="request.approved_at ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                  {{ request.approved_at ? 'Approved' : 'Pending' }}
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
                          This request will be permanently deleted.
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

      <!-- Pagination -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200" v-if="filteredRequests.length > 0">
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
          <div class="text-sm text-gray-700">
        <span :class="{'hidden sm:inline': true}">
          Page {{ currentPage }} of {{ Math.ceil(filteredRequests.length / itemsPerPage) }}
        </span>
        <span :class="{'sm:hidden': true}">
          {{ currentPage }}/{{ Math.ceil(filteredRequests.length / itemsPerPage) }}
        </span>
          </div>
          <button 
        @click="nextPage" 
        :disabled="paginatedRequests.length < itemsPerPage"
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
    <Toaster/>
  </div>
</template>