<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import { format } from 'date-fns'
import {
  Pagination,
  PaginationList,
  PaginationListItem,
  PaginationFirst,
  PaginationLast,
  PaginationNext,
  PaginationPrev,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { toast, Toaster } from 'vue-sonner'

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
const loading = ref(false)

const fetchUser = async () => {
  let { data, error: fetchError } = await supabase
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      email_address,
      profile_picture,
      user_type,
      sex,
      birthdate,
      full_address,
      civil_status,
      phone_number,
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
    if (isFPUAdmin(user.value.role.id) || isForestRanger(user.value.role.id)) {
      fetchApprovedByRecords()
    }
  }
}

const isForestProductCollector = (roleId) => {
  return roleId === 2
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
      created_at,      created_by:profiles!collection_records_created_by_fkey ( id, first_name, last_name ),
      is_paid
    `)
    .eq('user_id', userId)
    .is('deleted_at', null) // Exclude records with non-null deleted_at

  if (fetchError) {
    error.value = fetchError.message
  } else {
    // Fetch the collection record items to get forest product details
    for (let record of collection_records) {
      // Get items for each collection record
      const { data: items, error: itemsError } = await supabase
        .from('collection_record_items')
        .select(`
          id,
          total_cost,
          fp_and_location_id,
          fp_and_location:fp_and_locations(
            forest_product:forest_products(id, name)
          )
        `)
        .eq('collection_record_id', record.id)

      if (itemsError) {
        error.value = itemsError.message
        continue
      }

      // Calculate the actual total cost from items
      const totalCost = items.reduce((sum, item) => sum + item.total_cost, 0)

      // Extract forest product names
      const forestProducts = items.map(item => item.fp_and_location.forest_product.name)

      collectionRecords.value.push({
        id: record.id,
        created_at: record.created_at,
        formatted_created_at: format(new Date(record.created_at), 'MMMM dd, yyyy'),
        forest_products: forestProducts,
        total_cost: totalCost,
        created_by_name: `${record.created_by.first_name} ${record.created_by.last_name}`,
        is_paid: record.is_paid ? 'Paid' : 'Unpaid',
        items_count: items.length
      })
    }
  }
}

const fetchCreatedByRecords = async () => {
  let { data: created_by_records, error: fetchError } = await supabase
    .from('collection_records')
    .select(`
      id,
      created_at,
      user_id,
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
      for (let record of created_by_records) {
        // Get items for each collection record
        const { data: items, error: itemsError } = await supabase
          .from('collection_record_items')
          .select(`
            id,
            total_cost,
            fp_and_location_id,
            fp_and_location:fp_and_locations(
              forest_product:forest_products(id, name)
            )
          `)
          .eq('collection_record_id', record.id)

        if (itemsError) {
          error.value = itemsError.message
          continue
        }

        // Calculate the total cost from items
        const totalCost = items.reduce((sum, item) => sum + item.total_cost, 0)

        // Extract forest product names
        const forestProducts = items.map(item => item.fp_and_location.forest_product.name)

        createdByRecords.value.push({
          id: record.id,
          created_at: record.created_at,
          formatted_created_at: format(new Date(record.created_at), 'MMMM dd, yyyy'),
          forest_products: forestProducts,
          total_cost: totalCost,
          is_paid: record.is_paid ? 'Paid' : 'Unpaid',
          user: `${users.find(user => user.id === record.user_id)?.first_name} ${users.find(user => user.id === record.user_id)?.last_name}`,
          items_count: items.length
        });
      }
    }
  }
}

const fetchApprovedByRecords = async () => {
  let { data: approved_by_records, error: fetchError } = await supabase
    .from('collection_records')
    .select(`
      id,
      created_at,
      user_id,
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
      .in('id', userIds);

    if (userError) {
      error.value = userError.message;
    } else {
      for (let record of approved_by_records) {
        // Get items for each collection record
        const { data: items, error: itemsError } = await supabase
          .from('collection_record_items')
          .select(`
            id,
            total_cost,
            fp_and_location_id,
            fp_and_location:fp_and_locations(
              forest_product:forest_products(id, name)
            )
          `)
          .eq('collection_record_id', record.id)

        if (itemsError) {
          error.value = itemsError.message
          continue
        }

        // Calculate the total cost from items
        const totalCost = items.reduce((sum, item) => sum + item.total_cost, 0)

        // Extract forest product names
        const forestProducts = items.map(item => item.fp_and_location.forest_product.name)

        approvedByRecords.value.push({
          id: record.id,
          created_at: record.created_at,
          formatted_created_at: format(new Date(record.created_at), 'MMMM dd, yyyy'),
          forest_products: forestProducts,
          total_cost: totalCost,
          is_paid: record.is_paid ? 'Paid' : 'Unpaid',
          user: `${users.find(user => user.id === record.user_id)?.first_name} ${users.find(user => user.id === record.user_id)?.last_name}`,
          items_count: items.length
        });
      }
    }
  }
}

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

const paginatedApprovedByRecords = computed(() => {
  const start = (currentApprovedByPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return approvedByRecords.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(collectionRecords.value.length / itemsPerPage)
})

const totalCreatedByPages = computed(() => {
  return Math.ceil(createdByRecords.value.length / itemsPerPage)
})

const totalApprovedByPages = computed(() => {
  return Math.ceil(approvedByRecords.value.length / itemsPerPage)
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

onMounted(async () => {
  loading.value = true;
  
  // Check if user exists
  const { data: user, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', route.params.id)
    .single();

  if (error || !user) {
    // If user doesn't exist or there's an error, redirect to index
    router.push('/authenticated/system-users');
    toast.error('User not found');
    return;
  }

  // If user exists, fetch the details
  await fetchUser();
  loading.value = false;
});
</script>
<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 bg-gray-50">
    <!-- Loading Skeleton -->
    <div v-if="!user" class="animate-pulse">
      <!-- Back Button Skeleton -->
      <div class="max-w-5xl mx-auto mb-4">
        <div class="w-24 h-10 bg-gray-200 rounded-md"></div>
      </div>

      <!-- Profile Card Skeleton -->
      <div class="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-8">
        <!-- Cover Image Skeleton -->
        <div class="h-32 sm:h-48 bg-gray-200"></div>
        
        <!-- Profile Info Skeleton -->
        <div class="px-4 sm:px-6 pb-5 pt-0 relative">
          <!-- Profile Picture Skeleton -->
          <div class="absolute -top-12 sm:-top-16">
            <div class="h-24 w-24 sm:h-32 sm:w-32 rounded-full border-4 border-white shadow-md bg-gray-200"></div>
          </div>
          
          <!-- Name and Role Skeleton -->
          <div class="ml-28 sm:ml-36 pt-3">
            <div class="h-8 w-48 bg-gray-200 rounded"></div>
            <div class="flex gap-2 mt-2">
              <div class="h-5 w-24 bg-gray-200 rounded-full"></div>
              <div class="h-5 w-28 bg-gray-200 rounded-full"></div>
            </div>
          </div>
        </div>

        <!-- Quick Info Pills Skeleton -->
        <div class="px-4 sm:px-6 pb-6">
          <div class="flex flex-wrap gap-2 mb-6">
            <div class="h-8 w-32 bg-gray-200 rounded-full"></div>
            <div class="h-8 w-36 bg-gray-200 rounded-full"></div>
            <div class="h-8 w-28 bg-gray-200 rounded-full"></div>
          </div>

          <!-- Detailed Information Skeleton -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Personal Information Section Skeleton -->
            <div class="bg-gray-50 rounded-xl p-4">
              <div class="h-6 w-40 bg-gray-200 rounded mb-3"></div>
              <div class="space-y-3">
                <div class="h-4 w-24 bg-gray-200 rounded"></div>
                <div class="h-4 w-full bg-gray-200 rounded"></div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="h-4 w-20 bg-gray-200 rounded"></div>
                  <div class="h-4 w-16 bg-gray-200 rounded"></div>
                </div>
                <div class="h-4 w-28 bg-gray-200 rounded"></div>
              </div>
            </div>

            <!-- Account Information Section Skeleton -->
            <div class="bg-gray-50 rounded-xl p-4">
              <div class="h-6 w-40 bg-gray-200 rounded mb-3"></div>
              <div class="space-y-3">
                <div class="h-4 w-24 bg-gray-200 rounded"></div>
                <div class="h-4 w-full bg-gray-200 rounded"></div>
                <div class="h-4 w-20 bg-gray-200 rounded"></div>
                <div class="h-4 w-28 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Records Section Skeleton -->
      <div class="max-w-5xl mx-auto mt-8">
        <!-- Section Title Skeleton -->
        <div class="flex items-center space-x-2 mb-4">
          <div class="w-1.5 h-6 bg-gray-200 rounded-full"></div>
          <div class="h-6 w-48 bg-gray-200 rounded"></div>
        </div>

        <!-- Records Card Skeleton -->
        <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <!-- Table Header Skeleton -->
          <div class="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-200">
            <div class="h-5 w-64 bg-gray-200 rounded"></div>
          </div>

          <!-- Mobile View Skeleton -->
          <div class="block sm:hidden">
            <div v-for="i in 3" :key="i" class="border-b border-gray-100 p-4">
              <div class="flex justify-between items-start mb-2">
                <div class="h-5 w-16 bg-gray-200 rounded"></div>
                <div class="h-5 w-20 bg-gray-200 rounded-full"></div>
              </div>
              <div class="h-4 w-40 bg-gray-200 rounded mb-2"></div>
              <div class="flex justify-between">
                <div class="h-4 w-24 bg-gray-200 rounded"></div>
                <div class="h-4 w-20 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>

          <!-- Desktop Table Skeleton -->
          <div class="hidden sm:block">
            <div class="px-6 py-4 border-b border-gray-200">
              <div class="grid grid-cols-6 gap-4">
                <div v-for="i in 6" :key="i" class="h-4 bg-gray-200 rounded"></div>
              </div>
            </div>
            <div v-for="i in 3" :key="i" class="px-6 py-4 border-b border-gray-200">
              <div class="grid grid-cols-6 gap-4">
                <div v-for="j in 6" :key="j" class="h-4 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>

          <!-- Pagination Skeleton -->
          <div class="bg-gray-50 px-4 sm:px-6 py-4 border-t border-gray-200">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="h-4 w-48 bg-gray-200 rounded hidden sm:block"></div>
              <div class="flex items-center gap-2">
                <div class="h-8 w-8 bg-gray-200 rounded"></div>
                <div class="h-8 w-8 bg-gray-200 rounded"></div>
                <div class="h-8 w-8 bg-gray-200 rounded"></div>
                <div class="h-8 w-8 bg-gray-200 rounded"></div>
                <div class="h-8 w-8 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actual Content -->
    <div v-else>
      <!-- Error Message -->
      <div v-if="error" class="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-md transition-all duration-300 ease-in-out">
        <div class="flex items-center">
          <svg class="h-5 w-5 text-red-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 001.414 1.414L10 11.414l1.293 1.293a1 1 001.414-1.414L11.414 10l1.293-1.293a1 1 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <p class="ml-3 text-base text-red-700 font-medium">{{ error }}</p>
        </div>
      </div>

      <!-- Back to users button -->
      <div class="max-w-5xl mx-auto mb-4">
        <button
          @click="router.push('/authenticated/system-users')"
          class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-full shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
        >
          <svg 
            class="mr-2 -ml-1 h-5 w-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2" 
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Users
        </button>
      </div>

      <!-- User Profile Card -->
      <div v-if="user" class="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl mb-8">
        <!-- Profile Header with Background -->
        <div class="relative">
          <!-- Cover Image/Background -->
          <div class="h-32 sm:h-48 bg-gray-200"></div>
          
          <!-- Profile Info with Avatar Overlay -->
          <div class="px-4 sm:px-6 pb-5 pt-0 relative">
            <!-- Profile Picture -->
            <div class="absolute -top-12 sm:-top-16 flex items-end">
              <div class="h-24 w-24 sm:h-32 sm:w-32 rounded-full border-4 border-white shadow-md bg-white overflow-hidden">
                <img v-if="profilePictureUrl" :src="profilePictureUrl" alt="Profile Picture" class="h-full w-full object-cover" />
                <div v-else class="h-full w-full rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
                  <span class="text-white font-bold text-2xl">{{ user.first_name[0] }}{{ user.last_name[0] }}</span>
                </div>
              </div>
            </div>
            
            <!-- User Name and Role -->
            <div class="ml-28 sm:ml-36 pt-3">
              <h2 class="text-2xl sm:text-3xl font-bold text-green-900">{{ user.first_name }} {{ user.last_name }}</h2>
              <div class="flex flex-wrap items-center gap-2 mt-1">
                <span
                  class="px-2 py-1 inline-flex text-xs font-medium rounded-full"
                  :class="{
                    'bg-red-100 text-red-800': user.role.name === 'Forest Ranger',
                    'bg-amber-100 text-amber-800': user.role.name === 'Forest Product Collector',
                    'bg-emerald-100 text-emerald-800': user.role.name === 'FPU Administrator'
                  }"
                >
                  {{ user.role.name }}
                </span>
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
              </div>
            </div>
          </div>
        </div>

        <!-- Profile Details -->
        <div class="px-4 sm:px-6 pb-6">
          <!-- Quick Info Pills -->
          <div class="flex flex-wrap gap-2 mb-6">
            <div class="flex items-center px-3 py-1.5 bg-gray-100 rounded-full">
              <svg class="h-4 w-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
              </svg>
              <span class="ml-1.5 text-sm text-gray-800 font-medium truncate max-w-xs">{{ user.email_address || 'Not provided' }}</span>
            </div>
            
            <div class="flex items-center px-3 py-1.5 bg-gray-100 rounded-full">
              <svg class="h-4 w-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path>
              </svg>
              <span class="ml-1.5 text-sm text-gray-800 font-medium">{{ user.phone_number || 'Not provided' }}</span>
            </div>
            
            <div v-if="user.user_type === 'Individual'" class="flex items-center px-3 py-1.5 bg-gray-100 rounded-full">
              <svg class="h-4 w-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M6 3.5A1.5 1.5 0 017.5 2h5A1.5 1.5 0 0114 3.5v2.75a.75.75 0 01-1.5 0V3.5a.25.25 0 00-.25-.25h-5a.25.25 0 00-.25.25v2.75a.75.75 0 01-1.5 0V3.5zM3.5 10.75a.75.75 0 00-1.5 0v5.5c0 .138.112.25.25.25h13.5a.25.25 0 00.25-.25v-5.5a.75.75 0 00-1.5 0v5.5a1.75 1.75 0 01-1.75 1.75H5.25A1.75 1.75 0 013.5 16.25v-5.5z" clip-rule="evenodd"></path>
                <path fill-rule="evenodd" d="M6.75 9a.75.75 0 01.75.75v.75h3v-.75a.75.75 0 011.5 0v.75h.25A1.75 1.75 0 0114 11.25v1a.75.75 0 01-1.5 0v-1a.25.25 0 00-.25-.25h-.25v.25a.75.75 0 01-1.5 0v-.25h-3v.25a.75.75 0 01-1.5 0v-.25H5.5a.25.25 0 00-.25.25v1a.75.75 0 01-1.5 0v-1A1.75 1.75 0 015.5 9.75h.25V9a.75.75 0 01.75-.75h.25z" clip-rule="evenodd"></path>
              </svg>
              <span class="ml-1.5 text-sm text-gray-800 font-medium">
                {{ user.birthdate ? Math.floor((new Date() - new Date(user.birthdate)) / (365.25 * 24 * 60 * 60 * 1000)) : 'Unknown' }} Years Old
              </span>
            </div>
          </div>

          <!-- Detailed Information -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Personal Information Section -->
            <div class="bg-gray-50 rounded-xl p-4">
              <h3 class="text-lg font-semibold text-gray-800 mb-3">Personal Information</h3>
              
              <div class="space-y-3">
                <div class="flex flex-col">
                  <span class="text-xs text-gray-500 uppercase tracking-wide">Full Address</span>
                  <span class="text-gray-800 mt-1">{{ user.full_address || 'Not provided' }}</span>
                </div>
                
                <div v-if="user.user_type === 'Individual'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="flex flex-col">
                    <span class="text-xs text-gray-500 uppercase tracking-wide">Birthdate</span>
                    <span class="text-gray-800 mt-1">{{ user.birthdate ? new Date(user.birthdate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' }) : 'Not provided' }}</span>
                  </div>
                  
                  <div class="flex flex-col">
                    <span class="text-xs text-gray-500 uppercase tracking-wide">Sex</span>
                    <span class="text-gray-800 mt-1">{{ user.sex || 'Not provided' }}</span>
                  </div>
                </div>
                
                <div v-if="user.user_type === 'Individual'" class="flex flex-col">
                  <span class="text-xs text-gray-500 uppercase tracking-wide">Civil Status</span>
                  <span class="text-gray-800 mt-1">{{ user.civil_status || 'Not provided' }}</span>
                </div>
              </div>
            </div>

            <!-- Account Information Section -->
            <div class="bg-gray-50 rounded-xl p-4">
              <h3 class="text-lg font-semibold text-gray-800 mb-3">Account Information</h3>
              
              <div class="space-y-3">
                <div class="flex flex-col">
                  <span class="text-xs text-gray-500 uppercase tracking-wide">Email Address</span>
                  <span class="text-gray-800 mt-1 break-all">{{ user.email_address || 'Not provided' }}</span>
                </div>
                
                <div class="flex flex-col">
                  <span class="text-xs text-gray-500 uppercase tracking-wide">Phone Number</span>
                  <span class="text-gray-800 mt-1">{{ user.phone_number || 'Not provided' }}</span>
                </div>
                
                <div class="flex flex-col">
                  <span class="text-xs text-gray-500 uppercase tracking-wide">User Type</span>
                  <span class="text-gray-800 mt-1">{{ user.user_type || 'Not provided' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Records Section Component - Forest Ranger & FPU Admin -->
      <div
        v-if="isFPUAdmin(user?.role?.id) || isForestRanger(user?.role?.id)"
        class="max-w-5xl mx-auto mt-8"
      >
        <div class="flex items-center space-x-2 mb-4">
          <div class="w-1.5 h-6 bg-gray-900 rounded-full"></div>
          <h3 class="text-xl font-bold text-gray-800">
            Created Collection Records
          </h3>
        </div>

        <!-- Records Card -->
        <div
          class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <!-- Table Header -->
          <div
            class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-4 border-b border-gray-200"
          >
            <div class="flex items-center justify-between">
              <h4 class="font-medium text-gray-700 text-sm sm:text-base">
                Records created by {{ user.first_name }} {{ user.last_name }}
              </h4>
            </div>
          </div>

          <!-- Mobile View Record List -->
          <div class="block sm:hidden">
            <div v-if="paginatedCreatedByRecords.length === 0" class="p-8 text-center">
              <div class="flex flex-col items-center">
                <svg
                  class="w-12 h-12 text-gray-300 mb-3"
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
                <p class="text-gray-500 mb-1 text-sm">No records found</p>
                <p class="text-xs text-gray-400">
                  Created collection records will appear here
                </p>
              </div>
            </div>
            
            <div v-else>
              <div
                v-for="record in paginatedCreatedByRecords"
                :key="record.id"
                class="border-b border-gray-100 p-4 hover:bg-blue-50 transition-colors duration-200"
                @click="goToCollectionRecord(record.id)"
              >
                <div class="flex justify-between items-start mb-2">
                  <span class="font-medium text-blue-600">#{{ record.id }}</span>
                  <span
                    :class="[
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      record.is_paid === 'Paid' ? 'bg-emerald-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    ]"
                  >
                    {{ record.is_paid }}
                  </span>
                </div>
                <div class="mb-1 text-sm">
                  <span class="font-medium">Products:</span> {{ record.forest_products.join(', ') }}
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">{{ record.formatted_created_at }}</span>
                  <span class="font-medium text-gray-900">{{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(record.total_cost) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Desktop Records Table -->
          <div class="hidden sm:block overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-emerald-50">
                <tr>
                  <th
                    scope="col"
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    ID
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Forest Products
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
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
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    FP Collector
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Payment Status
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-if="paginatedCreatedByRecords.length === 0">
                  <td colspan="6" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center">
                      <img src="@/assets/records.png" alt="Records" class="w-10 h-10">
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
                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                  >
                    {{ record.forest_products.join(', ') }}
                  </td>
                  <td
                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                  >
                    {{ record.formatted_created_at }}
                  </td>
                  <td
                    class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                  >
                    {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(record.total_cost) }}
                  </td>
                  <td
                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                  >
                    {{ record.user }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      :class="[
                        'px-3 py-1 rounded-full text-xs font-medium',
                        record.is_paid === 'Paid' ? 'bg-emerald-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      ]"
                    >
                      {{ record.is_paid }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Collection Records Pagination -->
          <div class="bg-gray-50 px-4 sm:px-6 py-4 border-t border-gray-200">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="text-sm text-gray-600 hidden sm:block">
                Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentPage * itemsPerPage, collectionRecords.length) }} of {{ collectionRecords.length }} items
              </div>
              <Pagination
                v-slot="{ page }"
                :total="collectionRecords.length"
                :items-per-page="itemsPerPage"
                :sibling-count="1"
                show-edges
                :default-page="currentPage"
                @update:page="(newPage) => {
                  currentPage = newPage;
                }"
                class="w-full sm:w-auto"
              >
                <div class="flex items-center justify-center sm:justify-end gap-2">
                  <!-- Mobile View -->
                  <div class="flex items-center gap-2 sm:hidden">
                    <PaginationPrev class="!w-12 !h-12" />
                    <div class="text-sm font-medium">
                      {{ currentPage }} / {{ Math.ceil(collectionRecords.length / itemsPerPage) }}
                    </div>
                    <PaginationNext class="!w-12 !h-12" />
                  </div>

                  <!-- Desktop View -->
                  <div class="hidden sm:flex items-center gap-1">
                    <PaginationFirst />
                    <PaginationPrev />
                    <PaginationList v-slot="{ items }" class="flex items-center gap-1">
                      <template v-for="(item, index) in items">
                        <PaginationListItem
                          v-if="item.type === 'page'"
                          :key="index"
                          :value="item.value"
                          :class="[
                            'w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-colors',
                            item.value === page ? 'bg-emerald-900 text-white' : 'hover:bg-gray-100'
                          ]"
                        >
                          {{ item.value }}
                        </PaginationListItem>
                        <PaginationEllipsis
                          v-else
                          :key="item.type"
                          :index="index"
                        />
                      </template>
                    </PaginationList>
                    <PaginationNext />
                    <PaginationLast />
                  </div>
                </div>
              </Pagination>
            </div>
          </div>
        </div>
      </div>

      <!-- Collection Records Section - Forest Product Collector -->
      <div v-if="isForestProductCollector(user?.role?.id)" class="max-w-5xl mx-auto mt-8">
        <div class="flex items-center space-x-2 mb-4">
          <div class="w-1.5 h-6 bg-[#047857] rounded-full"></div>
          <h3 class="text-xl font-bold text-gray-800">Collection Records</h3>
        </div>

        <!-- Collection Records Card -->
        <div
          class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <!-- Table Header -->
          <div
            class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-4 border-b border-gray-200"
          >
            <div class="flex items-center justify-between">
              <h4 class="font-medium text-gray-700 text-sm sm:text-base">
                Records for {{ user.first_name }} {{ user.last_name }}
              </h4>
            </div>
          </div>

          <!-- Mobile View Record List -->
          <div class="block sm:hidden">
            <div v-if="paginatedRecords.length === 0" class="p-8 text-center">
              <div class="flex flex-col items-center">
                <svg
                  class="w-12 h-12 text-gray-300 mb-3"
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
                <p class="text-gray-500 mb-1 text-sm">No records found</p>
                <p class="text-xs text-gray-400">
                  Collection records will appear here
                </p>
              </div>
            </div>
            
            <div v-else>
              <div
                v-for="record in paginatedRecords"
                :key="record.id"
                class="border-b border-gray-100 p-4 hover:bg-blue-50 transition-colors duration-200"
                @click="goToCollectionRecord(record.id)"
              >
                <div class="flex justify-between items-start mb-2">
                  <span class="font-medium text-blue-600">#{{ record.id }}</span>
                  <span
                    :class="[
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      record.is_paid === 'Paid' ? 'bg-emerald-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    ]"
                  >
                    {{ record.is_paid }}
                  </span>
                </div>
                <div class="mb-1 text-sm">
                  <span class="font-medium">Products:</span> {{ record.forest_products.join(', ') }}
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">{{ record.formatted_created_at }}</span>
                  <span class="font-medium text-gray-900">{{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(record.total_cost) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Desktop Records Table -->
          <div class="hidden sm:block overflow-x-auto">
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
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Forest Products
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
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
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Processed By
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Payment Status
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-if="paginatedRecords.length === 0">
                  <td colspan="6" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center">
                      <img src="@/assets/records.png" alt="Records" class="w-10 h-10">
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
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    #{{ record.id }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {{ record.forest_products.join(', ') }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ record.formatted_created_at }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(record.total_cost) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ record.created_by_name }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      :class="[
                        'px-3 py-1 rounded-full text-xs font-medium',
                        record.is_paid === 'Paid' ? 'bg-emerald-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      ]"
                    >
                      {{ record.is_paid }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Collection Records Pagination -->
          <div class="bg-gray-50 px-4 sm:px-6 py-4 border-t border-gray-200">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="text-sm text-gray-600 hidden sm:block">
                Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentPage * itemsPerPage, collectionRecords.length) }} of {{ collectionRecords.length }} items
              </div>
              <Pagination
                v-slot="{ page }"
                :total="collectionRecords.length"
                :items-per-page="itemsPerPage"
                :sibling-count="1"
                show-edges
                :default-page="currentPage"
                @update:page="(newPage) => {
                  currentPage = newPage;
                }"
                class="w-full sm:w-auto"
              >
                <div class="flex items-center justify-center sm:justify-end gap-2">
                  <!-- Mobile View -->
                  <div class="flex items-center gap-2 sm:hidden">
                    <PaginationPrev class="!w-12 !h-12" />
                    <div class="text-sm font-medium">
                      {{ currentPage }} / {{ Math.ceil(collectionRecords.length / itemsPerPage) }}
                    </div>
                    <PaginationNext class="!w-12 !h-12" />
                  </div>

                  <!-- Desktop View -->
                  <div class="hidden sm:flex items-center gap-1">
                    <PaginationFirst />
                    <PaginationPrev />
                    <PaginationList v-slot="{ items }" class="flex items-center gap-1">
                      <template v-for="(item, index) in items">
                        <PaginationListItem
                          v-if="item.type === 'page'"
                          :key="index"
                          :value="item.value"
                          :class="[
                            'w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-colors',
                            item.value === page ? 'bg-emerald-900 text-white' : 'hover:bg-gray-100'
                          ]"
                        >
                          {{ item.value }}
                        </PaginationListItem>
                        <PaginationEllipsis
                          v-else
                          :key="item.type"
                          :index="index"
                        />
                      </template>
                    </PaginationList>
                    <PaginationNext />
                    <PaginationLast />
                  </div>
                </div>
              </Pagination>
            </div>
          </div>
        </div>
      </div>

      <!-- Approved Records Section - VSU Admin -->
      <div v-if="isFPUAdmin(user?.role?.id)" class="max-w-5xl mx-auto mt-8">
        <div class="flex items-center space-x-2 mb-4">
          <div class="w-1.5 h-6 bg-gray-900 rounded-full"></div>
          <h3 class="text-xl font-bold text-gray-800">
            Approved Collection Records
          </h3>
        </div>

        <!-- Approved Records Card -->
        <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <!-- Table Header -->
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-4 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h4 class="font-medium text-gray-700 text-sm sm:text-base">
                Records approved by {{ user.first_name }} {{ user.last_name }}
              </h4>
            </div>
          </div>

          <!-- Mobile View Record List -->
          <div class="block sm:hidden">
            <div v-if="paginatedApprovedByRecords.length === 0" class="p-8 text-center">
              <div class="flex flex-col items-center">
                <img src="@/assets/records.png" alt="Records" class="w-10 h-10">
                <p class="text-gray-500 mb-1 text-sm">No records found</p>
                <p class="text-xs text-gray-400">
                  Approved records will appear here
                </p>
              </div>
            </div>
            
            <div v-else>
              <div
                v-for="record in paginatedApprovedByRecords"
                :key="record.id"
                class="border-b border-gray-100 p-4 hover:bg-blue-50 transition-colors duration-200"
                @click="goToCollectionRecord(record.id)"
              >
                <div class="flex justify-between items-start mb-2">
                  <span class="font-medium text-blue-600">#{{ record.id }}</span>
                  <span
                    :class="[
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      record.is_paid === 'Paid' ? 'bg-emerald-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    ]"
                  >
                    {{ record.is_paid }}
                  </span>
                </div>
                <div class="mb-1 text-sm">
                  <span class="font-medium">Products:</span> {{ record.forest_products.join(', ') }}
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">{{ record.formatted_created_at }}</span>
                  <span class="font-medium text-gray-900">{{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(record.total_cost) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Desktop Records Table -->
          <div class="hidden sm:block overflow-x-auto">
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
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Forest Products
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
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
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    FP Collector
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Payment Status
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-if="paginatedApprovedByRecords.length === 0">
                  <td colspan="6" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center">
                      <img src="@/assets/records.png" alt="Records" class="w-10 h-10">
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
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    #{{ record.id }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {{ record.forest_products.join(', ') }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ record.formatted_created_at }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(record.total_cost) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ record.user }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      :class="[
                        'px-3 py-1 rounded-full text-xs font-medium',
                        record.is_paid === 'Paid' ? 'bg-emerald-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      ]"
                    >
                      {{ record.is_paid }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Approved Records Pagination -->
          <div class="bg-gray-50 px-4 sm:px-6 py-4 border-t border-gray-200">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="text-sm text-gray-600 hidden sm:block">
                Showing {{ ((currentApprovedByPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentApprovedByPage * itemsPerPage, approvedByRecords.length) }} of {{ approvedByRecords.length }} items
              </div>
              <Pagination
                v-slot="{ page }"
                :total="approvedByRecords.length"
                :items-per-page="itemsPerPage"
                :sibling-count="1"
                show-edges
                :default-page="currentApprovedByPage"
                @update:page="(newPage) => {
                  currentApprovedByPage = newPage;
                }"
                class="w-full sm:w-auto"
              >
                <div class="flex items-center justify-center sm:justify-end gap-2">
                  <!-- Mobile View -->
                  <div class="flex items-center gap-2 sm:hidden">
                    <PaginationPrev class="!w-12 !h-12" />
                    <div class="text-sm font-medium">
                      {{ currentApprovedByPage }} / {{ Math.ceil(approvedByRecords.length / itemsPerPage) }}
                    </div>
                    <PaginationNext class="!w-12 !h-12" />
                  </div>

                  <!-- Desktop View -->
                  <div class="hidden sm:flex items-center gap-1">
                    <PaginationFirst />
                    <PaginationPrev />
                    <PaginationList v-slot="{ items }" class="flex items-center gap-1">
                      <template v-for="(item, index) in items">
                        <PaginationListItem
                          v-if="item.type === 'page'"
                          :key="index"
                          :value="item.value"
                          :class="[
                            'w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-colors',
                            item.value === page ? 'bg-emerald-900 text-white' : 'hover:bg-gray-100'
                          ]"
                        >
                          {{ item.value }}
                        </PaginationListItem>
                        <PaginationEllipsis
                          v-else
                          :key="item.type"
                          :index="index"
                        />
                      </template>
                    </PaginationList>
                    <PaginationNext />
                    <PaginationLast />
                  </div>
                </div>
              </Pagination>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>