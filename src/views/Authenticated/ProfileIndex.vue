<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'
import { format } from 'date-fns'
import defaultProfileImage from '@/assets/profile.png'
import { getUser, fetchUserDetails } from '@/router/routeGuard'
import EditProfileModal from '@/views/Authenticated/EditProfileModal.vue'

const showEditProfileModal = ref(false)
const newProfileImage = ref(null)
const showImageModal = ref(false)
const showPasswordModal = ref(false)
const loading = ref(false)
const error = ref(null)

// Password update
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

// Add these new computed properties for password strength checking
const passwordStrength = computed(() => {
  if (!newPassword.value) return { score: 0, feedback: [] }
  
  let score = 0
  let feedback = []
  
  // Check length
  if (newPassword.value.length < 8) {
    feedback.push('At least 8 characters')
  } else if (newPassword.value.length >= 12) {
    score += 2
  } else if (newPassword.value.length >= 8) {
    score += 1
  }
  
  // Check for numbers
  if (/\d/.test(newPassword.value)) {
    score += 1
  } else {
    feedback.push('Add numbers')
  }
  
  // Check for uppercase
  if (/[A-Z]/.test(newPassword.value)) {
    score += 1
  } else {
    feedback.push('Add uppercase letters')
  }
  
  // Check for lowercase
  if (/[a-z]/.test(newPassword.value)) {
    score += 1
  } else {
    feedback.push('Add lowercase letters')
  }
  
  // Check for special characters
  if (/[^A-Za-z0-9]/.test(newPassword.value)) {
    score += 1
  } else {
    feedback.push('Add special characters')
  }
  
  return {
    score,
    feedback
  }
})

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
  if (score <= 4) return 'bg-emerald-400'
  return 'bg-emerald-600'
})

// Update the passwordsMatch computed property
const passwordsMatch = computed(() => {
  return newPassword.value === confirmPassword.value && 
         newPassword.value.length >= 8 && 
         passwordStrength.value.score >= 5
})

// Add this new method in your script setup
const handleProfileUpdated = async () => {
  await fetchUserDetails()
  toast.success('Profile information has been updated successfully.', { duration: 2000 })
}

const handleImageChange = (event) => {
  newProfileImage.value = event.target.files[0]
}

const handleLogout = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error logging out:', error)
  } else {
    setTimeout(() => {
      router.push({ name: 'Index' })
    }, 2000) // 2 second delay
  }
}

const handleImageSubmit = async () => {
  if (!newProfileImage.value) {
    toast.error('Please select an image', { duration: 3000 })
    return
  }

  loading.value = true

  // Delete previous profile picture if it exists
  if (getUser().profile_picture) {
    const previousImagePath = getUser().profile_picture.split('/').pop()
    await supabase
      .storage
      .from('nature_cart_images')
      .remove([`users/${previousImagePath}`])
  }

  const currentDate = new Date()
  const formattedDate = format(currentDate, 'yyyy-MM-dd HH:mm:ss')

  // Upload new image to Supabase bucket using S3 protocol
  const imageName = `${getUser().id}_${Date.now()}_${newProfileImage.value.name}`
  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('nature_cart_images')
    .upload(`users/${imageName}`, newProfileImage.value, {
      cacheControl: '3600',
      upsert: false,
      contentType: newProfileImage.value.type,
      endpoint: 'https://cikbihrqwkfgvkrdgmqi.supabase.co/storage/v1/s3',
      region: 'ap-southeast-1'
    })

  if (uploadError) {
    toast.error('Failed to upload image', { duration: 3000 })
    loading.value = false
    return
  }

  const imageUrl = supabase
    .storage
    .from('nature_cart_images')
    .getPublicUrl(uploadData.path)

  // Update user profile with new image URL
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ profile_picture: JSON.stringify(imageUrl), updated_at: formattedDate })
    .eq('id', getUser().id)

  if (updateError) {
    toast.error('Failed to update profile picture', { duration: 3000 })
    loading.value = false
    return
  }

  toast.success('Your profile picture has been updated.', { duration: 2000 })
  newProfileImage.value = null
  showImageModal.value = false
  loading.value = false
  fetchUserDetails()
}

const handlePasswordUpdate = async () => {
  if (newPassword.value !== confirmPassword.value) {
    toast.error('New passwords do not match', { duration: 3000 })
    return
  }

  if (newPassword.value.length < 8) {
    toast.error('Password must be at least 8 characters', { duration: 3000 })
    return
  }

  loading.value = true
  error.value = null

  try {
    // First verify the current password with a sign-in attempt
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: getUser().email_address,
      password: currentPassword.value
    })

    if (signInError) {
      throw new Error('Current password is incorrect')
    }

    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword.value
    })

    if (updateError) {
      throw new Error(updateError.message)
    }

    toast.success('Password updated successfully. You’ve been logged out and will be redirected to the login page upon clicking any button.', { duration: 4000 })
    showPasswordModal.value = false

    // Clear the form
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''

    // Log out the user after a short delay
    setTimeout(async () => {
      await supabase.auth.signOut()
    }, 2000)
  } catch (err) {
    error.value = err.message
    toast.error(err.message, { duration: 3000 })
  } finally {
    loading.value = false
  }
}

// Check if user is an individual
const isIndividual = computed(() => {
  return getUser()?.user_type === 'Individual'
})

const profilePictureUrl = computed(() => {
  return getUser()?.profile_picture ? getUser().profile_picture : defaultProfileImage
})

const formatDate = (dateString) => {
  if (!dateString) return 'Not provided'
  return new Date(dateString).toISOString().split('T')[0]
}

onMounted(async () => {
  await fetchUserDetails()
})
</script>
<template>
  <div class="max-w-3xl mx-auto bg-gray-50 min-h-screen">
    <!-- Profile picture and name section -->
    <div class="px-4 sm:px-8 pt-6">
      <div class="bg-gray-100 rounded-lg shadow-sm p-4 mb-4">
        <div
          class="flex flex-col sm:flex-row items-center sm:items-center relative z-10 gap-4 sm:gap-6"
        >
          <!-- Profile picture -->
          <div class="relative">
            <img
              :src="profilePictureUrl"
              alt="Profile Image"
              class="w-32 h-32 rounded-full border-4 border-white shadow-md object-cover bg-gray-200"
            />
            <button
              @click="showImageModal = true"
              aria-label="Edit profile picture"
              class="absolute bottom-0 right-0 p-2 bg-white rounded-full border border-gray-200 shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 text-gray-600"
          viewBox="0 0 20 20"
          fill="currentColor"
              >
          <path
            d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
          />
              </svg>
            </button>
          </div>

          <!-- Name and basic info -->
          <div class="text-center sm:text-left flex-1">
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">
              {{ isIndividual ? `${getUser().first_name} ${getUser().last_name}` : getUser().first_name }}
            </h1>
            <div
              class="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2"
            >
              <span
          class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
          :class="{
            'bg-red-100 text-red-800': getUser().role === 'Forest Ranger',
            'bg-amber-100 text-amber-800': getUser().role === 'Forest Product Collector',
            'bg-gray-100 text-gray-800': getUser().role === 'VSU Administrator',
            'bg-emerald-100 text-emerald-800': getUser().role === 'FPU Administrator'
          }"
              >
          {{ getUser().role }}
              </span>
              <span
          class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
          :class="{
            'bg-pink-100 text-pink-800': getUser().user_type === 'Individual',
            'bg-indigo-100 text-indigo-800': getUser().user_type === 'Association',
            'bg-lime-100 text-lime-800': getUser().user_type === 'Organization',
            'bg-cyan-100 text-cyan-800': getUser().user_type === 'Group of People'
          }"
              >
          {{ getUser().user_type }}
              </span>
            </div>
          </div>

          <!-- Update password button on larger screens -->
          <div class="hidden sm:block">
            <button
              @click="showPasswordModal = true"
              class="inline-flex items-center gap-x-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              title="Update Password"
            >
              <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              >
              <path
                fill-rule="evenodd"
                d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 1 1 0 000-2z"
                clip-rule="evenodd"
              />
              </svg>
            </button>
          </div>
          <!-- Add an Edit Profile button, you can place it near the Update Password button -->
          <!-- For desktop view -->
          <div class="hidden sm:block">
            <button
              @click="showEditProfileModal = true"
              class="inline-flex items-center gap-x-2 px-4 py-2 mr-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Update Profile Information"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
                />
              </svg>
            </button>
          </div>

          <!-- For mobile view, add this next to the mobile Update Password button -->
          <div class="sm:hidden my-6 flex justify-center">
            <button
              @click="showEditProfileModal = true"
              class="inline-flex items-center justify-center gap-x-2 w-full px-4 py-3 mb-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Update Profile Information"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
                />
              </svg>
              Update Profile Information
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error alert -->
    <div
      v-if="error"
      role="alert"
      class="mx-4 sm:mx-8 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg shadow-sm"
    >
      <div class="flex items-center text-red-800 text-sm">
        <svg
          class="h-5 w-5 text-red-500 mr-3 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <span>{{ error }}</span>
      </div>
    </div>

    <!-- Loading spinner -->
    <div v-if="!getUser()" class="flex items-center justify-center py-16">
      <svg
        class="animate-spin h-8 w-8 text-green-600"
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
      <span class="ml-3 text-gray-500">Loading Profile...</span>
    </div>

    <!-- Profile information cards -->
    <div v-else class="px-4 sm:px-8 pb-6">
      <!-- Update password button on mobile -->
      <div class="sm:hidden my-6 flex justify-center">
        <button
          @click="showPasswordModal = true"
          class="inline-flex items-center justify-center gap-x-2 w-full px-4 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 1 1 0 000-2z"
              clip-rule="evenodd"
            />
          </svg>
          Update Password
        </button>
      </div>

      <!-- Contact Information Section -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div class="flex items-center mb-3">
          <img
            src="@/assets/contact-info-logo2.png"
            alt="Contact Info Logo"
            class="w-6 h-6 mr-2"
          />
          <h2 class="text-lg font-semibold text-gray-800">
            Contact Information
          </h2>
        </div>
        <div class="space-y-3">
          <div class="flex items-center">
            <div
              class="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-100 flex-shrink-0"
            >
              <svg
                class="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div class="ml-3">
              <div class="text-xs text-gray-500">Email Address</div>
              <div class="text-gray-800">{{ getUser().email_address }}</div>
            </div>
          </div>

          <div class="flex items-center">
            <div
              class="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-100 flex-shrink-0"
            >
              <svg
                class="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
            <div class="ml-3">
              <div class="text-xs text-gray-500">Phone Number</div>
              <div class="text-gray-800">
                {{ getUser().phone_number || 'Not provided' }}
              </div>
            </div>
          </div>

          <div class="flex items-center">
            <div
              class="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-100 flex-shrink-0"
            >
              <svg
                class="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div class="ml-3">
              <div class="text-xs text-gray-500">Address</div>
              <div class="text-gray-800">
                {{ getUser().full_address || 'Not provided' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Personal Information Section (conditional for individuals) -->
      <div v-if="isIndividual" class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div class="flex items-center mb-3">
          <img
            src="@/assets/contact-info-logo.png"
            alt="Contact Info Logo"
            class="w-6 h-6 mr-2"
          />
          <h2 class="text-lg font-semibold text-gray-800">
            Personal Information
          </h2>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex items-center">
            <div
              class="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-100 flex-shrink-0"
            >
              <svg
                class="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div class="ml-3">
              <div class="text-xs text-gray-500">Sex</div>
              <div class="text-gray-800">
                {{ getUser().sex || 'Not provided' }}
              </div>
            </div>
          </div>

          <div class="flex items-center">
            <div
              class="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-100 flex-shrink-0"
            >
              <svg
                class="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div class="ml-3">
              <div class="text-xs text-gray-500">Birthdate</div>
              <div class="text-gray-800">
                {{ formatDate(getUser().birthdate) }}
              </div>
            </div>
          </div>

          <div class="flex items-center">
            <div
              class="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-100 flex-shrink-0"
            >
              <svg
                class="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <div class="ml-3">
              <div class="text-xs text-gray-500">Civil Status</div>
              <div class="text-gray-800">
                {{ getUser().civil_status || 'Not provided' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Account Information Section -->
      <div class="bg-white rounded-lg shadow-sm p-4">
        <div class="flex items-center mb-3">
          <img
            src="@/assets/account-info.png"
            alt="Contact Info Logo"
            class="w-6 h-6 mr-2"
          />
          <h2 class="text-lg font-semibold text-gray-800">
            Account Information
          </h2>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex items-center">
            <div
              class="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-100 flex-shrink-0"
            >
              <svg
                class="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div class="ml-3">
              <div class="text-xs text-gray-500">Member Since</div>
              <div class="text-gray-800">
                {{ formatDate(getUser().created_at) }}
              </div>
            </div>
          </div>

          <div class="flex items-center">
            <div
              class="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-100 flex-shrink-0"
            >
              <svg
                class="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <div class="ml-3">
              <div class="text-xs text-gray-500">Last Updated</div>
              <div class="text-gray-800">
                {{ formatDate(getUser().updated_at) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Profile Image Modal -->
    <div
      v-if="showImageModal"
      class="fixed inset-0 z-50 overflow-y-auto bg-gray-700 bg-opacity-75"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div class="flex items-center justify-center min-h-screen p-4">
        <div
          class="bg-white rounded-lg overflow-hidden shadow-xl w-full max-w-md p-6"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-semibold text-gray-900" id="modal-title">
              Update Profile Picture
            </h3>
            <button
              @click="showImageModal = false"
              class="text-gray-400 hover:text-gray-500"
            >
              <svg
                class="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div>
            <label
              for="file-upload"
              class="block text-sm font-medium text-gray-700 mb-2"
              >Choose image file</label
            >
            <input
              id="file-upload"
              name="profile_picture_upload"
              type="file"
              @change="handleImageChange"
              accept="image/png, image/jpeg, image/gif"
              class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-green-700 hover:file:bg-emerald-200 cursor-pointer border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p class="mt-1 text-xs text-gray-500">PNG, JPG, GIF. Max 2MB.</p>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              @click="showImageModal = false"
              class="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Cancel
            </button>
            <button
              type="button"
              :disabled="!newProfileImage"
              @click="handleImageSubmit"
              class="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Update Picture
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Password Update Modal -->
    <div
      v-if="showPasswordModal"
      class="fixed inset-0 z-50 overflow-y-auto bg-gray-700 bg-opacity-75"
      aria-labelledby="password-modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div class="flex items-center justify-center min-h-screen p-4">
        <div
          class="bg-white rounded-lg overflow-hidden shadow-xl w-full max-w-md p-6"
        >
          <div class="flex justify-between items-center mb-4">
            <h3
              class="text-xl font-semibold text-gray-900"
              id="password-modal-title"
            >
              Update Password
            </h3>
            <button
              @click="showPasswordModal = false"
              class="text-gray-400 hover:text-gray-500"
            >
              <svg
                class="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <form @submit.prevent="handlePasswordUpdate" class="space-y-4">
            <div>
              <label
                for="current-password"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Current Password</label
              >
              <input
                id="current-password"
                type="password"
                v-model="currentPassword"
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label
                for="new-password"
                class="block text-sm font-medium text-gray-700 mb-1"
                >New Password</label
              >
              <input
                id="new-password"
                type="password"
                v-model="newPassword"
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
                minlength="8"
              />
              <!-- Password Strength Indicator -->
              <div v-if="newPassword" class="mt-2">
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
                <ul v-if="passwordStrength.feedback.length > 0" class="mt-1 text-xs text-gray-500 space-y-1">
                  <li v-for="(feedback, index) in passwordStrength.feedback" :key="index" class="flex items-center">
                    <svg class="h-3 w-3 mr-1" :class="{
                      'text-red-500': passwordStrength.score <= 2,
                      'text-yellow-500': passwordStrength.score === 3,
                      'text-green-500': passwordStrength.score > 3
                    }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path v-if="passwordStrength.score <= 2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {{ feedback }}
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <label
                for="confirm-password"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Confirm New Password</label
              >
              <input
                id="confirm-password"
                type="password"
                v-model="confirmPassword"
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
              />
              <p
                v-if="newPassword && confirmPassword && newPassword !== confirmPassword"
                class="mt-1 text-xs text-red-600"
              >
                Passwords do not match.
              </p>
              <p
                v-else-if="newPassword && confirmPassword && newPassword === confirmPassword"
                class="mt-1 text-xs text-green-600"
              >
                Passwords match.
              </p>
              <!-- Add this new indicator for insufficient password strength -->
              <div v-if="newPassword && confirmPassword && newPassword === confirmPassword && passwordStrength.score < 5" 
                   class="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                <div class="flex items-start">
                  <svg class="h-4 w-4 text-yellow-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p class="text-xs font-medium text-yellow-800">Password strength requirements not met</p>
                    <p class="text-xs text-yellow-700 mt-1">Your password must be marked as "Very strong" to update. Please ensure it has:</p>
                    <ul class="text-xs text-yellow-700 mt-1 list-disc list-inside">
                      <li v-if="newPassword.length < 12">At least 12 characters</li>
                      <li v-if="!/\d/.test(newPassword)">Numbers</li>
                      <li v-if="!/[A-Z]/.test(newPassword)">Uppercase letters</li>
                      <li v-if="!/[a-z]/.test(newPassword)">Lowercase letters</li>
                      <li v-if="!/[^A-Za-z0-9]/.test(newPassword)">Special characters</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div class="pt-4 flex justify-end gap-3">
              <button
                type="button"
                @click="showPasswordModal = false"
                class="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="!passwordsMatch || !currentPassword || passwordStrength.score < 5"
                class="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Update Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <EditProfileModal
      :showModal="showEditProfileModal"
      @close="showEditProfileModal = false"
      @profileUpdated="handleProfileUpdated"
    />

    <!-- Loading Overlay -->
    <div
      v-if="loading"
      class="fixed inset-0 z-[100] bg-gray-600 bg-opacity-60 flex items-center justify-center"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-xs w-full">
        <div class="flex items-center justify-center">
          <svg
            class="animate-spin h-6 w-6 text-green-600"
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
          <span class="ml-3 text-gray-700 font-medium">Processing...</span>
        </div>
      </div>
    </div>

    <Toaster position="bottom-right" richColors />
  </div>
</template>
