<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'
import { format } from 'date-fns'
import defaultProfileImage from '@/assets/profile.png'
import { getUser, fetchUserDetails } from '@/router/routeGuard'

const newProfileImage = ref(null)
const showImageModal = ref(false)
const showPasswordModal = ref(false)
const loading = ref(false)
const error = ref(null)

// Password update
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordsMatch = computed(() => {
  return newPassword.value === confirmPassword.value && newPassword.value.length >= 6
})

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

  if (newPassword.value.length < 6) {
    toast.error('Password must be at least 6 characters', { duration: 3000 })
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

    toast.success('Password updated successfully', { duration: 3000 })
    showPasswordModal.value = false
    
    // Clear the form
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
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
  <div class="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
    <div class="flex items-center justify-center gap-4">
      <!-- <img :src="defaultProfileImage" alt="Profile Silhouette" class="w-12 h-12 rounded-full" /> -->
      <h1 class="text-3xl font-bold text-gray-900">Profile Information</h1>
    </div>
    <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mt-4 min-h-[400px]"> <div class="h-32 sm:h-40 bg-[#047857]"></div>
  
      <div v-if="error"
           role="alert"
           class="mx-4 sm:mx-6 -mt-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
        <div class="flex items-center text-red-800 text-sm sm:text-base">
          <svg class="h-5 w-5 text-red-500 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          <span>{{ error }}</span>
        </div>
      </div>

      <div v-if="!getUser()" class="flex items-center justify-center pt-16 pb-20 px-4">
          <svg class="animate-spin h-10 w-10 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="ml-3 text-gray-500 text-lg">Loading Profile...</span>
      </div>
      <div v-else class="px-4 sm:px-6 pb-6 sm:pb-8">
        <div class="flex flex-col items-center -mt-16 sm:-mt-20">
          <div class="relative group">
            <img
              :src="profilePictureUrl"
              alt="Profile Image"
              class="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-lg object-cover bg-gray-200"
            />
            <button
              @click="showImageModal = true"
              aria-label="Edit profile picture"
              class="absolute -bottom-1 -right-1 p-2 bg-white rounded-full border border-gray-200 shadow-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out opacity-0 group-hover:opacity-100"
            >
               <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 hover:text-green-700" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
          </div>

          <div class="text-center mt-4">
            <h1 class="text-2xl sm:text-3xl font-semibold text-gray-900">
              {{ isIndividual ? `${getUser().first_name} ${getUser().last_name}` : getUser().first_name }}
            </h1>
            <div class="mt-2 flex items-center justify-center gap-2 flex-wrap">
                <span class="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200">{{ getUser().role }}</span>
                <span class="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800 ring-1 ring-inset ring-green-200">{{ getUser().user_type }}</span>
            </div>
          </div>
        </div>

        <div class="mt-8 pt-6 border-t border-gray-200">
          <dl class="space-y-4">

             <div class="flex items-start p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition duration-150 ease-in-out group">
              <div class="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-100 rounded-lg shadow-sm">
                <svg class="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <div class="ml-3 sm:ml-4 flex-1 min-w-0">
                <dt class="text-xs sm:text-sm font-medium text-gray-500">Email Address</dt>
                <dd class="mt-0.5 text-sm sm:text-base text-gray-900 break-words">{{ getUser().email_address }}</dd>
              </div>
            </div>

            <div class="flex items-start p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition duration-150 ease-in-out group">
               <div class="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-100 rounded-lg shadow-sm">
                 <svg class="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
               </div>
               <div class="ml-3 sm:ml-4 flex-1 min-w-0">
                 <dt class="text-xs sm:text-sm font-medium text-gray-500">Phone Number</dt>
                 <dd class="mt-0.5 text-sm sm:text-base text-gray-900 break-words">{{ getUser().phone_number || 'Not provided' }}</dd>
               </div>
            </div>

            <div class="flex items-start p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition duration-150 ease-in-out group">
               <div class="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-100 rounded-lg shadow-sm">
                 <svg class="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               </div>
               <div class="ml-3 sm:ml-4 flex-1 min-w-0">
                 <dt class="text-xs sm:text-sm font-medium text-gray-500">Full Address</dt>
                 <dd class="mt-0.5 text-sm sm:text-base text-gray-900 break-words">{{ getUser().full_address || 'Not provided' }}</dd>
               </div>
            </div>

            <template v-if="isIndividual">
               <div class="flex items-start p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition duration-150 ease-in-out group">
                 <div class="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-100 rounded-lg shadow-sm">
                   <svg class="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                 </div>
                 <div class="ml-3 sm:ml-4 flex-1 min-w-0">
                   <dt class="text-xs sm:text-sm font-medium text-gray-500">Sex</dt>
                   <dd class="mt-0.5 text-sm sm:text-base text-gray-900 break-words">{{ getUser().sex || 'Not provided' }}</dd>
                 </div>
               </div>

               <div class="flex items-start p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition duration-150 ease-in-out group">
                 <div class="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-100 rounded-lg shadow-sm">
                   <svg class="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                 </div>
                 <div class="ml-3 sm:ml-4 flex-1 min-w-0">
                   <dt class="text-xs sm:text-sm font-medium text-gray-500">Birthdate</dt>
                   <dd class="mt-0.5 text-sm sm:text-base text-gray-900 break-words">{{ formatDate(getUser().birthdate) }}</dd>
                 </div>
               </div>

               <div class="flex items-start p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition duration-150 ease-in-out group">
                 <div class="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-100 rounded-lg shadow-sm">
                   <svg class="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                 </div>
                 <div class="ml-3 sm:ml-4 flex-1 min-w-0">
                   <dt class="text-xs sm:text-sm font-medium text-gray-500">Civil Status</dt>
                   <dd class="mt-0.5 text-sm sm:text-base text-gray-900 break-words">{{ getUser().civil_status || 'Not provided' }}</dd>
                 </div>
               </div>
            </template>

             <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
               <div class="flex items-start p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition duration-150 ease-in-out group">
                 <div class="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-100 rounded-lg shadow-sm">
                   <svg class="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                 </div>
                 <div class="ml-3 sm:ml-4">
                   <dt class="text-xs sm:text-sm font-medium text-gray-500">Member Since</dt>
                   <dd class="mt-0.5 text-sm sm:text-base text-gray-900">{{ formatDate(getUser().created_at) }}</dd>
                 </div>
               </div>
               <div class="flex items-start p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition duration-150 ease-in-out group">
                 <div class="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-100 rounded-lg shadow-sm">
                   <svg class="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                 </div>
                 <div class="ml-3 sm:ml-4">
                   <dt class="text-xs sm:text-sm font-medium text-gray-500">Last Updated</dt>
                   <dd class="mt-0.5 text-sm sm:text-base text-gray-900">{{ formatDate(getUser().updated_at) }}</dd>
                 </div>
               </div>
             </div>

             <div class="flex justify-center pt-8">
               <button
                 @click="showPasswordModal = true"
                 class="inline-flex items-center gap-x-2 px-6 py-3 bg-[#047857] text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 1 1 0 000-2z" clip-rule="evenodd" />
                 </svg>
                 Update Password
               </button>
             </div>
          </dl>
        </div>
      </div>
    </div> <Transition enter-active-class="transition ease-out duration-300"
                enter-from-class="opacity-0"
                enter-to-class="opacity-100"
                leave-active-class="transition ease-in duration-200"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0">
     <div v-if="showImageModal" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
       <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
         <div class="fixed inset-0 bg-gray-700 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
         <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
         <Transition enter-active-class="transition ease-out duration-300"
                     enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                     enter-to-class="opacity-100 translate-y-0 sm:scale-100"
                     leave-active-class="transition ease-in duration-200"
                     leave-from-class="opacity-100 translate-y-0 sm:scale-100"
                     leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
            <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full p-6 sm:p-8">
              <h3 class="text-xl font-semibold text-gray-900 mb-6" id="modal-title">Update Profile Picture</h3>
              <div>
                <label for="file-upload" class="block text-sm font-medium text-gray-700 mb-2">Choose image file</label>
                <input
                  id="file-upload"
                  name="profile_picture_upload"
                  type="file"
                  @change="handleImageChange"
                  accept="image/png, image/jpeg, image/gif"
                  class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-100 file:text-green-700 hover:file:bg-green-200 cursor-pointer border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                />
                <p class="mt-1 text-xs text-gray-500">PNG, JPG, GIF. Max 2MB.</p>
              </div>
              <div class="mt-6 sm:mt-8 sm:flex sm:flex-row-reverse gap-3">
                <button
                  type="button"
                  :disabled="!newProfileImage"
                  @click="handleImageSubmit"
                  class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                >
                  Update Picture
                </button>
                <button
                  type="button"
                  @click="showImageModal = false"
                  class="mt-3 sm:mt-0 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm transition duration-150 ease-in-out"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Transition>
       </div>
     </div>
    </Transition>

    <Transition enter-active-class="transition ease-out duration-300"
                enter-from-class="opacity-0"
                enter-to-class="opacity-100"
                leave-active-class="transition ease-in duration-200"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0">
     <div v-if="showPasswordModal" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="password-modal-title" role="dialog" aria-modal="true">
       <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
         <div class="fixed inset-0 bg-gray-700 bg-opacity-75 transition-opacity" @click="showPasswordModal = false" aria-hidden="true"></div>
         <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
         <Transition enter-active-class="transition ease-out duration-300"
                     enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                     enter-to-class="opacity-100 translate-y-0 sm:scale-100"
                     leave-active-class="transition ease-in duration-200"
                     leave-from-class="opacity-100 translate-y-0 sm:scale-100"
                     leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
            <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full p-6 sm:p-8">
              <h3 class="text-xl font-semibold text-gray-900 mb-6" id="password-modal-title">Update Password</h3>
              <form @submit.prevent="handlePasswordUpdate" class="space-y-5">
                <div>
                  <label for="current-password" class="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input
                    id="current-password"
                    type="password"
                    v-model="currentPassword"
                    class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label for="new-password" class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    id="new-password"
                    type="password"
                    v-model="newPassword"
                    class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    required
                    minlength="8" />
                  <p class="mt-1 text-xs text-gray-500">Must be at least 8 characters long.</p>
                </div>
                <div>
                  <label for="confirm-password" class="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    v-model="confirmPassword"
                    class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    required
                  />
                  <p v-if="newPassword && confirmPassword && newPassword !== confirmPassword" class="mt-1 text-xs text-red-600">Passwords do not match.</p>
                </div>
                <div class="pt-4 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="submit"
                    :disabled="!passwordsMatch || !currentPassword || !newPassword || newPassword.length < 8"
                    class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                  >
                    Update Password
                  </button>
                  <button
                    type="button"
                    @click="showPasswordModal = false"
                    class="mt-3 sm:mt-0 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm transition duration-150 ease-in-out"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </Transition>
       </div>
     </div>
    </Transition>

    <Transition enter-active-class="transition ease-out duration-300"
                enter-from-class="opacity-0"
                enter-to-class="opacity-100"
                leave-active-class="transition ease-in duration-200"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0">
      <div v-if="loading" class="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="loading-modal-title" role="dialog" aria-modal="true">
        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-600 bg-opacity-60 transition-opacity" aria-hidden="true"></div>
          <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
           <Transition enter-active-class="transition ease-out duration-300"
                     enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                     enter-to-class="opacity-100 translate-y-0 sm:scale-100"
                     leave-active-class="transition ease-in duration-200"
                     leave-from-class="opacity-100 translate-y-0 sm:scale-100"
                     leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
              <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xs sm:w-full p-6">
                  <div class="flex items-center justify-center">
                      <svg class="animate-spin h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span class="ml-3 text-gray-700 font-medium">Processing...</span>
                  </div>
              </div>
            </Transition>
        </div>
      </div>
    </Transition>
    <Toaster position="bottom-right" richColors /> </div>
</template>