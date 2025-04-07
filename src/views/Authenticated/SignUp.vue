<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import NatureCartLogo from '@/components/logo/NatureCartLogo.vue'
import { toast, Toaster } from 'vue-sonner'
import { supabase } from '@/lib/supabaseClient'

const router = useRouter()
const email = ref('')
const password = ref('')
const firstName = ref('')
const lastName = ref('')
const sex = ref('')
const birthdate = ref('')
const fullAddress = ref('')
const civilStatus = ref('')
const userType = ref('')
const phoneNumber = ref('')
const entityName = ref('') // Added for non-individual entities

// Computed property to determine if individual-specific fields should be shown
const isIndividual = computed(() => userType.value === 'Individual')

const handleSignUp = async () => {
  try {
    const { data, error } = await supabase.auth.signUp({ email: email.value, password: password.value })
    if (error) throw error

    // Create a new profile in the public.profiles table
    const { user } = data
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{
        id: user.id,
        email_address: user.email,
        // Use entityName for non-individuals, firstName for individuals
        first_name: isIndividual.value ? firstName.value : entityName.value,
        // Only store lastName for individuals
        last_name: isIndividual.value ? lastName.value : null,
        sex: isIndividual.value ? sex.value : null,
        birthdate: isIndividual.value ? birthdate.value : null,
        full_address: fullAddress.value,
        civil_status: isIndividual.value ? civilStatus.value : null,
        user_type: userType.value,
        phone_number: phoneNumber.value
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
  }
}

const goToLoginPage = () => {
  router.push({ name: 'Index' })
}
</script>

<template>
  <!-- On small screens, allow full page scrolling. On medium and up, use fixed container -->
  <div class="sm:h-auto md:h-screen flex flex-col md:flex-row sm:overflow-auto md:overflow-hidden">
    <!-- Left Section - Sign Up Form -->
    <div class="w-full md:w-1/2 flex flex-col order-2 md:order-1 md:h-screen">
      <!-- Fixed header part on md+ screens, scrolls with content on small screens -->
      <div class="p-4 sm:p-6 md:p-6 flex-shrink-0">
        <div class="max-w-sm w-full mx-auto">
          <div class="flex items-center">
            <div class="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
              <NatureCartLogo width="100%" height="100%" />
            </div>
            <h1 class="text-lg sm:text-xl md:text-2xl font-bold ml-2">Sign up to Nature Cart</h1>
          </div>
          <div>
            <p class="text-sm sm:text-base text-gray-600 mt-2">Enter your details to create an account.</p>
          </div>
        </div>
      </div>

      <!-- Form part - scrollable only on md+ screens -->
      <div class="flex-1 md:overflow-y-auto px-4 sm:px-6 md:px-6 pb-6">
        <div class="max-w-sm w-full mx-auto">
          <form @submit.prevent="handleSignUp" class="space-y-4">
            <div class="space-y-3">
              <!-- User Type (First Field) -->
              <div>
                <label for="user-type" class="block text-sm font-medium text-gray-700">User Type</label>
                <select
                  id="user-type"
                  v-model="userType"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  required
                >
                  <option value="" disabled>Select</option>
                  <option value="Individual">Individual</option>
                  <option value="Association">Association</option>
                  <option value="Organization">Organization</option>
                  <option value="Group of People">Group of People</option>
                </select>
              </div>

              <!-- Entity Name field that shows for non-individuals -->
              <div v-if="!isIndividual && userType">
                <label for="entity-name" class="block text-sm font-medium text-gray-700">
                  {{ userType }} Name
                </label>
                <input
                  id="entity-name"
                  type="text"
                  v-model="entityName"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  required
                />
              </div>

              <!-- Individual name fields -->
              <div v-if="isIndividual">
                <label for="first-name" class="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  id="first-name"
                  type="text"
                  v-model="firstName"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  required
                />
              </div>

              <div v-if="isIndividual">
                <label for="last-name" class="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  id="last-name"
                  type="text"
                  v-model="lastName"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  required
                />
              </div>

              <div>
                <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
                <input
                  id="email"
                  type="email"
                  v-model="email"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  required
                />
              </div>

              <div>
                <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
                <input
                  id="password"
                  type="password"
                  v-model="password"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  required
                />
              </div>

              <!-- Individual-specific fields that only show when userType is 'Individual' -->
              <template v-if="isIndividual">
                <div>
                  <label for="sex" class="block text-sm font-medium text-gray-700">Sex</label>
                  <select
                    id="sex"
                    v-model="sex"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    required
                  >
                    <option value="" disabled>Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label for="birthdate" class="block text-sm font-medium text-gray-700">Birthdate</label>
                  <input
                    id="birthdate"
                    type="date"
                    v-model="birthdate"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label for="civil-status" class="block text-sm font-medium text-gray-700">Civil Status</label>
                  <select
                    id="civil-status"
                    v-model="civilStatus"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    required
                  >
                    <option value="" disabled>Select</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>
              </template>

              <div>
                <label for="full-address" class="block text-sm font-medium text-gray-700">Full Address</label>
                <textarea
                  id="full-address"
                  v-model="fullAddress"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  required
                ></textarea>
              </div>

              <div>
                <label for="phone-number" class="block text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  id="phone-number"
                  type="text"
                  v-model="phoneNumber"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              Sign Up
            </button>
          </form>
          <div class="text-center mt-4 mb-6">
            <p class="text-sm text-gray-600">
              Already have an account?
              <button @click="goToLoginPage" class="text-green-600 hover:text-green-500 font-medium">
                Login
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Section - Branding -->
    <div class="w-full md:w-1/2 bg-green-50 flex flex-col justify-center items-center p-4 sm:p-6 md:p-8 order-1 md:order-2">
      <div class="text-center w-full max-w-3xl">
        <h2 class="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-4 sm:mb-6">
          Forest Product Collectors Monitoring System
        </h2>
        
        <!-- Logos Section -->
        <div class="flex flex-col sm:flex-row gap-3 sm:gap-6 justify-center items-center mb-4 sm:mb-6">
          <div class="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-yellow-400 rounded-lg flex items-center justify-center overflow-hidden p-2">
            <img src="@/assets/vsu_logo.png" alt="VSU Logo" class="w-full h-full object-contain" />
          </div>
          <div class="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-white rounded-lg flex items-center justify-center overflow-hidden p-2">
            <img src="@/assets/DFS_logo.png" alt="DFS Logo" class="w-full h-full object-contain" />
          </div>
        </div>

        <!-- Feature Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full">
          <div class="bg-white p-3 sm:p-4 rounded-lg shadow-md">
            <div class="flex flex-col sm:flex-row items-center mb-2 gap-2">
              <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full">            
                <img src="@/assets/verify.png" alt="Verify Icon" class="w-full h-full object-contain" />
              </div>
              <h3 class="text-sm sm:text-base md:text-lg font-bold text-center sm:text-left">TRACK FOREST PRODUCT COLLECTION RECORDS</h3>
            </div>
            <p class="text-xs sm:text-sm text-gray-600 text-justify">Log and monitor forest product collection with precision. Keep detailed records of quantities, types, and collection dates.</p>
          </div>

          <div class="bg-white p-3 sm:p-4 rounded-lg shadow-md">
            <div class="flex flex-col sm:flex-row items-center mb-2 gap-2">
              <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full">            
                <img src="@/assets/location.png" alt="Location Icon" class="w-full h-full object-contain" />
              </div>
              <h3 class="text-sm sm:text-base md:text-lg font-bold text-center sm:text-left">LOCATE FOREST PRODUCTS</h3>
            </div>
            <p class="text-xs sm:text-sm text-gray-600 text-justify">Pinpoint and map exact locations of forest product sources. Facilitate easy tracking and spatial analysis.</p>
          </div>

          <div class="bg-white p-3 sm:p-4 rounded-lg shadow-md">
            <div class="flex flex-col sm:flex-row items-center mb-2 gap-2">
              <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full">            
                <img src="@/assets/registered.png" alt="Register Icon" class="w-full h-full object-contain" />
              </div>
              <h3 class="text-sm sm:text-base md:text-lg font-bold text-center sm:text-left">REGISTER COLLECTORS</h3>
            </div>
            <p class="text-xs sm:text-sm text-gray-600 text-justify">Maintain a comprehensive database of authorized forest product collectors with complete details.</p>
          </div>
        </div>
      </div>
    </div>
    <Toaster />
  </div>
</template>