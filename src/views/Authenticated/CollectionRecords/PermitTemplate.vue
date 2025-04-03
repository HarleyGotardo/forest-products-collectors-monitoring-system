<template>
    <div id="permit" class="p-8 bg-white text-black max-w-[800px] mx-auto border border-gray-300 rounded-lg">
      <div class="text-center">
        <h1 class="text-lg font-bold uppercase">College of Forestry and Environmental Science</h1>
        <h2 class="text-md font-semibold">Department of Forest Science</h2>
        <p>Visca, Baybay, Leyte</p>
        <h3 class="text-lg font-bold mt-4 uppercase">Forest Conservation Permit</h3>
      </div>
  
      <div class="mt-6">
        <p>To Whom It May Concern:</p>
        <p class="mt-4">
          This is to certify that Mr./Ms. <span class="font-bold underline">{{ permitData.name }}</span>
          is given permission to <span class="font-bold underline">{{ permitData.purpose }}</span>.
        </p>
        <p class="mt-4">
          This permit expires on <span class="font-bold underline">{{ permitData.expiryDate }}</span>.
        </p>
      </div>
  
      <div class="mt-6">
        <p>Purpose:</p>
        <ul class="list-none mt-2">
          <li>
            <input type="checkbox" :checked="permitData.purpose === 'Official'" disabled /> Official
          </li>
          <li>
            <input type="checkbox" :checked="permitData.purpose === 'Personal'" disabled /> Personal
          </li>
          <li>
            <input type="checkbox" :checked="permitData.purpose === 'Others'" disabled /> Others, specify
          </li>
        </ul>
      </div>
  
      <div class="mt-6">
        <p>Forest Charges Paid: <span class="font-bold underline">₱{{ permitData.chargesPaid }}</span></p>
      </div>
  
      <div class="mt-6 grid grid-cols-2 gap-4">
        <div>
          <p>Issued by:</p>
          <p class="mt-4 font-bold underline">{{ permitData.issuedBy }}</p>
          <p>Forest Guard On-Duty</p>
        </div>
        <div>
          <p>Inspected by:</p>
          <p class="mt-4 font-bold underline">{{ permitData.inspectedBy }}</p>
          <p>Forest Guard On-Duty</p>
        </div>
      </div>
  
      <div class="mt-6">
        <p>Noted by:</p>
        <p class="mt-4 font-bold underline">DENNIS P. PEQUE</p>
        <p>Forest Conservation Officer</p>
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