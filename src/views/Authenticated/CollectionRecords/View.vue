<script setup>
import { createApp } from 'vue';
import html2pdf from 'html2pdf.js';
import PermitTemplate from './PermitTemplate.vue'; 
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import Button from '@/components/ui/button/Button.vue'
import { isVSUAdmin } from '@/router/routeGuard'
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

const route = useRoute()
const router = useRouter()
const recordId = route.params.id
const record = ref(null)
const recordItems = ref([])
const error = ref(null)

const fetchCollectionRecord = async () => {
  // Fetch the main collection record
  const { data, error: fetchError } = await supabase
    .from('collection_records')
    .select(`
      id,
      created_at,
      is_paid,
      approved_at,
      user:profiles!forest_product_collection_records_user_id_fkey (first_name, last_name),
      created_by:profiles!collection_records_created_by_fkey (first_name, last_name),
      approved_by:profiles!collection_records_approved_by_fkey (first_name, last_name),
      purpose,
      collection_request_id
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
      const totalCost = item.total_cost.toFixed(2);
      return `${productName} (Location: ${locationName}, Quantity: ${quantity}, Total: ₱${totalCost})`;
    }).join('; ');

    // Prepare permit data
    const permitData = {
      permitNo: record.value.id, // Permit Number is the record ID
      dateIssued: new Date(record.value.created_at).toLocaleDateString(), // Date the record was created
      name: `${record.value.user.first_name} ${record.value.user.last_name}`,
      permission: `collect the forest products: ${forestProductsList}`, // Updated to "permission"
      purpose: record.value.purpose, // Official, Personal, or Others
      collectionRequestId: record.value.collection_request_id, // Collection Request ID
      expiryDate: new Date(new Date(record.value.created_at).setFullYear(new Date(record.value.created_at).getFullYear() + 1)).toLocaleDateString(),
      chargesPaid: calculateTotalCost().toFixed(2),
      issuedBy: `${record.value.created_by.first_name} ${record.value.created_by.last_name}`, // Name of the user who created the record
      inspectedBy: `${record.value.created_by.first_name} ${record.value.created_by.last_name}`, // Same as "Issued by"
    };

    // Generate the PDF
    const permitElement = document.createElement('div');
    document.body.appendChild(permitElement);

    const app = createApp(PermitTemplate, { permitData });
    app.mount(permitElement);

    const options = {
      margin: 1,
      filename: `Forest_Conservation_Permit_${record.value.id}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
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

    // Fetch the collection record items
    const { data: items, error: itemsError } = await supabase
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

    if (itemsError) {
      console.error('Error fetching collection record items:', itemsError);
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

    // Prepare permit data
    const permitData = {
      permitNo: record.value.id, // Permit Number is the record ID
      dateIssued: new Date().toLocaleDateString(), // Current date
      name: `${record.value.user.first_name} ${record.value.user.last_name}`,
      permission: `collect the forest products: ${forestProductsList}`, // Updated to "permission"
      purpose: record.value.purpose, // Official, Personal, or Others
      collectionRequestId: record.value.collection_request_id, // Collection Request ID
      expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString(),
      chargesPaid: calculateTotalCost().toFixed(2),
      issuedBy: `${record.value.created_by.first_name} ${record.value.created_by.last_name}`, // Name of the user who created the record
      inspectedBy: `${record.value.created_by.first_name} ${record.value.created_by.last_name}`, // Same as "Issued by"
    };

    // Generate the PDF
    const permitElement = document.createElement('div');
    document.body.appendChild(permitElement);

    const app = createApp(PermitTemplate, { permitData });
    app.mount(permitElement);

    const options = {
      margin: 1,
      filename: `Forest_Conservation_Permit_${recordId}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    };

    await html2pdf().from(permitElement).set(options).save();

    app.unmount();
    document.body.removeChild(permitElement);

    // Show success message
    toast.success('Collection record marked as paid successfully. Check your downloads to see the permit.', { duration: 2000 });

    // Refresh the record
    fetchCollectionRecord();
  } catch (err) {
    console.error('Error marking as paid:', err);
    error.value = 'Failed to mark as paid';
  }
};

// Calculate total from all items
const calculateTotalCost = () => {
  return recordItems.value.reduce((sum, item) => sum + item.total_cost, 0)
}

onMounted(() => {
  fetchCollectionRecord()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-2 px-1 sm:py-4 mt-5 sm:px-3 lg:px-4">
    <div class="max-w-4xl mx-auto mb-4 flex justify-between items-center">
      <Button @click="router.back()" class="bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back
      </Button>
      <Button 
      v-if="record?.is_paid" 
      @click="downloadPermit" 
      class="bg-gray-900 hover:bg-gray-700 text-white">
      Download Permit
      </Button>
    </div>

    <div
      v-if="error"
      class="max-w-4xl mx-auto mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-lg"
    >
      <div class="flex items-center">
        <svg class="h-4 w-4 sm:h-5 sm:w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <p class="ml-2 sm:ml-3 text-xs sm:text-sm">{{ error }}</p>
      </div>
    </div>

    <div v-if="record" class="max-w-4xl mx-auto bg-white rounded-lg sm:rounded-xl shadow-md sm:shadow-lg overflow-hidden">
      <div class="border-b border-gray-200 p-4 sm:p-8">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6 sm:gap-8">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Collection Receipt</h1>
            <p class="text-sm text-gray-500 mt-1">Forest Products Collection Record</p>
          </div>
          <div class="sm:text-right space-y-2">
            <div>
              <p class="text-sm text-gray-500">Receipt No.</p>
              <p class="text-lg font-bold text-gray-900">#{{ record.id }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Date Issued</p>
              <p class="text-base text-gray-900">{{ new Date(record.created_at).toLocaleDateString() }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Purpose</p>
              <p class="text-base text-gray-900">{{ record.purpose }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Request ID</p>
              <p 
              class="text-base text-blue-600 cursor-pointer hover:underline" 
              @click="router.push(`/authenticated/collection-requests/${record.collection_request_id}`)"
              >
              {{ record.collection_request_id }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="p-4 sm:p-8">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
          <div>
            <h2 class="text-xs sm:text-sm font-medium text-gray-500 mb-2">Processed By</h2>
            <p class="text-sm sm:text-base text-gray-900 font-medium">
              {{ record.created_by ? `${record.created_by.first_name} ${record.created_by.last_name}` : 'N/A' }}
            </p>
          </div>
          <div>
            <h2 class="text-xs sm:text-sm font-medium text-gray-500 mb-2">Collector Details</h2>
            <p class="text-sm sm:text-base text-gray-900 font-medium">
              {{ record.user ? `${record.user.first_name} ${record.user.last_name}` : 'N/A' }}
            </p>
          </div>
        </div>

        <div class="mb-6 sm:mb-8">
          <h2 class="text-xs sm:text-sm font-medium text-gray-500 mb-4">Collection Details</h2>
          <div class="bg-gray-50 rounded-lg overflow-x-auto">
            <table class="w-full min-w-[640px]">
              <thead>
                <tr class="bg-gray-100">
                  <th class="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Forest Product</th>
                  <th class="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th class="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Purchased Quantity</th>
                  <th class="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Price Per Unit</th>
                  <th class="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="item in recordItems" :key="item.id">
                  <td class="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900">
                    {{ item.fp_and_location?.forest_product?.name || 'N/A' }}
                    <p class="text-gray-500 text-xs sm:text-xs">
                      Quantity: {{ item.quantity_during_purchase }} {{ item.fp_and_location?.forest_product?.measurement_unit?.unit_name || 'units' }}
                    </p>
                    <p class="text-gray-500 text-xs sm:text-xs">
                      Deducted: {{ item.deducted_quantity }} {{ item.fp_and_location?.forest_product?.measurement_unit?.unit_name || 'units' }}
                    </p>
                    <p class="text-gray-500 text-xs sm:text-xs">
                      Remaining: {{ item.remaining_quantity_during_purchase }} {{ item.fp_and_location?.forest_product?.measurement_unit?.unit_name || 'units' }}
                    </p>
                  </td>
                  <td class="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 text-right">
                    {{ item.fp_and_location?.location?.name || 'N/A' }}
                  </td>
                  <td class="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 text-right">
                    {{ item.deducted_quantity }} {{ item.fp_and_location?.forest_product?.measurement_unit?.unit_name || 'units' }}
                  </td>
                  <td class="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 text-right">
                    ₱{{ item.price_per_unit_during_purchase }}
                  </td>
                  <td class="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 text-right font-medium">
                    ₱{{ item.total_cost }}
                  </td>
                </tr>
                <tr v-if="recordItems.length === 0">
                  <td colspan="5" class="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 text-center">
                    No items found in this collection record.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="border-t border-gray-200 pt-6 sm:pt-8">
          <div class="flex flex-col sm:flex-row sm:justify-end gap-6 sm:gap-4">
            <div class="w-full sm:w-64">
              <div class="flex justify-between py-2">
                <p class="text-xs sm:text-sm font-medium text-gray-500">Total Amount</p>
                <p class="text-lg sm:text-xl font-bold text-gray-900">₱{{ calculateTotalCost().toFixed(2) }}</p>
              </div>
              <div class="flex justify-between py-2 border-t border-gray-200 mt-2">
                <p class="text-xs sm:text-sm font-medium text-gray-500">Payment Status</p>
                <p class="text-xs sm:text-sm font-medium" :class="record.is_paid ? 'text-green-600' : 'text-red-600'">
                  {{ record.is_paid ? 'PAID' : 'UNPAID' }}
                </p>
              </div>

              <template v-if="record.is_paid">
                <div class="flex justify-between py-2 border-t border-gray-200">
                  <p class="text-xs sm:text-sm font-medium text-gray-500">Approved By</p>
                  <p class="text-xs sm:text-sm text-gray-900">
                    {{ record.approved_by ? `${record.approved_by.first_name} ${record.approved_by.last_name}` : 'N/A' }}
                  </p>
                </div>
                <div class="flex justify-between py-2">
                  <p class="text-xs sm:text-sm font-medium text-gray-500">Approved At</p>
                  <p class="text-xs sm:text-sm text-gray-900">
                    {{ record.approved_at ? new Date(record.approved_at).toLocaleDateString() : 'N/A' }}
                  </p>
                </div>
              </template>

              <div v-if="isVSUAdmin && !record.is_paid" class="mt-4">
                <AlertDialog>
                  <AlertDialogTrigger>
                    <Button class="w-full">
                      Mark as Paid
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
                      <AlertDialogAction @click="markAsPaid">Mark as Paid</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-gray-50 px-4 sm:px-8 py-4 sm:py-6">
        <div class="text-xs sm:text-sm text-gray-500 text-center">
          <p>Thank you for your business</p>
        </div>
      </div>
    </div>
  </div>
</template>