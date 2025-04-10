<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import NatureCartLogo from '@/components/logo/NatureCartLogo.vue'
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'

const router = useRouter()
const email = ref('')
const password = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
  if (!email.value || !password.value) {
    toast.error('Please fill in all fields', {
      duration: 3000,
    })
    return
  }
  
  isLoading.value = true
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: email.value, 
      password: password.value 
    })
    
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
  } finally {
    isLoading.value = false
  }
}

const goToSignUpPage = () => {
  router.push({ name: 'SignUp' })
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col lg:flex-row">
    <!-- Green top banner for mobile view only -->
    <div class="lg:hidden relative bg-gradient-to-r from-green-600 to-green-500 py-8 px-6 text-white rounded-b-3xl shadow-lg">
      <div class="absolute right-0 top-0 w-32 h-32 bg-green-400 rounded-bl-full opacity-20"></div>
      <div class="absolute left-0 bottom-0 w-24 h-24 bg-green-700 rounded-tr-full opacity-10"></div>
      
      <div class="flex items-center space-x-3 mb-6">
        <div class="w-12 h-12 bg-white rounded-full p-2 shadow-md">
          <img src="@/assets/nature-cart.png" alt="VSU Logo" class="max-h-full max-w-full object-contain" />
        </div>
        <h1 class="text-2xl font-bold">Nature Cart</h1>
      </div>
      
      <h2 class="text-xl font-semibold mb-1">Forest Product Collectors</h2>
      <p class="text-green-100">Monitoring & Management System</p>
      
      <!-- Mobile logos in a row -->
      <div class="flex justify-start space-x-4 mt-4">
        <div class="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center p-1">
          <img src="@/assets/vsu_logo.png" alt="VSU Logo" class="max-h-full max-w-full object-contain" />
        </div>
        <div class="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center p-1">
          <img src="@/assets/DFS_logo.png" alt="DFS Logo" class="max-h-full max-w-full object-contain" />
        </div>
      </div>
    </div>
    
    <!-- Login Column -->
    <div class="w-full lg:w-1/2 flex flex-col justify-center p-6 sm:p-8">
      <div class="mx-auto w-full max-w-md">
        <!-- Logo and Title - Only visible on desktop -->
        <div class="hidden lg:flex items-center mb-12 space-x-6">
          <div class="w-20 h-20 flex-shrink-0 bg-gradient-to-r from-green-600 to-green-500 rounded-full p-3 shadow-lg">
            <img src="@/assets/nature-cart.png" alt="Nature Cart Logo" class="w-full h-full object-contain" />
          </div>
          <div>
            <h1 class="text-4xl font-extrabold text-gray-800">Nature Cart</h1>
            <p class="text-sm text-gray-600">Forest Product Collectors Monitoring System</p>
          </div>
        </div>
        
        <!-- Welcome Message -->
        <div class="mb-10">
          <h2 class="text-3xl lg:text-4xl font-extrabold text-gray-900">Welcome</h2>
          <p class="mt-3 text-lg text-gray-600">Please enter your credentials to access your account</p>
        </div>
        
        <!-- Login Form -->
        <form @submit.prevent="handleLogin" class="space-y-5">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div class="mt-1 relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <input
                id="email"
                type="email"
                v-model="email"
                required
                autocomplete="email"
                class="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between">
              <label for="password" class="block text-sm font-medium text-gray-700">
                Password
              </label>
            </div>
            <div class="mt-1 relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                id="password"
                type="password"
                v-model="password"
                required
                autocomplete="current-password"
                class="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="••••••••"
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
            {{ isLoading ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>

        <!-- Sign Up Link -->
        <div class="mt-8 text-center">
          <p class="text-sm text-gray-600">
            Don't have an account?
            <button @click="goToSignUpPage" class="font-medium text-green-600 hover:text-green-500">
              Sign up
            </button>
          </p>
        </div>
        
        <!-- Mobile Feature Cards (Simplified) -->
        <div class="mt-12 lg:hidden">
          <h3 class="text-lg font-semibold text-gray-800 mb-4 text-center">System Features</h3>
          
          <div class="grid grid-cols-1 gap-4">
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <img src="@/assets/verify.png" alt="Verify Icon" class="w-6 h-6 object-contain" />
              </div>
              <div class="ml-4">
                <h4 class="font-medium text-gray-800">Track Collection Records</h4>
                <p class="text-xs text-gray-500 mt-1">Monitor forest product collection with precision</p>
              </div>
            </div>
            
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <img src="@/assets/location.png" alt="Location Icon" class="w-6 h-6 object-contain" />
              </div>
              <div class="ml-4">
                <h4 class="font-medium text-gray-800">Locate Forest Products</h4>
                <p class="text-xs text-gray-500 mt-1">Map exact locations of forest product sources</p>
              </div>
            </div>
            
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <img src="@/assets/registered.png" alt="Register Icon" class="w-6 h-6 object-contain" />
              </div>
              <div class="ml-4">
                <h4 class="font-medium text-gray-800">Register Collectors</h4>
                <p class="text-xs text-gray-500 mt-1">Maintain a comprehensive database of collectors</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Feature Column - Hidden on mobile, visible on desktop -->
    <div class="hidden lg:flex lg:w-1/2 bg-green-50 flex-col justify-center items-center p-12">
      <div class="max-w-lg">
        <h2 class="text-3xl font-bold text-gray-800 mb-8 text-center">
          Forest Product Collectors Monitoring System
        </h2>
        
        <!-- Logos Section -->
        <div class="flex justify-center space-x-8 mb-12">
          <div class="w-32 h-32 bg-white rounded-lg shadow-md flex items-center justify-center p-4">
            <img src="@/assets/vsu_logo.png" alt="VSU Logo" class="max-h-full max-w-full object-contain" />
          </div>
          <div class="w-32 h-32 bg-white rounded-lg shadow-md flex items-center justify-center p-4">
            <img src="@/assets/DFS_logo.png" alt="DFS Logo" class="max-h-full max-w-full object-contain" />
          </div>
        </div>
        
        <!-- Feature Cards -->
        <div class="space-y-4">
          <div class="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-start">
              <div class="flex-shrink-0 mt-1">
                <img src="@/assets/verify.png" alt="Verify Icon" class="w-10 h-10 object-contain" />
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-semibold text-gray-800">Track Collection Records</h3>
                <p class="mt-1 text-gray-600">Monitor forest product collection with precision. Keep detailed records of quantities, types, and collection dates.</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-start">
              <div class="flex-shrink-0 mt-1">
                <img src="@/assets/location.png" alt="Location Icon" class="w-10 h-10 object-contain" />
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-semibold text-gray-800">Locate Forest Products</h3>
                <p class="mt-1 text-gray-600">Pinpoint and map exact locations of forest product sources for better tracking and analysis.</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-start">
              <div class="flex-shrink-0 mt-1">
                <img src="@/assets/registered.png" alt="Register Icon" class="w-10 h-10 object-contain" />
              </div>
              <div class="ml-4">
                <h3 class="text-lg font-semibold text-gray-800">Register Collectors</h3>
                <p class="mt-1 text-gray-600">Maintain a comprehensive database of authorized forest product collectors with complete details.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <Toaster />
  </div>
</template>