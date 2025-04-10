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

const showRejectDialog = ref(false) // State for reject confirmation dialog
const userToReject = ref(null) // Store the user ID to reject
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
const isLoading = ref(true) // Loading state for data processing

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
  isLoading.value = true
  let { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      email_address,
      profile_picture,
      approval_flag,
      user_type,
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
  isLoading.value = false
}

const fetchRoles = async () => {
  isLoading.value = true
  let { data, error } = await supabase
    .from('roles')
    .select('id, name')

  if (error) {
    console.error('Error fetching roles:', error)
  } else {
    roles.value = data
  }
  isLoading.value = false
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

const rejectUser = (userId) => {
  userToReject.value = userId
  showRejectDialog.value = true
}

const handleRejectConfirm = async () => {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userToReject.value)

  if (error) {
    toast.error('Error rejecting user.', error.message)
  } else {
    toast.success('User rejected successfully.')
    fetchUsers() // Refresh the users list
  }
  showRejectDialog.value = false
  userToReject.value = null
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
  isLoading.value = true;
  await fetchUsers();
  await fetchRoles();
  isLoading.value = false;
});
</script>
<template>
  <div class="max-w-7xl mx-auto p-4 sm:p-6">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
      <div class="flex items-center space-x-3">
        <img
          src="@/assets/user.png"
          alt="Users icon"
          class="w-10 h-10 transition-transform group-hover:scale-105"
        />
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900">System Users</h1>
          <p class="text-sm text-gray-500">Manage and view all system users</p>
        </div>
      </div>
      <button
        v-if="isFPUAdmin || isForestRanger"
        @click="showModal = true"
        class="relative px-4 py-2 bg-yellow-500 text-white font-medium rounded-lg shadow hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 transition"
      >
        <div class="flex items-center space-x-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span>Pending Approval</span>
          <!-- Notification Badge -->
          <span
            v-if="unapprovedUsers.length > 0"
            class="absolute -top-2 -right-2 flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-red-600 rounded-full"
          >
            {{ unapprovedUsers.length }}
          </span>
        </div>
      </button>
    </div>

    <!-- Filters Section -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <!-- Role Filter -->
      <div>
        <label for="role" class="block text-sm font-medium text-gray-700 mb-2">Filter by Role</label>
        <div class="relative">
          <select
            id="role"
            v-model="selectedRole"
            class="block w-full px-4 py-2 rounded-lg bg-white border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 appearance-none transition"
            aria-label="Filter users by role"
          >
            <option value="">All Roles</option>
            <option v-for="role in roles" :key="role.id" :value="role.id">
              {{ role.name }}
            </option>
          </select>
          <div class="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            class="block w-full px-4 py-2 pl-10 rounded-lg bg-white border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
            aria-label="Search users by name or email"
          />
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="isLoading" class="animate-pulse mb-6">
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-100">
              <tr>
                <th class="px-6 py-3 h-10"></th>
                <th class="hidden sm:table-cell px-6 py-3 h-10"></th>
                <th class="hidden sm:table-cell px-6 py-3 h-10"></th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="n in 5" :key="n">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="h-10 w-10 rounded-full bg-gray-200"></div>
                    <div class="ml-4">
                      <div class="h-4 bg-gray-200 rounded w-28"></div>
                      <div class="block sm:hidden h-3 bg-gray-200 rounded w-32 mt-2"></div>
                    </div>
                  </div>
                </td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-36"></div>
                </td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                  <div class="h-5 bg-gray-200 rounded-full w-20"></div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Users Table -->
    <div v-else class="bg-white rounded-lg shadow overflow-hidden mb-6">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-800">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-100 uppercase tracking-wider">
                User
              </th>
              <th scope="col" class="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-100 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" class="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-100 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" class="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-100 uppercase tracking-wider">
                Role
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="paginatedUsers.length === 0">
              <td colspan="3" class="px-6 py-10 text-center">
                <div class="flex flex-col items-center">
                  <svg class="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p class="text-gray-500">No users found matching your criteria</p>
                </div>
              </td>
            </tr>
            <tr
              v-for="user in paginatedUsers"
              :key="user.id"
              class="hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <router-link
                :to="{ name: 'SystemUsersView', params: { id: user.id } }"
                class="contents"
              >
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="h-10 w-10 flex-shrink-0">
                      <img
                        v-if="getProfilePictureUrl(user.profile_picture)"
                        :src="getProfilePictureUrl(user.profile_picture)"
                        alt=""
                        class="h-10 w-10 rounded-full object-cover"
                      />
                      <div
                        v-else
                        class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center"
                      >
                        <span class="text-gray-600 font-medium">
                          {{ user.first_name[0] }}{{ user.last_name[0] }}
                        </span>
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900">
                        {{ user.first_name }} {{ user.last_name }}
                      </div>
                      <div class="block sm:hidden text-sm text-gray-600">
                        {{ user.email_address }}
                      </div>
                      <div
                        class="block sm:hidden mt-1 text-xs font-medium rounded-full bg-green-100 px-2 py-1 text-green-800"
                      >
                        {{ user.role.name }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-600">{{ user.email_address }}</div>
                </td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                  <span
                  class="px-2 py-1 inline-flex text-xs font-medium rounded-full"
                  :class="{
                  'bg-pink-100 text-pink-800': user.user_type === 'Individual',
                  'bg-indigo-100 text-indigo-800': user.user_type === 'Association',
                  'bg-lime-100 text-lime-800': user.user_type === 'Organization',
                  'bg-cyan-100 text-cyan-800': user.user_type === 'Group of People'
                  }"
                  >
                  {{ user.user_type }}
                  </span>
                </td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                  <span
                  class="px-2 py-1 inline-flex text-xs font-medium rounded-full"
                  :class="{
                  'bg-red-100 text-red-800': user.role.name === 'Forest Ranger',
                  'bg-amber-100 text-amber-800': user.role.name === 'Forest Product Collector',
                  'bg-gray-100 text-gray-800': user.role.name === 'VSU Administrator',
                  'bg-emerald-100 text-emerald-800': user.role.name === 'FPU Administrator'
                  }"
                  >
                  {{ user.role.name }}
                  </span>
                </td>
              </router-link>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Controls -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <button
        @click="prevPageApproved"
        :disabled="currentPageApproved === 1"
        class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Previous page"
          >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        <span class="hidden sm:inline">Previous</span>
          </button>
          <span v-if="filteredUsers.length > 0" class="text-sm text-gray-700">
        <span class="hidden sm:inline">Page {{ currentPageApproved }} of {{ Math.ceil(filteredUsers.length / itemsPerPage) }}</span>
        <span class="sm:hidden">{{ currentPageApproved }}/{{ Math.ceil(filteredUsers.length / itemsPerPage) }}</span>
          </span>
          <button
        @click="nextPageApproved"
        :disabled="(currentPageApproved * itemsPerPage) >= filteredUsers.length"
        class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Next page"
          >
        <span class="hidden sm:inline">Next</span>
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Unapproved Users Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
        <div class="relative bg-white rounded-lg p-6 max-w-4xl w-full shadow-xl">
          <button
            type="button"
            @click="showModal = false"
            class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
            aria-label="Close modal"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 class="text-2xl font-bold text-gray-900 mb-4">Unapproved Users</h2>

          <!-- Search Input for Unapproved Users -->
          <div class="mb-4">
            <div class="relative">
              <input
                id="unapprovedSearch"
                v-model="unapprovedSearchQuery"
                type="text"
                placeholder="Search by name or email..."
                class="block w-full px-4 py-2 pl-10 rounded-lg bg-white border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                aria-label="Search unapproved users"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-100">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" class="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" class="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Role
                    </th>
                    <th scope="col" class="hidden sm:table-cell px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-if="paginatedUnapprovedUsers.length === 0">
                    <td colspan="4" class="px-6 py-10 text-center">
                      <div class="flex flex-col items-center">
                        <svg class="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <p class="text-gray-500">No unapproved users found</p>
                      </div>
                    </td>
                  </tr>
                  <tr
                    v-for="user in paginatedUnapprovedUsers"
                    :key="user.id"
                    class="hover:bg-gray-50 transition-colors"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="h-10 w-10 flex-shrink-0">
                          <img
                            v-if="getProfilePictureUrl(user.profile_picture)"
                            :src="getProfilePictureUrl(user.profile_picture)"
                            alt=""
                            class="h-10 w-10 rounded-full object-cover"
                          />
                          <div
                            v-else
                            class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center"
                          >
                            <span class="text-gray-600 font-medium">
                              {{ user.first_name[0] }}{{ user.last_name[0] }}
                            </span>
                          </div>
                        </div>
                        <div class="ml-4 text-left">
                          <div class="text-sm font-medium text-gray-900">
                            {{ user.first_name }} {{ user.last_name }}
                          </div>
                          <div class="block sm:hidden text-sm text-gray-600">
                            {{ user.email_address }}
                          </div>
                          <div class="block sm:hidden text-sm text-gray-600">
                            {{ user.role.name }}
                          </div>
                          <div class="block sm:hidden mt-3 space-x-2">
                            <button
                              @click="approveUser(user.id)"
                              class="px-3 py-1.5 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition"
                              aria-label="Approve user"
                            >
                              <div class="flex items-center space-x-1">
                                <span>Approve</span>
                                <img src="@/assets/approve.png" alt="" class="w-4 h-4" />
                              </div>
                            </button>
                            <button
                              @click="rejectUser(user.id)"
                              class="px-3 py-1.5 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition"
                              aria-label="Reject user"
                            >
                              <div class="flex items-center space-x-1">
                                <span>Reject</span>
                                <img src="@/assets/reject.png" alt="" class="w-4 h-4" />
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-600">{{ user.email_address }}</div>
                    </td>
                    <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                      <span class="px-2 py-1 inline-flex text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        {{ user.role.name }}
                      </span>
                    </td>
                    <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-right">
                      <div class="flex justify-end space-x-2">
                        <button
                          @click="approveUser(user.id)"
                          class="px-3 py-1.5 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition"
                          aria-label="Approve user"
                        >
                          <div class="flex items-center space-x-1">
                            <span>Approve</span>
                            <img src="@/assets/approve.png" alt="" class="w-4 h-4" />
                          </div>
                        </button>
                        <button
                          @click="rejectUser(user.id)"
                          class="px-3 py-1.5 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition"
                          aria-label="Reject user"
                        >
                          <div class="flex items-center space-x-1">
                            <span>Reject</span>
                            <img src="@/assets/reject.png" alt="" class="w-4 h-4" />
                          </div>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Pagination Controls -->
          <div v-if="filteredUnapprovedUsers.length > 0" class="flex justify-between items-center mt-4">
            <button
              @click="prevPage"
              :disabled="currentPage === 1"
              class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              Next
              <svg class="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <Toaster />
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
        <AlertDialogAction @click="handleApproveConfirm" class="bg-green-600 hover:bg-green-700">
          Approve
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Reject Confirmation Dialog -->
  <AlertDialog :open="showRejectDialog" @update:open="showRejectDialog = $event">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Reject User?</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to reject this user? This action cannot be undone. This account will be permanently deleted.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="showRejectDialog = false">Cancel</AlertDialogCancel>
        <AlertDialogAction @click="handleRejectConfirm" class="bg-red-600 hover:bg-red-700">
          Reject
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>