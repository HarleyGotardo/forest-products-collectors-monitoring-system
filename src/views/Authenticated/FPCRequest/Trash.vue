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
const requests = ref([]); // Store all deleted requests
const paginatedRequests = ref([]); // Store paginated requests
const error = ref(null);
const currentPage = ref(1);
const itemsPerPage = 7;
const searchQuery = ref('');
const loading = ref(true);

const fetchDeletedRequests = async () => {
  try {
    loading.value = true;
    const user = getUser();
    let { data, error: fetchError } = await supabase
      .from('collection_requests')
      .select('*')
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null); // Fetch only requests with non-null deleted_at

    if (fetchError) {
      error.value = fetchError.message;
      loading.value = false;
      return;
    }

    requests.value = data;
    paginateRequests();
    loading.value = false;
  } catch (err) {
    console.error('Error fetching deleted requests:', err);
    error.value = 'Failed to load deleted requests';
    loading.value = false;
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

const totalPages = computed(() => {
  return Math.ceil(filteredRequests.value.length / itemsPerPage);
});

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
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

const viewRequest = (requestId) => {
  router.push(`/authenticated/collection-requests/${requestId}`);
};

const restoreRequest = async (requestId) => {
  try {
    const { error: restoreError } = await supabase
      .from('collection_requests')
      .update({ deleted_at: null })
      .eq('id', requestId);

    if (restoreError) {
      toast.error(restoreError.message, { duration: 3000 });
    } else {
      toast.success('Request restored successfully', { duration: 2000 });
      fetchDeletedRequests();
    }
  } catch (err) {
    console.error('Error restoring request:', err);
    toast.error('Failed to restore request', { duration: 3000 });
  }
};

const deletePermanently = async (requestId) => {
  try {
    const { error: deleteError } = await supabase
      .from('collection_requests')
      .delete()
      .eq('id', requestId);

    if (deleteError) {
      toast.error(deleteError.message, { duration: 3000 });
    } else {
      toast.success('Request permanently deleted', { duration: 2000 });
      fetchDeletedRequests();
    }
  } catch (err) {
    console.error('Error deleting request permanently:', err);
    toast.error('Failed to delete request permanently', { duration: 3000 });
  }
};

onMounted(() => {
  fetchUserDetails();
  fetchDeletedRequests();
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
        <img src="@/assets/trash-bin.png" alt="Trash Bin" class="w-12 h-12 group-hover:scale-110 transition-transform" />
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Trashed Collection Requests</h2>
          <p class="mt-1 text-sm">View and manage your deleted collection requests</p>
        </div>
      </div>
      <div class="flex space-x-4">
        <div class="relative flex-1 sm:flex-none">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search deleted requests..."
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

    <!-- Loading Skeleton -->
    <div v-if="loading" class="animate-pulse">
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th class="px-6 py-6 bg-gray-200 h-12"></th>
                <th class="px-6 py-6 bg-gray-200 h-12"></th>
                <th class="px-6 py-6 bg-gray-200 h-12"></th>
                <th class="px-6 py-6 bg-gray-200 h-12"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="n in 7" :key="n">
                <td class="px-6 py-8 bg-gray-100 h-12"></td>
                <td class="px-6 py-8 bg-gray-100 h-12"></td>
                <td class="px-6 py-8 bg-gray-100 h-12"></td>
                <td class="px-6 py-8 bg-gray-100 h-12"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Requests Table -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested At</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collection Date</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deleted At</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="paginatedRequests.length === 0">
              <td colspan="5" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center">
                  <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <p class="text-gray-500 text-sm">No deleted requests found</p>
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
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ new Date(request.deleted_at).toLocaleDateString() }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" @click.stop>
                <div class="flex items-center justify-end space-x-3">
                  <!-- Restore Button -->
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <div>
                        <Button>
                          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path 
                              stroke-linecap="round" 
                              stroke-linejoin="round" 
                              stroke-width="2" 
                              d="M9 5L4 10m0 0l5 5m-5-5h7a5 5 0 1 1 0 10" 
                            />
                          </svg>
                        </Button>
                      </div>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restore Request?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This request will be moved back to your active requests.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction @click="restoreRequest(request.id)">Restore</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  
                  <!-- Delete Permanently Button -->
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <div>
                        <Button>
                          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Permanently?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This request will be permanently removed from our servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction @click="deletePermanently(request.id)" class="bg-red-600 hover:bg-red-700">Delete Permanently</AlertDialogAction>
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
              Page {{ currentPage }} of {{ totalPages }}
            </span>
            <span :class="{'sm:hidden': true}">
              {{ currentPage }}/{{ totalPages }}
            </span>
          </div>
          <button 
            @click="nextPage" 
            :disabled="currentPage >= totalPages"
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