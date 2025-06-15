<script setup>
import { createApp } from 'vue';
import PermitTemplate from './PermitTemplate.vue';
import { ref, onMounted, computed, watch } from 'vue'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'vue-sonner'
import { isFPUAdmin, isForestRanger } from '@/router/routeGuard'
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
import { jsPDF } from 'jspdf';

const collectionRecords = ref([])
const currentPage = ref(1)
const itemsPerPage = 8
const error = ref(null)
const searchQuery = ref('')
const paymentFilter = ref('all') // 'all', 'paid', 'unpaid'
const loading = ref(true);
const showNotes = ref(true);
const forestConservationOfficer = ref(null);
const showEditSignatureDialog = ref(false);
const newSignature = ref('');

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
      .order('id', { ascending: false })

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
          deducted_quantity,
          quantity_during_purchase,
          price_per_unit_during_purchase,
          total_cost,
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
        items: items.map(item => ({
          ...item,
          total_cost: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.total_cost || 0),
          price_per_unit_during_purchase: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.price_per_unit_during_purchase || 0)
        })),
        total_cost: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(totalCost),
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

const fetchForestConservationOfficer = async () => {
  try {
    const { data, error } = await supabase
      .from('signatures')
      .select('*')
      .eq('title', 'forest_conservation_officer')
      .single();

    if (error) {
      console.error('Error fetching forest conservation officer:', error);
      return;
    }

    if (data) {
      forestConservationOfficer.value = data;
    }
  } catch (err) {
    console.error('Error in fetchForestConservationOfficer:', err);
  }
};

const updateForestConservationOfficer = async () => {
  try {
    if (!newSignature.value.trim()) {
      toast.error('Please enter a valid name');
      return;
    }

    // First check if the record exists
    const { data: existingRecord, error: fetchError } = await supabase
      .from('signatures')
      .select('id')
      .eq('title', 'forest_conservation_officer')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is the error code for no rows returned
      console.error('Error checking existing record:', fetchError);
      toast.error('Failed to update forest conservation officer');
      return;
    }

    let updateError;
    if (existingRecord) {
      // Update existing record
      const { error } = await supabase
        .from('signatures')
        .update({ full_name: newSignature.value.trim() })
        .eq('id', existingRecord.id);
      updateError = error;
    } else {
      // Create new record if none exists
      const { error } = await supabase
        .from('signatures')
        .insert({
          title: 'forest_conservation_officer',
          full_name: newSignature.value.trim()
        });
      updateError = error;
    }

    if (updateError) {
      console.error('Error updating forest conservation officer:', updateError);
      toast.error('Failed to update forest conservation officer');
      return;
    }

    await fetchForestConservationOfficer();
    showEditSignatureDialog.value = false;
    newSignature.value = '';
    toast.success('Forest Conservation Officer updated successfully');
  } catch (err) {
    console.error('Error in updateForestConservationOfficer:', err);
    toast.error('Failed to update forest conservation officer');
  }
};

const markAsPaid = async (recordId) => {
  try {
    // Get the current user's ID from the auth session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User authentication error:', userError);
      error.value = 'Failed to authenticate user';
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

    // Fetch the updated record to get the approved_by information
    const { data: updatedRecord, error: fetchError } = await supabase
      .from('collection_records')
      .select(`
        id,
        created_at,
        purpose,
        collection_request_id,
        created_by:profiles!collection_records_created_by_fkey (first_name, last_name),
        approved_by:profiles!collection_records_approved_by_fkey (first_name, last_name)
      `)
      .eq('id', recordId)
      .single();

    if (fetchError) {
      console.error('Error fetching updated record:', fetchError);
      error.value = 'Failed to fetch updated record';
      return;
    }

    // Fetch the collection record items
    const { data: recordItems, error: itemsError } = await supabase
      .from('collection_record_items')
      .select(`
        id,
        purchased_quantity,
        fp_and_location_id,
        deducted_quantity,
        quantity_during_purchase,
        price_per_unit_during_purchase,
        total_cost,
        fp_and_location:fp_and_locations (
          id,
          forest_product:forest_products (
            name,
            measurement_unit_id,
            measurement_unit:measurement_units (unit_name)
          ),
          location:locations (name)
        )
      `)
      .eq('collection_record_id', recordId);

    if (itemsError) {
      console.error('Error fetching record items:', itemsError);
      error.value = 'Failed to fetch record items';
      return;
    }

    // Update collection_record_items with initial and remaining quantities
    for (const item of recordItems) {
      if (!item || !item.fp_and_location_id) {
        console.error('Invalid item data:', item);
        continue;
      }

      // Get current quantity from fp_and_locations
      const { data: fpLocationData, error: fpLocationError } = await supabase
        .from('fp_and_locations')
        .select('quantity')
        .eq('id', item.fp_and_location_id)
        .single();

      if (fpLocationError) {
        console.error('Error fetching fp_and_location:', fpLocationError);
        continue;
      }

      const currentQuantity = fpLocationData.quantity;
      const remainingQuantity = currentQuantity - (item.deducted_quantity || 0);

      // Update the collection_record_items with initial and remaining quantities
      const { error: updateItemError } = await supabase
        .from('collection_record_items')
        .update({
          quantity_during_purchase: currentQuantity,
          remaining_quantity_during_purchase: remainingQuantity,
          price_per_unit_during_purchase: item.price_per_unit_during_purchase
        })
        .eq('id', item.id);

      if (updateItemError) {
        console.error('Error updating collection record item:', updateItemError);
        continue;
      }

      // Update the fp_and_locations table with new quantity
      const { error: updateFpLocationError } = await supabase
        .from('fp_and_locations')
        .update({ quantity: remainingQuantity })
        .eq('id', item.fp_and_location_id);

      if (updateFpLocationError) {
        console.error('Error updating fp_and_location quantity:', updateFpLocationError);
      }
    }

    // Format the list of forest products for the permit
    const forestProductsList = recordItems.map((item) => {
      if (!item || !item.fp_and_location) return null;
      return {
        productName: item.fp_and_location.forest_product?.name || 'Unknown Product',
        locationName: item.fp_and_location.location?.name || 'Unknown Location',
        quantity: `${item.purchased_quantity || 0} ${item.fp_and_location.forest_product?.measurement_unit?.unit_name || ''}`.trim(),
        totalCost: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.total_cost || 0)
      };
    }).filter(Boolean);

    // Check if any product is firewood
    const firewoodNote = recordItems.some((item) =>
      item?.fp_and_location?.forest_product?.name?.toLowerCase() === 'firewood'
    )
      ? 'Firewood Permits are intended for family consumption but not for sale. It is limited to dead branches up to 10cm diameter, 1 meter length.'
      : '';

    // Prepare permit data
    const permitData = {
      permitNo: recordId,
      dateIssued: new Date().toLocaleDateString(),
      name: recordItems[0]?.user_name || 'N/A',
      permission: forestProductsList,
      purpose: updatedRecord.purpose || 'N/A',
      collectionRequestId: updatedRecord.collection_request_id || 'N/A',
      expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString(),
      chargesPaid: recordItems.reduce((sum, item) => sum + (item?.total_cost || 0), 0).toFixed(2),
      issuedBy: `${updatedRecord.created_by.first_name} ${updatedRecord.created_by.last_name}`,
      inspectedBy: `${updatedRecord.approved_by.first_name} ${updatedRecord.approved_by.last_name}`,
      note: firewoodNote,
      forestConservationOfficer: forestConservationOfficer.value?.full_name || 'DENNIS P. PEQUE',
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

const generatePDF = async (record) => {
  try {
    const { data: user } = await supabase.auth.getUser()
    if (!user) throw new Error('User not found')

    // Fetch the collection record with created_by and approved_by information
    const { data: collectionRecord, error: recordError } = await supabase
      .from('collection_records')
      .select(`
        *,
        created_by:created_by (
          first_name,
          last_name
        ),
        approved_by:approved_by (
          first_name,
          last_name
        )
      `)
      .eq('id', record.id)
      .single()

    if (recordError) throw recordError

    const doc = new jsPDF()

    // Add header
    doc.setFontSize(20)
    doc.text('Collection Record', 105, 20, { align: 'center' })

    // Add record details
    doc.setFontSize(12)
    doc.text(`Record ID: ${record.id}`, 20, 40)
    doc.text(`Date: ${new Date(record.created_at).toLocaleDateString()}`, 20, 50)
    doc.text(`Collector: ${record.profiles.first_name} ${record.profiles.last_name}`, 20, 60)
    doc.text(`Status: ${record.is_paid ? 'Paid' : 'Unpaid'}`, 20, 70)

    // Add items
    doc.text('Items:', 20, 90)
    let y = 100
    record.collection_record_items.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.fp_and_locations.forest_products.name}`, 30, y)
      doc.text(`Quantity: ${item.purchased_quantity} ${item.fp_and_locations.forest_products.measurement_units.unit_name}`, 40, y + 10)
      doc.text(`Price: ₱${item.total_cost}`, 40, y + 20)
      y += 40
    })

    // Add total
    doc.text(`Total Amount: ₱${record.total_amount}`, 20, y + 10)

    // Add signatures
    doc.text('Signatures:', 20, y + 30)
    doc.text(`Issued By: ${collectionRecord.created_by ? `${collectionRecord.created_by.first_name} ${collectionRecord.created_by.last_name}` : 'N/A'}`, 20, y + 40)
    doc.text(`Inspected By: ${collectionRecord.approved_by ? `${collectionRecord.approved_by.first_name} ${collectionRecord.approved_by.last_name}` : 'N/A'}`, 20, y + 50)

    // Save the PDF
    doc.save(`collection_record_${record.id}.pdf`)

    toast.success('PDF generated successfully')
  } catch (error) {
    console.error('Error generating PDF:', error)
    toast.error('Failed to generate PDF')
  }
}

const revertCollectionRecord = async (recordId, requestId) => {
  try {
    // First, verify that the collection request exists and get its current state
    const { data: requestData, error: fetchError } = await supabase
      .from('collection_requests')
      .select('id, is_recorded')
      .eq('id', requestId)
      .single();

    if (fetchError) {
      console.error('Error fetching collection request:', fetchError);
      toast.error('Failed to verify collection request');
      return;
    }

    if (!requestData) {
      toast.error('Collection request not found');
      return;
    }

    // Update the collection request to set is_recorded to false
    const { error: updateRequestError } = await supabase
      .from('collection_requests')
      .update({ is_recorded: false })
      .eq('id', requestId);

    if (updateRequestError) {
      console.error('Error updating collection request:', updateRequestError);
      toast.error('Failed to update collection request');
      return;
    }

    // Only proceed with deletion if the request update was successful
    const { error: deleteError } = await supabase
      .from('collection_records')
      .delete()
      .eq('id', recordId);

    if (deleteError) {
      // If deletion fails, try to revert the request update
      const { error: revertError } = await supabase
        .from('collection_requests')
        .update({ is_recorded: true })
        .eq('id', requestId);

      if (revertError) {
        console.error('Error reverting collection request:', revertError);
      }

      console.error('Error deleting collection record:', deleteError);
      toast.error('Failed to delete collection record');
      return;
    }

    toast.success('Collection record reverted successfully');
    fetchCollectionRecords();
  } catch (err) {
    console.error('Error in revertCollectionRecord:', err);
    toast.error('Failed to revert collection record');
  }
};

onMounted(() => {
  fetchCollectionRecords()
  fetchForestConservationOfficer()
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
  <div class="max-w-7xl mx-auto p-3 sm:p-6">
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
          <h2 class="text-lg sm:text-xl md:text-2xl font-bold text-green-900">
            Forest Products Collection Records
          </h2>
          <p class="mt-1 text-xs sm:text-sm text-green-900">
            View and manage all collection records
          </p>
        </div>
      </div>
      <div
        class="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0"
      >
        <div class="relative flex-1">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search records..."
            class="block w-full px-4 py-2 rounded-full bg-white border border-gray-200 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
            title="Search Collection Record"
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
        <div class="flex space-x-4">
          <Button
            v-if="isFPUAdmin || isForestRanger"
            @click="createCollectionRecord"
            class="min-w-10 bg-emerald-900 text-white hover:bg-emerald-700"
            title="Create New Collection Record"
          >
            +
          </Button>
          <Button
            v-if="isFPUAdmin"
            @click="showEditSignatureDialog = true"
            class="bg-emerald-900 text-white hover:bg-emerald-700"
          >
            Edit Forest Conservation Officer
          </Button>
        </div>
      </div>
    </div>

    <!-- Filter Section -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-6">
      <div class="flex items-center space-x-4">
        <!-- Payment Status Filter -->
        <select
          v-model="paymentFilter"
          class="block w-full sm:w-40 px-3 py-2 rounded-full bg-white border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
        >
          <option value="all">All Records</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>
    </div>

    <!-- Info Notes -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-2">
          <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3 class="text-lg font-medium text-gray-900">Important Information</h3>
        </div>
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
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      <div v-if="showNotes" class="space-y-4">
        <!-- Payment Note -->
        <div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg
                class="h-5 w-5 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-blue-700">
                <span class="font-medium">Important:</span> Collection records
                can only be edited or deleted if they are unpaid. Once a record
                is marked as paid, it becomes permanent and cannot be modified.
              </p>
            </div>
          </div>
        </div>

        <!-- Payment Process Note -->
        <div class="bg-emerald-50 border-l-4 border-green-400 p-4 rounded-r-lg">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg
                class="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-green-700">
                <span class="font-medium">Payment Process:</span> When a record
                is marked as paid, the system automatically generates a forest
                conservation permit and deducts the collected quantities from
                the available stock. The permit can then be downloaded.
              </p>
            </div>
          </div>
        </div>
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
      <div
        class="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-emerald-900">
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
        <div
          v-for="n in 8"
          :key="n"
          class="bg-white rounded-lg shadow border border-gray-100 overflow-hidden"
        >
          <!-- Card header skeleton -->
          <div
            class="p-4 border-b border-gray-100 flex items-center justify-between"
          >
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
          <div
            class="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between"
          >
            <div class="h-8 bg-gray-200 rounded w-24"></div>
            <div class="h-8 bg-gray-200 rounded w-24"></div>
            <div class="h-8 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </div>

      <!-- Pagination Skeleton -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div
          class="flex flex-col sm:flex-row items-center justify-between gap-4"
        >
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
          <thead class="bg-emerald-900">
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
                Action
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="paginatedRecords.length === 0">
              <td colspan="7" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center">
                  <img
                    src="@/assets/records2.png"
                    alt=""
                    class="w-12 h-12 mb-4"
                  />
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
                {{ record.total_cost }}
                </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ record.created_by_name }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  :class="[
              'px-2.5 py-0.5 rounded-full text-xs font-medium',
              record.is_paid 
                ? 'bg-emerald-100 text-green-800'
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
                  <!-- Mark as Paid Button or Paid At Message -->
                  <template v-if="isFPUAdmin">
                    <span v-if="record.is_paid" class="text-green-700 text-xs font-semibold">
                      Paid at {{ record.approved_at ? record.approved_at : 'N/A' }}
                    </span>
                    <AlertDialog v-else>
                      <AlertDialogTrigger>
                        <Button
                          class="text-sm bg-emerald-600 hover:bg-emerald-700 text-white sm:inline-flex sm:items-center sm:space-x-1 rounded-full"
                        >
                          <svg
                            class="w-4 h-4 sm:mr-1"
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
                          <span>Paid</span>
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
                          <AlertDialogAction class="bg-emerald-700 hover:bg-emerald-900" @click="markAsPaid(record.id)">
                            Mark as Paid
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </template>
                    <span v-else-if="record.is_paid" class="text-green-700 text-xs font-semibold rounded-full bg-green-50 p-2 flex items-center">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    This collection record is already paid
                    </span>
                  <span v-else class="inline-block w-[40px]"></span>

                  <!-- Revert Button -->
                  <AlertDialog v-if="!record.is_paid">
                    <AlertDialogTrigger>
                      <Button
                        v-if="isFPUAdmin || isForestRanger"
                        class="p-2 bg-gray-500 text-white hover:bg-gray-400 rounded-full"
                        title="Revert Collection Record"
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
                            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                          />
                        </svg>
                        Revert
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revert Collection Record?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the collection record and revert the associated request to unrecorded status.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          class="bg-gray-500 hover:bg-gray-400"
                          @click="revertCollectionRecord(record.id, record.collection_request_id)"
                          >Revert</AlertDialogAction
                        >
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <!-- Delete Button -->
                  <AlertDialog v-if="!record.is_paid">
                    <AlertDialogTrigger>
                      <Button
                        v-if="isFPUAdmin || isForestRanger"
                        class="p-2 bg-red-900 text-white hover:bg-red-600 rounded-full"
                        title="Delete Collection Record"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
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
                        <AlertDialogAction
                          class="bg-red-900 hover:bg-red-700"
                          @click="deleteCollectionRecord(record.id)"
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
        <div
          v-if="paginatedRecords.length === 0"
          class="bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center"
        >
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

        <!-- Card for each record -->
        <div
          v-for="record in paginatedRecords"
          :key="record.id"
          class="bg-white rounded-lg shadow border border-gray-100 overflow-hidden"
          @click="viewCollectionRecord(record.id)"
        >
          <!-- Card header with ID and status badges -->
          <div
            class="p-4 border-b border-gray-100 flex items-center justify-between"
          >
            <div class="flex items-center">
              <span class="font-medium text-gray-800 mr-2"
                >#{{ record.id }}</span
              >
            </div>
            <div>
              <span
                :class="record.is_paid ? 'bg-emerald-100 text-green-800' : 'bg-yellow-100 text-yellow-800'"
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
                  <div class="font-medium text-sm">
                    {{ record.formatted_created_at }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-gray-500">Total Cost</div>
                  <div class="font-medium text-sm">
                    {{ record.total_cost }}
                  </div>
                </div>
              </div>

              <div>
                <div class="text-xs text-gray-500">Collector</div>
                <div class="font-medium text-sm">{{ record.user_name }}</div>
              </div>

              <div>
                <div class="text-xs text-gray-500">Processed By</div>
                <div class="font-medium text-sm">
                  {{ record.created_by_name }}
                </div>
              </div>
            </div>
          </div>

            <!-- Card actions -->
            <div
            class="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between"
            @click.stop
            >
            <!-- Mark as Paid Button or Paid At Message -->
            <template v-if="isFPUAdmin">
              <span v-if="record.is_paid" class="text-green-700 text-xs font-semibold">
                Paid at {{ record.approved_at ? record.approved_at : 'N/A' }}
              </span>
              <AlertDialog v-else>
                <AlertDialogTrigger>
                  <Button
                    class="text-sm bg-emerald-600 hover:bg-emerald-700 text-white sm:inline-flex sm:items-center sm:space-x-1"
                  >
                    <svg
                      class="w-4 h-4 sm:mr-1"
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
                    <span>Mark as Paid</span>
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
                    <AlertDialogAction class="bg-emerald-700 hover:bg-emerald-900" @click="markAsPaid(record.id)">
                      Mark as Paid
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </template>
            <span v-else-if="record.is_paid" class="text-green-700 text-xs font-semibold">
              Paid
            </span>

            <!-- Revert Button -->
            <AlertDialog v-if="!record.is_paid">
              <AlertDialogTrigger asChild>
              <Button
                v-if="isFPUAdmin || isForestRanger"
                class="text-sm bg-gray-500 text-white hover:bg-gray-400 sm:inline-flex sm:items-center sm:space-x-1"
              >
                <svg
                class="w-4 h-4 sm:mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
                </svg>
                <span class="hidden sm:inline">Revert</span>
              </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revert Collection Record?</AlertDialogTitle>
                <AlertDialogDescription>
                This will permanently delete the collection record and revert the associated request to unrecorded status.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                class="bg-gray-500 hover:bg-gray-400"
                @click="revertCollectionRecord(record.id, record.collection_request_id)"
                >Revert</AlertDialogAction
                >
              </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <!-- Delete Button -->
            <AlertDialog
              v-if="!record.is_paid && (isFPUAdmin || isForestRanger)"
            >
              <AlertDialogTrigger asChild>
              <Button class="text-sm sm:inline-flex sm:items-center sm:space-x-1 bg-red-800 hover:bg-red-600">
                <svg
                class="w-4 h-4 sm:mr-1"
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
                <span class="hidden sm:inline">Delete</span>
              </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Collection Record?</AlertDialogTitle>
                <AlertDialogDescription>
                This collection record will be transferred to the recycle
                bin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction @click="deleteCollectionRecord(record.id)" class="bg-red-800 hover:bg-red-600"
                >Delete</AlertDialogAction
                >
              </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div
          class="flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div class="text-sm text-gray-600 hidden sm:block">
            Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to
            {{ Math.min(currentPage * itemsPerPage, filteredRecords.length) }}
            of {{ filteredRecords.length }} items
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
                  {{ currentPage }} /
                  {{ Math.ceil(filteredRecords.length / itemsPerPage) }}
                </div>
                <PaginationNext class="!w-12 !h-12" />
              </div>

              <!-- Desktop View -->
              <div class="hidden sm:flex items-center gap-1">
                <PaginationFirst />
                <PaginationPrev />
                <PaginationList
                  v-slot="{ items }"
                  class="flex items-center gap-1"
                >
                  <template v-for="(item, index) in items">
                    <PaginationListItem
                      v-if="item.type === 'page'"
                      :key="index"
                      :value="item.value"
                      :class="[
                        'w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-colors',
                        item.value === page ? 'bg-emerald-900 text-white' : 'hover:bg-gray-100'
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

  <!-- Add Edit Signature Dialog -->
  <AlertDialog v-model:open="showEditSignatureDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <div class="flex items-center space-x-2">
          <img
            src="@/assets/fco.png"
            alt="Logo"
            class="w-8 h-8"
          />
          <AlertDialogTitle>Edit Forest Conservation Officer</AlertDialogTitle>
        </div>
        <AlertDialogDescription>
          Update the name of the Forest Conservation Officer who will be signing
          the permits.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div class="py-4">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Current Officer</label
            >
            <p class="text-sm text-gray-500">
              {{ forestConservationOfficer?.full_name || 'DENNIS P. PEQUE' }}
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >New Officer Name</label
            >
            <input
              v-model="newSignature"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter full name"
            />
          </div>
        </div>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel @click="showEditSignatureDialog = false"
          >Cancel</AlertDialogCancel
        >
        <AlertDialogAction @click="updateForestConservationOfficer"
           class="bg-green-800 hover:bg-green-600">Save Changes</AlertDialogAction
        >
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
