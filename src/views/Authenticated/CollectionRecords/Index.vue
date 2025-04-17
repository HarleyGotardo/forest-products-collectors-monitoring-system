<script setup>
import { createApp } from 'vue';
import PermitTemplate from './PermitTemplate.vue';
import { ref, onMounted, computed, watch } from 'vue'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'vue-sonner'
import { isFPUAdmin, isForestRanger, isVSUAdmin } from '@/router/routeGuard'
import router from '@/router'
import Button from '@/components/ui/button/Button.vue'
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
import html2pdf from 'html2pdf.js';

const collectionRecords = ref([])
const currentPage = ref(1)
const itemsPerPage = 8
const error = ref(null)
const searchQuery = ref('')
const paymentFilter = ref('all') // 'all', 'paid', 'unpaid'
const loading = ref(true);

const fetchCollectionRecords = async () => {
  loading.value = true; // Start loading
  try {
    // First, fetch the collection records
    let { data: records, error: fetchError } = await supabase
      .from('collection_records')
      .select(`
        id,
        created_at,
        user_id,
        user:profiles!forest_product_collection_records_user_id_fkey (id, first_name, last_name),
        created_by,
        creator:profiles!collection_records_created_by_fkey (id, first_name, last_name),
        approved_by,
        approver:profiles!collection_records_approved_by_fkey (id, first_name, last_name),
        approved_at,
        deleted_at,
        is_paid,
        collection_request_id,
        purpose
      `)
      .is('deleted_at', null)

    if (fetchError) {
      error.value = fetchError.message
      return
    }

    // For each record, fetch the collection_record_items to calculate the total cost
    const recordsWithItems = await Promise.all(records.map(async (record) => {
      // Fetch items for this collection record
      const { data: items, error: itemsError } = await supabase
        .from('collection_record_items')
        .select(`
          id,
          total_cost,
          fp_and_location_id,
          fp_and_location:fp_and_locations (
            id,
            forest_product:forest_products (id, name)
          )
        `)
        .eq('collection_record_id', record.id)

      if (itemsError) {
        console.error('Error fetching items:', itemsError)
        return null
      }

      // Calculate total cost from all items
      const totalCost = items.reduce((sum, item) => sum + (item.total_cost || 0), 0)

      // Format the record with all necessary data
      return {
        id: record.id,
        created_at: record.created_at,
        formatted_created_at: format(new Date(record.created_at), 'MMMM dd, yyyy'),
        user_name: `${record.user.first_name} ${record.user.last_name}`,
        location_id: record.location_id,
        location_name: record.location ? record.location.name : 'Unknown Location',
        items: items,
        total_cost: totalCost.toFixed(2),
        created_by_name: record.creator ? `${record.creator.first_name} ${record.creator.last_name}` : 'Unknown',
        approved_by_name: record.approver ? `${record.approver.first_name} ${record.approver.last_name}` : null,
        approved_at: record.approved_at ? format(new Date(record.approved_at), 'MMMM dd, yyyy') : null,
        is_paid: record.is_paid,
        collection_request_id: record.collection_request_id,
        purpose: record.purpose,
      }
    }))

    // Filter out any null records (in case of errors)
    collectionRecords.value = recordsWithItems.filter(record => record !== null)
    paginateRecords()
  } catch (err) {
    console.error('Error in fetchCollectionRecords:', err)
    error.value = 'Failed to load collection records'
  } finally {
    loading.value = false; // End loading
  }
}

const paginateRecords = () => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  paginatedRecords.value = filteredRecords.value.slice(start, end)
}

const filteredRecords = computed(() => {
  let records = collectionRecords.value

  // Apply payment filter
  if (paymentFilter.value !== 'all') {
    records = records.filter(record =>
      paymentFilter.value === 'paid' ? record.is_paid : !record.is_paid
    )
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    records = records.filter(record =>
      record.id.toString().includes(query) ||
      record.user_name.toLowerCase().includes(query) ||
      record.location_name.toLowerCase().includes(query) ||
      record.created_by_name.toLowerCase().includes(query)
    )
  }

  return records
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

// Update the markAsPaid function to include quantity deduction
const markAsPaid = async (recordId) => {
  try {
    // Get the current user's ID from the auth session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User authentication error:', userError);
      error.value = 'Failed to authenticate user';
      return;
    }

    // Fetch the collection record items to get quantities for deduction
    const { data: recordItems, error: itemsError } = await supabase
      .from('collection_record_items')
      .select(`
        id,
        purchased_quantity,
        fp_and_location_id,
        deducted_quantity,
        quantity_during_purchase
      `)
      .eq('collection_record_id', recordId);

    if (itemsError) {
      console.error('Error fetching record items:', itemsError);
      error.value = 'Failed to fetch record items';
      return;
    }

    // Update the record as paid
    const { error: updateError } = await supabase
      .from('collection_records')
      .update({
        is_paid: true,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', recordId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      error.value = 'Failed to update collection record';
      return;
    }

    // Deduct the quantities from fp_and_locations
    for (const item of recordItems) {
      // Get current quantity from fp_and_locations
      const { data: fpLocationData, error: fpLocationError } = await supabase
        .from('fp_and_locations')
        .select('quantity')
        .eq('id', item.fp_and_location_id)
        .single();

      if (fpLocationError) {
        console.error('Error fetching fp_and_location:', fpLocationError);
        continue; // Skip this item but continue with others
      }

      // Calculate new quantity
      const newQuantity = fpLocationData.quantity - item.deducted_quantity;

      // Update the fp_and_locations table
      const { error: updateFpLocationError } = await supabase
        .from('fp_and_locations')
        .update({ quantity: newQuantity })
        .eq('id', item.fp_and_location_id);

      if (updateFpLocationError) {
        console.error('Error updating fp_and_location quantity:', updateFpLocationError);
        // Continue with other items despite this error
      }
    }

    // Rest of the function for generating permit remains the same
    // Fetch the record details for the permit
    const record = collectionRecords.value.find((r) => r.id === recordId);

    if (!record) {
      console.error('Record not found in collectionRecords:', recordId);
      error.value = 'Record not found';
      return;
    }

    // Fetch the collection record items
    const { data: items, error: permitItemsError } = await supabase
      .from('collection_record_items')
      .select(`
        id,
        purchased_quantity,
        total_cost,
        fp_and_location:fp_and_locations (
          location:locations (name),
          forest_product:forest_products (name)
        )
      `)
      .eq('collection_record_id', recordId);

    if (permitItemsError) {
      console.error('Error fetching collection record items:', permitItemsError);
      error.value = 'Failed to fetch collection record items';
      return;
    }

    // Format the list of forest products
    const forestProductsList = items.map((item) => {
      const productName = item.fp_and_location.forest_product.name;
      const locationName = item.fp_and_location.location.name;
      const quantity = item.purchased_quantity;
      const totalCost = item.total_cost.toFixed(2);
      return `${productName} (Location: ${locationName}, Quantity: ${quantity}, Total: ₱${totalCost})`;
    }).join('; ');

    // Check if any product is firewood
    const firewoodNote = items.some((item) =>
      item.fp_and_location.forest_product.name.toLowerCase() === 'firewood'
    )
      ? 'Firewood Permits are intended for family consumption but not for sale. It is limited to dead branches up to 10cm diameter, 1 meter length.'
      : '';

    // Prepare permit data
    const permitData = {
      permitNo: record.id,
      dateIssued: new Date(record.created_at).toLocaleDateString(),
      name: record.user_name,
      permission: `collect the forest products: ${forestProductsList}`,
      purpose: record.purpose,
      collectionRequestId: record.collection_request_id,
      expiryDate: new Date(new Date(record.created_at).setFullYear(new Date(record.created_at).getFullYear() + 1)).toLocaleDateString(),
      chargesPaid: record.total_cost,
      issuedBy: record.created_by_name,
      inspectedBy: record.created_by_name,
      note: firewoodNote,
    };

    // Generate the PDF
    const permitElement = document.createElement('div');
    document.body.appendChild(permitElement);

    const app = createApp(PermitTemplate, { permitData });
    app.mount(permitElement);

    const options = {
      margin: [0.3, 0.3, 0.3, 0.3],
      filename: `Forest_Conservation_Permit_${recordId}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    };

    await html2pdf().from(permitElement).set(options).save();

    app.unmount();
    document.body.removeChild(permitElement);

    // Show success message
    toast.success('Collection record marked as paid successfully. Check your downloads to see the permit.', { duration: 2000 });

    // Refresh the records
    fetchCollectionRecords();
  } catch (err) {
    console.error('Error marking as paid:', err);
    error.value = 'Failed to mark as paid';
  }
};

const deleteCollectionRecord = async (recordId) => {
  const currentDate = new Date().toISOString()
  const { error: deleteError } = await supabase
    .from('collection_records')
    .update({ deleted_at: currentDate })
    .eq('id', recordId)

  if (deleteError) {
    error.value = deleteError.message
  } else {
    fetchCollectionRecords()
    toast.success('Collection record deleted successfully', { duration: 2000 })
  }
}

const viewCollectionRecord = (recordId) => {
  router.push({ name: 'CollectionRecordsView', params: { id: recordId } })
}

onMounted(() => {
  fetchCollectionRecords()
})

watch(searchQuery, () => {
  currentPage.value = 1
  paginateRecords()
})

watch(currentPage, () => {
  paginateRecords()
})

watch(paymentFilter, () => {
  currentPage.value = 1
  paginateRecords()
})
</script>


<template>
  <div class="max-w-7xl mx-auto p-4 sm:p-6">
    <!-- Header Section -->
    <div
      class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0 mt-2"
    >
      <div class="flex items-center space-x-2">
        <img
          src="@/assets/records2.png"
          alt="Forest Map"
          class="w-10 h-10 sm:w-12 sm:h-12 group-hover:scale-110 transition-transform"
        />
        <div>
          <h2 class="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
            Forest Products Collection Records
          </h2>
          <p class="mt-1 text-xs sm:text-sm">
            View and manage all collection records
          </p>
        </div>
      </div>
      <div class="flex space-x-4">
        <div class="relative flex-1 sm:flex-none">
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
        <Button
          v-if="isFPUAdmin || isForestRanger"
          @click="createCollectionRecord"
          class="min-w-10"
        >
          +
        </Button>
      </div>
    </div>

    <!-- Filter Section -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-6">
      <div class="flex items-center space-x-4">
        <!-- Payment Status Filter -->
        <select
          v-model="paymentFilter"
          class="block w-full sm:w-40 px-3 py-2 rounded-lg bg-white border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
        >
          <option value="all">All Records</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error"
      class="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg"
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
        <p class="ml-3 text-sm">{{ error }}</p>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="animate-pulse">
      <!-- Desktop Table Skeleton -->
      <div class="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-700">
              <tr>
                <th class="px-6 py-3 h-12"></th>
                <th class="px-6 py-3 h-12"></th>
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
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-32"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-16"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded-full w-16"></div>
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
          <div class="p-4 border-b border-gray-100 flex items-center justify-between">
            <div class="h-4 bg-gray-200 rounded w-16"></div>
            <div class="h-4 bg-gray-200 rounded-full w-16"></div>
          </div>
          
          <!-- Card body skeleton -->
          <div class="p-4">
            <div class="space-y-3">
              <div class="flex justify-between">
                <div>
                  <div class="h-3 bg-gray-200 rounded w-16 mb-1"></div>
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                </div>
                <div>
                  <div class="h-3 bg-gray-200 rounded w-20 mb-1"></div>
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
              
              <div>
                <div class="h-3 bg-gray-200 rounded w-20 mb-1"></div>
                <div class="h-4 bg-gray-200 rounded w-32"></div>
              </div>
              
              <div>
                <div class="h-3 bg-gray-200 rounded w-24 mb-1"></div>
                <div class="h-4 bg-gray-200 rounded w-32"></div>
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
    <div
      v-else
      class="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 overflow-hidden"
    >
<!-- Desktop view (table) - hidden on small screens -->
<div class="hidden sm:block overflow-x-auto">
  <table class="min-w-full divide-y divide-gray-200">
    <thead class="bg-gray-700">
      <tr>
        <th
          scope="col"
          class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white"
        >
          ID
        </th>
        <th
          scope="col"
          class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white"
        >
          Date
        </th>
        <th
          scope="col"
          class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white"
        >
          COLLECTOR
        </th>
        <th
          scope="col"
          class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white"
        >
          Total Cost
        </th>
        <th
          scope="col"
          class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white"
        >
          Processed By
        </th>
        <th
          scope="col"
          class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white"
        >
          Status
        </th>
        <th
          scope="col"
          class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-white"
        >
          Actions
        </th>
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-gray-200">
      <tr v-if="paginatedRecords.length === 0">
        <td colspan="7" class="px-6 py-12 text-center">
          <div class="flex flex-col items-center">
            <svg
              class="w-12 h-12 text-gray-300 mb-4"
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
            <p class="text-gray-500 text-sm">
              No collection records found matching your criteria
            </p>
          </div>
        </td>
      </tr>
      <tr
        v-for="record in paginatedRecords"
        :key="record.id"
        class="hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
        @click="viewCollectionRecord(record.id)"
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
          ₱{{ record.total_cost }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {{ record.created_by_name }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span
            :class="[
              'px-2.5 py-0.5 rounded-full text-xs font-medium',
              record.is_paid 
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            ]"
          >
            {{ record.is_paid ? 'Paid' : 'Unpaid' }}
          </span>
        </td>
        <td
          class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
          @click.stop
        >
          <div class="flex items-center justify-end space-x-3">
            <!-- Mark as Paid Button or Placeholder -->
            <span v-if="!record.is_paid" class="inline-block">
              <AlertDialog>
                <AlertDialogTrigger>
                  <Button v-if="isVSUAdmin" class="p-2">
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark as Paid?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will mark the collection record as paid.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction @click="markAsPaid(record.id)"
                      >Mark as Paid</AlertDialogAction
                    >
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </span>
            <span v-else class="inline-block w-[40px]"></span>
            <!-- Placeholder for alignment -->

            <!-- Edit Button -->
            <Button
              v-if="(isFPUAdmin || isForestRanger) && !record.is_paid"
              class="p-2"
              @click="router.push({ name: 'CollectionRecordsEdit', params: { id: record.id } })"
            >
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </Button>

            <!-- Delete Button -->
            <AlertDialog v-if="!record.is_paid">
              <AlertDialogTrigger>
                <Button v-if="isFPUAdmin || isForestRanger" class="p-2">
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
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Collection Record?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This collection record will be transferred to the
                    recycle bin.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction @click="deleteCollectionRecord(record.id)"
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
    <p class="text-gray-500 text-sm">No collection records found matching your criteria</p>
  </div>

  <!-- Card for each record -->
  <div 
    v-for="record in paginatedRecords" 
    :key="record.id"
    class="bg-white rounded-lg shadow border border-gray-100 overflow-hidden"
    @click="viewCollectionRecord(record.id)"
  >
    <!-- Card header with ID and status badges -->
    <div class="p-4 border-b border-gray-100 flex items-center justify-between">
      <div class="flex items-center">
        <span class="font-medium text-gray-800 mr-2">#{{ record.id }}</span>
      </div>
      <div>
        <span
          :class="record.is_paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'"
          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
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
            <div class="text-xs text-gray-500">Date</div>
            <div class="font-medium text-sm">{{ record.formatted_created_at }}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500">Total Cost</div>
            <div class="font-medium text-sm">₱{{ record.total_cost }}</div>
          </div>
        </div>
        
        <div>
          <div class="text-xs text-gray-500">Collector</div>
          <div class="font-medium text-sm">{{ record.user_name }}</div>
        </div>
        
        <div>
          <div class="text-xs text-gray-500">Processed By</div>
          <div class="font-medium text-sm">{{ record.created_by_name }}</div>
        </div>
      </div>
    </div>
    
    <!-- Card actions -->
    <div class="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between" @click.stop>
      <!-- Mark as Paid Button -->
      <Button 
        v-if="isVSUAdmin && !record.is_paid" 
        class="text-sm"
        @click="() => {}"
      >
        <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M5 13l4 4L19 7" />
        </svg>
        Mark as Paid
      </Button>
      
      <!-- Edit Button -->
      <Button 
        v-if="(isFPUAdmin || isForestRanger) && !record.is_paid" 
        class="text-sm"
        @click="router.push({ name: 'CollectionRecordsEdit', params: { id: record.id } })"
      >
        <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </Button>
      
      <!-- Delete Button -->
      <AlertDialog v-if="!record.is_paid && (isFPUAdmin || isForestRanger)">
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
            <AlertDialogTitle>Delete Collection Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This collection record will be transferred to the recycle bin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction @click="deleteCollectionRecord(record.id)">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </div>
</div>

      <!-- Pagination -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="text-sm text-gray-600 hidden sm:block">
            Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentPage * itemsPerPage, filteredRecords.length) }} of {{ filteredRecords.length }} items
          </div>
          <Pagination
            v-slot="{ page }"
            :total="filteredRecords.length"
            :items-per-page="itemsPerPage"
            :sibling-count="1"
            show-edges
            :default-page="currentPage"
            @update:page="(newPage) => {
              currentPage = newPage;
              paginateRecords();
            }"
            class="w-full sm:w-auto"
          >
            <div class="flex items-center justify-center sm:justify-end gap-2">
              <!-- Mobile View -->
              <div class="flex items-center gap-2 sm:hidden">
                <PaginationPrev class="!w-12 !h-12" />
                <div class="text-sm font-medium">
                  {{ currentPage }} / {{ Math.ceil(filteredRecords.length / itemsPerPage) }}
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
                        item.value === page ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
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