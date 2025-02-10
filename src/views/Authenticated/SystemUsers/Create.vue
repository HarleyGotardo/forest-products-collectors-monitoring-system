<script setup>
import { ref } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import Swal from 'sweetalert2'

const email = ref('')
const loading = ref(false)

const inviteUser = async () => {
  if (!email.value) {
    Swal.fire('Error', 'Please enter an email address', 'error')
    return
  }

  loading.value = true

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: email.value
  })

  loading.value = false

  if (error) {
    Swal.fire('Error', error.message, 'error')
  } else {
    Swal.fire('Success', 'Invitation sent successfully', 'success')
    email.value = ''
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-6">
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">Create User</h2>
      <form @submit.prevent="inviteUser">
        <div class="mb-4">
          <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="mt-1 block w-full px-4 py-3 rounded-lg bg-white border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
            placeholder="Enter user's email"
            required
          />
        </div>
        <div class="flex justify-end">
          <button
            type="submit"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            :disabled="loading"
          >
            {{ loading ? 'Sending...' : 'Send Invitation' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
/* Add any additional styles here */
</style>