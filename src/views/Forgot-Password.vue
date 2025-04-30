<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'
import Button from "@/components/ui/button/Button.vue"
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

const router = useRouter()
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const isPasswordVisible = ref(false)
const isConfirmPasswordVisible = ref(false)
const hasRecoveryToken = ref(false)
const accessToken = ref(null)
const isValidatingToken = ref(true)

const validateAndRedirect = async () => {
  isValidatingToken.value = true
  
  try {
    // Get the hash parameters
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const type = hashParams.get('type')
    const token_hash = hashParams.get('token_hash')

    // If no token hash or not a recovery type, redirect
    if (!token_hash || type !== 'recovery') {
      throw new Error('Invalid or missing recovery token')
    }

    // Verify the recovery token
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: 'recovery'
    })

    if (error) throw error

    if (data.session) {
      accessToken.value = data.session.access_token
      hasRecoveryToken.value = true
    } else {
      throw new Error('No valid session found')
    }
  } catch (error) {
    console.error('Token validation error:', error)
    toast.error('Invalid password reset link. Redirecting to login...', {
      duration: 3000,
    })
    setTimeout(() => {
      router.push('/')
    }, 1500)
  } finally {
    isValidatingToken.value = false
  }
}

onMounted(async () => {
  await validateAndRedirect()

  // Listen for password recovery event
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth event:', event)
    if (event === 'PASSWORD_RECOVERY') {
      hasRecoveryToken.value = true
      if (session) {
        accessToken.value = session.access_token
      }
    }
  })
})

const togglePasswordVisibility = (field) => {
  if (field === 'password') {
    isPasswordVisible.value = !isPasswordVisible.value
  } else {
    isConfirmPasswordVisible.value = !isConfirmPasswordVisible.value
  }
}

const handlePasswordReset = async () => {
  if (!hasRecoveryToken.value) {
    toast.error('Invalid password recovery session', {
      duration: 3000,
    })
    return
  }

  if (password.value !== confirmPassword.value) {
    toast.error('Passwords do not match', {
      duration: 3000,
    })
    return
  }

  if (password.value.length < 6) {
    toast.error('Password must be at least 6 characters long', {
      duration: 3000,
    })
    return
  }

  isLoading.value = true

  try {
    // Update the user's password
    const { data, error } = await supabase.auth.updateUser({
      password: password.value
    })

    if (error) throw error

    toast.success('Password updated successfully! Redirecting to login...', {
      duration: 3000,
    })

    // Sign out the user
    await supabase.auth.signOut()
    
    setTimeout(() => {
      router.push('/')
    }, 2000)
  } catch (error) {
    console.error('Password update error:', error)
    toast.error(`Error updating password: ${error.message}`, {
      duration: 3000,
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-4">
    <!-- Loading State -->
    <div v-if="isValidatingToken" class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
      <p class="text-gray-600">Validating reset link...</p>
    </div>

    <!-- Main Content -->
    <div v-else-if="hasRecoveryToken" class="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg">
      <!-- Header -->
      <div class="text-center">
        <img src="@/assets/nature-cart.png" alt="Nature Cart Logo" class="mx-auto h-16 w-16" />
        <h2 class="mt-6 text-3xl font-bold text-gray-900">Reset Password</h2>
        <p class="mt-2 text-sm text-gray-600">
          Enter your new password below
        </p>
      </div>

      <!-- Form -->
      <form class="mt-8 space-y-6" @submit.prevent>
        <!-- New Password -->
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">
            New Password
          </label>
          <div class="mt-1 relative">
            <input
              :type="isPasswordVisible ? 'text' : 'password'"
              v-model="password"
              required
              class="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter new password"
            />
            <button
              type="button"
              @click="togglePasswordVisibility('password')"
              class="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <svg
                class="h-5 w-5 text-gray-400"
                :class="{ 'text-green-500': isPasswordVisible }"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path v-if="!isPasswordVisible" d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path v-if="!isPasswordVisible" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                <path v-if="isPasswordVisible" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 12C18.268 7.943 14.478 5 10 5a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" />
                <path v-if="isPasswordVisible" d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 12c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Confirm Password -->
        <div>
          <label for="confirm-password" class="block text-sm font-medium text-gray-700">
            Confirm Password
          </label>
          <div class="mt-1 relative">
            <input
              :type="isConfirmPasswordVisible ? 'text' : 'password'"
              v-model="confirmPassword"
              required
              class="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Confirm new password"
            />
            <button
              type="button"
              @click="togglePasswordVisibility('confirm')"
              class="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <svg
                class="h-5 w-5 text-gray-400"
                :class="{ 'text-green-500': isConfirmPasswordVisible }"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path v-if="!isConfirmPasswordVisible" d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path v-if="!isConfirmPasswordVisible" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                <path v-if="isConfirmPasswordVisible" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 12C18.268 7.943 14.478 5 10 5a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" />
                <path v-if="isConfirmPasswordVisible" d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 12c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Submit Button with Confirmation Dialog -->
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              :disabled="isLoading"
              class="w-full bg-green-600 text-white hover:bg-green-700"
            >
              <svg
                v-if="isLoading"
                class="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {{ isLoading ? 'Updating Password...' : 'Update Password' }}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Password Update</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to update your password? You will need to use this new password to log in.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel class="bg-gray-100 hover:bg-gray-200 text-gray-800">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                @click="handlePasswordReset"
                class="bg-green-600 hover:bg-green-700"
              >
                Update Password
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <!-- Back to Login -->
        <div class="text-center">
          <button
            type="button"
            @click="router.push('/')"
            class="text-sm text-green-600 hover:text-green-500 font-medium"
          >
            Back to Login
          </button>
        </div>
      </form>
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
