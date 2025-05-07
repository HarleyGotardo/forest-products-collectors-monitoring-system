<script setup>
import { createApp } from 'vue';
import html2pdf from 'html2pdf.js';
import PermitTemplate from './PermitTemplate.vue';
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
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
import { toast } from 'vue-sonner'
import { isFPUAdmin, isForestRanger, isVSUAdmin } from '@/router/routeGuard'

const route = useRoute()
const router = useRouter()
const recordId = route.params.id
const record = ref(null)
const recordItems = ref([])
const error = ref(null)
const forestConservationOfficer = ref(null)
const loading = ref(false)

const fetchCollectionRecord = async () => {
  // Fetch the main collection record
  const { data, error: fetchError } = await supabase
    .from('collection_records')
    .select(`
      id,
      created_at,
      is_paid,
      approved_at,
      deleted_at,
      user:profiles!forest_product_collection_records_user_id_fkey (first_name, last_name),
      created_by:profiles!collection_records_created_by_fkey (first_name, last_name),
      approved_by:profiles!collection_records_approved_by_fkey (first_name, last_name),
      purpose,
      collection_request_id,
      is_paid
    `)
    .eq('id', recordId)
    .single()

  if (fetchError) {
    error.value = fetchError.message
    return
  }

  record.value = data

  // Fetch the collection record items
  const { data: itemsData, error: itemsError } = await supabase
    .from('collection_record_items')
    .select(`
      id,
      purchased_quantity,
      total_cost,
      deducted_quantity,
      remaining_quantity_during_purchase,
      quantity_during_purchase,
      price_per_unit_during_purchase,
      fp_and_location:fp_and_locations (
        id,
        location_id,
        location:locations (name),
        forest_product:forest_products (
          name,
          measurement_unit_id,
          measurement_unit:measurement_units (unit_name)
        )
      )
    `)
    .eq('collection_record_id', recordId)

  if (itemsError) {
    error.value = itemsError.message
  } else {
    recordItems.value = itemsData
  }
}

const deleteCollectionRecord = async (recordId) => {
  try {
    const currentDate = new Date().toISOString()
    const { error: deleteError } = await supabase
      .from('collection_records')
      .update({ deleted_at: currentDate })
      .eq('id', recordId)

    if (deleteError) {
      error.value = deleteError.message
      toast.error(`Failed to delete record: ${deleteError.message}`, { duration: 3000 })
    } else {
      toast.success('Collection record deleted successfully', { duration: 2000 })
      // Navigate back after successful deletion instead of fetching records
      router.back()
    }
  } catch (err) {
    console.error('Error deleting record:', err)
    error.value = 'An unexpected error occurred while deleting the record'
    toast.error('An unexpected error occurred while deleting the record', { duration: 3000 })
  }
}

const restoreRecord = async (recordId) => {
  const { error: updateError } = await supabase
    .from('collection_records')
    .update({ deleted_at: null })
    .eq('id', recordId)

  if (updateError) {
    toast.error(updateError.message, { duration: 3000 })
  } else {
    toast.success('Collection record restored successfully', { duration: 3000 })
    router.back()
  }
}

const deleteRecordPermanently = async (recordId) => {
  const { error: deleteError } = await supabase
    .from('collection_records')
    .delete()
    .eq('id', recordId)

  if (deleteError) {
    toast.error(deleteError.message, { duration: 3000 })
  } else {
    toast.success('Collection record deleted permanently', { duration: 3000 })
    router.back()
  }
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

const downloadPermit = async () => {
  try {
    if (!record.value.is_paid) {
      toast.error('Permit can only be downloaded for paid records.');
      return;
    }

    // Format the list of forest products
    const forestProductsList = recordItems.value.map((item) => {
      const productName = item.fp_and_location.forest_product.name;
      const locationName = item.fp_and_location.location.name;
      const quantity = item.purchased_quantity;
      const totalCost = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.total_cost);
      return `${productName} (Location: ${locationName}, Quantity: ${quantity}, Total: ${totalCost})`;
    }).join('; ');

    // Check if any product is firewood
    const firewoodNote = recordItems.value.some((item) =>
      item.fp_and_location.forest_product.name.toLowerCase() === 'firewood'
    )
      ? 'Firewood Permits are intended for family consumption but not for sale. It is limited to dead branches up to 10cm diameter, 1 meter length.'
      : '';

    // Prepare permit data
    const permitData = {
      permitNo: record.value.id,
      dateIssued: new Date(record.value.created_at).toLocaleDateString(),
      name: `${record.value.user.first_name} ${record.value.user.last_name}`,
      permission: `collect the forest products: ${forestProductsList}`,
      purpose: record.value.purpose || 'N/A',
      collectionRequestId: record.value.collection_request_id,
      expiryDate: new Date(new Date(record.value.created_at).setFullYear(new Date(record.value.created_at).getFullYear() + 1)).toLocaleDateString(),
      chargesPaid: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(calculateTotalCost()),
      issuedBy: `${record.value.created_by.first_name} ${record.value.created_by.last_name}`,
      inspectedBy: `${record.value.approved_by.first_name} ${record.value.approved_by.last_name}`,
      note: firewoodNote,
      forestConservationOfficer: forestConservationOfficer.value?.full_name || 'DENNIS P. PEQUE',
    };

    // Generate the PDF
    const permitElement = document.createElement('div');
    document.body.appendChild(permitElement);

    const app = createApp(PermitTemplate, { permitData });
    app.mount(permitElement);

    const options = {
      margin: [.3, .3, .3, .3],
      filename: `Forest_Conservation_Permit_${record.value.id}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    };

    await html2pdf().from(permitElement).set(options).save();

    app.unmount();
    document.body.removeChild(permitElement);

    toast.success('Permit downloaded successfully.');
  } catch (err) {
    console.error('Error downloading permit:', err);
    toast.error('Failed to download permit.');
  }
};

const markAsPaid = async () => {
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

    // Update collection_record_items with initial and remaining quantities
    for (const item of recordItems.value) {
      // Get current quantity from fp_and_locations
      const { data: fpLocationData, error: fpLocationError } = await supabase
        .from('fp_and_locations')
        .select('quantity')
        .eq('id', item.fp_and_location.id)
        .single();

      if (fpLocationError) {
        console.error('Error fetching fp_and_location:', fpLocationError);
        continue;
      }

      const currentQuantity = fpLocationData.quantity;
      const remainingQuantity = currentQuantity - item.deducted_quantity;

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
        .eq('id', item.fp_and_location.id);

      if (updateFpLocationError) {
        console.error('Error updating fp_and_location quantity:', updateFpLocationError);
      }
    }

    // Show success message
    toast.success('Collection record marked as paid successfully. Downloading permit...', { duration: 2000 });

    // Refresh the record and download the permit
    await fetchCollectionRecord();
    await downloadPermit();
  } catch (err) {
    console.error('Error marking as paid:', err);
    error.value = 'Failed to mark as paid';
  }
};

// Calculate total from all items
const calculateTotalCost = () => {
  return recordItems.value.reduce((sum, item) => sum + item.total_cost, 0)
}

onMounted(async () => {
  loading.value = true;

  // Check if collection record exists
  const { data: record, error } = await supabase
    .from('collection_records')
    .select('id')
    .eq('id', route.params.id)
    .single();

  if (error || !record) {
    // If record doesn't exist or there's an error, redirect to index
    router.push('/authenticated/collection-records');
    toast.error('Collection record not found');
    return;
  }

  // If record exists, fetch the details
  await fetchCollectionRecord();
  loading.value = false;
  fetchForestConservationOfficer()
})
</script>
<template>
  <div class="min-h-screen py-6 px-4 sm:px-6 lg:px-8">
    <div
      class="max-w-5xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div class="flex items-center space-x-3 sm:space-x-4">
        <Button
          @click="router.back()"
          variant="outline"
          size="sm"
          class="flex items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 mr-1.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </Button>
        <div class="flex-shrink-0 p-2 rounded-full">
          <img
            src="@/assets/records2.png"
            alt="Record Icon"
            class="w-6 h-6 sm:w-7 sm:h-7"
          />
        </div>
        <h1 class="text-xl sm:text-2xl font-semibold text-green-800">
          Collection Record
        </h1>
      </div>
      <div class="flex items-center space-x-3 sm:space-x-4">
        <div
          v-if="record?.deleted_at"
          class="px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-700 border border-red-200 flex items-center gap-2"
        >
          <span class="w-2 h-2 rounded-full bg-red-500"></span>
          Deleted
          {{ new Date(record.deleted_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
        </div>
        <div
          v-if="record && record?.is_paid"
          class="px-3 py-1 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-2"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          Paid
        </div>
        <div
          v-else-if="record && !record?.is_paid"
          class="px-3 py-1 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-2"
        >
          <span class="w-2 h-2 rounded-full bg-amber-500"></span>
          Unpaid
        </div>
        <Button
          v-if="record?.is_paid && (isFPUAdmin || isForestRanger || isVSUAdmin)"
          @click="downloadPermit"
          size="sm"
          class="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 mr-1.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download Permit
        </Button>
        <div class="flex items-center space-x-2">
          <!-- <Button
            v-if="(isFPUAdmin || isForestRanger) && record && !record?.is_paid && !record?.deleted_at"
                class="p-2 flex items-center justify-center"
            @click="router.push({ name: 'CollectionRecordsEdit', params: { id: record?.id } })"
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
              </Button> -->
          <AlertDialog v-if="record && !record.is_paid && !record?.deleted_at">
            <AlertDialogTrigger>
              <Button
                v-if="isFPUAdmin || isForestRanger"
                class="p-2 flex items-center justify-center bg-red-600 hover:bg-red-700"
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
                <AlertDialogAction class="bg-red-600 hover:bg-red-700" @click="deleteCollectionRecord(record.id)">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <!-- Restore and Delete Permanently buttons for deleted records -->
          <template v-if="record?.deleted_at">
            <AlertDialog>
              <AlertDialogTrigger>
                <Button class="p-2 flex items-center justify-center">
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
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle
                    >Restore Collection Record?</AlertDialogTitle
                  >
                  <AlertDialogDescription>
                    This collection record will be restored.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction @click="restoreRecord(record.id)">
                    Restore
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger>
                <Button class="p-2 flex items-center justify-center">
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
                  <AlertDialogTitle
                    >Delete Collection Record Permanently?</AlertDialogTitle
                  >
                  <AlertDialogDescription>
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    @click="deleteRecordPermanently(record.id)"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </template>
        </div>
      </div>
    </div>

    <div
      v-if="error"
      class="max-w-5xl mx-auto mb-6 rounded-md bg-red-50 p-4 border border-red-200"
    >
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <svg
            class="h-5 w-5 text-red-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L10 8.586 7.707 6.293a1 1 0 00-1.414 1.414L8.586 10l-2.293 2.293a1 1 0 101.414 1.414L10 11.414l2.293 2.293a1 1 0 001.414-1.414L11.414 10l2.293-2.293z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium text-red-800">{{ error }}</p>
        </div>
      </div>
    </div>

    <div
      v-if="record"
      class="max-w-5xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden"
    >
      <div class="border-b border-gray-200 px-6 py-5">
        <div class="flex flex-col gap-5">
          <div>
            <h2 class="text-lg font-semibold text-emerald-900">
              {{ record?.is_paid ? 'Collection Record Receipt' : 'Collection Record Invoice' }}
            </h2>
            <p class="text-sm text-gray-500 mt-0.5">
              Forest Products Collection Record Details
            </p>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
            <div>
              <p
                class="text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Invoice No.
              </p>
              <p class="text-sm font-bold text-emerald-900 mt-1">
                #{{ record.id }}
              </p>
            </div>
            <div>
              <p
                class="text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Date Issued
              </p>
              <p class="text-sm text-gray-900 mt-1">
                {{ new Date(record.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}
              </p>
            </div>
            <div>
              <p
                class="text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Purpose
              </p>
              <p class="text-sm text-gray-900 mt-1">{{ record.purpose }}</p>
            </div>
            <div>
              <p
                class="text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Request ID
              </p>
              <p
                class="text-sm text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer hover:underline mt-1"
                @click="router.push(`/authenticated/collection-requests/${record.collection_request_id}`)"
              >
                {{ record.collection_request_id }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mb-8">
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-1">Processed By</h3>
            <p class="text-sm text-gray-900">
              {{ record.created_by ? `${record.created_by.first_name} ${record.created_by.last_name}` : 'N/A' }}
            </p>
          </div>
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-1">
              Collector Details
            </h3>
            <p class="text-sm text-gray-900">
              {{ record.user ? `${record.user.first_name} ${record.user.last_name}` : 'N/A' }}
            </p>
          </div>
        </div>

        <div class="mb-8">
          <h3 class="text-sm font-medium text-gray-500 mb-3">
            Collection Details
          </h3>

          <div
            class="hidden sm:block border border-gray-200 rounded-lg overflow-hidden"
          >
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Forest Product
                  </th>
                  <th
                    scope="col"
                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Location
                  </th>
                  <th
                    scope="col"
                    class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Collected Qty
                  </th>
                  <th
                    scope="col"
                    class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    Price / Unit
                  </th>
                  <th
                    scope="col"
                    class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="item in recordItems" :key="item.id">
                  <td class="px-4 py-4 text-sm text-gray-800 align-top">
                    <span
                      class="font-medium"
                      >{{ item.fp_and_location?.forest_product?.name || 'N/A' }}</span
                    >
                    <div class="mt-1 text-xs text-gray-500 space-y-0.5">
                      <p>
                        Collected: {{ item.deducted_quantity }}
                        {{ item.fp_and_location?.forest_product?.measurement_unit?.unit_name || 'units' }}
                      </p>
                      <p v-if="item.quantity_during_purchase !== null">
                        Initial Qty: {{ item.quantity_during_purchase }}
                        {{ item.fp_and_location?.forest_product?.measurement_unit?.unit_name || 'units' }}
                      </p>
                      <p
                        v-if="item.remaining_quantity_during_purchase !== null"
                      >
                        Remaining:
                        {{ item.remaining_quantity_during_purchase }}
                        {{ item.fp_and_location?.forest_product?.measurement_unit?.unit_name || 'units' }}
                      </p>
                    </div>
                  </td>
                  <td class="px-4 py-4 text-sm text-gray-600 align-top">
                    {{ item.fp_and_location?.location?.name || 'N/A' }}
                  </td>
                  <td
                    class="px-4 py-4 text-sm text-gray-800 text-right align-top whitespace-nowrap"
                  >
                    {{ item.deducted_quantity }}
                    {{ item.fp_and_location?.forest_product?.measurement_unit?.unit_name || 'units' }}(s)
                  </td>
                    <td
                    class="px-4 py-4 text-sm text-gray-800 text-right align-top whitespace-nowrap"
                    >
                    {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.price_per_unit_during_purchase) }}
                    </td>
                  <td
                    class="px-4 py-4 text-sm text-gray-900 font-semibold text-right align-top whitespace-nowrap"
                  >
                    {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.total_cost) }}
                  </td>
                </tr>
                <tr v-if="recordItems.length === 0">
                  <td
                    colspan="5"
                    class="px-4 py-6 text-sm text-gray-500 text-center"
                  >
                    No items found in this collection record.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="sm:hidden space-y-4">
            <div
              v-for="item in recordItems"
              :key="item.id"
              class="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div class="mb-3 pb-3 border-b border-gray-200">
                <p class="text-sm font-semibold text-gray-900">
                  {{ item.fp_and_location?.forest_product?.name || 'N/A' }}
                </p>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ item.fp_and_location?.location?.name || 'N/A' }}
                </p>
              </div>

              <div class="grid grid-cols-3 gap-x-2 gap-y-1 mb-3 text-xs">
                <div>
                  <p class="font-medium text-gray-500">Initial</p>
                  <p class="text-gray-700">
                    {{ item.quantity_during_purchase }}
                    {{ item.fp_and_location?.forest_product?.measurement_unit?.unit_name || 'units' }}
                  </p>
                </div>
                <div>
                  <p class="font-medium text-gray-500">Collected</p>
                  <p class="text-gray-700">
                    {{ item.deducted_quantity }}
                    {{ item.fp_and_location?.forest_product?.measurement_unit?.unit_name || 'units' }}
                  </p>
                </div>
                <div>
                  <p class="font-medium text-gray-500">Remaining</p>
                  <p class="text-gray-700">
                    {{ item.remaining_quantity_during_purchase }}
                    {{ item.fp_and_location?.forest_product?.measurement_unit?.unit_name || 'units' }}
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div>
                  <p class="text-xs font-medium text-gray-500">Price/Unit</p>
                  <p class="text-gray-800">
                    {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.price_per_unit_during_purchase) }}
                  </p>
                </div>
                <div>
                  <p class="text-xs font-medium text-gray-500">Total Amount</p>
                  <p class="font-semibold text-gray-900">
                    {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.total_cost) }}
                  </p>
                </div>
              </div>
            </div>

            <div
              v-if="recordItems.length === 0"
              class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center"
            >
              <p class="text-sm text-gray-500">No items found.</p>
            </div>
          </div>
        </div>

        <div class="border-t border-gray-200 pt-6">
          <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-6">
            <div class="w-full sm:w-auto sm:max-w-xs flex-grow">
              <dl class="space-y-3 text-sm">
                <div class="flex justify-between items-center">
                  <dt class="text-gray-600">Total Amount</dt>
                  <dd class="text-lg font-semibold text-gray-900">
                    {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(calculateTotalCost()) }}
                  </dd>
                </div>
                <div
                  class="flex justify-between items-center border-t border-gray-200 pt-3"
                >
                  <dt class="text-gray-600">Payment Status</dt>
                  <dd
                    class="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    :class="record.is_paid ? 'bg-emerald-100 text-green-800' : 'bg-red-100 text-red-800'"
                  >
                    {{ record.is_paid ? 'PAID' : 'UNPAID' }}
                  </dd>
                </div>

                <template v-if="record.is_paid">
                  <div
                    class="flex justify-between items-center border-t border-gray-200 pt-3"
                  >
                    <dt class="text-gray-600">Maked Paid By</dt>
                    <dd class="text-gray-800">
                      {{ record.approved_by ? `${record.approved_by.first_name} ${record.approved_by.last_name}` : 'N/A' }}
                    </dd>
                  </div>
                  <div class="flex justify-between items-center">
                    <dt class="text-gray-600">Payment Date</dt>
                    <dd class="text-gray-800">
                      {{ record.approved_at ? new Date(record.approved_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A' }}
                    </dd>
                  </div>
                </template>

                <div v-if="isVSUAdmin && !record.is_paid" class="pt-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        class="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Mark as Paid
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Payment</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to mark this collection record
                          as paid? This action cannot be undone easily.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          @click="markAsPaid"
                          class="bg-emerald-600 hover:bg-emerald-700"
                        >
                          Confirm Mark as Paid
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div class="text-xs text-gray-500 text-center">
          <p>Thank you for processing this collection.</p>
          <p>
            Generated on:
            {{ new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
          </p>
        </div>
      </div>
    </div>

    <div
      v-else
      class="max-w-5xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden animate-pulse"
    >
      <!-- Content Skeleton -->
      <div class="px-6 py-6">
        <!-- User Details Skeleton -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mb-8">
          <div>
            <h3
              class="text-sm font-medium text-gray-300 bg-gray-200 w-24 h-5 rounded mb-1"
            ></h3>
            <div class="text-sm bg-gray-200 w-48 h-5 rounded"></div>
          </div>
          <div>
            <h3
              class="text-sm font-medium text-gray-300 bg-gray-200 w-32 h-5 rounded mb-1"
            ></h3>
            <div class="text-sm bg-gray-200 w-48 h-5 rounded"></div>
          </div>
        </div>

        <!-- Collection Details Skeleton -->
        <div class="mb-8">
          <h3
            class="text-sm font-medium text-gray-300 bg-gray-200 w-32 h-5 rounded mb-3"
          ></h3>

          <!-- Desktop Table Skeleton -->
          <div
            class="hidden sm:block border border-gray-200 rounded-lg overflow-hidden"
          >
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3">
                    <div class="h-4 bg-gray-200 rounded w-24"></div>
                  </th>
                  <th class="px-4 py-3">
                    <div class="h-4 bg-gray-200 rounded w-20"></div>
                  </th>
                  <th class="px-4 py-3 text-right">
                    <div class="h-4 bg-gray-200 rounded w-24 ml-auto"></div>
                  </th>
                  <th class="px-4 py-3 text-right">
                    <div class="h-4 bg-gray-200 rounded w-20 ml-auto"></div>
                  </th>
                  <th class="px-4 py-3 text-right">
                    <div class="h-4 bg-gray-200 rounded w-16 ml-auto"></div>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="n in 3" :key="n">
                  <td class="px-4 py-4">
                    <div class="space-y-2">
                      <div class="h-5 bg-gray-200 rounded w-32"></div>
                      <div class="space-y-1">
                        <div class="h-4 bg-gray-200 rounded w-24"></div>
                        <div class="h-4 bg-gray-200 rounded w-28"></div>
                        <div class="h-4 bg-gray-200 rounded w-20"></div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-4 align-top">
                    <div class="h-5 bg-gray-200 rounded w-32"></div>
                  </td>
                  <td class="px-4 py-4 text-right align-top">
                    <div class="h-5 bg-gray-200 rounded w-24 ml-auto"></div>
                  </td>
                  <td class="px-4 py-4 text-right align-top whitespace-nowrap">
                    <div class="h-5 bg-gray-200 rounded w-20 ml-auto"></div>
                  </td>
                  <td class="px-4 py-4 text-right align-top whitespace-nowrap">
                    <div class="h-5 bg-gray-200 rounded w-24 ml-auto"></div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Cards Skeleton -->
          <div class="sm:hidden space-y-4">
            <div
              v-for="n in 3"
              :key="n"
              class="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div class="mb-3 pb-3 border-b border-gray-200">
                <div class="h-5 bg-gray-200 rounded w-40 mb-1"></div>
                <div class="h-4 bg-gray-200 rounded w-32"></div>
              </div>

              <div class="grid grid-cols-3 gap-x-2 gap-y-1 mb-3">
                <div>
                  <div class="h-4 bg-gray-200 rounded w-16 mb-1"></div>
                  <div class="h-5 bg-gray-200 rounded w-20"></div>
                </div>
                <div>
                  <div class="h-4 bg-gray-200 rounded w-20 mb-1"></div>
                  <div class="h-5 bg-gray-200 rounded w-24"></div>
                </div>
                <div>
                  <div class="h-4 bg-gray-200 rounded w-20 mb-1"></div>
                  <div class="h-5 bg-gray-200 rounded w-24"></div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                <div>
                  <div class="h-4 bg-gray-200 rounded w-20 mb-1"></div>
                  <div class="h-5 bg-gray-200 rounded w-24"></div>
                </div>
                <div>
                  <div class="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                  <div class="h-5 bg-gray-200 rounded w-28"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary Section Skeleton -->
        <div class="border-t border-gray-200 pt-6">
          <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-6">
            <div class="w-full sm:w-auto sm:max-w-xs flex-grow">
              <dl class="space-y-3 text-sm">
                <div class="flex justify-between items-center">
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                  <div class="h-6 bg-gray-200 rounded w-32"></div>
                </div>
                <div
                  class="flex justify-between items-center border-t border-gray-200 pt-3"
                >
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                  <div class="h-5 bg-gray-200 rounded-full w-16"></div>
                </div>
                <div
                  class="flex justify-between items-center border-t border-gray-200 pt-3"
                >
                  <div class="h-4 bg-gray-200 rounded w-28"></div>
                  <div class="h-5 bg-gray-200 rounded w-40"></div>
                </div>
                <div class="flex justify-between items-center">
                  <div class="h-4 bg-gray-200 rounded w-24"></div>
                  <div class="h-5 bg-gray-200 rounded w-48"></div>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Skeleton -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div class="text-center space-y-1">
          <div class="h-4 bg-gray-200 rounded w-48 mx-auto"></div>
          <div class="h-4 bg-gray-200 rounded w-64 mx-auto"></div>
        </div>
      </div>
    </div>
  </div>
</template>
