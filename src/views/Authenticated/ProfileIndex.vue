<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import Swal from 'sweetalert2'
import { format } from 'date-fns'
import defaultProfileImage from '@/assets/profile.png'

const user = ref(null)
const error = ref(null)
const newProfileImage = ref(null)
const showImageModal = ref(false)
const loading = ref(false)

const fetchUserProfile = async () => {
  const { data: authUser, error: authError } = await supabase.auth.getUser()
  if (authError) {
    error.value = authError.message
    return
  }

  if (authUser && authUser.user) {
    let { data, error: fetchError } = await supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        email_address,
        profile_picture,
        updated_at,
        created_at,
        role_id
      `)
      .eq('id', authUser.user.id)
      .single()

    if (fetchError) {
      error.value = fetchError.message
    } else {
      if (data.profile_picture) {
        try {
          const profilePictureData = JSON.parse(data.profile_picture)
          data.profile_picture = profilePictureData.data.publicUrl
        } catch (e) {
          console.error('Error parsing profile_picture:', e)
        }
      }

      // Fetch role name
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('name')
        .eq('id', data.role_id)
        .single()

      if (roleError) {
        error.value = roleError.message
      } else {
        data.role = roleData
        user.value = data
      }
    }
  } else {
    error.value = 'User not authenticated'
  }
}

const handleImageChange = (event) => {
  newProfileImage.value = event.target.files[0]
}

const handleImageSubmit = async () => {
  if (!newProfileImage.value) {
    error.value = 'Please select an image'
    return
  }

  loading.value = true

  // Delete previous profile picture if it exists
  if (user.value.profile_picture) {
    const previousImagePath = user.value.profile_picture.split('/').pop()
    await supabase
      .storage
      .from('nature_cart_images')
      .remove([`users/${previousImagePath}`])
  }

  const currentDate = new Date()
  const formattedDate = format(currentDate, 'yyyy-MM-dd HH:mm:ss')

  // Upload new image to Supabase bucket using S3 protocol
  const imageName = `${user.value.id}_${Date.now()}_${newProfileImage.value.name}`
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
    error.value = uploadError.message
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
    .eq('id', user.value.id)

  if (updateError) {
    error.value = updateError.message
    loading.value = false
    return
  }

  Swal.fire({
    icon: 'success',
    title: 'Updated!',
    text: 'Your profile picture has been updated.',
    timer: 2000,
    showConfirmButton: false
  }).then(() => {
    showImageModal.value = false
    loading.value = false
    fetchUserProfile()
  })
}

const profilePictureUrl = computed(() => {
  return user.value && user.value.profile_picture ? user.value.profile_picture : defaultProfileImage
})

onMounted(() => {
  fetchUserProfile()
})
</script>

<template>
  <div class="max-w-3xl mx-auto p-6">
    <!-- Profile Card -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <!-- Header with background -->
      <div class="h-32 bg-gradient-to-r from-blue-500 to-blue-600"></div>

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

      <div v-if="user" class="px-6 pb-6">
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
            {{ user.first_name }} {{ user.last_name }}
          </h1>
          <div class="mt-1 px-3 py-1 bg-blue-50 rounded-full">
            <span class="text-sm font-medium text-blue-700">{{ user.role.name }}</span>
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
                <p class="text-gray-900">{{ user.email_address }}</p>
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
                  <p class="text-gray-900">{{ new Date(user.created_at).toISOString().split('T')[0] }}</p>
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
                  <p class="text-gray-900">{{ new Date(user.updated_at).toISOString().split('T')[0] }}</p>
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
  </div>
</template>