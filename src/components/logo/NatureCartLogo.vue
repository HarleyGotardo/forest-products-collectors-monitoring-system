<template>
  <svg
    :width="width"
    :height="height"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
  >
    <rect width="64" height="64" fill="url(#pattern0_12_21)" />
    <defs>
      <pattern
        id="pattern0_12_21"
        patternContentUnits="objectBoundingBox"
        width="1"
        height="1"
      >
        <use xlink:href="#image0_12_21" transform="scale(0.015625)" />
      </pattern>
      <image
        id="image0_12_21"
        width="32"
        height="32"
        xlink:href="data:image/png;base64,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"
      />
    </defs>
  </svg>
</template>

<script setup>
import { defineProps } from 'vue'

const props = defineProps({
  width: {
    type: String,
    default: '64'
  },
  height: {
    type: String,
    default: '64'
  }
})
</script>