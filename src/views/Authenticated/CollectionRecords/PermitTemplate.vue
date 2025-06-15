<template>
  <div id="permit" class="w-full min-h-full bg-white p-6 flex flex-col relative text-black text-sm" style="font-family: 'Times New Roman', Times, serif;">
    <!-- Header -->
    <div class="mb-4">
      <div class="flex flex-col items-center mb-2">
        <div class="flex items-center justify-center w-full mb-3">
          <div class="w-12 h-12 mr-2">
        <img src="@/assets/ffes-logo.jpg" alt="">
          </div>
        </div>
        <div class="text-center">
          <h1 class="text-base uppercase m-0">Faculty of Forestry and Environmental Science</h1>
          <h2 class="text-sm mt-1 mb-0.5 m-0">Department of Forest Science</h2>
          <p class="text-xs m-0">Visca, Baybay, Leyte</p>
        </div>
        <div class="mt-3 w-full text-center">
                    <h2 class="text-sm m-0 inline-block pb-1">
        Forest Product Collectors Monitoring System
          </h2><br>
          <h2 class="text-base uppercase m-0 inline-block border-b border-gray-900 pb-1">
        Forest Conservation Permit
          </h2> 

        </div>
      </div>

      <!-- Permit Information -->
      <div class="flex flex-wrap justify-between mt-3 text-sm">
        <div class="flex justify-between w-full mb-1.5">
          <div class="w-1/2">
        <span>Permit No.:</span>
        <span class="ml-2">{{ permitData.permitNo }}</span>
          </div>
          <div class="w-1/2">
        <span>Date Issued:</span>
        <span class="ml-2">{{ permitData.dateIssued }}</span>
          </div>
        </div>
        <div class="flex justify-between w-full mb-1.5">
          <div class="w-1/2">
        <span>Request Number:</span>
        <span class="ml-2">{{ permitData.collectionRequestId }}</span>
          </div>
          <div class="w-1/2">
        <span>Expiry Date:</span>
        <span class="ml-2">{{ permitData.expiryDate }}</span>
          </div>
        </div>
      </div>

      <div class="h-1 bg-gray-900 my-3"></div>
    </div>

    <!-- Main Content -->
    <div class="flex-grow mb-3 text-sm text-justify">
      <p class="my-1.5 leading-relaxed">To Whom It May Concern:</p>

      <p class="my-3 leading-relaxed">
      This is to certify that Mr./Ms. <span class="font-bold">{{ permitData.name }}</span> is given permission to
      <span class="font-bold">
        <template v-if="Array.isArray(permitData.permission)">
          collect the following forest products:
          <table class="w-full mt-2 mb-2 border border-gray-400 text-xs">
            <thead class="bg-gray-100">
              <tr>
                <th class="border border-gray-400 px-2 py-1 text-left">Forest Product</th>
                <th class="border border-gray-400 px-2 py-1 text-left">Location</th>
                <th class="border border-gray-400 px-2 py-1 text-right">Quantity</th>
                <th class="border border-gray-400 px-2 py-1 text-right">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in permitData.permission" :key="idx">
                <td class="border border-gray-400 px-2 py-1 font-normal">{{ item.productName }}</td>
                <td class="border border-gray-400 px-2 py-1 font-normal">{{ item.locationName }}</td>
                <td class="border border-gray-400 px-2 py-1 text-right font-normal">{{ item.quantity }}</td>
                <td class="border border-gray-400 px-2 py-1 text-right font-normal">{{ item.totalCost }}</td>
              </tr>
            </tbody>
          </table>
        </template>
        <template v-else>
          {{ permitData.permission }}
        </template>
      </span>
      </p>

      <div class="my-3 border border-gray-300 p-2">
      <p class=" mb-2 mt-0">Purpose:</p>
      <div class="flex gap-4">
        <div class="flex items-center">
        <input type="checkbox" :checked="permitData.purpose === 'Official'" disabled class="mr-2 h-3 w-3" />
        <span>Official</span>
        </div>
        <div class="flex items-center">
        <input type="checkbox" :checked="permitData.purpose === 'Personal'" disabled class="mr-2 h-3 w-3" />
        <span>Personal</span>
        </div>
        <div class="flex items-center">
        <input 
          type="checkbox" 
          :checked="permitData.purpose && permitData.purpose !== 'Official' && permitData.purpose !== 'Personal'" 
          disabled 
          class="mr-2 h-3 w-3" 
        />
        <span>Others, specify:</span>
        <span 
          v-if="permitData.purpose && permitData.purpose !== 'Official' && permitData.purpose !== 'Personal'" 
          class=" underline ml-2"
        >
          {{ permitData.purpose }}
        </span>
      </div>
      </div>
      </div>

      <div class="my-2 py-3 border-t border-b border-gray-300">
      <p class="m-0">Forest Charges Paid: <span class="font-bold">{{ permitData.chargesPaid }}</span></p>
      </div>
    </div>

    <!-- Signatories -->
    <div class="mb-6">
      <div class="flex justify-between mb-6">
        <div class="w-5/12">
          <p class="text-xs m-0">Issued by:</p>
          <p class=" underline mt-4 mb-1 text-sm">{{ permitData.issuedBy }}</p>
          <p class="text-xs m-0">Forest Protection Unit Personnel</p>
        </div>
        <div class="w-5/12">
          <p class="text-xs m-0">Approved by:</p>
          <p class=" underline mt-4 mb-1 text-sm">{{ permitData.inspectedBy }}</p>
          <p class="text-xs m-0">Forest Protection Unit Personnel</p>
        </div>
      </div>

      <div v-if="permitData.note" class="text-center mt-3">
        <p class="text-xs m-0">Note:</p>
        <p class="mt-2 text-sm">{{ permitData.note }}</p>
      </div>

      <div class="text-center mt-3">
        <p class="text-xs m-0">Noted by:</p>
        <p class=" underline mt-4 mb-1 text-sm">{{ permitData.forestConservationOfficer }}</p>
        <p class="text-xs m-0">Forest Conservation Officer</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="text-center text-xs pt-2 border-t border-gray-300">
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