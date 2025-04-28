<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'
import NatureCartLogo from '@/components/logo/NatureCartLogo.vue'

const router = useRouter()
const route = useRoute()
const newPassword = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const isValidSession = ref(false)

const handleResetPassword = async () => {
  if (!newPassword.value || !confirmPassword.value) {
    toast.error('Please fill in all fields')
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    toast.error('Passwords do not match')
    return
  }

  if (newPassword.value.length < 6) {
    toast.error('Password must be at least 6 characters long')
    return
  }

  isLoading.value = true
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword.value
    })

    if (error) throw error

    toast.success('Password reset successful!')
    setTimeout(() => {
      router.push({ name: 'Index' })
    }, 2000)
  } catch (error) {
    toast.error(`Error: ${error.message}`)
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  try {
    // Get the access token from the URL
    const accessToken = route.hash.split('access_token=')[1]?.split('&')[0]
    
    if (!accessToken) {
      toast.error('Invalid reset link')
      setTimeout(() => {
        router.push({ name: 'Index' })
      }, 2000)
      return
    }

    // Set the session with the access token
    const { data: { session }, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: ''
    })

    if (error) throw error

    if (!session) {
      toast.error('Invalid or expired reset link')
      setTimeout(() => {
        router.push({ name: 'Index' })
      }, 2000)
      return
    }

    isValidSession.value = true
  } catch (error) {
    console.error('Session check error:', error)
    toast.error('Error processing reset link')
    setTimeout(() => {
      router.push({ name: 'Index' })
    }, 2000)
  }
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo and Title -->
      <div class="text-center mb-8">
        <div class="w-20 h-20 mx-auto bg-gradient-to-r from-green-600 to-green-500 rounded-full p-3 shadow-lg mb-4">
          <img src="@/assets/nature-cart.png" alt="Nature Cart Logo" class="w-full h-full object-contain" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900">Reset Password</h1>
        <p class="mt-2 text-gray-600">Enter your new password below</p>
      </div>

      <!-- Reset Password Form -->
      <div v-if="isValidSession" class="bg-white p-8 rounded-xl shadow-lg">
        <form @submit.prevent="handleResetPassword" class="space-y-6">
          <div>
            <label for="new-password" class="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <div class="mt-1 relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                id="new-password"
                type="password"
                v-model="newPassword"
                required
                class="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="Enter new password"
              />
            </div>
          </div>

          <div>
            <label for="confirm-password" class="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <div class="mt-1 relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                id="confirm-password"
                type="password"
                v-model="confirmPassword"
                required
                class="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-base font-medium text-white bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isLoading ? 'Resetting...' : 'Reset Password' }}
          </button>
        </form>
      </div>

      <!-- Loading State -->
      <div v-else class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        <p class="mt-4 text-gray-600">Verifying reset link...</p>
      </div>
    </div>

    <Toaster
      theme="light"
      :toastOptions="{
        class: 'bg-[#ecfdf5] text-gray-800 border border-green-200 rounded-lg shadow-md',
        style: {
          padding: '1rem',
        }
      }"
    />
  </div>
</template>