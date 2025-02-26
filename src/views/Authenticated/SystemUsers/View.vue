<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import { format } from 'date-fns'

const route = useRoute()
const router = useRouter()
const userId = route.params.id
const user = ref(null)
const error = ref(null)
const collectionRecords = ref([])
const createdByRecords = ref([])
const currentPage = ref(1)
const itemsPerPage = 5
const currentCreatedByPage = ref(1)
const approvedByRecords = ref([])
const currentApprovedByPage = ref(1)

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
    if (isForestProductCollector(user.value.role.id)) {
      fetchCollectionRecords()
    }
    if (isFPUAdmin(user.value.role.id) || isForestRanger(user.value.role.id)) {
      fetchCreatedByRecords()
    }
    if (isVSUAdmin(user.value.role.id)) {
      fetchApprovedByRecords()
    }
  }
}

const isForestProductCollector = (roleId) => {
  return roleId === 2
}

const isVSUAdmin = (roleId) => {
  return roleId === 3
}

const isFPUAdmin = (roleId) => {
  return roleId === 4
}

const isForestRanger = (roleId) => {
  return roleId === 1
}

const goToCollectionRecord = (recordId) => {
  router.push(`/authenticated/collection-records/${recordId}`)
}

const fetchCollectionRecords = async () => {
  let { data: collection_records, error: fetchError } = await supabase
    .from('collection_records')
    .select(`
      id,
      created_at,
      forest_product:forest_products ( id, name ),
      total_cost,
      created_by:profiles!collection_records_created_by_fkey ( id, first_name, last_name ),
      is_paid
    `)
    .eq('user_id', userId)
    .is('deleted_at', null) // Exclude records with non-null deleted_at

  if (fetchError) {
    error.value = fetchError.message
  } else {
    collectionRecords.value = collection_records.map(record => ({
      id: record.id,
      created_at: record.created_at,
      formatted_created_at: format(new Date(record.created_at), 'MMMM dd, yyyy'),
      forest_product: record.forest_product,
      total_cost: record.total_cost,
      created_by_name: `${record.created_by.first_name} ${record.created_by.last_name}`,
      is_paid: record.is_paid ? 'Paid' : 'Unpaid'
    }))
  }
}

const fetchCreatedByRecords = async () => {
  let { data: created_by_records, error: fetchError } = await supabase
    .from('collection_records')
    .select(`
      id,
      created_at,
      forest_product:forest_products ( id, name ),
      user_id,
      total_cost,
      is_paid
    `)
    .eq('created_by', userId)
    .is('deleted_at', null); // Exclude records with non-null deleted_at

  if (fetchError) {
    error.value = fetchError.message;
  } else {
    // Fetch user details from profiles based on created_by user_id
    const userIds = created_by_records.map(record => record.user_id);
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', userIds); // Get users based on the created_by ids

    if (userError) {
      error.value = userError.message;
    } else {
      createdByRecords.value = created_by_records.map(record => ({
        id: record.id,
        created_at: record.created_at,
        formatted_created_at: format(new Date(record.created_at), 'MMMM dd, yyyy'),
        forest_product: record.forest_product,
        total_cost: record.total_cost,
        is_paid: record.is_paid ? 'Paid' : 'Unpaid',
        user: `${users.find(user => user.id === record.user_id)?.first_name} ${users.find(user => user.id === record.user_id)?.last_name}` // Find the user details and format to first_name and last_name
      }));
    }
  }
}

const fetchApprovedByRecords = async () => {
  let { data: approved_by_records, error: fetchError } = await supabase
    .from('collection_records')
    .select(`
      id,
      created_at,
      forest_product:forest_products ( id, name ),
      user_id,
      total_cost,
      is_paid
    `)
    .eq('approved_by', userId)
    .is('deleted_at', null); // Exclude records with non-null deleted_at

  if (fetchError) {
    error.value = fetchError.message;
  } else {
    // Fetch user details from profiles based on user_id
    const userIds = approved_by_records.map(record => record.user_id);
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', userIds); // Get users based on the user ids

    if (userError) {
      error.value = userError.message;
    } else {
      approvedByRecords.value = approved_by_records.map(record => ({
        id: record.id,
        created_at: record.created_at,
        formatted_created_at: format(new Date(record.created_at), 'MMMM dd, yyyy'),
        forest_product: record.forest_product,
        total_cost: record.total_cost,
        is_paid: record.is_paid ? 'Paid' : 'Unpaid',
        user: `${users.find(user => user.id === record.user_id)?.first_name} ${users.find(user => user.id === record.user_id)?.last_name}` // Find the user details and format to first_name and last_name
      }));
    }
  }
}

const paginatedApprovedByRecords = computed(() => {
  const start = (currentApprovedByPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return approvedByRecords.value.slice(start, end)
})

const totalApprovedByPages = computed(() => {
  return Math.ceil(approvedByRecords.value.length / itemsPerPage)
})

const nextApprovedByPage = () => {
  if (currentApprovedByPage.value < totalApprovedByPages.value) {
    currentApprovedByPage.value++
  }
}

const prevApprovedByPage = () => {
  if (currentApprovedByPage.value > 1) {
    currentApprovedByPage.value--
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

const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return collectionRecords.value.slice(start, end)
})

const paginatedCreatedByRecords = computed(() => {
  const start = (currentCreatedByPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return createdByRecords.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(collectionRecords.value.length / itemsPerPage)
})

const totalCreatedByPages = computed(() => {
  return Math.ceil(createdByRecords.value.length / itemsPerPage)
})

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const nextCreatedByPage = () => {
  if (currentCreatedByPage.value < totalCreatedByPages.value) {
    currentCreatedByPage.value++
  }
}

const prevCreatedByPage = () => {
  if (currentCreatedByPage.value > 1) {
    currentCreatedByPage.value--
  }
}

onMounted(() => {
  fetchUser()
})
</script>
<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 bg-gray-50">
    <!-- Error Alert -->
    <div
      v-if="error"
      class="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-md transition-all duration-300 ease-in-out"
    >
      <div class="flex items-center">
        <svg
          class="h-5 w-5 text-red-500 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 101.414 1.414L10 11.414l1.293 1.293a1 1 001.414-1.414L11.414 10l1.293-1.293a1 1 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <p class="ml-3 text-base text-red-700 font-medium">{{ error }}</p>
      </div>
    </div>

    <!-- User Details Card -->
    <div
      v-if="user"
      class="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-2xl"
    >
      <!-- Card Header with Gradient Background -->
      <div
        class="px-6 sm:px-8 py-6 bg-gradient-to-r from-blue-500 to-indigo-600"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-bold text-white">User Profile</h2>
          <!-- Avatar with Ring -->
          <div
            class="h-14 w-14 rounded-full bg-white p-1 ring-4 ring-white/30 shadow-lg"
          >
            <img
              v-if="profilePictureUrl"
              :src="profilePictureUrl"
              alt="Profile Picture"
              class="h-full w-full rounded-full object-cover"
            />
            <div
              v-else
              class="h-full w-full rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center"
            >
              <span class="text-white font-medium text-lg">
                {{ user.first_name[0] }}{{ user.last_name[0] }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- User Information Grid -->
      <div class="p-6 sm:p-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- First Name -->
          <div
            class="space-y-2 transition-all duration-300 p-4 rounded-xl hover:bg-gray-50"
          >
            <label
              class="block text-sm font-medium text-gray-500 uppercase tracking-wider"
            >
              First Name
            </label>
            <p class="text-lg text-gray-900 font-medium">
              {{ user.first_name }}
            </p>
          </div>

          <!-- Last Name -->
          <div
            class="space-y-2 transition-all duration-300 p-4 rounded-xl hover:bg-gray-50"
          >
            <label
              class="block text-sm font-medium text-gray-500 uppercase tracking-wider"
            >
              Last Name
            </label>
            <p class="text-lg text-gray-900 font-medium">
              {{ user.last_name }}
            </p>
          </div>

          <!-- Email Address -->
          <div
            class="space-y-2 transition-all duration-300 p-4 rounded-xl hover:bg-gray-50"
          >
            <label
              class="block text-sm font-medium text-gray-500 uppercase tracking-wider"
            >
              Email Address
            </label>
            <p class="text-lg text-gray-900 font-medium break-all">
              {{ user.email_address }}
            </p>
          </div>

          <!-- Role -->
          <div
            class="space-y-2 transition-all duration-300 p-4 rounded-xl hover:bg-gray-50"
          >
            <label
              class="block text-sm font-medium text-gray-500 uppercase tracking-wider"
            >
              Role
            </label>
            <div class="flex items-center">
              <span
                class="px-4 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 border border-indigo-100"
              >
                {{ user.role.name }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Created By Records Section -->
    <div
      v-if="isFPUAdmin(user?.role?.id) || isForestRanger(user?.role?.id)"
      class="mt-12"
    >
      <div class="flex items-center space-x-2 mb-6">
        <div class="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
        <h3 class="text-xl font-bold text-gray-800">
          Created Collection Records
        </h3>
      </div>

      <!-- Created By Records Card -->
      <div
        class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <!-- Table Header -->
        <div
          class="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200"
        >
          <div class="flex items-center justify-between">
            <h4 class="font-medium text-gray-700">
              Records created by {{ user.first_name }} {{ user.last_name }}
            </h4>
          </div>
        </div>

        <!-- Records Table -->
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  ID
                </th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Forest Product
                </th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Date Collected
                </th>
                <th
                  scope="col"
                  class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Total Cost
                </th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  FP Collector
                </th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Payment Status
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-if="paginatedCreatedByRecords.length === 0">
                <td colspan="6" class="px-6 py-12 text-center">
                  <div class="flex flex-col items-center">
                    <svg
                      class="w-16 h-16 text-gray-300 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    <p class="text-gray-500 mb-1">No records found</p>
                    <p class="text-sm text-gray-400">
                      Created collection records will appear here
                    </p>
                  </div>
                </td>
              </tr>
              <tr
                v-for="record in paginatedCreatedByRecords"
                :key="record.id"
                class="hover:bg-blue-50 transition-colors duration-200 cursor-pointer"
                @click="goToCollectionRecord(record.id)"
              >
                <td
                  class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600"
                >
                  #{{ record.id }}
                </td>
                <td
                  class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                >
                  {{ record.forest_product.name }}
                </td>
                <td
                  class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {{ record.formatted_created_at }}
                </td>
                <td
                  class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                >
                  ₱{{ record.total_cost }}
                </td>
                <td
                  class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {{ record.user }}
                </td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                  <span
                    :class="[
                  'px-3 py-1 rounded-full text-xs font-medium',
                  record.is_paid === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                ]"
                  >
                    {{ record.is_paid }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <!-- Pagination Controls for Created By Records -->
        <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div class="flex items-center justify-between">
            <button
              @click="prevCreatedByPage"
              :disabled="currentCreatedByPage === 1"
              class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              :class="currentCreatedByPage === 1 ? 'text-gray-400' : 'text-gray-700'"
            >
              <svg
                class="mr-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Previous
            </button>

            <div
              class="flex items-center px-4 py-2 rounded-lg bg-white border border-gray-200 shadow-sm"
            >
              <span class="text-sm font-medium text-gray-700"
                >Page {{ currentCreatedByPage }} of
                {{ totalCreatedByPages }}</span
              >
            </div>

            <button
              @click="nextCreatedByPage"
              :disabled="currentCreatedByPage === totalCreatedByPages"
              class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              :class="currentCreatedByPage === totalCreatedByPages ? 'text-gray-400' : 'text-gray-700'"
            >
              Next
              <svg
                class="ml-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Collection Records Section -->
    <div v-if="isForestProductCollector(user?.role?.id)" class="mt-12">
      <div class="flex items-center space-x-2 mb-6">
        <div class="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
        <h3 class="text-xl font-bold text-gray-800">Collection Records</h3>
      </div>

      <!-- Collection Records Card -->
      <div
        class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <!-- Table Header -->
        <div
          class="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200"
        >
          <div class="flex items-center justify-between">
            <h4 class="font-medium text-gray-700">
              Records for {{ user.first_name }} {{ user.last_name }}
            </h4>
            <!-- Could add filter/search controls here -->
          </div>
        </div>

        <!-- Records Table -->
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  ID
                </th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Forest Product
                </th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Date Collected
                </th>
                <th
                  scope="col"
                  class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Total Cost
                </th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Processed By
                </th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Payment Status
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-if="paginatedRecords.length === 0">
                <td colspan="6" class="px-6 py-12 text-center">
                  <div class="flex flex-col items-center">
                    <svg
                      class="w-16 h-16 text-gray-300 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    <p class="text-gray-500 mb-1">No records found</p>
                    <p class="text-sm text-gray-400">
                      Collection records will appear here
                    </p>
                  </div>
                </td>
              </tr>
              <tr
                v-for="record in paginatedRecords"
                :key="record.id"
                class="hover:bg-blue-50 transition-colors duration-200 cursor-pointer"
                @click="goToCollectionRecord(record.id)"
              >
                <td
                  class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600"
                >
                  #{{ record.id }}
                </td>
                <td
                  class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                >
                  {{ record.forest_product.name }}
                </td>
                <td
                  class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {{ record.formatted_created_at }}
                </td>
                <td
                  class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                >
                  ₱{{ record.total_cost }}
                </td>
                <td
                  class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {{ record.created_by_name }}
                </td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                  <span
                    :class="[
                      'px-3 py-1 rounded-full text-xs font-medium',
                      record.is_paid === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    ]"
                  >
                    {{ record.is_paid }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div class="flex items-center justify-between">
            <button
              @click="prevPage"
              :disabled="currentPage === 1"
              class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              :class="currentPage === 1 ? 'text-gray-400' : 'text-gray-700'"
            >
              <svg
                class="mr-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Previous
            </button>

            <div
              class="flex items-center px-4 py-2 rounded-lg bg-white border border-gray-200 shadow-sm"
            >
              <span class="text-sm font-medium text-gray-700"
                >Page {{ currentPage }} of {{ totalPages }}</span
              >
            </div>

            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              :class="currentPage === totalPages ? 'text-gray-400' : 'text-gray-700'"
            >
              Next
              <svg
                class="ml-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Approved By Records Section -->
    <div v-if="isVSUAdmin(user?.role?.id)" class="mt-12">
      <div class="flex items-center space-x-2 mb-6">
        <div class="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
        <h3 class="text-xl font-bold text-gray-800">
          Approved Collection Records
        </h3>
      </div>

      <!-- Approved By Records Card -->
      <div
        class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <!-- Table Header -->
        <div
          class="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200"
        >
          <div class="flex items-center justify-between">
            <h4 class="font-medium text-gray-700">
              Records approved by {{ user.first_name }} {{ user.last_name }}
            </h4>
          </div>
        </div>

        <!-- Records Table -->
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  ID
                </th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Forest Product
                </th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Date Collected
                </th>
                <th
                  scope="col"
                  class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Total Cost
                </th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  FP Collector
                </th>
                <th
                  scope="col"
                  class="hidden sm:table-cell px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Payment Status
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-if="paginatedApprovedByRecords.length === 0">
                <td colspan="6" class="px-6 py-12 text-center">
                  <div class="flex flex-col items-center">
                    <svg
                      class="w-16 h-16 text-gray-300 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    <p class="text-gray-500 mb-1">No records found</p>
                    <p class="text-sm text-gray-400">
                      Approved collection records will appear here
                    </p>
                  </div>
                </td>
              </tr>
              <tr
                v-for="record in paginatedApprovedByRecords"
                :key="record.id"
                class="hover:bg-blue-50 transition-colors duration-200 cursor-pointer"
                @click="goToCollectionRecord(record.id)"
              >
                <td
                  class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600"
                >
                  #{{ record.id }}
                </td>
                <td
                  class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                >
                  {{ record.forest_product.name }}
                </td>
                <td
                  class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {{ record.formatted_created_at }}
                </td>
                <td
                  class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                >
                  ₱{{ record.total_cost }}
                </td>
                <td
                  class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {{ record.user }}
                </td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                  <span
                    :class="['px-3 py-1 rounded-full text-xs font-medium', record.is_paid === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800']"
                    >{{ record.is_paid }}</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div class="flex items-center justify-between">
            <button
              @click="prevApprovedByPage"
              :disabled="currentApprovedByPage === 1"
              class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              :class="currentApprovedByPage === 1 ? 'text-gray-400' : 'text-gray-700'"
            >
              <svg
                class="mr-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Previous
            </button>

            <div
              class="flex items-center px-4 py-2 rounded-lg bg-white border border-gray-200 shadow-sm"
            >
              <span class="text-sm font-medium text-gray-700"
                >Page {{ currentApprovedByPage }} of
                {{ totalApprovedByPages }}</span
              >
            </div>

            <button
              @click="nextApprovedByPage"
              :disabled="currentApprovedByPage === totalApprovedByPages"
              class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              :class="currentApprovedByPage === totalApprovedByPages ? 'text-gray-400' : 'text-gray-700'"
            >
              Next
              <svg
                class="ml-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
