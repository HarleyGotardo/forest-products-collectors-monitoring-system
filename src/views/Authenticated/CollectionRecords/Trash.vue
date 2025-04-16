<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'vue-sonner';
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

const collectionRecords = ref([]);
const currentPage = ref(1);
const itemsPerPage = 8;
const error = ref(null);
const searchQuery = ref('');
const loading = ref(true); // Added loading state
import { useRouter } from 'vue-router';
const router = useRouter();

const fetchDeletedCollectionRecords = async () => {
  try {
    loading.value = true; // Set loading to true when fetching data

    // Fetch deleted collection records
    let { data: records, error: fetchError } = await supabase
      .from('collection_records')
      .select(`
        id,
        created_at,
        user:profiles!forest_product_collection_records_user_id_fkey (id, first_name, last_name),
        created_by:profiles!collection_records_created_by_fkey (id, first_name, last_name),
        is_paid,
        approved_by:profiles!collection_records_approved_by_fkey (id, first_name, last_name),
        approved_at,
        deleted_at
      `)
      .not('deleted_at', 'is', null); // Only include records with non-null deleted_at

    if (fetchError) {
      error.value = fetchError.message;
      loading.value = false; // Set loading to false if there's an error
      return;
    }

    // Fetch items for each record and calculate total cost
    const recordsWithItems = await Promise.all(
      records.map(async (record) => {
        const { data: items, error: itemsError } = await supabase
          .from('collection_record_items')
          .select(`
            id,
            total_cost,
            fp_and_location:fp_and_locations (
              id,
              forest_product:forest_products (id, name)
            )
          `)
          .eq('collection_record_id', record.id);

        if (itemsError) {
          console.error('Error fetching items:', itemsError);
          return {
            ...record,
            items: [],
            total_cost: 0,
          };
        }

        const totalCost = items.reduce((sum, item) => sum + (item.total_cost || 0), 0);
        const productNames = items
          .map((item) => item.fp_and_location?.forest_product?.name)
          .filter(Boolean)
          .join(', ');

        return {
          id: record.id,
          created_at: record.created_at,
          formatted_created_at: format(new Date(record.created_at), 'MMMM dd, yyyy'),
          user_name: record.user ? `${record.user.first_name} ${record.user.last_name}` : 'Unknown',
          created_by_name: record.created_by ? `${record.created_by.first_name} ${record.created_by.last_name}` : 'Unknown',
          location_name: record.location?.name || 'Unknown',
          is_paid: record.is_paid,
          approved_at: record.approved_at ? format(new Date(record.approved_at), 'MMMM dd, yyyy') : 'Not approved',
          approved_by_name: record.approved_by ? `${record.approved_by.first_name} ${record.approved_by.last_name}` : 'Not approved',
          total_cost: totalCost,
          products: productNames,
          items: items,
        };
      })
    );

    collectionRecords.value = recordsWithItems;
    paginateRecords();
    loading.value = false; // Set loading to false after data is loaded
  } catch (err) {
    console.error('Error fetching deleted collection records:', err);
    error.value = 'Failed to load deleted collection records';
    loading.value = false; // Set loading to false if there's an error
  }
};

const paginateRecords = () => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  paginatedRecords.value = filteredRecords.value.slice(start, end);
};

const filteredRecords = computed(() => {
  if (!searchQuery.value) {
    return collectionRecords.value;
  }
  const query = searchQuery.value.toLowerCase();
  return collectionRecords.value.filter(
    (record) =>
      record.user_name.toLowerCase().includes(query) ||
      record.products.toLowerCase().includes(query) ||
      record.created_by_name.toLowerCase().includes(query) ||
      record.location_name.toLowerCase().includes(query)
  );
});

const paginatedRecords = ref([]);

const totalPages = computed(() => {
  return Math.ceil(filteredRecords.value.length / itemsPerPage);
});

const viewCollectionRecord = (recordId) => {
  router.push({ name: 'CollectionRecordsView', params: { id: recordId } });
};

const goToPage = (page) => {
  currentPage.value = page;
  paginateRecords();
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    paginateRecords();
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    paginateRecords();
  }
};

const restoreRecord = async (recordId) => {
  const { error: updateError } = await supabase
    .from('collection_records')
    .update({ deleted_at: null })
    .eq('id', recordId);

  if (updateError) {
    toast.error(updateError.message, { duration: 3000 });
  } else {
    toast.success('Collection record restored successfully', { duration: 3000 });
    fetchDeletedCollectionRecords();
  }
};

const deleteRecordPermanently = async (recordId) => {
  const { error: deleteError } = await supabase
    .from('collection_records')
    .delete()
    .eq('id', recordId);

  if (deleteError) {
    toast.error(deleteError.message, { duration: 3000 });
  } else {
    toast.success('Collection record deleted permanently', { duration: 3000 });
    fetchDeletedCollectionRecords();
  }
};

onMounted(() => {
  fetchDeletedCollectionRecords();
});

watch(searchQuery, () => {
  currentPage.value = 1; // Reset to first page on search query change
  paginateRecords();
});

watch(currentPage, () => {
  paginateRecords();
});
</script>
<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header Section -->
    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 space-y-4 md:space-y-0"
    >
      <div class="flex items-center space-x-2">
        <img
          src="@/assets/trash-bin.png"
          alt="Trash Bin"
          class="w-12 h-12 group-hover:scale-110 transition-transform"
        />
        <div>
          <h2 class="text-2xl font-bold text-gray-900">
            Deleted Collection Records
          </h2>
          <p class="mt-1 text-sm text-gray-500">
            View and manage all collection records in the recycle bin
          </p>
        </div>
      </div>
      <div class="flex w-full md:w-auto space-x-4">
        <div class="relative w-full md:w-auto">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search records..."
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
        class="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-200">
              <tr>
                <th scope="col" class="px-4 sm:px-6 py-3 h-10"></th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-4 sm:px-6 py-3 h-10"
                ></th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3 h-10"
                ></th>
                <th scope="col" class="px-6 py-3 h-10"></th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3 h-10"
                ></th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3 h-10"
                ></th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3 h-10"
                ></th>
                <th scope="col" class="px-4 sm:px-6 py-3 h-10"></th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="n in 5" :key="n">
                <td class="px-4 sm:px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-12"></div>
                </td>
                <td
                  class="hidden sm:table-cell px-4 sm:px-6 py-4 whitespace-nowrap"
                >
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                </td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-20"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-16"></div>
                </td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-16"></div>
                </td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-20"></div>
                </td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded-full w-16"></div>
                </td>
                <td class="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
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

    <!-- Collection Records Table -->
    <div
      v-else
      class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <!-- Desktop view (table) - hidden on small screens -->
<div class="hidden sm:block overflow-x-auto">
  <table class="min-w-full divide-y divide-gray-200">
    <thead class="bg-gray-700">
      <tr>
        <th
          scope="col"
          class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
        >
          ID
        </th>
        <th
          scope="col"
          class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
        >
          Created At
        </th>
        <th
          scope="col"
          class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
        >
          User
        </th>
        <th
          scope="col"
          class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
        >
          Location
        </th>
        <th
          scope="col"
          class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
        >
          Total Cost
        </th>
        <th
          scope="col"
          class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
        >
          Payment Status
        </th>
        <th
          scope="col"
          class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
        >
          Created By
        </th>
        <th
          scope="col"
          class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider"
        >
          Actions
        </th>
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-gray-200">
      <tr v-if="paginatedRecords.length === 0">
        <td colspan="8" class="px-6 py-12 text-center">
          <div class="flex flex-col items-center">
            <img
              src="@/assets/page-not-found.png"
              alt="No Records Found"
              class="w-24 h-24 mb-4"
            />
            <p class="text-gray-500 text-sm">
              No collection records found in the recycle bin
            </p>
          </div>
        </td>
      </tr>
      <tr
        v-for="record in paginatedRecords"
        :key="record.id"
        class="hover:bg-gray-50 transition-colors duration-200"
      >
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          #{{ record.id }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {{ record.formatted_created_at }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {{ record.user_name }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {{ record.location_name }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ₱{{ record.total_cost.toFixed(2) }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span
            :class="`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              record.is_paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`"
          >
            {{ record.is_paid ? 'Paid' : 'Unpaid' }}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {{ record.created_by_name }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div class="flex items-center justify-end space-x-3">
            <!-- Restore Button -->
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div @click.stop>
                  <Button>
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
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
                  <AlertDialogTitle>Restore Collection Record?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This collection record will be restored.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction @click="restoreRecord(record.id)"
                    >Restore</AlertDialogAction
                  >
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <!-- Delete Button -->
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div @click.stop>
                  <Button>
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </Button>
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Collection Record Permanently?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction @click="deleteRecordPermanently(record.id)"
                    >Delete</AlertDialogAction
                  >
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
  <!-- Empty state when no records are found -->
  <div v-if="paginatedRecords.length === 0" class="bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center">
    <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
    <p class="text-gray-500 text-sm">No collection records found in the recycle bin</p>
  </div>

  <!-- Card for each record -->
  <div 
    v-for="record in paginatedRecords" 
    :key="record.id"
    class="bg-white rounded-lg shadow border border-gray-100 overflow-hidden"
  >
    <!-- Card header with ID and payment status badges -->
    <div class="p-4 border-b border-gray-100 flex items-center justify-between">
      <div class="flex items-center">
        <span class="font-medium text-gray-800 mr-2">#{{ record.id }}</span>
      </div>
      <div>
        <span
          :class="`px-2 py-0.5 rounded-full text-xs font-medium ${
            record.is_paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`"
        >
          {{ record.is_paid ? 'Paid' : 'Unpaid' }}
        </span>
      </div>
    </div>
    
    <!-- Card body with record details -->
    <div class="p-4">
      <div class="space-y-3">
        <div class="flex justify-between">
          <div>
            <div class="text-xs text-gray-500">Created At</div>
            <div class="font-medium text-sm">{{ record.formatted_created_at }}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500">Total Cost</div>
            <div class="font-medium text-sm">₱{{ record.total_cost.toFixed(2) }}</div>
          </div>
        </div>
        
        <div>
          <div class="text-xs text-gray-500">User</div>
          <div class="font-medium text-sm">{{ record.user_name }}</div>
        </div>
        
        <div>
          <div class="text-xs text-gray-500">Location</div>
          <div class="font-medium text-sm">{{ record.location_name }}</div>
        </div>
        
        <div>
          <div class="text-xs text-gray-500">Created By</div>
          <div class="font-medium text-sm">{{ record.created_by_name }}</div>
        </div>
      </div>
    </div>
    
    <!-- Card actions -->
    <div class="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between">
      <!-- Restore Button -->
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button class="text-sm">
            <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M9 5L4 10m0 0l5 5m-5-5h7a5 5 0 1 1 0 10" />
            </svg>
            Restore
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Collection Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This collection record will be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction @click="restoreRecord(record.id)">Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
            
      <!-- Delete Button -->
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button class="text-sm">
            <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection Record Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction @click="deleteRecordPermanently(record.id)">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </div>
</div>

      <!-- Pagination -->
      <div
        class="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200"
        v-if="filteredRecords.length > 0"
      >
        <div class="flex items-center justify-between">
          <button
            @click="prevPage"
            :disabled="currentPage === 1"
            class="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              class="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5"
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
            Previous
          </button>
          <div class="text-sm sm:text-base text-gray-700">
            <span v-if="totalPages >= 1">
              <span class="sm:hidden"
                >{{ currentPage }} / {{ totalPages }}</span
              >
              <span class="hidden sm:inline"
                >Page {{ currentPage }} of {{ totalPages }}</span
              >
            </span>
          </div>
          <button
            @click="nextPage"
            :disabled="paginatedRecords.length < itemsPerPage"
            class="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <svg
              class="ml-1 sm:ml-2 h-4 w-4 sm:h-5 sm:w-5"
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
  </div>
</template>
