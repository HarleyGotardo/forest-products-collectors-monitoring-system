<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'
import { isFPCollector, isVSUAdmin, isFPUAdmin, isForestRanger } from '@/router/routeGuard'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const showApproveDialog = ref(false)
const userToApprove = ref(null)
const users = ref([])
const unapprovedUsers = ref([])
const roles = ref([])
const selectedRole = ref('')
const searchQuery = ref('')
const showModal = ref(false) // State to control the modal visibility
const unapprovedSearchQuery = ref('') // Search query for unapproved users
const currentPage = ref(1) // Current page for pagination
const itemsPerPage = 5 // Items per page for pagination
const currentPageApproved = ref(1) // Current page for approved users pagination

const paginatedUsers = computed(() => {
  const start = (currentPageApproved.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredUsers.value.slice(start, end)
})

const nextPageApproved = () => {
  if ((currentPageApproved.value * itemsPerPage) < filteredUsers.value.length) {
    currentPageApproved.value++
  }
}

const prevPageApproved = () => {
  if (currentPageApproved.value > 1) {
    currentPageApproved.value--
  }
}


const filteredUsers = computed(() => {
  let filtered = users.value

  if (selectedRole.value) {
    filtered = filtered.filter(user => user.role.id === selectedRole.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(user =>
      user.first_name.toLowerCase().includes(query) ||
      user.last_name.toLowerCase().includes(query) ||
      user.email_address.toLowerCase().includes(query)
    )
  }

  return filtered
})

const filteredUnapprovedUsers = computed(() => {
  let filtered = unapprovedUsers.value

  if (unapprovedSearchQuery.value) {
    const query = unapprovedSearchQuery.value.toLowerCase()
    filtered = filtered.filter(user =>
      user.first_name.toLowerCase().includes(query) ||
      user.last_name.toLowerCase().includes(query) ||
      user.email_address.toLowerCase().includes(query)
    )
  }

  return filtered
})

const paginatedUnapprovedUsers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredUnapprovedUsers.value.slice(start, end)
})

const fetchUsers = async () => {
  let { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      email_address,
      profile_picture,
      approval_flag,
      role:roles (
        id,
        name
      )
    `)

  if (error) {
    console.error('Error fetching users:', error)
  } else {
    users.value = data.filter(user => user.approval_flag !== null)
    unapprovedUsers.value = data.filter(user => user.approval_flag === null)
  }
}

const fetchRoles = async () => {
  let { data, error } = await supabase
    .from('roles')
    .select('id, name')

  if (error) {
    console.error('Error fetching roles:', error)
  } else {
    roles.value = data
  }
}

const getProfilePictureUrl = (profilePicture) => {
  if (profilePicture) {
    try {
      const parsedProfilePicture = JSON.parse(profilePicture)
      return parsedProfilePicture.data.publicUrl
    } catch (e) {
      console.error('Error parsing profile picture URL:', e)
      return null
    }
  }
  return null
}

const approveUser = async (userId) => {
  userToApprove.value = userId
  showApproveDialog.value = true
}

const handleApproveConfirm = async () => {
  const currentDate = new Date()
  const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ')

  const { error } = await supabase
    .from('profiles')
    .update({ approval_flag: formattedDate })
    .eq('id', userToApprove.value)

  if (error) {
    toast.error('Error approving user.', error.message)
  } else {
    toast.success('User approved successfully.')
    fetchUsers()
  }
  showApproveDialog.value = false
  userToApprove.value = null
}


const nextPage = () => {
  if ((currentPage.value * itemsPerPage) < filteredUnapprovedUsers.value.length) {
    currentPage.value++
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

onMounted(async () => {
  await fetchUsers()
  await fetchRoles()
})
</script>
<template>
  <div class="max-w-7xl mx-auto p-4 sm:p-6 mt-2">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0 mt-2">
      <div>
      <h2 class="text-xl sm:text-2xl font-bold text-gray-900">System Users</h2>
      <p class="mt-1 text-sm text-gray-500">Manage and view all system users</p>
      </div>
      <div class="flex space-x-4">
      <div class="relative flex-1 sm:flex-none">
        <input
        v-model="searchQuery"
        type="text"
        placeholder="Search users..."
        class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-200 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
        />
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        </div>
      </div>
      <button 
        v-if="isFPUAdmin || isForestRanger"
        @click="showModal = true"
        class="px-3 sm:px-4 py-2 bg-yellow-500 text-white rounded-lg shadow-sm hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 text-sm sm:text-base"
      >
        Pending Approval
      </button>
      </div>
    </div>

    <!-- Filters Section -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
      <!-- Role Filter -->
      <div class="relative">
        <label for="role" class="block text-sm font-medium text-gray-700 mb-2">Filter by Role</label>
        <div class="relative">
          <select
            id="role"
            v-model="selectedRole"
            class="appearance-none block w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-white border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
          >
            <option value="">All Roles</option>
            <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
          </select>
          <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Search Input -->
      <div>
        <label for="search" class="block text-sm font-medium text-gray-700 mb-2">Search Users</label>
        <div class="relative">
          <input
            id="search"
            v-model="searchQuery"
            type="text"
            placeholder="Search by name or email..."
            class="block w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-white border border-gray-200 pl-10 sm:pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
          />
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>

<!-- Users Table -->
<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            User
          </th>
          <th class="px-4 hidden sm:table-cell sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Email
          </th>
          <th class="px-4 hidden sm:table-cell sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Role
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr v-if="paginatedUsers.length === 0">
          <td colspan="3" class="px-4 sm:px-6 py-12 text-center">
            <div class="flex flex-col items-center">
              <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p class="text-gray-500 text-sm">No users found matching your criteria</p>
            </div>
          </td>
        </tr>
        <tr v-for="user in paginatedUsers" 
            :key="user.id"
            class="hover:bg-gray-50 transition-colors duration-200">
          <router-link :to="{ name: 'SystemUsersView', params: { id: user.id } }" class="contents">
            <td class="px-4 sm:px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div class="h-10 w-10 flex-shrink-0">
                  <img
                    v-if="getProfilePictureUrl(user.profile_picture)"
                    :src="getProfilePictureUrl(user.profile_picture)"
                    alt="Profile Picture"
                    class="h-10 w-10 rounded-full object-cover"
                  />
                  <div v-else class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span class="text-gray-600 font-medium">
                      {{ user.first_name[0] }}{{ user.last_name[0] }}
                    </span>
                  </div>
                </div>
                <div class="ml-4">
                  <div class="text-sm font-medium text-gray-900">
                    {{ user.first_name }} {{ user.last_name }}
                  </div>
                  <div class="block sm:hidden text-sm text-gray-600">{{ user.email_address }}</div>
                    <div class="block sm:hidden text-sm text-gray-600 rounded-2xl mt-1 bg-green-100 px-2 py-1 w-max">{{ user.role.name }}</div>
                </div>
              </div>
            </td>
            <td class="px-4 hidden sm:table-cell sm:px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-600">{{ user.email_address }}</div>
            </td>
            <td class="px-4 hidden sm:table-cell sm:px-6 py-4 whitespace-nowrap">
              <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                {{ user.role.name }}
              </span>
            </td>
          </router-link>
        </tr>
      </tbody>
    </table>
  </div>
  <!-- Pagination Controls for Approved Users -->
<div class="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200">
  <div class="flex items-center justify-between">
    <button 
      @click="prevPageApproved" 
      :disabled="currentPageApproved === 1"
      class="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg class="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Previous
    </button>
    <span class="text-sm text-gray-700">
      Page {{ currentPageApproved }} of {{ Math.ceil(filteredUsers.length / itemsPerPage) }}
    </span>
    <button 
      @click="nextPageApproved" 
      :disabled="(currentPageApproved * itemsPerPage) >= filteredUsers.length"
      class="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Next
      <svg class="ml-1 sm:ml-2 h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </div>
</div>
</div>



    <!-- Unapproved Users Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
        <div class="relative bg-white rounded-lg p-6 sm:p-8 max-w-4xl w-full">
          <button
            type="button"
            @click="showModal = false"
            class="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 class="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Unapproved Users</h2>
          
          <!-- Search Input for Unapproved Users -->
          <div class="mb-4">
            <div class="relative">
              <input
                id="unapprovedSearch"
                v-model="unapprovedSearchQuery"
                type="text"
                placeholder="Search by name or email..."
                class="block w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-white border border-gray-200 pl-10 sm:pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                  <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th class="hidden sm:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th class="hidden sm:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th class="hidden sm:table-cell px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-if="paginatedUnapprovedUsers.length === 0">
                  <td colspan="4" class="px-4 sm:px-6 py-12 text-center">
                    <div class="flex flex-col items-center">
                    <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p class="text-gray-500 text-sm">No unapproved users found</p>
                    </div>
                  </td>
                  </tr>
                  <tr v-for="user in paginatedUnapprovedUsers" 
                    :key="user.id"
                    class="hover:bg-gray-50 transition-colors duration-200">
                  <td class="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                    <div class="h-10 w-10 flex-shrink-0">
                      <img
                      v-if="getProfilePictureUrl(user.profile_picture)"
                      :src="getProfilePictureUrl(user.profile_picture)"
                      alt="Profile Picture"
                      class="h-10 w-10 rounded-full object-cover"
                      />
                      <div v-else class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span class="text-gray-600 font-medium">
                        {{ user.first_name[0] }}{{ user.last_name[0] }}
                      </span>
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900">
                      {{ user.first_name }} {{ user.last_name }}
                      </div>
                      <div class="block sm:hidden text-sm text-gray-600">{{ user.email_address }}</div>
                      <div class="block sm:hidden text-sm text-gray-600">{{ user.role.name }}</div>
                      <div class="block sm:hidden text-right text-sm font-medium">
                      <!-- Update both mobile and desktop approve buttons -->
<button
  @click="approveUser(user.id)"
  class="px-3 sm:px-4 py-2 bg-green-100 text-black rounded-lg shadow-sm hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
>
  <div class="flex items-center justify-center space-x-2">
    <p>Approve</p>
    <img src="@/assets/approve.png" alt="Approve Button" class="w-4 h-4" />
  </div>
</button>
                      </div>
                    </div>
                    </div>
                  </td>
                  <td class="hidden sm:table-cell px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-600">{{ user.email_address }}</div>
                  </td>
                  <td class="hidden sm:table-cell px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    {{ user.role.name }}
                    </span>
                  </td>
                  <td class="hidden sm:table-cell px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                    @click="approveUser(user.id)"
                    class="px-3 sm:px-4 py-2 bg-green-100 text-black rounded-lg shadow-sm hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                    <div class="flex items-center justify-center space-x-2">
                      <p>
                      Approve
                      </p>
                      <img src="@/assets/approve.png" alt="Approve Button" class="w-4 h-4" />
                    </div>
                    </button>
                  </td>
                  </tr>
                </tbody>
                </table>
            </div>
          </div>

          <!-- Pagination Controls -->
          <div class="flex justify-between items-center mt-4">
            <button
              @click="prevPage"
              :disabled="currentPage === 1"
      class="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
            <svg class="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
              Previous
            </button>
            <span class="text-sm text-gray-700">
              Page {{ currentPage }} of {{ Math.ceil(filteredUnapprovedUsers.length / itemsPerPage) }}
            </span>
            <button
              @click="nextPage"
              :disabled="(currentPage * itemsPerPage) >= filteredUnapprovedUsers.length"
      class="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <svg class="ml-1 sm:ml-2 h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
            </button>
          </div>
        </div>
      </div>
      <Toaster/>
    </div>
  </div>
  <!-- Alert Dialog -->
<AlertDialog :open="showApproveDialog" @update:open="showApproveDialog = $event">
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Approve User?</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to approve this user?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel @click="showApproveDialog = false">Cancel</AlertDialogCancel>
      <AlertDialogAction @click="handleApproveConfirm">Approve</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
</template>