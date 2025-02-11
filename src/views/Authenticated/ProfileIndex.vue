<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import Swal from 'sweetalert2'
import { toast, Toaster } from 'vue-sonner'
import { format } from 'date-fns'
import defaultProfileImage from '@/assets/profile.png'
import { getUser, fetchUserDetails } from '@/router/routeGuard'

const newProfileImage = ref(null)
const showImageModal = ref(false)
const loading = ref(false)

const handleImageChange = (event) => {
  newProfileImage.value = event.target.files[0]
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

const profilePictureUrl = computed(() => {
  return getUser().profile_picture ? getUser().profile_picture : defaultProfileImage
})

onMounted(async () => {
  await fetchUserDetails()
})
</script>

<template>
  <div class="max-w-3xl mx-auto p-6">
    <!-- Profile Card -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <!-- Header with background -->
      <div class="h-32 bg-gradient-to-r from-green-500 to-blue-300"></div>

      <!-- Error Alert -->
      <div v-if="error" 
           class="mx-6 -mt-4 p-4 bg-red-50 border border-red-100 rounded-lg">
        <div class="flex items-center text-red-700">
          <svg class="h-5 w-5 text-red-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          {{ error }}
        </div>
      </div>

      <div v-if="!getUser()" class="animate-pulse flex flex-col items-center gap-4 w-60 mx-auto mt-8">
        <div>
          <div class="w-48 h-6 bg-slate-400 rounded-md"></div>
          <div class="w-28 h-4 bg-slate-400 mx-auto mt-3 rounded-md"></div>
        </div>
        <div class="h-7 bg-slate-400 w-full rounded-md"></div>
        <div class="h-7 bg-slate-400 w-full rounded-md"></div>
        <div class="h-7 bg-slate-400 w-full rounded-md"></div>
        <div class="h-7 bg-slate-400 w-1/2 rounded-md"></div>
      </div>

      <div v-else class="px-6 pb-6">
        <!-- Profile Image Section -->
        <div class="flex flex-col items-center -mt-16">
          <div class="relative">
            <img
              :src="profilePictureUrl"
              alt="Profile Image"
              class="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover"
            />
            <button 
              @click="showImageModal = true"
              class="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 focus:outline-none"
            >
              <img src="@/assets/edit.png" alt="Edit" class="w-5 h-5" />
            </button>
          </div>
          
          <!-- Name and Role -->
          <h1 class="mt-4 text-2xl font-bold text-gray-900">
            {{ getUser().first_name }} {{ getUser().last_name }}
          </h1>
          <div class="mt-1 px-3 py-1 bg-blue-50 rounded-full">
            <span class="text-sm font-medium text-blue-700">{{ getUser().role }}</span>
          </div>
        </div>

        <!-- Contact and Details -->
        <div class="mt-8">
          <div class="grid grid-cols-1 gap-4">
            <!-- Email -->
            <div class="flex items-center p-4 bg-gray-50 rounded-lg">
              <div class="p-2 bg-white rounded-md shadow-sm">
                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="ml-4">
                <p class="text-sm text-gray-500">Email Address</p>
                <p class="text-gray-900">{{ getUser().email_address }}</p>
              </div>
            </div>

            <!-- Dates Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Created Date -->
              <div class="flex items-center p-4 bg-gray-50 rounded-lg">
                <div class="p-2 bg-white rounded-md shadow-sm">
                  <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="ml-4">
                  <p class="text-sm text-gray-500">Member Since</p>
                  <p class="text-gray-900">{{ new Date(getUser().created_at).toISOString().split('T')[0] }}</p>
                </div>
              </div>

              <!-- Updated Date -->
              <div class="flex items-center p-4 bg-gray-50 rounded-lg">
                <div class="p-2 bg-white rounded-md shadow-sm">
                  <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div class="ml-4">
                  <p class="text-sm text-gray-500">Last Updated</p>
                  <p class="text-gray-900">{{ new Date(getUser().updated_at).toISOString().split('T')[0] }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Image Modal -->
    <div v-if="showImageModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
        <div class="relative bg-white rounded-lg p-8 max-w-lg w-full">
          <h3 class="text-lg font-medium mb-4">Update Profile Picture</h3>
          <input 
            type="file" 
            @change="handleImageChange" 
            class="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer focus:outline-none"
          />
          <div class="flex justify-end mt-4">
            <button
              type="button"
              @click="showImageModal = false"
              class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 mr-2"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleImageSubmit"
              class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Update
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading Modal -->
    <div v-if="loading" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
        <div class="relative bg-white rounded-lg p-8 max-w-lg w-full">
          <div class="flex flex-row gap-2">
            <div class="animate-pulse bg-gray-300 w-14 h-14 rounded-lg"></div>
            <div class="flex flex-col gap-2">
              <div class="animate-pulse bg-gray-300 w-28 h-5 rounded-lg"></div>
              <div class="animate-pulse bg-gray-300 w-36 h-3 rounded-lg"></div>
              <div class="animate-pulse bg-gray-300 w-36 h-2 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Toaster/>
  </div>
</template>