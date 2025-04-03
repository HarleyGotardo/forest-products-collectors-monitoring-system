<template>
  <div id="permit" class="p-6 bg-white text-black max-w-[800px] mx-auto border-2 border-black rounded-lg">
    <!-- Header -->
    <div class="text-center border-b border-black pb-3">
      <h1 class="text-lg font-bold uppercase">Faculty of Forestry and Environmental Science</h1>
      <h2 class="text-md font-semibold">Department of Forest Science</h2>
      <p class="text-sm">Visca, Baybay, Leyte</p>
      <h3 class="text-lg font-bold mt-3 uppercase">Forest Conservation Permit</h3>
    </div>

    <!-- Permit Number and Date -->
    <div class="flex justify-between mt-3 text-sm">
      <p>Permit No.: <span class="font-bold underline">{{ permitData.permitNo }}</span></p>
      <p>Date Issued: <span class="font-bold underline">{{ permitData.dateIssued }}</span></p>
    </div>

    <!-- Collection Request ID -->
    <div class="mt-3 text-sm">
      <p>Request Number: <span class="font-bold underline">{{ permitData.collectionRequestId }}</span></p>
    </div>

    <!-- Main Content -->
    <div class="mt-4">
      <p>To Whom It May Concern:</p>
      <p class="mt-3">
        This is to certify that 
        <span class="font-bold underline">{{ permitData.name }}</span> 
        is given permission to 
        <span class="font-bold underline">{{ permitData.permission }}</span>.
      </p>
      <p class="mt-3">
        This permit expires on 
        <span class="font-bold underline">{{ permitData.expiryDate }}</span>.
      </p>
    </div>

    <!-- Purpose Section -->
    <div class="mt-4 border border-gray-400 p-3">
      <p class="font-semibold">Purpose:</p>
      <div class="flex space-x-6 mt-2">
        <div>
          <input type="checkbox" :checked="permitData.purpose === 'Official'" disabled class="mr-1" /> 
          <span>Official</span>
        </div>
        <div>
          <input type="checkbox" :checked="permitData.purpose === 'Personal'" disabled class="mr-1" /> 
          <span>Personal</span>
        </div>
        <div>
          <input type="checkbox" :checked="permitData.purpose !== 'Official' && permitData.purpose !== 'Personal'" disabled class="mr-1" /> 
          <span>Others, specify: <span v-if="permitData.purpose !== 'Official' && permitData.purpose !== 'Personal'" class="font-bold underline">{{ permitData.purpose }}</span></span>
        </div>
      </div>
    </div>

    <!-- Charges Section -->
    <div class="mt-4 border-t border-b border-gray-300 py-3">
      <p>Forest Charges Paid: <span class="font-bold underline">₱{{ permitData.chargesPaid }}</span></p>
    </div>

    <!-- Signatories Section -->
    <div class="mt-4 grid grid-cols-2 gap-4">
      <div>
        <p class="text-sm">Issued by:</p>
        <p class="mt-3 font-bold underline">{{ permitData.issuedBy }}</p>
        <p class="text-sm">Forest Guard On-Duty</p>
      </div>
      <div>
        <p class="text-sm">Inspected by:</p>
        <p class="mt-3 font-bold underline">{{ permitData.inspectedBy }}</p>
        <p class="text-sm">Forest Guard On-Duty</p>
      </div>
    </div>

    <!-- Noted By Section -->
    <div class="mt-6 text-center">
      <p class="text-sm">Noted by:</p>
      <p class="mt-3 font-bold underline">DENNIS P. PEQUE</p>
      <p class="text-sm">Forest Conservation Officer</p>
    </div>

    <!-- Footer -->
    <div class="mt-4 text-xs text-center border-t border-gray-300 pt-2">
      <p>This permit is not valid without the signature of authorized personnel.</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  permitData: {
    type: Object,
    required: true,
  },
});
</script>

<style scoped>
#permit {
  font-family: Arial, sans-serif;
}
</style>