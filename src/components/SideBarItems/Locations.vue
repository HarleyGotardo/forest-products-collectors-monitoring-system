<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  isDropdownOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggleDropdown'])

const toggleDropdown = () => {
  emit('toggleDropdown')
}
</script>

<template>
  <div>
    <button @click="toggleDropdown" class="flex items-center gap-3 p-3 w-full text-left hover:bg-gray-100 rounded-lg">
      <img src="@/assets/location_icon.png" alt="icon" class="w-6 h-6" />
      <span>{{ label }}</span>
      <svg class="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path v-if="!isDropdownOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 15l-7-7-7 7" />
      </svg>
    </button>
    <div v-if="isDropdownOpen" class="ml-6 space-y-2">
      <slot></slot>
    </div>
  </div>
</template>