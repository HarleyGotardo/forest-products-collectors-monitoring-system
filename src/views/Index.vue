<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import NatureCartLogo from '@/components/logo/NatureCartLogo.vue'
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'

const router = useRouter()
const email = ref('')
const password = ref('')

const handleLogin = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
    if (error) throw error

    const { user } = data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('approval_flag') 
      .eq('id', user.id)
      .single()

    if (profileError) throw profileError

    if (profile.approval_flag === null) {
      await supabase.auth.signOut()
      toast.error('Your account is not yet approved. Please wait for the admin to approve your account.', {
        duration: 3000,
      })
    } else {
      toast.success('Successfully Logged In.', {
        duration: 2000,
      })
      setTimeout(() => {
        router.push({ name: 'Dashboard' })
      }, 2000)
    }
  } catch (error) {
    toast.error(`Login Failed: ${error.message}`, {
      duration: 3000,
    })
  }
}


const goToSignUpPage = () => {
  router.push({ name: 'SignUp' })
}
</script>
<template>
  <div class="min-h-screen flex flex-col md:flex-row">
    <!-- Left Section - Login Form -->
    <div class="w-full md:w-1/2 flex flex-col justify-center p-4 sm:p-6 md:p-12 order-2 md:order-1">
      <div class="max-w-sm w-full mx-auto space-y-8">
      <div class="flex between">
        <div class="w-10 h-10 sm:w-14 sm:h-14">
        <NatureCartLogo width="100%" height="100%" />
        </div>
        <h1 class="text-lg sm:text-xl md:text-3xl font-bold ml-2">Login to Nature Cart</h1>
      </div>

      <div>
        <p class="text-sm sm:text-base md:text-lg text-gray-600">Please enter your login information.</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div class="space-y-4">
        <div class="max-w-xs sm:max-w-sm mx-auto">
          <label for="email" class="block text-sm sm:text-base font-medium text-gray-700">
          Email
          </label>
          <input
          id="email"
          type="email"
          v-model="email"
          class="mt-1 block w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm sm:text-base"
          />
        </div>

        <div class="max-w-xs sm:max-w-sm mx-auto">
          <label for="password" class="block text-sm sm:text-base font-medium text-gray-700">
          Password
          </label>
          <input
          id="password"
          type="password"
          v-model="password"
          class="mt-1 block w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm sm:text-base"
          />
        </div>
        </div>

        <button
        type="submit"
        class="w-full flex justify-center py-2 sm:py-2.5 px-4 border border-transparent rounded-full shadow-sm text-sm sm:text-base font-medium text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
        >
        Log In
        </button>
      </form>

      <div class="text-center mt-4">
        <p class="text-sm sm:text-base text-gray-600">
        No account?
        <button @click="goToSignUpPage" class="text-green-600 hover:text-green-500 font-medium">
          Sign Up
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