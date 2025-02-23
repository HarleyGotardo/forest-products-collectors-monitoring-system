<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'

const route = useRoute()
const userId = route.params.id
const user = ref(null)
const error = ref(null)

const fetchUser = async () => {
  let { data, error: fetchError } = await supabase
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      email_address,
      profile_picture,
      role:roles (
        id,
        name
      )
    `)
    .eq('id', userId)
    .single()

  if (fetchError) {
    error.value = fetchError.message
  } else {
    user.value = data
  }
}

const profilePictureUrl = computed(() => {
  if (user.value && user.value.profile_picture) {
    try {
      const parsedProfilePicture = JSON.parse(user.value.profile_picture)
      return parsedProfilePicture.data.publicUrl
    } catch (e) {
      console.error('Error parsing profile picture URL:', e)
      return null
    }
  }
  return null
})

onMounted(() => {
  fetchUser()
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
    <!-- Error Alert -->
    <div 
      v-if="error" 
      class="mb-4 sm:mb-8 p-3 sm:p-4 bg-red-50 border-l-4 border-red-400 rounded-r-xl shadow-sm"
    >
      <div class="flex items-center">
        <svg 
          class="h-4 w-4 sm:h-5 sm:w-5 text-red-400 flex-shrink-0" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path 
            fill-rule="evenodd" 
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 101.414 1.414L10 11.414l1.293 1.293a1 1 001.414-1.414L11.414 10l1.293-1.293a1 1 00-1.414-1.414L10 8.586 8.707 7.293z" 
            clip-rule="evenodd"
          />
        </svg>
        <p class="ml-2 sm:ml-3 text-sm sm:text-base text-red-700 font-medium">{{ error }}</p>
      </div>
    </div>

    <!-- User Details Card -->
    <div 
      v-if="user" 
      class="bg-white rounded-xl mt-2 sm:rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
    >
      <!-- Card Header -->
      <div class="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-100">
        <div class="flex items-center justify-between">
          <h2 class="text-xl sm:text-2xl font-bold text-gray-900">User Details</h2>
          <!-- Avatar -->
          <div class="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-100 flex items-center justify-center">
            <img 
              v-if="profilePictureUrl" 
              :src="profilePictureUrl" 
              alt="Profile Picture" 
              class="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover"
            />
            <span v-else class="text-blue-600 font-medium text-base sm:text-lg">
              {{ user.first_name[0] }}{{ user.last_name[0] }}
            </span>
          </div>
        </div>
      </div>

      <!-- User Information Grid -->
      <div class="p-4 sm:p-8">
        <div class="grid grid-cols-1 gap-4 sm:gap-8">
          <!-- First Name -->
          <div class="space-y-1 sm:space-y-2">
            <label class="block text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
              First Name
            </label>
            <p class="text-base sm:text-lg text-gray-900 font-medium">
              {{ user.first_name }}
            </p>
          </div>

          <!-- Last Name -->
          <div class="space-y-1 sm:space-y-2">
            <label class="block text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
              Last Name
            </label>
            <p class="text-base sm:text-lg text-gray-900 font-medium">
              {{ user.last_name }}
            </p>
          </div>

          <!-- Email Address -->
          <div class="space-y-1 sm:space-y-2">
            <label class="block text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
              Email Address
            </label>
            <p class="text-base sm:text-lg text-gray-900 font-medium break-all">
              {{ user.email_address }}
            </p>
          </div>

          <!-- Role -->
          <div class="space-y-1 sm:space-y-2">
            <label class="block text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
              Role
            </label>
            <div class="flex items-center">
              <span 
                class="px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold
                       bg-blue-100 text-blue-700"
              >
                {{ user.role.name }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>