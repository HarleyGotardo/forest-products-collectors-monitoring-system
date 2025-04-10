<script setup>
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import NatureCartLogo from '@/components/logo/NatureCartLogo.vue'
import { toast, Toaster } from 'vue-sonner'
import { supabase } from '@/lib/supabaseClient'

const router = useRouter()
const formData = reactive({
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  sex: '',
  birthdate: '',
  fullAddress: '',
  civilStatus: '',
  userType: '',
  phoneNumber: '',
  entityName: ''
})

const isLoading = ref(false)

// Computed property to determine if individual-specific fields should be shown
const isIndividual = computed(() => formData.userType === 'Individual')

const handleSignUp = async () => {
  // Simple validation
  if (
    !formData.email || 
    !formData.password || 
    !formData.userType || 
    !formData.phoneNumber || 
    !formData.fullAddress ||
    (isIndividual.value && (!formData.firstName || !formData.lastName || !formData.sex || !formData.birthdate || !formData.civilStatus)) ||
    (!isIndividual.value && !formData.entityName)
  ) {
    toast.error('Please fill in all required fields', {
      duration: 3000,
    })
    return
  }
  
  isLoading.value = true
  
  try {
    const { data, error } = await supabase.auth.signUp({ 
      email: formData.email, 
      password: formData.password 
    })
    
    if (error) throw error

    // Create a new profile in the public.profiles table
    const { user } = data
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{
        id: user.id,
        email_address: user.email,
        // Use entityName for non-individuals, firstName for individuals
        first_name: isIndividual.value ? formData.firstName : formData.entityName,
        // Only store lastName for individuals
        last_name: isIndividual.value ? formData.lastName : null,
        sex: isIndividual.value ? formData.sex : null,
        birthdate: isIndividual.value ? formData.birthdate : null,
        full_address: formData.fullAddress,
        civil_status: isIndividual.value ? formData.civilStatus : null,
        user_type: formData.userType,
        phone_number: formData.phoneNumber
      }])

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
  } finally {
    isLoading.value = false
  }
}

const goToLoginPage = () => {
  router.push({ name: 'Index' })
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
        <img src="@/assets/nature-cart.png" alt="Nature Cart Logo" class="w-full h-full object-contain" />
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
    
    <!-- Signup Column -->
    <div class="w-full lg:w-1/2 flex flex-col justify-start p-6 pt-0 sm:p-8 overflow-y-auto">
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
        <div class="mb-10 mt-5 sm:mt-5">
          <h2 class="text-3xl lg:text-4xl font-extrabold text-gray-900">Welcome</h2>
            <p class="mt-3 text-lg text-gray-600">Please fill out the form below to create your account</p>
        </div>
        
        <!-- Signup Form -->
        <form @submit.prevent="handleSignUp" class="space-y-5">
          <!-- User Type -->
          <div>
            <label for="userType" class="block text-sm font-medium text-gray-700">
              User Type
            </label>
            <div class="mt-1 relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <select
                id="userType"
                v-model="formData.userType"
                class="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                required
              >
                <option value="" disabled>Select user type</option>
                <option value="Individual">Individual</option>
                <option value="Association">Association</option>
                <option value="Organization">Organization</option>
                <option value="Group of People">Group of People</option>
              </select>
            </div>
          </div>
          
          <!-- Entity name (for non-individuals) -->
          <div v-if="!isIndividual && formData.userType">
            <label for="entityName" class="block text-sm font-medium text-gray-700">
              {{ formData.userType }} Name
            </label>
            <div class="mt-1 relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <input
                id="entityName"
                type="text"
                v-model="formData.entityName"
                class="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="Enter organization name"
                required
              />
            </div>
          </div>
          
          <!-- Individual-specific fields -->
          <div v-if="isIndividual" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="firstName" class="block text-sm font-medium text-gray-700">
                First Name
              </label>
              <div class="mt-1 relative">
                <input
                  id="firstName"
                  type="text"
                  v-model="formData.firstName"
                  class="appearance-none block w-full pl-3 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  placeholder="First name"
                  required
                />
              </div>
            </div>
            
            <div>
              <label for="lastName" class="block text-sm font-medium text-gray-700">
                Last Name
              </label>
              <div class="mt-1 relative">
                <input
                  id="lastName"
                  type="text"
                  v-model="formData.lastName"
                  class="appearance-none block w-full pl-3 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  placeholder="Last name"
                  required
                />
              </div>
            </div>
          </div>
          
          <!-- Contact information for all users -->
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700">
              Email Address
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
                v-model="formData.email"
                class="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>
          </div>
          
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div class="mt-1 relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                id="password"
                type="password"
                v-model="formData.password"
                class="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          
          <div>
            <label for="phoneNumber" class="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <div class="mt-1 relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <input
                id="phoneNumber"
                type="text"
                v-model="formData.phoneNumber"
                class="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="Phone number"
                required
              />
            </div>
          </div>
          
          <!-- Address for all users -->
          <div>
            <label for="fullAddress" class="block text-sm font-medium text-gray-700">
              Full Address
            </label>
            <div class="mt-1 relative">
              <div class="absolute top-3 left-3 flex items-start pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <textarea
                id="fullAddress"
                v-model="formData.fullAddress"
                rows="3"
                class="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="Enter your full address"
                required
              ></textarea>
            </div>
          </div>
          
          <!-- Additional individual fields -->
          <div v-if="isIndividual" class="space-y-5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="sex" class="block text-sm font-medium text-gray-700">
                  Sex
                </label>
                <div class="mt-1 relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <select
                    id="sex"
                    v-model="formData.sex"
                    class="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    required
                  >
                    <option value="" disabled>Select sex</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label for="civilStatus" class="block text-sm font-medium text-gray-700">
                  Civil Status
                </label>
                <div class="mt-1 relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <select
                    id="civilStatus"
                    v-model="formData.civilStatus"
                    class="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    required
                  >
                    <option value="" disabled>Select status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div>
              <label for="birthdate" class="block text-sm font-medium text-gray-700">
                Birthdate
              </label>
              <div class="mt-1 relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  id="birthdate"
                  type="date"
                  v-model="formData.birthdate"
                  class="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  required
                />
              </div>
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
            {{ isLoading ? 'Creating account...' : 'Create account' }}
          </button>
          
          <div class="text-center mt-4">
            <p class="text-sm text-gray-600">
              Already have an account?
              <button @click="goToLoginPage" class="font-medium text-green-600 hover:text-green-500">
                Sign in
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Feature Column - Hidden on mobile, visible on desktop -->
    <div class="hidden lg:flex lg:w-1/2 bg-green-50 flex-col items-center p-12">
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