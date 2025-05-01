<script setup>
import { ref, onMounted, computed } from 'vue'
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

// Password strength validation
const passwordStrength = computed(() => {
  if (!password.value) return { score: 0, feedback: '' }
  
  let score = 0
  let feedback = []
  
  // Check length
  if (password.value.length < 6) {
    feedback.push('At least 6 characters')
  } else if (password.value.length >= 12) {
    score += 2
  } else if (password.value.length >= 8) {
    score += 1
  }
  
  // Check for numbers
  if (/\d/.test(password.value)) {
    score += 1
  } else {
    feedback.push('Add numbers')
  }
  
  // Check for uppercase
  if (/[A-Z]/.test(password.value)) {
    score += 1
  } else {
    feedback.push('Add uppercase letters')
  }
  
  // Check for lowercase
  if (/[a-z]/.test(password.value)) {
    score += 1
  } else {
    feedback.push('Add lowercase letters')
  }
  
  // Check for special characters
  if (/[^A-Za-z0-9]/.test(password.value)) {
    score += 1
  } else {
    feedback.push('Add special characters')
  }
  
  return {
    score,
    feedback: feedback.join(', ')
  }
})

// Password strength labels and colors
const strengthLabel = computed(() => {
  const score = passwordStrength.value.score
  if (score === 0) return 'Very weak'
  if (score <= 2) return 'Weak'
  if (score <= 3) return 'Medium'
  if (score <= 4) return 'Strong'
  return 'Very strong'
})

const strengthColor = computed(() => {
  const score = passwordStrength.value.score
  if (score === 0) return 'bg-gray-200'
  if (score <= 2) return 'bg-red-500'
  if (score <= 3) return 'bg-yellow-500'
  if (score <= 4) return 'bg-green-400'
  return 'bg-green-600'
})

const passwordsMatch = computed(() => {
  if (!confirmPassword.value || !password.value) return null
  return password.value === confirmPassword.value
})

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
    // Force sign out the user in case they got signed in
    await supabase.auth.signOut()
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

  // Additional password strength check
  if (passwordStrength.value.score < 3) {
    toast.error('Please use a stronger password', {
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

// Add form submit handler
const handleFormSubmit = (e) => {
  e.preventDefault()
  if (!isLoading) {
    handlePasswordReset()
  }
}

// Add this new method
const handleBackToLogin = async () => {
  try {
    await supabase.auth.signOut()
    router.push('/')
  } catch (error) {
    console.error('Error signing out:', error)
    router.push('/')
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
      <form class="mt-8 space-y-6" @submit="handleFormSubmit">
        <!-- New Password -->
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">
            New Password
          </label>
          <div class="mt-1 relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <input
              id="password"
              :type="isPasswordVisible ? 'text' : 'password'"
              v-model="password"
              required
              class="appearance-none block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter new password"
            />
            <button
              type="button"
              @click="togglePasswordVisibility('password')"
              class="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path v-if="!isPasswordVisible" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path v-if="!isPasswordVisible" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                <path v-if="isPasswordVisible" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            </button>
          </div>
          
          <!-- Password Strength Indicator -->
          <div v-if="password" class="mt-2">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-medium" :class="{
                'text-red-600': passwordStrength.score <= 2,
                'text-yellow-600': passwordStrength.score === 3,
                'text-green-600': passwordStrength.score > 3
              }">
                Password strength: {{ strengthLabel }}
              </span>
            </div>
            <div class="h-1.5 rounded-full bg-gray-200 w-full flex overflow-hidden">
              <div 
                class="h-full transition-all duration-300"
                :class="strengthColor"
                :style="`width: ${Math.min(passwordStrength.score * 20, 100)}%`"
              ></div>
            </div>
            <p v-if="passwordStrength.feedback" class="text-xs text-gray-500 mt-1">
              {{ passwordStrength.feedback }}
            </p>
          </div>
        </div>

        <!-- Confirm Password -->
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
              :type="isConfirmPasswordVisible ? 'text' : 'password'"
              v-model="confirmPassword"
              required
              class="appearance-none block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Confirm new password"
            />
            <button
              type="button"
              @click="togglePasswordVisibility('confirm')"
              class="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path v-if="!isConfirmPasswordVisible" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path v-if="!isConfirmPasswordVisible" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                <path v-if="isConfirmPasswordVisible" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            </button>
          </div>
          
          <!-- Password Match Indicator -->
          <div v-if="confirmPassword && passwordsMatch !== null" class="mt-1">
            <p v-if="passwordsMatch" class="text-xs text-green-600 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Passwords match
            </p>
            <p v-else class="text-xs text-red-600 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Passwords do not match
            </p>
          </div>
        </div>

        <!-- Submit Button with Confirmation Dialog -->
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="submit"
              :disabled="isLoading || (password && passwordStrength.score < 3)"
              class="w-full text-white"
              :class="password && passwordStrength.score >= 3 ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'"
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                class="text-sm text-green-600 hover:text-green-500 font-medium"
              >
                Back to Login
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Password Reset</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to go back to login? This will cancel the password reset process and the reset link will expire.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel class="bg-gray-100 hover:bg-gray-200 text-gray-800">
                  Stay Here
                </AlertDialogCancel>
                <AlertDialogAction 
                  @click="handleBackToLogin"
                  class="bg-green-600 hover:bg-green-700"
                >
                  Go Back to Login
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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