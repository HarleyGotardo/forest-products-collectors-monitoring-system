<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'
import { user, isFPCollector, isVSUAdmin, isFPUAdmin, isForestRanger, fetchUserDetails, getUser } from '@/router/routeGuard'
import Button from '@/components/ui/button/Button.vue'
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

const loading = ref(true);
const router = useRouter()
const allCollectionRecords = ref([]) // Store all collection records
const collectionRecords = ref([]) // Store paginated collection records
const error = ref(null)
const currentPage = ref(1)
const itemsPerPage = 8
const searchQuery = ref('')
const selectedStatus = ref('') // New ref for selected status
const showNotes = ref(true); // Add showNotes state
const subscription = ref(null); // Add subscription ref

// Add multiple subscription channels
const insertChannel = ref(null);
const updateChannel = ref(null);
const deleteChannel = ref(null);
const softDeleteChannel = ref(null);

const createCollectionRecord = () => {
  router.push('/authenticated/collection-records/create')
}

const fetchAllCollectionRecords = async () => {
  loading.value = true; // Start loading
  const currentUser = getUser();
  
  try {
    // First, fetch the collection records
    let { data: records, error: recordsError } = await supabase
      .from('collection_records')
      .select(`
        id,
        created_at,
        user_id,
        created_by,
        deleted_at,
        is_paid,
        approved_by,
        approved_at,
        purpose,
        collection_request_id
      `)
      .eq('user_id', currentUser.id) // Filter by authenticated user's ID
      .is('deleted_at', null) // Exclude records with non-null deleted_at
      .order('id', { ascending: false }); // Sort by ID descending

    if (recordsError) throw recordsError;
    
    // For each record, get its items with related forest products and locations
    const recordsWithDetails = await Promise.all(records.map(async (record) => {
      // Get items for this collection record
      const { data: items, error: itemsError } = await supabase
        .from('collection_record_items')
        .select(`
          id,
          purchased_quantity,
          total_cost,
          fp_and_location:fp_and_locations (
            id,
            quantity,
            forest_product:forest_products (
              id,
              name,
              image_url,
              type,
              price_based_on_measurement_unit,
              measurement_unit:measurement_units (
                id,
                unit_name
              )
            ),
            location:locations (
              id,
              name
            )
          )
        `)
        .eq('collection_record_id', record.id);
      
      if (itemsError) {
        console.error('Error fetching items for record', record.id, itemsError);
        return null;
      }
      
      // Format record with first item's details (if multiple items, you may need to adjust)
      if (items && items.length > 0) {
        const item = items[0]; // Use the first item
        const fp = item.fp_and_location.forest_product;
        const location = item.fp_and_location.location;
        
        return {
          ...record,
          product_name: fp?.name || 'N/A',
          product_type: fp?.type || 'N/A',
          product_price: fp?.price_based_on_measurement_unit || 0,
          unit_name: fp?.measurement_unit?.unit_name || 'N/A',
          location_name: location?.name || 'N/A',
          image_url: fp?.image_url ? JSON.parse(fp.image_url).data.publicUrl : null,
          quantity: item.purchased_quantity,
          total_value: item.total_cost || 0,
          status: record.is_paid ? 'Paid' : 'Unpaid' // Updated status logic
        };
      }
      
      return {
        ...record,
        product_name: 'N/A',
        product_type: 'N/A',
        product_price: 0,
        unit_name: 'N/A',
        location_name: 'N/A',
        image_url: null,
        quantity: 0,
        total_value: 0,
        status: record.is_paid ? 'Paid' : 'Unpaid' // Updated status logic
      };
    }));
    
    // Filter out any null records
    allCollectionRecords.value = recordsWithDetails.filter(record => record !== null);
    paginateCollectionRecords();
    
  } catch (error) {
    console.error('Error fetching collection records:', error);
    error.value = error.message || 'Failed to fetch collection records';
  } finally {
    loading.value = false;
  }
}

const paginateCollectionRecords = () => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  collectionRecords.value = filteredCollectionRecords.value.slice(start, end)
}

const filteredCollectionRecords = computed(() => {
  let records = allCollectionRecords.value;

  if (selectedStatus.value) {
    records = records.filter(record => record.status === selectedStatus.value);
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    records = records.filter(record =>
      record.id.toString().includes(query) ||
      (record.product_name && record.product_name.toLowerCase().includes(query)) ||
      (record.location_name && record.location_name.toLowerCase().includes(query))
    );
  }

  return records;
});

const nextPage = () => {
  if ((currentPage.value * itemsPerPage) < filteredCollectionRecords.value.length) {
    currentPage.value++
    paginateCollectionRecords()
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    paginateCollectionRecords()
  }
}

const viewRecord = (recordId) => {
  router.push(`/authenticated/collection-records/${recordId}`)
}

// Subscribe to real-time updates with multiple channels 
const subscribeToChanges = () => {
  const currentUser = getUser();
  if (!currentUser) return;

  // Main channel for all changes to the user's records
  subscription.value = supabase
    .channel('collection-records-all-changes')
    .on(
      'postgres_changes',
      {
        event: '*',  // Listen to ALL events (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'collection_records',
        filter: `user_id=eq.${currentUser.id}`
      },
      handleRealtimeChanges
    )
    .subscribe((status) => {
      console.log('Realtime subscription status:', status);
    });
    
  // Dedicated channel specifically for DELETE events (to catch revert actions)
  deleteChannel.value = supabase
    .channel('collection-records-delete-events')
    .on(
      'postgres_changes',
      {
        event: 'DELETE',  // Only listen to DELETE events
        schema: 'public',
        table: 'collection_records',
        filter: `user_id=eq.${currentUser.id}`
      },
      handleDeleteEvent
    )
    .subscribe((status) => {
      console.log('Delete event subscription status:', status);
    });
};

// Unified handler for all realtime changes
const handleRealtimeChanges = async (payload) => {
  console.log('Collection record change detected:', payload);
  const { eventType, new: newRecord, old: oldRecord } = payload;

  // HANDLE DELETE EVENTS (permanent deletion)
  if (eventType === 'DELETE') {
    console.log('Record permanently deleted:', oldRecord.id);
    // Remove from local records
    const index = allCollectionRecords.value.findIndex(r => r.id === oldRecord.id);
    if (index !== -1) {
      allCollectionRecords.value.splice(index, 1);
      paginateCollectionRecords();
      
      // Show prominent toast notification for permanent deletion
      toast.error('Collection Record Deleted', {
        duration: 8000,
        description: `Your collection record #${oldRecord.id} has been permanently deleted.`,
        position: 'top-center',
        important: true,
        style: { 
          border: '2px solid red',
          fontWeight: 'bold'
        }
      });
    } else {
      // If we couldn't find the record in our array, refresh the data anyway
      console.log('Deleted record not found in local array, refreshing data');
      await fetchAllCollectionRecords();
      
      // Still show the notification even if record wasn't in our array
      toast.error('Collection Record Deleted', {
        duration: 8000,
        description: `One of your collection records has been deleted.`,
        position: 'top-center',
        important: true,
        style: { 
          border: '2px solid red',
          fontWeight: 'bold'
        }
      });
    }
    return;
  }

  // HANDLE INSERT EVENTS (new records)
  if (eventType === 'INSERT') {
    console.log('New record created:', newRecord.id);
    // Refresh all records to get the complete data structure
    await fetchAllCollectionRecords();
    
    // Show toast notification for new record
    toast.success('Collection Record Created', {
      duration: 5000,
      description: `A new collection record #${newRecord.id} has been created.`,
      action: {
        label: 'View',
        onClick: () => viewRecord(newRecord.id)
      }
    });
    return;
  }

  // HANDLE UPDATE EVENTS (including soft deletes, restoration, and payment status changes)
  if (eventType === 'UPDATE') {
    console.log('Record updated:', newRecord.id);
    
    // Check for payment status change to paid
    if (!oldRecord.is_paid && newRecord.is_paid) {
      // Update the local record
      const index = allCollectionRecords.value.findIndex(r => r.id === newRecord.id);
      if (index !== -1) {
        allCollectionRecords.value[index].status = 'Paid';
        paginateCollectionRecords();
        
        // Show toast notification for payment
        toast.success('Collection Record Paid', {
          duration: 5000,
          description: `Your collection record #${newRecord.id} has been marked as paid. You can now proceed with your collection.`,
          action: {
            label: 'View',
            onClick: () => viewRecord(newRecord.id)
          }
        });
      } else {
        // If we can't find the record locally, refresh all records
        await fetchAllCollectionRecords();
      }
      return;
    }
    
    // Check for payment status change from paid to unpaid
    if (oldRecord.is_paid && !newRecord.is_paid) {
      // Update the local record
      const index = allCollectionRecords.value.findIndex(r => r.id === newRecord.id);
      if (index !== -1) {
        allCollectionRecords.value[index].status = 'Unpaid';
        paginateCollectionRecords();
        
        // Show toast notification for unpaid status
        toast.warning('Payment Status Changed', {
          duration: 5000,
          description: `Your collection record #${newRecord.id} has been marked as unpaid. Please contact the Forest Protection Unit for assistance.`,
          action: {
            label: 'View',
            onClick: () => viewRecord(newRecord.id)
          }
        });
      } else {
        // If we can't find the record locally, refresh all records
        await fetchAllCollectionRecords();
      }
      return;
    }
    
    // Check for soft delete (deleted_at changed from null to a value)
    if (oldRecord.deleted_at === null && newRecord.deleted_at !== null) {
      // Remove the soft-deleted record from our local array
      const index = allCollectionRecords.value.findIndex(r => r.id === newRecord.id);
      if (index !== -1) {
        allCollectionRecords.value.splice(index, 1);
        paginateCollectionRecords();
        
        // Show toast notification for soft deletion
        toast.warning('Collection Record Removed', {
          duration: 5000,
          description: `Your collection record #${newRecord.id} has been moved to trash.`
        });
      }
      return;
    }
    
    // Check for record restoration (deleted_at changed from a value to null)
    if (oldRecord.deleted_at !== null && newRecord.deleted_at === null) {
      // Refresh all records to include the restored record
      await fetchAllCollectionRecords();
      
      // Show toast notification for restoration
      toast.success('Collection Record Restored', {
        duration: 5000,
        description: `Your collection record #${newRecord.id} has been restored from trash.`
      });
      return;
    }
    
    // Generic update notification for other types of updates
    toast.info('Collection Record Updated', {
      duration: 5000,
      description: `Your collection record #${newRecord.id} has been updated.`,
      action: {
        label: 'Refresh',
        onClick: () => fetchAllCollectionRecords()
      }
    });
    
    // Refresh records to ensure we have the latest data
    await fetchAllCollectionRecords();
  }
};

// Special handler specifically for DELETE events (revert actions)
const handleDeleteEvent = async (payload) => {
  console.log('DELETE EVENT DETECTED:', payload);
  const { old: oldRecord } = payload;
  
  // Remove from local records
  const index = allCollectionRecords.value.findIndex(r => r.id === oldRecord.id);
  if (index !== -1) {
    allCollectionRecords.value.splice(index, 1);
    paginateCollectionRecords();
  }
  
  // Show highly visible notification for delete action
  toast.error('Collection Record Deleted', {
    duration: 10000,
    description: `Your collection record #${oldRecord.id} has been permanently deleted.`,
    position: 'top-center',
    important: true,
    style: { 
      border: '3px solid red',
      fontWeight: 'bold',
      backgroundColor: '#FEE2E2'
    }
  });
  
  // Force refresh collection records
  await fetchAllCollectionRecords();
};

// Unsubscribe when component is unmounted
onUnmounted(() => {
  if (subscription.value) {
    subscription.value.unsubscribe();
    console.log('Unsubscribed from realtime updates');
  }
  if (deleteChannel.value) {
    deleteChannel.value.unsubscribe();
    console.log('Unsubscribed from delete events');
  }
});

onMounted(() => {
  fetchUserDetails()
  fetchAllCollectionRecords()
  subscribeToChanges() // Add subscription when component mounts
})

watch(searchQuery, () => {
  currentPage.value = 1 // Reset to first page on search query change
  paginateCollectionRecords()
})

watch(currentPage, () => {
  paginateCollectionRecords()
})

watch(selectedStatus, () => {
  currentPage.value = 1 // Reset to first page on status change
  paginateCollectionRecords()
})
</script>

<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0 mt-2">
      <div class="flex items-center space-x-2">
      <img src="@/assets/records2.png" alt="Collection Records" class="w-12 h-12 group-hover:scale-110 transition-transform" />
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-green-900">My Collection Records</h2>
        <p class="mt-1 text-sm text-green-900">View and manage your forest product collection records</p>
      </div>
      </div>
      <div class="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
      <div class="relative flex-1 sm:flex-none">
        <input
        v-model="searchQuery"
        type="text"
        placeholder="ID, product, location"
        class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
        />
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        </div>
      </div>
      <div class="flex space-x-4">
        <select
        v-model="selectedStatus"
        class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
        >
        <option value="">All Status</option>
        <option value="Unpaid">Unpaid</option>
        <option value="Paid">Paid</option>
        </select>
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

    <!-- Info Notes -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900">Important Information</h3>
        <button
          @click="showNotes = !showNotes"
          class="flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <span>{{ showNotes ? 'Hide Notes' : 'Show Notes' }}</span>
          <svg
            class="w-4 h-4 ml-1 transform transition-transform"
            :class="{ 'rotate-180': showNotes }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div v-if="showNotes" class="space-y-4">
        <!-- Payment Note -->
        <div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-blue-700">
                <span class="font-medium">Payment Process:</span> For unpaid records, please proceed to the VSU Registrar's Office to pay the required fees and obtain your collection permit. After payment, return to the Forest Protection Unit to complete your collection.
              </p>
            </div>
          </div>
        </div>

        <!-- Collection Process Note -->
        <div class="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-green-700">
                <span class="font-medium">Collection Process:</span> Once you have paid and obtained your collection permit from the VSU Registrar's Office, return to the Forest Protection Unit to proceed with your collection. Make sure to bring all required documentation. Remember the ID number of the collection record.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="animate-pulse">
      <!-- Desktop Table Skeleton -->
      <div class="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-green-900">
              <tr>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="n in 8" :key="n">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-12"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-lg"></div>
                    <div class="ml-4">
                      <div class="h-4 bg-gray-200 rounded w-24"></div>
                      <div class="h-3 bg-gray-200 rounded w-16 mt-1"></div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-32"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-16"></div>
                  <div class="h-3 bg-gray-200 rounded w-24 mt-1"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded-full w-16"></div>
                  <div class="h-3 bg-gray-200 rounded w-24 mt-1"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <div class="flex items-center justify-end space-x-3">
                    <div class="h-8 w-8 bg-gray-200 rounded-md"></div>
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
      <div class="sm:hidden px-4 py-4 space-y-4">
        <div v-for="n in 8" :key="n" class="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
          <!-- Card header skeleton -->
          <div class="p-4 border-b border-gray-100 flex items-start space-x-4">
            <div class="flex-shrink-0 h-12 w-12 bg-gray-200 rounded-lg"></div>
            <div class="flex-grow min-w-0">
              <div class="h-4 bg-gray-200 rounded w-24 mb-1"></div>
              <div class="h-3 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
          
          <!-- Card body skeleton -->
          <div class="p-4">
            <div class="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <div class="h-3 bg-gray-200 rounded w-16 mb-1"></div>
                <div class="h-4 bg-gray-200 rounded w-24"></div>
              </div>
              <div>
                <div class="h-3 bg-gray-200 rounded w-20 mb-1"></div>
                <div class="h-4 bg-gray-200 rounded w-24"></div>
              </div>
              <div>
                <div class="h-3 bg-gray-200 rounded w-24 mb-1"></div>
                <div class="h-4 bg-gray-200 rounded w-32"></div>
              </div>
              <div>
                <div class="h-3 bg-gray-200 rounded w-16 mb-1"></div>
                <div class="h-4 bg-gray-200 rounded-full w-16"></div>
              </div>
            </div>
          </div>
          
          <!-- Card actions skeleton -->
          <div class="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between">
            <div class="h-8 bg-gray-200 rounded w-24"></div>
            <div class="h-8 bg-gray-200 rounded w-24"></div>
            <div class="h-8 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </div>

      <!-- Pagination Skeleton -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="h-4 bg-gray-200 rounded w-48 hidden sm:block"></div>
          <div class="flex items-center gap-2">
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

    <!-- Collection Records Table -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
  <table class="min-w-full border-collapse sm:border-separate sm:border-spacing-0 cursor-pointer">
    <thead class="bg-green-900 hidden sm:table-header-group">
      <tr>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">ID</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Product</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Location</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Quantity</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-gray-600">Status</th>
      </tr>
    </thead>

    <tbody class="bg-white">

      <tr v-if="filteredCollectionRecords.length === 0" class="block sm:table-row">
        <td colspan="5" class="px-6 py-12 text-center block sm:table-cell">
          <div class="flex flex-col items-center">
            <img
              src="@/assets/page-not-found.png"
              alt="No Records Found"
              class="w-24 h-24 mb-4"
            />
            <p class="text-gray-900 text-sm">No collection records found matching your criteria</p>
          </div>
        </td>
      </tr>

      <tr
        v-for="record in collectionRecords"
        :key="record.id"
        class="block mb-4 rounded-lg shadow-md border border-gray-200 bg-white sm:table-row sm:mb-0 sm:rounded-none sm:shadow-none sm:border-0 sm:border-b sm:border-gray-200 sm:hover:bg-gray-50 transition-colors duration-150"
        @click="viewRecord(record.id, $event)"
      >

        <td class="block p-4 sm:hidden" colspan="5">
          <div class="flex items-start space-x-4 mb-3">
             <div class="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-lg bg-blue-50">
               <img :src="record.image_url" alt="Product Image" class="h-12 w-12 rounded-lg object-cover" />
             </div>
             <div class="flex-grow min-w-0"> 
                <h3 class="text-base font-semibold text-gray-900 mb-0.5 truncate">{{ record.product_name }}</h3> 
                <p class="text-xs text-gray-500">ID: #{{ record.id }}</p>
             </div>
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t border-gray-100 pt-3">
             <div>
               <span class="block text-xs text-gray-500 font-medium">Location</span>
               <p class="text-gray-800">{{ record.location_name }}</p>
             </div>
             <div>
               <span class="block text-xs text-gray-500 font-medium">Quantity</span>
               <p class="text-gray-800">
                 {{ record.quantity }}
                 <span class="text-gray-500 text-xs">{{ record.unit_name }}</span>
               </p>
             </div>
             <div>
               <span class="block text-xs text-gray-500 font-medium">Collection Date</span>
               <p class="text-gray-800">{{ new Date(record.created_at).toLocaleDateString() }}</p>
             </div>
             <div>
               <span class="block text-xs text-gray-500 font-medium">Status</span>
               <span 
                 class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                 :class="{
                   'bg-yellow-100 text-yellow-800': record.status === 'Unpaid',
                   'bg-green-100 text-green-800': record.status === 'Paid'
                 }"
               >
                 {{ record.status }}
               </span>
             </div>
          </div>
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
          #{{ record.id }}
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-blue-50">
                <img v-if="record.image_url != null" :src="record.image_url" alt="Product Image" class="h-10 w-10 rounded-lg object-cover" />
                <img v-else src="@/assets/forest-product.png" alt="Default Image" class="h-10 w-10 rounded-lg object-cover" />
            </div>
            <div class="ml-4 min-w-0"> 
              <div class="text-sm font-medium text-gray-900 truncate">{{ record.product_name }}</div> 
              <div class="text-sm text-gray-500">{{ record.product_type }}</div>
            </div>
          </div>
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
          {{ record.location_name }}
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
           <span>
             {{ record.quantity }} <span class="text-gray-500 text-xs">{{ record.unit_name }}</span>
           </span>
           <div class="text-sm text-gray-500">
             Total: ₱{{ record.total_value.toFixed(2) }}
           </div>
        </td>
        <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap border-b border-gray-200">
           <span 
             class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
             :class="{
               'bg-yellow-100 text-yellow-800': record.status === 'Unpaid',
               'bg-green-100 text-green-800': record.status === 'Paid'
             }"
           >
             {{ record.status }}
           </span>
           <div class="text-xs text-gray-500 mt-1">
             {{ new Date(record.created_at).toLocaleDateString() }}
           </div>
        </td>
        </tr>
    </tbody>
  </table>
</div>

      <!-- Pagination -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="text-sm text-gray-600 hidden sm:block">
            Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentPage * itemsPerPage, filteredCollectionRecords.length) }} of {{ filteredCollectionRecords.length }} items
          </div>
          <Pagination
            v-slot="{ page }"
            :total="filteredCollectionRecords.length"
            :items-per-page="itemsPerPage"
            :sibling-count="1"
            show-edges
            :default-page="currentPage"
            @update:page="(newPage) => {
              currentPage = newPage;
              paginateCollectionRecords();
            }"
            class="w-full sm:w-auto"
          >
            <div class="flex items-center justify-center sm:justify-end gap-2">
              <!-- Mobile View -->
              <div class="flex items-center gap-2 sm:hidden">
                <PaginationPrev class="!w-12 !h-12" />
                <div class="text-sm font-medium">
                  {{ currentPage }} / {{ Math.ceil(filteredCollectionRecords.length / itemsPerPage) }}
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
  </div>
</template>