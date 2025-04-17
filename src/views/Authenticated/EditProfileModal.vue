<script setup>
import { ref, onMounted, computed, watch, reactive } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'vue-sonner'
import { format } from 'date-fns'
import { getUser, fetchUserDetails } from '@/router/routeGuard'

const props = defineProps({
  showModal: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'profileUpdated'])

const loading = ref(false)
const error = ref(null)

// Original user data for comparison
const originalUserData = ref({})

// User profile form data
const profileForm = ref({
  first_name: '',
  last_name: '',
  phone_number: '',
  full_address: '',
  sex: '',
  birthdate: '',
  civil_status: '',
  user_type: '' 
})

// Form validation state
const validationErrors = reactive({
  first_name: false,
  last_name: false,
  phone_number: false,
  full_address: false,
  sex: false,
  birthdate: false,
  civil_status: false
})

// Options for dropdowns
const sexOptions = ['Male', 'Female', 'Prefer not to say']
const civilStatusOptions = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated']

// Determine if user is an individual to show/hide certain fields
const isIndividual = computed(() => {
  return profileForm.value.user_type === 'Individual'
})

// Check if form is valid
const isFormValid = computed(() => {
  // Always required fields
  if (!profileForm.value.first_name || !profileForm.value.phone_number) {
    return false
  }
  
  // Individual-specific required fields
  if (isIndividual.value) {
    if (!profileForm.value.last_name || !profileForm.value.sex || 
        !profileForm.value.birthdate || !profileForm.value.civil_status) {
      return false
    }
  }
  
  // For non-individuals, last_name is still required
  if (!isIndividual.value && !profileForm.value.last_name) {
    return false
  }
  
  // Full address is required for everyone
  if (!profileForm.value.full_address) {
    return false
  }
  
  return true
})

// Check if form has changes
const hasChanges = computed(() => {
  // Compare current form with original data
  if (profileForm.value.first_name !== originalUserData.value.first_name ||
      profileForm.value.last_name !== originalUserData.value.last_name ||
      profileForm.value.phone_number !== originalUserData.value.phone_number ||
      profileForm.value.full_address !== originalUserData.value.full_address) {
    return true
  }
  
  // Only check individual fields if user is an individual
  if (isIndividual.value) {
    if (profileForm.value.sex !== originalUserData.value.sex ||
        profileForm.value.birthdate !== originalUserData.value.birthdate ||
        profileForm.value.civil_status !== originalUserData.value.civil_status) {
      return true
    }
  }
  
  return false
})

// Determine if save button should be enabled
const isSaveEnabled = computed(() => {
  return isFormValid.value && hasChanges.value && !loading.value
})

// Function to close the modal
const handleClose = () => {
  emit('close')
}

// Validate a specific field
const validateField = (fieldName) => {
  if (fieldName === 'first_name') {
    validationErrors.first_name = !profileForm.value.first_name
  } 
  else if (fieldName === 'last_name') {
    validationErrors.last_name = !profileForm.value.last_name
  }
  else if (fieldName === 'phone_number') {
    validationErrors.phone_number = !profileForm.value.phone_number
  }
  else if (fieldName === 'full_address') {
    validationErrors.full_address = !profileForm.value.full_address
  }
  else if (fieldName === 'sex' && isIndividual.value) {
    validationErrors.sex = !profileForm.value.sex
  }
  else if (fieldName === 'birthdate' && isIndividual.value) {
    validationErrors.birthdate = !profileForm.value.birthdate
  }
  else if (fieldName === 'civil_status' && isIndividual.value) {
    validationErrors.civil_status = !profileForm.value.civil_status
  }
}

// Load user data into the form
const loadUserData = () => {
  const userData = getUser()
  if (userData) {
    // Store original data for comparison
    originalUserData.value = {
      first_name: userData.first_name || '',
      last_name: userData.last_name || '',
      phone_number: userData.phone_number || '',
      full_address: userData.full_address || '',
      sex: userData.sex || '',
      birthdate: userData.birthdate ? new Date(userData.birthdate).toISOString().split('T')[0] : '',
      civil_status: userData.civil_status || '',
      user_type: userData.user_type || 'Individual'
    }
    
    // Set form data
    profileForm.value = { ...originalUserData.value }
    
    // Reset validation errors
    Object.keys(validationErrors).forEach(key => {
      validationErrors[key] = false
    })
  }
}

// Validate all fields
const validateAllFields = () => {
  Object.keys(validationErrors).forEach(validateField)
  return isFormValid.value
}

// Update profile function
const handleProfileUpdate = async () => {
  // Validate all fields first
  if (!validateAllFields()) {
    toast.error('Please fill in all required fields', { duration: 3000 })
    return
  }
  
  loading.value = true
  error.value = null

  try {
    const currentDate = new Date()
    const formattedDate = format(currentDate, 'yyyy-MM-dd HH:mm:ss')
    
    // Prepare update data
    const updateData = {
      first_name: profileForm.value.first_name,
      last_name: profileForm.value.last_name,
      phone_number: profileForm.value.phone_number,
      full_address: profileForm.value.full_address,
      updated_at: formattedDate,
    }

    // Only include individual-specific fields if user type is Individual
    if (profileForm.value.user_type === 'Individual') {
      updateData.sex = profileForm.value.sex
      updateData.birthdate = profileForm.value.birthdate || null
      updateData.civil_status = profileForm.value.civil_status
    }

    // Update profile in database
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', getUser().id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    toast.success('Profile updated successfully', { duration: 3000 })
    await fetchUserDetails() // Refresh user data
    emit('profileUpdated')
    handleClose()
  } catch (err) {
    error.value = err.message
    toast.error(err.message, { duration: 3000 })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadUserData()
})

// Watch for modal open to reload data
watch(
  () => props.showModal,
  (newVal) => {
    if (newVal) {
      loadUserData()
    }
  }
)
</script>

<template>
    <div v-if="props.showModal" class="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-60 backdrop-filter" aria-labelledby="edit-profile-modal-title" role="dialog" aria-modal="true">
      <div class="flex items-center justify-center min-h-screen p-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-2xl w-full max-w-2xl border border-gray-100 dark:border-gray-700">
          <!-- Modal Header -->
          <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-3">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  class="h-8 w-8 text-green-600" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2" 
                  stroke-linecap="round" 
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                </svg>
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white" id="edit-profile-modal-title">
                  Edit Profile Information
                </h3>
              </div>
              <button 
                @click="handleClose" 
                class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-full p-1"
                aria-label="Close modal"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div class="px-6 py-5">
            <!-- Error Alert -->
            <div v-if="error" class="mb-5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-300 text-sm">
              <div class="flex items-center">
                <svg class="h-5 w-5 text-red-500 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                <span>{{ error }}</span>
              </div>
            </div>
            
            <!-- Required Fields Notice -->
            <div class="mb-5 flex items-center text-sm text-gray-600 dark:text-gray-400">
              <svg class="h-4 w-4 mr-1.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Fields marked with * are required</span>
            </div>
            
            <form @submit.prevent="handleProfileUpdate" class="space-y-6">
              <!-- User Type Display (non-editable) -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">User Type</label>
                <div class="px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-700 dark:text-gray-300 font-medium">
                  {{ profileForm.user_type }}
                </div>
              </div>
              
              <!-- Basic Info Section -->
              <div>
                <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Basic Information</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label for="first-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      First Name *
                    </label>
                    <input
                      id="first-name"
                      type="text"
                      v-model="profileForm.first_name"
                      @blur="validateField('first_name')"
                      class="block w-full px-4 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      :class="validationErrors.first_name ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
                      required
                    />
                    <p v-if="validationErrors.first_name" class="mt-1 text-sm text-red-600 dark:text-red-400">
                      First name is required
                    </p>
                  </div>
                  
                  <div>
                    <label for="last-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Last Name *
                    </label>
                    <input
                      id="last-name"
                      type="text"
                      v-model="profileForm.last_name"
                      @blur="validateField('last_name')"
                      class="block w-full px-4 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      :class="validationErrors.last_name ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
                      required
                    />
                    <p v-if="validationErrors.last_name" class="mt-1 text-sm text-red-600 dark:text-red-400">
                      Last name is required
                    </p>
                  </div>
                </div>
              </div>
              
              <!-- Contact Details -->
              <div>
                <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Contact Details</h4>
                <div class="grid grid-cols-1 gap-5">
                  <div>
                    <label for="phone-number" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Phone Number *
                    </label>
                    <input
                      id="phone-number"
                      type="tel"
                      v-model="profileForm.phone_number"
                      @blur="validateField('phone_number')"
                      class="block w-full px-4 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      :class="validationErrors.phone_number ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
                      required
                    />
                    <p v-if="validationErrors.phone_number" class="mt-1 text-sm text-red-600 dark:text-red-400">
                      Phone number is required
                    </p>
                  </div>
                  
                  <div>
                    <label for="address" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Full Address *
                    </label>
                    <textarea
                      id="address"
                      v-model="profileForm.full_address"
                      @blur="validateField('full_address')"
                      rows="3"
                      class="block w-full px-4 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      :class="validationErrors.full_address ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
                      placeholder="Street address, city, state, postal code"
                      required
                    ></textarea>
                    <p v-if="validationErrors.full_address" class="mt-1 text-sm text-red-600 dark:text-red-400">
                      Full address is required
                    </p>
                  </div>
                </div>
              </div>
              
              <!-- Individual-specific fields -->
              <div v-if="isIndividual">
                <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Personal Information</h4>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label for="sex" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Sex *
                    </label>
                    <select
                      id="sex"
                      v-model="profileForm.sex"
                      @blur="validateField('sex')"
                      class="block w-full px-4 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      :class="validationErrors.sex ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
                      required
                    >
                      <option value="" disabled>Select</option>
                      <option v-for="option in sexOptions" :key="option" :value="option">{{ option }}</option>
                    </select>
                    <p v-if="validationErrors.sex" class="mt-1 text-sm text-red-600 dark:text-red-400">
                      Sex is required
                    </p>
                  </div>
                  
                  <div>
                    <label for="civil-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Civil Status *
                    </label>
                    <select
                      id="civil-status"
                      v-model="profileForm.civil_status"
                      @blur="validateField('civil_status')"
                      class="block w-full px-4 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      :class="validationErrors.civil_status ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
                      required
                    >
                      <option value="" disabled>Select</option>
                      <option v-for="option in civilStatusOptions" :key="option" :value="option">{{ option }}</option>
                    </select>
                    <p v-if="validationErrors.civil_status" class="mt-1 text-sm text-red-600 dark:text-red-400">
                      Civil status is required
                    </p>
                  </div>
                  
                  <div>
                    <label for="birthdate" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Birthdate *
                    </label>
                    <input
                      id="birthdate"
                      type="date"
                      v-model="profileForm.birthdate"
                      @blur="validateField('birthdate')"
                      class="block w-full px-4 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      :class="validationErrors.birthdate ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
                      required
                    />
                    <p v-if="validationErrors.birthdate" class="mt-1 text-sm text-red-600 dark:text-red-400">
                      Birthdate is required
                    </p>
                  </div>
                </div>
              </div>
            </form>
          </div>
          
          <!-- Action Buttons -->
          <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
            <div class="flex justify-end gap-3">
              <button
                type="button"
                @click="handleClose"
                class="px-5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                @click="handleProfileUpdate"
                class="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                :class="[isSaveEnabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed']"
                :disabled="!isSaveEnabled"
              >
                <span v-if="loading" class="inline-flex items-center">
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
                <span v-else-if="!hasChanges">No Changes</span>
                <span v-else-if="!isFormValid">Complete Required Fields</span>
                <span v-else>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
</template>