<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import NatureCartLogo from '@/components/logo/NatureCartLogo.vue'
import Records from '@/components/SideBarItems/Records.vue'
import ForestProducts from '@/components/SideBarItems/ForestProducts.vue'
import FPC_Request from '@/components/SideBarItems/FPC_Request.vue'
import SystemUsers from '@/components/SideBarItems/SystemUsers.vue'
import Locations from '@/components/SideBarItems/Locations.vue'
import defaultProfileImage from '@/assets/profile.png'
import requestImage from '@/assets/request.png'
import logoutIcon from '@/assets/logout.png'
import { supabase } from '@/lib/supabaseClient'
import { getName, getUser, isFPCollector, isFPUAdmin, isForestRanger, fetchUserDetails, subscribeToUserChanges, getUserRole } from '@/router/routeGuard'
import { Toaster } from 'vue-sonner'
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
} from '@/components/ui/alert-dialog'

const router = useRouter()
const activeDropdown = ref(null) // Track active dropdown
const isSidebarOpen = ref(false)
const isLoading = ref(true) // Track loading state
const isLoggingOut = ref(false) // Track logout state
const pendingRequestsCount = ref(0) // Track pending requests count
let pendingRequestsSubscription = null; // Add this line to store subscription reference

// Computed properties for dropdown states
const isRecordsDropdownOpen = computed(() => activeDropdown.value === 'records')
const isForestProductsDropdownOpen = computed(() => activeDropdown.value === 'forestProducts')
const isFPCRequestDropdownOpen = computed(() => activeDropdown.value === 'fpc_request')
const isCollectorsDropdownOpen = computed(() => activeDropdown.value === 'collectors')
const isSystemUsersDropdownOpen = computed(() => activeDropdown.value === 'systemUsers')
const isLocationDropdownOpen = computed(() => activeDropdown.value === 'locations')

const fetchPendingRequestsCount = async () => {
  try {
    const { count, error } = await supabase
      .from('collection_requests')
      .select('id', { count: 'exact', head: true })
      .is('remarked_at', null)
      .is('deleted_at', null);

    if (error) {
      console.error('Error fetching pending requests count:', error);
      return;
    }

    pendingRequestsCount.value = count || 0;
  } catch (error) {
    console.error('Error in fetchPendingRequestsCount:', error);
  }
};

const setupPendingRequestsSubscription = () => {
  // Unsubscribe from any existing subscription
  if (pendingRequestsSubscription) {
    pendingRequestsSubscription.unsubscribe();
  }

  // Subscribe to collection_requests changes
  pendingRequestsSubscription = supabase
    .channel('pending-requests-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'collection_requests'
      },
      async (payload) => {
        // Refetch count when any change occurs
        await fetchPendingRequestsCount();
      }
    )
    .subscribe();
};

// Update onMounted to include subscription setup
onMounted(async () => {
  await fetchUserDetails();
  await fetchPendingRequestsCount();
  setupPendingRequestsSubscription();
  isLoading.value = false;
  subscribeToUserChanges();
});

// Add onUnmounted to clean up subscription
onUnmounted(() => {
  if (pendingRequestsSubscription) {
    pendingRequestsSubscription.unsubscribe();
  }
});

const profilePictureUrl = computed(() => {
  return getUser() && getUser().profile_picture ? getUser().profile_picture : defaultProfileImage
})

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const closeSidebar = () => {
  isSidebarOpen.value = false
}

// Modified toggle functions
const toggleRecordsDropdown = () => {
  activeDropdown.value = activeDropdown.value === 'records' ? null : 'records'
}

const toggleLocationDropdown = () => {
  activeDropdown.value = activeDropdown.value === 'locations' ? null : 'locations'
}

const toggleForestProductsDropdown = () => {
  activeDropdown.value = activeDropdown.value === 'forestProducts' ? null : 'forestProducts'
}

const toggleFPCRequestDropdown = () => {
  activeDropdown.value = activeDropdown.value === 'fpc_request' ? null : 'fpc_request'
}

const toggleCollectorsDropdown = () => {
  activeDropdown.value = activeDropdown.value === 'collectors' ? null : 'collectors'
}

const toggleSystemUsersDropdown = () => {
  activeDropdown.value = activeDropdown.value === 'systemUsers' ? null : 'systemUsers'
}

const handleLogout = async () => {
  isLoggingOut.value = true // Set logging out state
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error logging out:', error)
    isLoggingOut.value = false // Reset state if error
  } else {
    setTimeout(() => {
      router.push({ name: 'Index' })
    }, 2000) // 1 second delay
  }
}

const goToProfile = () => {
  router.push({ name: 'Profile' })
}

onMounted(async () => {
  await fetchUserDetails()
  await fetchPendingRequestsCount() // Add this line
  isLoading.value = false
  subscribeToUserChanges()
})
</script>
<template>
  <div
    class="min-h-screen bg-gray-50 relative"
    :class="{ 'pointer-events-none': isLoggingOut }"
  >
    <!-- Add overlay when logging out -->
    <div
      v-if="isLoggingOut"
      class="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-center justify-center"
    >
      <div class="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
        <div
          class="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"
        ></div>
        <span class="text-emerald-700">Logging out...</span>
      </div>
    </div>

    <!-- Improved Mobile Header - Better spacing and organization while preserving original elements -->
    <div
      class="fixed top-0 left-0 w-full h-16 bg-emerald-900 z-40 md:hidden flex items-center justify-between px-4"
    >
      <div class="flex items-center">
        <button
          @click="toggleSidebar"
          class="p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <svg
            class="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <div class="ml-3 flex items-center">
          <div class="w-8 h-8 rounded-full p-1.5">
            <img
              src="@/assets/nature-cart.png"
              alt="Nature Cart Logo"
              class="w-full h-full object-contain"
            />
          </div>
          <h1 class="ml-2 text-lg font-bold text-white">Nature Cart</h1>
        </div>
      </div>

      <router-link
        to="/authenticated/profile"
        class="flex items-center gap-2 rounded-full transition-all duration-300"
        :class="{ 'ring-2 ring-emerald-400 shadow-md': $route.name === 'Profile' }"
      >
        <div class="text-right hidden sm:block">
          <p class="text-white text-sm font-bold">{{ getName() }}</p>
          <p class="text-emerald-300 text-xs">{{ getUserRole() }}</p>
        </div>
        <img
          :src="profilePictureUrl"
          alt="Profile Picture"
          class="w-10 h-10 rounded-full"
        />
      </router-link>
    </div>

    <!-- Enhanced Overlay with Blur -->
    <div
      v-if="isSidebarOpen"
      @click="closeSidebar"
      class="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
    ></div>

    <!-- Enhanced Sidebar - Keeping all original icons -->
    <aside
      :class="`fixed top-0 left-0 h-full w-72 bg-white shadow-xl transition-all duration-300 ease-in-out z-50 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`"
    >
      <div class="flex flex-col h-full">
        <!-- Enhanced Header with tagline and close button for mobile -->
        <div
          class="p-5 border-b border-gray-300 relative"
        >
          <div class="flex flex-col">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-emerald-50 p-2">
                <NatureCartLogo />
              </div>
              <h1
                class="text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent"
              >
                Nature Cart
              </h1>
            </div>
            
            <p class="text-xs text-green-600 mt-2 font-bold italic tracking-wide">
              Forest treasures, tracked with care.
            </p>
          </div>
          <button
            @click="closeSidebar"
            class="md:hidden absolute top-5 right-4 p-2 rounded-lg hover:bg-gray-100 transition-all"
          >
            <svg
              class="w-5 h-5 text-gray-500"
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

        <!-- Enhanced Navigation - Preserving all original icons -->
        <nav class="flex-1 overflow-y-auto px-4 py-5 space-y-2">
          <!-- Main Navigation Section -->
          <div class="space-y-1 mb-5">
            <p
              class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2"
            >
              MAIN NAVIGATION
            </p>

            <router-link
              to="/authenticated/dashboard"
              class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
              @click="closeSidebar"
            >
              <div
                class="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-100 group-hover:bg-emerald-200 transition-all"
              >
                <img
                  src="@/assets/dashboard.png"
                  alt="Dashboard"
                  class="w-5 h-5 group-hover:scale-110 transition-transform"
                />
              </div>
              <div>
                <span
                  class="font-bold text-gray-700 group-hover:text-emerald-600"
                  >Dashboard</span
                >
                <p class="text-xs text-gray-500 mt-0.5">
                  System overview and summary statistics
                </p>
              </div>
            </router-link>

            <router-link
              v-if="isFPUAdmin || isForestRanger"
              to="/authenticated/sales-report"
              class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
              @click="closeSidebar"
            >
              <div
                class="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-all"
              >
                <img
                  src="@/assets/sales-report-2.png"
                  alt="Sales Report"
                  class="w-5 h-5 group-hover:scale-110 transition-transform"
                />
              </div>
              <div>
                <span
                  class="font-bold text-gray-700 group-hover:text-emerald-600"
                  >Sales Report</span
                >
                <p class="text-xs text-gray-500 mt-0.5">
                  Track revenue and collection metrics
                </p>
              </div>
            </router-link>

            <router-link
              v-if="isFPUAdmin || isForestRanger"
              to="/authenticated/system-users"
              class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
              @click="closeSidebar"
            >
              <div
                class="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-all"
              >
                <img
                  src="@/assets/user.png"
                  alt="Users"
                  class="w-5 h-5 group-hover:scale-110 transition-transform"
                />
              </div>
              <div>
                <span
                  class="font-bold text-gray-700 group-hover:text-emerald-600"
                  >System Users</span
                >
                <p class="text-xs text-gray-500 mt-0.5">
                  Manage user accounts and permissions
                </p>
              </div>
            </router-link>
            <router-link
              v-if="isFPUAdmin || isForestRanger" 
              to="/authenticated/collection-requests/all"
              class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
              @click="closeSidebar"
            >
              <div class="relative">
              <div
                class="w-8 h-8 flex items-center justify-center rounded-lg bg-yellow-50 group-hover:bg-yellow-100 transition-all"
              >
                <img
                src="@/assets/letter.png"
                alt="Users"
                class="w-5 h-5 group-hover:scale-110 transition-transform"
                />
              </div>
              <div
                v-if="pendingRequestsCount > 0"
                class="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1"
              >
                {{ pendingRequestsCount }}
              </div>
              </div>
              <div>
              <span
                class="font-bold text-gray-700 group-hover:text-emerald-600"
                >Collection Requests</span
              >
              <p class="text-xs text-gray-500 mt-0.5">
                View and manage all collection requests
              </p>
              </div>
            </router-link>
          </div>

          <!-- Collection Requests Section -->
          <div class="space-y-1 mb-5">
            <p
              class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2"
            >
              Requests / Records
            </p>

            <FPC_Request
              v-if="isFPCollector"
              :isDropdownOpen="isFPCRequestDropdownOpen"
              @toggleDropdown="toggleFPCRequestDropdown"
              label="Collection Requests"
              class="rounded-xl overflow-hidden"
            >              
              <router-link
                v-if="isFPCollector"
                to="/authenticated/collection-requests"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/request2.png"
                  alt="Your Requests"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >Your Requests</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    View your submitted collection requests
                  </p>
                </div>
              </router-link>
              <router-link
                v-if="isFPCollector"
                to="/authenticated/collection-request/create"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/add.png"
                  alt="New Request"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >New Request</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    Submit a new forest product collection request
                  </p>
                </div>
              </router-link>
              <router-link
                v-if="isFPCollector"
                to="/authenticated/collection-requests/trash"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/trash-bin.png"
                  alt="Trash Requests"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >Trash Requests</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    Review and take action on previously deleted requests
                  </p>
                </div>
              </router-link>
            </FPC_Request>

            <Records
              v-if="isFPUAdmin || isForestRanger || isFPCollector"
              :isDropdownOpen="isRecordsDropdownOpen"
              @toggleDropdown="toggleRecordsDropdown"
              label="Collection Records"
              class="rounded-xl overflow-hidden"
            >
              <router-link
                v-if="isFPUAdmin || isForestRanger"
                to="/authenticated/collection-records"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/records2.png"
                  alt="View Records"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >View Records</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    Browse all forest product collection records
                  </p>
                </div>
              </router-link>
              <router-link
                v-if="isFPCollector"
                to="/authenticated/fpc-collection-records"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/records2.png"
                  alt="View Records"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >Your Records</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    Access your personal collection history
                  </p>
                </div>
              </router-link>
              <router-link
                v-if="isFPUAdmin || isForestRanger"
                to="/authenticated/collection-records/create"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/add.png"
                  alt="New Record"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >New Record</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    Create a new forest product collection record
                  </p>
                </div>
              </router-link>
              <router-link
                v-if="isFPUAdmin || isForestRanger"
                to="/authenticated/collection-records/trash"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/trash-bin.png"
                  alt="Trashed Records"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >Trashed Records</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    Review and restore deleted collection records
                  </p>
                </div>
              </router-link>
            </Records>
          </div>

          <!-- Forest Management Section -->
          <div class="space-y-1 mb-5">
            <p
              class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2"
            >
              Forest Products & Locations
            </p>

            <ForestProducts
              :isDropdownOpen="isForestProductsDropdownOpen"
              @toggleDropdown="toggleForestProductsDropdown"
              label="Forest Products"
              class="rounded-xl overflow-hidden"
            >
              <router-link
                to="/authenticated/forest-products"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/forest-product.png"
                  alt="View Products"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >View Forest Products</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    Browse available forest products and details
                  </p>
                </div>
              </router-link>
              <router-link
                v-if="isFPUAdmin || isForestRanger"
                to="/authenticated/forest-products/create"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/add.png"
                  alt="New Product"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >New Forest Product</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    Add a new product to the forest inventory
                  </p>
                </div>
              </router-link>
              <router-link
                to="/authenticated/map"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/forest-map.png"
                  alt="Products Map"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >Forest Products Map</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    View products on an interactive map
                  </p>
                </div>
              </router-link>
              <router-link
                v-if="isFPUAdmin || isForestRanger"
                to="/authenticated/forest-products/trash"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/trash-bin.png"
                  alt="Trashed Products"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >Trashed Forest Products</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    Manage and restore deleted products
                  </p>
                </div>
              </router-link>
            </ForestProducts>

            <Locations
              :isDropdownOpen="isLocationDropdownOpen"
              @toggleDropdown="toggleLocationDropdown"
              label="Locations"
              class="rounded-xl overflow-hidden"
            >
              <router-link
                to="/authenticated/locations"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/location2.png"
                  alt="View Locations"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >View Locations</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    Browse and manage forest collection locations
                  </p>
                </div>
              </router-link>
              <router-link
                v-if="isFPUAdmin || isForestRanger"
                to="/authenticated/locations/create"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/add.png"
                  alt="New Location"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >New Location</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    Add a new forest product collection site
                  </p>
                </div>
              </router-link>
              <router-link
                v-if="isFPUAdmin || isForestRanger"
                to="/authenticated/locations/trash"
                class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
                @click="closeSidebar"
              >
                <img
                  src="@/assets/trash-bin.png"
                  alt="Trashed Locations"
                  class="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <div>
                  <span
                    class="font-bold text-emerald-700 group-hover:text-emerald-600"
                    >Trashed Locations</span
                  >
                  <p class="text-xs text-gray-500 mt-0.5">
                    Recover and manage deleted location data
                  </p>
                </div>
              </router-link>
            </Locations>
          </div>
        </nav>
        <!-- Enhanced User Profile Footer -->
        <div class="p-4 border-t border-gray-100 bg-gray-50">
          <div class="flex items-center justify-between">
            <router-link
              to="/authenticated/profile"
              class="flex items-center gap-3 rounded-xl transition-all duration-200 hover:bg-white p-2 active:scale-95"
              @click="closeSidebar"
            >
              <img
                :src="profilePictureUrl"
                alt="Profile Picture"
                class="w-12 h-12 rounded-xl object-cover ring-2 ring-emerald-100 hover:ring-emerald-200 transition-all"
              />
              <div>
                <p class="font-bold text-emerald-800">{{ getName() }}</p>
                <p class="text-sm text-gray-500">{{ getUserRole() }}</p>
              </div>
            </router-link>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  class="p-2 transition-all rounded-lg bg-gray-100 hover:bg-emerald-50 active:scale-95"
                  title="Logout"
                >
                  <img src="@/assets/logout.png" alt="Logout" class="w-4 h-4" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to log out?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    @click="handleLogout"
                    class="bg-red-600 hover:bg-red-700"
                  >
                    Log Out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <footer class="text-center text-xs text-gray-500 border-t border-gray-100 mt-4">
          <p class="text-gray-400">© 2025 Visayas State University. All rights reserved.</p>
        </footer>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main
      :class="`transition-all duration-300 ease-in-out ${
        isSidebarOpen ? 'ml-0 md:ml-72' : 'ml-0 md:ml-72'
      } pt-20 md:pt-6 px-4 md:px-8 pb-8`"
    >
      <router-view />
    </main>
    <Toaster
      theme="light"
      :toastOptions="{
        class: 'bg-[#ecfdf5] text-gray-800 border border-green-200 rounded-lg shadow-md',
        style: {
          padding: '1rem',
        }
      }"
    />
  </div>
</template>

<style scoped>
.router-link-active {
  @apply bg-emerald-50 text-emerald-600 font-bold;
}

/* Smooth transitions */
aside {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Custom scrollbar for sidebar */
nav {
  scrollbar-width: thin;
  scrollbar-color: #e2e8f0 transparent;
}

nav::-webkit-scrollbar {
  width: 4px;
}

nav::-webkit-scrollbar-track {
  background: transparent;
}

nav::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 2px;
}

nav::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}

/* Prevent scrolling when sidebar is open on mobile */
.overflow-hidden {
  overflow: hidden;
}

/* Add styles for disabled state */
.pointer-events-none {
  pointer-events: none;
  user-select: none;
}
</style>