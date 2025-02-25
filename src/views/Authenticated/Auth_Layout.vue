<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import NatureCartLogo from '@/components/logo/NatureCartLogo.vue'
import Records from '@/components/SideBarItems/Records.vue'
import ForestProducts from '@/components/SideBarItems/ForestProducts.vue'
import SystemUsers from '@/components/SideBarItems/SystemUsers.vue'
import Locations from '@/components/SideBarItems/Locations.vue'
import defaultProfileImage from '@/assets/profile.png'
import logoutIcon from '@/assets/logout.png'
import { supabase } from '@/lib/supabaseClient'
import { getName, getUser, isFPCollector, isVSUAdmin, isFPUAdmin, isForestRanger, fetchUserDetails, subscribeToUserChanges, getUserRole } from '@/router/routeGuard'
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

// Computed properties for dropdown states
const isRecordsDropdownOpen = computed(() => activeDropdown.value === 'records')
const isForestProductsDropdownOpen = computed(() => activeDropdown.value === 'forestProducts')
const isCollectorsDropdownOpen = computed(() => activeDropdown.value === 'collectors')
const isSystemUsersDropdownOpen = computed(() => activeDropdown.value === 'systemUsers')
const isLocationDropdownOpen = computed(() => activeDropdown.value === 'locations')

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

const toggleCollectorsDropdown = () => {
  activeDropdown.value = activeDropdown.value === 'collectors' ? null : 'collectors'
}

const toggleSystemUsersDropdown = () => {
  activeDropdown.value = activeDropdown.value === 'systemUsers' ? null : 'systemUsers'
}

const handleLogout = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error logging out:', error)
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
  isLoading.value = false
  subscribeToUserChanges()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 relative">
    <!-- Improved Burger Menu Button -->
    <button 
      @click="toggleSidebar"
      :class="`md:hidden fixed top-4 left-4 z-50 p-3 transition-all duration-300 active:scale-95 bg-transparent ${
      isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`"
    >
      <svg 
      class="w-6 h-6 text-gray-700" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
      >
      <path 
        v-if="!isSidebarOpen" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        stroke-width="2" 
        d="M4 6h16M4 12h16M4 18h16"
      />
      </svg>
    </button>

    <!-- Enhanced Overlay with Blur -->
    <div 
      v-if="isSidebarOpen" 
      @click="closeSidebar"
      class="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
    ></div>

    <!-- Enhanced Sidebar -->
    <aside 
      :class="`fixed top-0 left-0 h-full w-72 bg-white shadow-xl transition-all duration-300 ease-in-out z-40 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`"
    >
      <div class="flex flex-col h-full">
        <!-- Enhanced Header -->
        <div class="p-6 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-50 p-2">
              <NatureCartLogo />
            </div>
            <h1 class="text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
              Nature Cart
            </h1>
          </div>
        </div>

        <!-- Enhanced Navigation -->
        <nav class="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          <router-link 
            to="/authenticated/dashboard" 
            class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
          >
            <img src="@/assets/dashboard.png" alt="Dashboard" class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="font-medium text-gray-700 group-hover:text-emerald-600">Dashboard</span>
          </router-link>
        
          <router-link 
            v-if="isFPUAdmin || isForestRanger || isVSUAdmin"
            to="/authenticated/system-users" 
            class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
          >
            <img src="@/assets/user.png" alt="Dashboard" class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="font-medium text-gray-700 group-hover:text-emerald-600">System Users</span>
          </router-link>

          <ForestProducts
            :isDropdownOpen="isForestProductsDropdownOpen"
            @toggleDropdown="toggleForestProductsDropdown"
            label="Forest Products"
            class="rounded-xl overflow-hidden"
          >
          <router-link 
            to="/authenticated/forest-products" 
            class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
          >
            <img src="@/assets/forest-product.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="font-medium text-gray-700 group-hover:text-emerald-600">View Forest Products</span>
          </router-link>
          <router-link 
            v-if="isFPUAdmin || isForestRanger" 
            to="/authenticated/forest-products/create" 
            class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
          >
            <img src="@/assets/add.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="font-medium text-gray-700 group-hover:text-emerald-600">New Forest Product</span>
          </router-link>
            <router-link 
            to="/authenticated/map" 
            class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
          >
            <img src="@/assets/forest-map.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="font-medium text-gray-700 group-hover:text-emerald-600">Forest Products Map</span>
          </router-link>
          <router-link 
            v-if="isFPUAdmin || isForestRanger"
            to="/authenticated/forest-products/trash" 
            class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
          >
            <img src="@/assets/trash-bin.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="font-medium text-gray-700 group-hover:text-emerald-600">Trashed Forest Products</span>
          </router-link>
          </ForestProducts>

          <!-- Enhanced Dropdowns -->
          <Locations
            :isDropdownOpen="isLocationDropdownOpen"
            @toggleDropdown="toggleLocationDropdown"
            label="Locations"
            class="rounded-xl overflow-hidden"
          >
            <router-link 
            to="/authenticated/locations" 
            class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
          >
            <img src="@/assets/location2.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="font-medium text-gray-700 group-hover:text-emerald-600">View Locations</span>
          </router-link>
          <router-link 
            v-if="isFPUAdmin || isForestRanger" 
            to="/authenticated/locations/create" 
            class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
          >
            <img src="@/assets/add.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="font-medium text-gray-700 group-hover:text-emerald-600">New Location</span>
          </router-link>
          <router-link 
            v-if="isFPUAdmin || isForestRanger" 
            to="/authenticated/locations/trash" 
            class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
          >
            <img src="@/assets/trash-bin.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="font-medium text-gray-700 group-hover:text-emerald-600">Trashed Locations</span>
          </router-link>
          </Locations>

          <Records
            :isDropdownOpen="isRecordsDropdownOpen"
            @toggleDropdown="toggleRecordsDropdown"
            label="Collection Records"
            class="rounded-xl overflow-hidden"
          >
          <router-link 
            v-if="isFPUAdmin || isForestRanger || isVSUAdmin" 
            to="/authenticated/collection-records" 
            class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
          >
            <img src="@/assets/records2.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="font-medium text-gray-700 group-hover:text-emerald-600">View Records</span>
          </router-link>
          <router-link 
            v-if="isFPUAdmin || isForestRanger" 
            to="/authenticated/collection-records/create" 
            class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
          >
            <img src="@/assets/add.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="font-medium text-gray-700 group-hover:text-emerald-600">New Record</span>
          </router-link>
          <router-link 
            v-if="isFPUAdmin || isForestRanger" 
            to="/authenticated/collection-records/trash" 
            class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
          >
            <img src="@/assets/trash-bin.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="font-medium text-gray-700 group-hover:text-emerald-600">Trashed Records</span>
          </router-link>
          </Records>
        </nav>

        <div class="flex items-center justify-between gap-3 p-3 border-t bg-gray-50 shadow-xl border-gray-100 ">
          <router-link
            to="/authenticated/profile"
            class="flex items-center gap-3 p-3 cursor-pointer rounded-xl transition-all duration-200 group active:scale-95"
            active-class="bg-green-100"
          >
            <div class="flex flex-col items-center rounded-lg">
              <img 
                :src="profilePictureUrl" 
                alt="Profile Picture" 
                class="w-12 h-12 rounded-xl object-cover ring-2 ring-emerald-100 group-hover:ring-emerald-200 transition-all"
              />
              <p class="font-medium text-gray-800 mt-2">{{ getName() }}</p>
              <p class="text-sm text-gray-500">{{ getUserRole() }}</p>
            </div>
          </router-link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
                <button class="p-2 transition-all rounded-lg bg-gray-100 hover:bg-emerald-50 active:scale-95">
                <img src="@/assets/logout.png" alt="Logout" class="w-6 h-6" />
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
                <AlertDialogAction @click="handleLogout">Log Out</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main 
      :class="`transition-all duration-300 ease-in-out ${
        isSidebarOpen ? 'ml-0 md:ml-72' : 'ml-0 md:ml-72'
      } p-6 md:p-8`"
    >
      <router-view />
    </main>
    <Toaster />
  </div>
</template>

<style scoped>
.router-link-active {
  @apply bg-emerald-50 text-emerald-600 font-medium;
}

/* Smooth transitions */
aside {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Custom scrollbar for sidebar */
aside::-webkit-scrollbar {
  width: 4px;
}

aside::-webkit-scrollbar-track {
  background: transparent;
}

aside::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 2px;
}

aside::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}

/* Prevent scrolling when sidebar is open on mobile */
.overflow-hidden {
  overflow: hidden;
}
</style>