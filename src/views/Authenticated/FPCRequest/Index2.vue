<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { toast, Toaster } from 'vue-sonner';
import Button from '@/components/ui/button/Button.vue';
import { getUser } from '@/router/routeGuard';
import AlertDialog from '@/components/ui/alert-dialog/AlertDialog.vue';
import AlertDialogTrigger from '@/components/ui/alert-dialog/AlertDialogTrigger.vue';
import AlertDialogContent from '@/components/ui/alert-dialog/AlertDialogContent.vue';
import AlertDialogTitle from '@/components/ui/alert-dialog/AlertDialogTitle.vue';
import AlertDialogDescription from '@/components/ui/alert-dialog/AlertDialogDescription.vue';
import AlertDialogAction from '@/components/ui/alert-dialog/AlertDialogAction.vue';
import AlertDialogCancel from '@/components/ui/alert-dialog/AlertDialogCancel.vue';
import AlertDialogHeader from '@/components/ui/alert-dialog/AlertDialogHeader.vue';
import AlertDialogFooter from '@/components/ui/alert-dialog/AlertDialogFooter.vue';
import { isFPCollector, isVSUAdmin, isFPUAdmin, isForestRanger } from '@/router/routeGuard';

const router = useRouter();
const requests = ref([]); // Store all requests
const paginatedRequests = ref([]); // Store paginated requests
const error = ref(null);
const currentPage = ref(1);
const itemsPerPage = 7;
const searchQuery = ref('');
const showDialog = ref(false);
const requestToApprove = ref(null);
const loading = ref(true); // Add loading state

// Add filter states
const statusFilter = ref('all'); // 'all', 'approved', 'pending'
const recordedFilter = ref('all'); // 'all', 'recorded', 'unrecorded'

const fetchAllRequests = async () => {
  loading.value = true; // Set loading to true before fetching
  let { data, error: fetchError } = await supabase
    .from('collection_requests')
    .select(`
      *,
      profiles!collection_requests_user_id_fkey (first_name, last_name)
    `)
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
      request.id.toString().includes(query) ||
      (request.approved_at ? 'approved' : 'pending').includes(query) ||
      `${request.profiles.first_name} ${request.profiles.last_name}`.toLowerCase().includes(query)
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

const viewRequest = (requestId) => {
  router.push(`/authenticated/collection-requests/${requestId}`);
};

const confirmApproveRequest = (requestId) => {
  requestToApprove.value = requestId;
  showDialog.value = true;
};

const approveRequest = async () => {
  const user = getUser();
  const { error: approveError } = await supabase
    .from('collection_requests')
    .update({
      approved_by: user.id,
      approved_at: new Date().toISOString()
    })
    .eq('id', requestToApprove.value);

  if (approveError) {
    error.value = approveError.message;
  } else {
    fetchAllRequests();
    toast.success('Request approved successfully', { duration: 2000 });
  }
  showDialog.value = false;
};

// Reset page when filters change
watch([searchQuery, statusFilter, recordedFilter], () => {
  currentPage.value = 1;
  paginateRequests();
});

watch(currentPage, () => {
  paginateRequests();
});

onMounted(() => {
  fetchAllRequests();
});
</script>

<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header Section -->
    <div
      class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0 mt-2"
    >
      <div class="flex items-center space-x-2">
        <img
          src="@/assets/request.png"
          alt="Request Icon"
          class="w-12 h-12 group-hover:scale-110 transition-transform"
        />
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-gray-900">
            All Collection Requests
          </h2>
          <p class="mt-1 text-sm">View and manage all collection requests</p>
        </div>
      </div>
      <div
        class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto"
      >
        <div class="relative flex-1 sm:flex-none">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by ID..."
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
      </div>
    </div>

    <!-- Filters -->
    <div
      class="flex flex-col sm:flex-row justify-start items-start sm:items-center gap-3 mb-6"
    >
      <div class="flex items-center">
        <label for="statusFilter" class="mr-2 text-sm font-medium text-gray-700"
          >Status:</label
        >
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
        <label
          for="recordedFilter"
          class="mr-2 text-sm font-medium text-gray-700"
          >Recording:</label
        >
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
      <div
        class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden"
      >
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
                  <div class="h-4 bg-gray-200 rounded w-32"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-5 bg-gray-200 rounded-full w-20"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-5 bg-gray-200 rounded-full w-20"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <div class="flex items-center justify-end">
                    <div class="h-8 bg-gray-200 rounded w-24"></div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Requests Table -->
    <div
      v-else
      class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <div class="w-full overflow-x-auto sm:overflow-visible">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-700">
            <tr>
              <th
                scope="col"
                class="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
              >
                ID
              </th>
              <th
                scope="col"
                class="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
              >
                Requested At
              </th>
              <th
                scope="col"
                class="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden md:table-cell"
              >
                Collection Date
              </th>
              <th
                scope="col"
                class="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden sm:table-cell"
              >
                Requested By
              </th>
              <th
                scope="col"
                class="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                class="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-white uppercase tracking-wider hidden sm:table-cell"
              >
                Recording
              </th>
              <th
                v-if="isFPUAdmin || isForestRanger || isVSUAdmin"
                scope="col"
                class="px-2 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-white uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="filteredRequests.length === 0">
              <td colspan="7" class="px-2 sm:px-6 py-6 sm:py-12 text-center">
                <div class="flex flex-col items-center">
                  <svg
                    class="w-8 h-8 sm:w-12 sm:h-12 text-gray-300 mb-2 sm:mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  <p class="text-gray-500 text-xs sm:text-sm">
                    No requests found matching your criteria
                  </p>
                </div>
              </td>
            </tr>
            <tr
              v-for="request in paginatedRequests"
              :key="request.id"
              class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
              @click="viewRequest(request.id)"
            >
              <td
                class="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500"
              >
                #{{ request.id }}
              </td>
              <td
                class="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500"
              >
                {{ new Date(request.requested_at).toLocaleDateString() }}
              </td>
              <td
                class="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 hidden md:table-cell"
              >
                {{ new Date(request.collection_date).toLocaleDateString() }}
              </td>
              <td
                class="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 hidden sm:table-cell"
              >
                {{ request.profiles.first_name }}
                {{ request.profiles.last_name }}
              </td>
              <td class="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                <span
                  :class="request.approved_at ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'"
                  class="inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-xs font-medium"
                >
                  <template v-if="request.approved_at">
                    <svg
                      class="w-4 h-4 sm:hidden"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span class="hidden sm:inline">Approved</span>
                  </template>
                  <template v-else>
                    <svg
                      class="w-4 h-4 sm:hidden"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                      />
                    </svg>
                    <span class="hidden sm:inline">Pending</span>
                  </template>
                </span>
              </td>
              <td
                class="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap hidden sm:table-cell"
              >
                <span
                  :class="request.is_recorded ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'"
                  class="inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-xs font-medium"
                >
                  {{ request.is_recorded ? 'Recorded' : 'Unrecorded' }}
                </span>
              </td>
              <td
                class="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium"
                @click.stop
              >
                <div
                  class="flex items-center justify-end space-x-1 sm:space-x-3"
                >
                  <template v-if="request.approved_at">
                    <span
                      class="text-xs sm:text-sm text-gray-500 hidden sm:inline"
                      >Approved at
                      {{ new Date(request.approved_at).toLocaleDateString() }}</span
                    >
                  </template>
                  <template v-else>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          v-if="isFPUAdmin || isForestRanger"
                          class="text-xs px-2 py-1 sm:text-sm sm:px-3 sm:py-2"
                          @click="confirmApproveRequest(request.id)"
                        >
                          <svg
                            class="w-3 h-3 sm:w-5 sm:h-5 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span class="hidden sm:inline">Approve</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Approve Request</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to approve this request?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel @click="showDialog = false"
                            >Cancel</AlertDialogCancel
                          >
                          <AlertDialogAction @click="approveRequest"
                            >Approve</AlertDialogAction
                          >
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </template>
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
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span class="hidden sm:inline ml-2">Previous</span>
          </button>
          <span
            :class="{'text-sm text-gray-700': true, 'hidden sm:inline': true, 'inline sm:hidden': false}"
          >
            Page {{ currentPage }} of
            {{ Math.ceil(filteredRequests.length / itemsPerPage) || 1 }}
          </span>
          <span
            :class="{'text-sm text-gray-700': true, 'inline sm:hidden': true, 'hidden sm:inline': false}"
          >
            {{ currentPage
            }}/{{ Math.ceil(filteredRequests.length / itemsPerPage) || 1 }}
          </span>
          <button
            @click="nextPage"
            :disabled="currentPage * itemsPerPage >= filteredRequests.length"
            class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span class="hidden sm:inline mr-2">Next</span>
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <Toaster />
  </div>
</template>
