import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import Index from '@/views/Index.vue'
import Auth_Layout from '@/views/Authenticated/Auth_Layout.vue'
import Dashboard from '@/views/Authenticated/Dashboard.vue'
import Map from '@/views/Authenticated/ForestProducts/Map.vue'
import ForestProductsIndex from '@/views/Authenticated/ForestProducts/Index.vue'
import ForestProductsCreate from '@/views/Authenticated/ForestProducts/Create.vue'
import SystemUsersIndex from '@/views/Authenticated/SystemUsers/Index.vue'
import CollectionRecordsIndex from '@/views/Authenticated/CollectionRecords/Index.vue'
import CollectionRecordsCreate from '@/views/Authenticated/CollectionRecords/Create.vue'
import CollectionRecordsTrash from '@/views/Authenticated/CollectionRecords/Trash.vue'
import ProfileIndex from '@/views/Authenticated/ProfileIndex.vue'
import LocationsIndex from '@/views/Authenticated/Location/Index.vue'
import LocationsCreate from '@/views/Authenticated/Location/Create.vue'
import LocationsTrash from '@/views/Authenticated/Location/Trash.vue'
import LocationsView from '@/views/Authenticated/Location/View.vue'
import LocationsEdit from '@/views/Authenticated/Location/Edit.vue'
import ForestProductsView from '@/views/Authenticated/ForestProducts/View.vue'
import ForestProductsEdit from '@/views/Authenticated/ForestProducts/Edit.vue'
import SignUp from '@/views/Authenticated/SignUp.vue'

const routes = [
  {
    path: '/',
    name: 'Index',
    component: Index,
    meta: { title: 'Nature Cart - Home' }
  },
  {
    path: '/sign-up',
    name: 'SignUp',
    component: SignUp,
    meta: { title: 'Sign Up - Nature Cart' }
  },
  {
    path: '/authenticated',
    component: Auth_Layout,
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: Dashboard,
        meta: { title: 'Dashboard - Nature Cart' }
      },
      {
        path: 'records',
        name: 'Records',
        component: ForestProductsIndex,
        meta: { title: 'Records - Nature Cart' }
      },
      {
        path: 'map',
        name: 'Map',
        component: Map,
        meta: { title: 'Map - Nature Cart' }
      },
      {
        path: 'forest-products',
        name: 'ForestProducts',
        component: ForestProductsIndex,
        meta: { title: 'Forest Products - Nature Cart' }
      },
      {
        path: 'forest-products/create',
        name: 'ForestProductsCreate',
        component: ForestProductsCreate,
        meta: { title: 'Create Forest Product - Nature Cart' }
      },
      {
        path: 'forest-products/:id',
        name: 'ForestProductsView',
        component: ForestProductsView,
        meta: { title: 'View Forest Product - Nature Cart' }
      },
      {
        path: 'forest-products/:id/edit',
        name: 'ForestProductsEdit',
        component: ForestProductsEdit,
        meta: { title: 'Edit Forest Product - Nature Cart' }
      },
      {
        path: 'system-users',
        name: 'SystemUsers',
        component: SystemUsersIndex,
        meta: { title: 'System Users - Nature Cart' }
      },
      {
        path: 'collection-records',
        name: 'CollectionRecords',
        component: CollectionRecordsIndex,
        meta: { title: 'Collection Records - Nature Cart' }
      },
      {
        path: 'collection-records/create',
        name: 'CollectionRecordsCreate',
        component: CollectionRecordsCreate,
        meta: { title: 'Create Collection Record - Nature Cart' }
      },
      {
        path: 'collection-records/trash',
        name: 'CollectionRecordsTrash',
        component: CollectionRecordsTrash,
        meta: { title: 'Collection Records Trash - Nature Cart' }
      },
      {
        path: 'locations',
        name: 'LocationsIndex',
        component: LocationsIndex,
        meta: { title: 'Locations - Nature Cart' }
      },
      {
        path: 'locations',
        name: 'LocationsIndex',
        component: LocationsIndex,
        meta: { title: 'Locations - Nature Cart' }
      },
      {
        path: 'locations/create',
        name: 'LocationsCreate',
        component: LocationsCreate,
        meta: { title: 'Create Locations - Nature Cart' }
      },
      {
        path: 'locations/:id',
        name: 'LocationsView',
        component: LocationsView,
        meta: { title: 'View Location - Nature Cart' }
      },
      {
        path: 'locations/trash',
        name: 'LocationsTrash',
        component: LocationsTrash,
        meta: { title: 'Trash Locations - Nature Cart' }
      },
      {
        path: 'locations/:id/edit',
        name: 'LocationsEdit',
        component: LocationsEdit,
        meta: { title: 'Edit Location - Nature Cart' }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: ProfileIndex,
        meta: { title: 'Profile - Nature Cart' }
      }
      // Add other routes here
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession()

  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!session) {
      next({ name: 'Index' })
    } else {
      next()
    }
  } else {
    if (session && to.name === 'Index') {
      next({ name: 'Dashboard' })
    } else {
      next()
    }
  }

  // Set the document title
  if (to.meta.title) {
    document.title = to.meta.title
  } else {
    document.title = 'Nature Cart'
  }
})

export default router