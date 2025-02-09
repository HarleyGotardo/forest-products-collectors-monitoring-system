<template>
    <div>
      <button @click="showAlert" :class="buttonClass">
        <slot>Show Alert</slot>
      </button>
    </div>
  </template>
  
  <script setup>
  import { defineProps, defineEmits } from 'vue'
  import Swal from 'sweetalert2'
  import { useRouter } from 'vue-router'
  
  const props = defineProps({
    title: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      required: true
    },
    confirmButtonText: {
      type: String,
      default: 'Confirm'
    },
    cancelButtonText: {
      type: String,
      default: 'Cancel'
    },
    buttonClass: {
      type: String,
      default: 'w-full mt-4 px-4 py-2 text-white rounded-xl hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
    },
    redirectTo: {
      type: String,
      default: null
    }
  })
  
  const emit = defineEmits(['confirmed'])
  
  const router = useRouter()
  
  const showAlert = () => {
    Swal.fire({
      title: props.title,
      text: props.text,
      icon: props.icon,
      showCancelButton: true,
      cancelButtonText: props.cancelButtonText,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: props.confirmButtonText
    }).then((result) => {
      if (result.isConfirmed) {
        emit('confirmed')
        if (props.redirectTo) {
          router.push({ name: props.redirectTo })
        }
      }
    })
  }
  </script>