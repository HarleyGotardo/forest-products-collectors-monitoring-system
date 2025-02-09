<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import NatureCartLogo from '@/components/logo/NatureCartLogo.vue'
import Records from '@/components/SideBarItems/Records.vue'
import ForestProducts from '@/components/SideBarItems/ForestProducts.vue'
import SystemUsers from '@/components/SideBarItems/SystemUsers.vue'
import SweetAlert from '@/components/SweetAlert.vue'
import Locations from '@/components/SideBarItems/Locations.vue'
import defaultProfileImage from '@/assets/profile.png'
import logoutIcon from '@/assets/logout.png'
import { supabase } from '@/lib/supabaseClient'
import {getName , isFPCollector ,isVSUAdmin, isFPUAdmin, isForestRanger, fetchUserDetails, subscribeToUserChanges} from '@/router/routeGuard';

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

const user = ref(null)

const fetchUserDetails2 = async () => {
  isLoading.value = true
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (authUser) {
    const { data: userDetails, error } = await supabase
      .from('profiles')
      .select('id, role_id, first_name, last_name, profile_picture')
      .eq('id', authUser.id)
      .single()

    if (error) {
      console.error('Error fetching user details:', error)
    } else {
      user.value = userDetails
      if (user.value && user.value.profile_picture) {
        try {
          const profilePictureData = JSON.parse(user.value.profile_picture)
          user.value.profile_picture = profilePictureData.data.publicUrl
        } catch (e) {
          console.error('Error parsing profile_picture:', e)
        }
      }
    }
  }
  isLoading.value = false
}

onMounted(() => {
  fetchUserDetails2()
})

const profilePictureUrl = computed(() => {
  return user.value && user.value.profile_picture ? user.value.profile_picture : defaultProfileImage
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
    router.push({ name: 'Index' })
  }
}

const goToProfile = () => {
  router.push({ name: 'Profile' })
}

// const isFPUAdmin = computed(() => {
//   return user.value && user.value.role_id === 4
// })

// const isForestRanger = computed(() => {
//   return user.value && user.value.role_id === 1
// })

// const isFPCollector = computed(() => {
//   return user.value && user.value.role_id === 2
// })

// const isVSUAdmin = computed(() => {
//   return user.value && user.value.role_id === 3
// })
</script>

<template>
  <div class="min-h-screen bg-gray-50 relative">
    <!-- Improved Burger Menu Button -->
    <button 
      @click="toggleSidebar"
      :class="`md:hidden fixed top-4 left-4 z-50 p-3 rounded-full bg-white shadow-lg transition-all duration-300 hover:bg-gray-50 active:scale-95 ${
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
            to="/authenticated/map" 
            class="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-emerald-50 group"
          >
            <img src="@/assets/forest-map.png" alt="Forest Map" class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="font-medium text-gray-700 group-hover:text-emerald-600">Forest Products Map</span>
          </router-link>

          <!-- Enhanced Dropdowns -->
          <Locations
            :isDropdownOpen="isLocationDropdownOpen"
            @toggleDropdown="toggleLocationDropdown"
            label="Locations"
            class="rounded-xl overflow-hidden"
          >
            <router-link to="/authenticated/locations" class="block p-3 hover:bg-emerald-50 transition-colors">
              All Locations
            </router-link>
            <router-link 
              v-if="isFPUAdmin || isForestRanger" 
              to="/authenticated/locations/create" 
              class="block p-3 hover:bg-emerald-50 transition-colors"
            >
              Create
            </router-link>
            <router-link 
              v-if="isFPUAdmin || isForestRanger" 
              to="/authenticated/locations/trash" 
              class="block p-3 hover:bg-emerald-50 transition-colors"
            >
              Recycle Bin
            </router-link>
          </Locations>

          <Records
            :isDropdownOpen="isRecordsDropdownOpen"
            @toggleDropdown="toggleRecordsDropdown"
            label="Collection Records"
            class="rounded-xl overflow-hidden"
          >
            <router-link to="/authenticated/collection-records" class="block p-3 hover:bg-emerald-50 transition-colors">
              All Records
            </router-link>
            <router-link 
              v-if="isFPUAdmin || isForestRanger" 
              to="/authenticated/collection-records/create" 
              class="block p-3 hover:bg-emerald-50 transition-colors"
            >
              Create
            </router-link>
            <router-link 
              v-if="isFPUAdmin || isForestRanger" 
              to="/authenticated/collection-records/trash" 
              class="block p-3 hover:bg-emerald-50 transition-colors"
            >
              Recycle Bin
            </router-link>
          </Records>

          <ForestProducts
            :isDropdownOpen="isForestProductsDropdownOpen"
            @toggleDropdown="toggleForestProductsDropdown"
            label="Forest Products"
            class="rounded-xl overflow-hidden"
          >
            <router-link to="/authenticated/forest-products" class="block p-3 hover:bg-emerald-50 transition-colors">
              All Forest Products
            </router-link>
            <router-link 
              v-if="isFPUAdmin || isForestRanger" 
              to="/authenticated/forest-products/create" 
              class="block p-3 hover:bg-emerald-50 transition-colors"
            >
              Create
            </router-link>
          </ForestProducts>

          <SystemUsers
            v-if="isFPUAdmin || isForestRanger"
            :isDropdownOpen="isSystemUsersDropdownOpen"
            @toggleDropdown="toggleSystemUsersDropdown"
            label="System Users"
            class="rounded-xl overflow-hidden"
          >
            <router-link to="/authenticated/system-users" class="block p-3 hover:bg-emerald-50 transition-colors">
              All Users
            </router-link>
            <router-link 
              v-if="isFPUAdmin || isForestRanger" 
              to="/authenticated/system-users/create" 
              class="block p-3 hover:bg-emerald-50 transition-colors"
            >
              Create
            </router-link>
          </SystemUsers>
        </nav>

        <!-- Enhanced User Profile -->
        <div class="flex items-center justify-between gap-3 p-3 border-t border-gray-100 bg-gray-50">
          <div 
            v-if="!isLoading"
            @click="goToProfile" 
            class="flex items-center gap-3 p-3 cursor-pointer rounded-xl hover:bg-white transition-all duration-200 group"
          >
            <img 
              :src="profilePictureUrl" 
              alt="Profile Picture" 
              class="w-12 h-12 rounded-xl object-cover ring-2 ring-emerald-100 group-hover:ring-emerald-200 transition-all"
            />
            <div>
              <p class="font-medium text-gray-800">{{ user ? `${getName()}` : 'User' }}</p>
              <p class="text-sm text-gray-500">View Profile</p>
            </div>
          </div>
          <div v-else class="relative flex w-64 animate-pulse gap-2 p-4">
            <div class="h-12 w-12 rounded-full bg-slate-400"></div>
            <div class="flex-1">
              <div class="mb-1 h-5 w-3/5 rounded-lg bg-slate-400 text-lg"></div>
              <div class="h-5 w-[90%] rounded-lg bg-slate-400 text-sm"></div>
            </div>
            <div class="absolute bottom-5 right-0 h-4 w-4 rounded-full bg-slate-400"></div>
          </div>
          <SweetAlert
            title="Confirm Logout"
            text="Are you sure you want to log out?"
            icon="warning"
            confirmButtonText="Log Out"
            @confirmed="handleLogout"
          >
            <button class="">
              <img src="@/assets/logout.png" alt="Logout">
            </button>
          </SweetAlert>
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