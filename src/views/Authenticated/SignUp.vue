<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import NatureCartLogo from '@/components/logo/NatureCartLogo.vue'
import { toast, Toaster } from 'vue-sonner'
import { supabase } from '@/lib/supabaseClient'

const router = useRouter()
const email = ref('')
const password = ref('')

const handleSignUp = async () => {
  try {
    const { data, error } = await supabase.auth.signUp({ email: email.value, password: password.value })
    if (error) throw error

    // Create a new profile in the public.profiles table
    const { user } = data
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{ id: user.id, email_address: user.email }])

    if (profileError) throw profileError

    toast.success('Sign Up Successful! Please check your email to confirm your account.', {
      action: {
        label: 'Login',
        onClick: goToLoginPage,
      },
      duration: 3000,
    })

    setTimeout(() => {
      router.push({ name: 'Index' })
    }, 2000)
  } catch (error) {
    toast.error(`Sign Up Failed: ${error.message}`, {
      duration: 3000,
    })
  }
}

const goToLoginPage = () => {
  router.push({ name: 'Index' })
}
</script>

<template>
  <div class="min-h-screen flex flex-col md:flex-row">
    <!-- Left Section - Sign Up Form -->
    <div class="w-full md:w-1/2 flex flex-col justify-center p-4 sm:p-6 md:p-12 order-2 md:order-1">
      <div class="max-w-md w-full mx-auto space-y-8">
        <div class="flex between">
          <div class="w-12 h-12 sm:w-16 sm:h-16">
            <NatureCartLogo width="100%" height="100%" />
          </div>
          <h1 class="text-xl sm:text-2xl md:text-4xl font-bold ml-2">Sign Up for Nature Cart</h1>
        </div>

        <div>
          <p class="text-base sm:text-lg md:text-2xl text-gray-600">Please enter your sign-up information.</p>
        </div>

        <form @submit.prevent="handleSignUp" class="space-y-6">
          <div class="space-y-4">
            <div>
              <label for="email" class="block text-sm sm:text-base font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                v-model="email"
                class="mt-1 block w-full px-3 py-2 sm:py-3 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm sm:text-base"
              />
            </div>

            <div>
              <label for="password" class="block text-sm sm:text-base font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                v-model="password"
                class="mt-1 block w-full px-3 py-2 sm:py-3 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm sm:text-base"
              />
            </div>
          </div>

          <button
            type="submit"
            class="w-full flex justify-center py-2 sm:py-3 px-4 border border-transparent rounded-full shadow-sm text-sm sm:text-base font-medium text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
          >
            Sign Up
          </button>
        </form>
        <div class="text-center mt-4">
          <p class="text-sm sm:text-base text-gray-600">
            Already have an account?
            <button @click="goToLoginPage" class="text-green-600 hover:text-green-500 font-medium">
              Login
            </button>
          </p>
        </div>
      </div>
    </div>

    <!-- Right Section - Branding -->
    <div class="w-full md:w-1/2 bg-green-50 flex flex-col justify-center items-center p-4 sm:p-6 md:p-12 order-1 md:order-2">
      <div class="text-center w-full max-w-3xl">
        <h2 class="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-6 sm:mb-8">
          Forest Product Collectors Monitoring System
        </h2>
        
        <!-- Logos Section -->
        <div class="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-center items-center mb-6 sm:mb-8">
          <div class="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 bg-yellow-400 rounded-lg flex items-center justify-center overflow-hidden p-2">
            <img src="@/assets/vsu_logo.png" alt="VSU Logo" class="w-full h-full object-contain" />
          </div>
          <div class="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 bg-white rounded-lg flex items-center justify-center overflow-hidden p-2">
            <img src="@/assets/DFS_logo.png" alt="DFS Logo" class="w-full h-full object-contain" />
          </div>
        </div>

        <!-- Feature Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
          <div class="bg-white p-4 sm:p-6 rounded-lg shadow-md">
            <div class="flex flex-col sm:flex-row items-center mb-2 gap-2">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full">            
                <img src="@/assets/verify.png" alt="Verify Icon" class="w-full h-full object-contain" />
              </div>
              <h3 class="text-base sm:text-lg md:text-xl font-bold text-center sm:text-left">TRACK FOREST PRODUCT COLLECTION RECORDS</h3>
            </div>
            <p class="text-sm sm:text-base text-gray-600 text-justify">Log and monitor forest product collection with precision. Keep detailed records of quantities, types, and collection dates.</p>
          </div>

          <div class="bg-white p-4 sm:p-6 rounded-lg shadow-md">
            <div class="flex flex-col sm:flex-row items-center mb-2 gap-2">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full">            
                <img src="@/assets/location.png" alt="Location Icon" class="w-full h-full object-contain" />
              </div>
              <h3 class="text-base sm:text-lg md:text-xl font-bold text-center sm:text-left">LOCATE FOREST PRODUCTS</h3>
            </div>
            <p class="text-sm sm:text-base text-gray-600 text-justify">Pinpoint and map exact locations of forest product sources. Facilitate easy tracking and spatial analysis.</p>
          </div>

          <div class="bg-white p-4 sm:p-6 rounded-lg shadow-md">
            <div class="flex flex-col sm:flex-row items-center mb-2 gap-2">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full">            
                <img src="@/assets/registered.png" alt="Register Icon" class="w-full h-full object-contain" />
              </div>
              <h3 class="text-base sm:text-lg md:text-xl font-bold text-center sm:text-left">REGISTER COLLECTORS</h3>
            </div>
            <p class="text-sm sm:text-base text-gray-600 text-justify">Maintain a comprehensive database of authorized forest product collectors with complete details.</p>
          </div>
        </div>
      </div>
    </div>
    <Toaster />
  </div>
</template>