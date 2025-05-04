import { createRouter, createWebHistory } from "vue-router";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchUserDetails,
  isFPUAdmin,
  isForestRanger,
  isFPCollector,
  isVSUAdmin,
  user,
} from "@/router/routeGuard";
import Index from "@/views/Index.vue";
import Auth_Layout from "@/views/Authenticated/Auth_Layout.vue";
import Dashboard from "@/views/Authenticated/Dashboard.vue";
import Map from "@/views/Authenticated/ForestProducts/Map.vue";
import ForestProductsIndex from "@/views/Authenticated/ForestProducts/Index.vue";
import ForestProductsCreate from "@/views/Authenticated/ForestProducts/Create.vue";
import ForestProductsTrash from "@/views/Authenticated/ForestProducts/Trash.vue";
import SystemUsersIndex from "@/views/Authenticated/SystemUsers/Index.vue";
import CollectionRecordsIndex from "@/views/Authenticated/CollectionRecords/Index.vue";
import CollectionRecordsCreate from "@/views/Authenticated/CollectionRecords/Create.vue";
import CollectionRecordsTrash from "@/views/Authenticated/CollectionRecords/Trash.vue";
import CollectionRecordsView from "@/views/Authenticated/CollectionRecords/View.vue";
import CollectionRecordsEdit from "@/views/Authenticated/CollectionRecords/Edit.vue";
import ProfileIndex from "@/views/Authenticated/ProfileIndex.vue";
import LocationsIndex from "@/views/Authenticated/Location/Index.vue";
import LocationsCreate from "@/views/Authenticated/Location/Create.vue";
import LocationsTrash from "@/views/Authenticated/Location/Trash.vue";
import LocationsView from "@/views/Authenticated/Location/View.vue";
import LocationsEdit from "@/views/Authenticated/Location/Edit.vue";
import ForestProductsView from "@/views/Authenticated/ForestProducts/View.vue";
import ForestProductsEdit from "@/views/Authenticated/ForestProducts/Edit.vue";
import SignUp from "@/views/SignUp.vue";
import SystemUsersView from "@/views/Authenticated/SystemUsers/View.vue";
import FPCRequestCreate from "@/views/Authenticated/FPCRequest/Create.vue";
import FPCRequestIndex from "@/views/Authenticated/FPCRequest/Index.vue";
import FPCRequestView from "@/views/Authenticated/FPCRequest/View.vue";
import FPCRequestEdit from "@/views/Authenticated/FPCRequest/Edit.vue";
import FPCRequestIndex2 from "@/views/Authenticated/FPCRequest/Index2.vue";
import FPCRequestTrash from "@/views/Authenticated/FPCRequest/Trash.vue";
import SalesReport from "@/views/Authenticated/SalesReport.vue";
import FPCCollectionRecordsIndex from "@/views/Authenticated/CollectionRecords/FPCIndex.vue";
import ForgotPassword from "@/views/Forgot-Password.vue";

// 4 = FPU Admin, 1 = Forest Ranger, 2 = FP Collector, 3 = VSU Admin
const routes = [
  {
    path: "/",
    name: "Index",
    component: Index,
    meta: { title: "Log In - Nature Cart" },
  },
  {
    path: "/sign-up",
    name: "SignUp",
    component: SignUp,
    meta: { title: "Sign Up - Nature Cart" },
  },
  {
    path: "/forgot-password",
    name: "ForgotPassword",
    component: ForgotPassword,
    meta: {
      requiresAuth: false,
      title: "Reset Password - Nature Cart",
    },
    props: (route) => ({
      type: route.hash.includes("type=recovery") ? "recovery" : null,
      token_hash: new URLSearchParams(route.hash.substring(1)).get(
        "token_hash"
      ),
    }),
  },
  {
    path: "/authenticated",
    component: Auth_Layout,
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        redirect: { name: "Dashboard" },
      },
      {
        path: "dashboard",
        name: "Dashboard",
        component: Dashboard,
        meta: { title: "Dashboard - Nature Cart", requiresRole: [4, 2, 3, 1] },
      },
      {
        path: "records",
        name: "Records",
        component: ForestProductsIndex,
        meta: { title: "Records - Nature Cart", requiresRole: [4, 2, 3, 1] },
      },
      {
        path: "map",
        name: "Map",
        component: Map,
        meta: { title: "Map - Nature Cart", requiresRole: [4, 2, 3, 1] },
      },
      {
        path: "forest-products",
        name: "ForestProducts",
        component: ForestProductsIndex,
        meta: {
          title: "Forest Products - Nature Cart",
          requiresRole: [4, 2, 3, 1],
        },
      },
      {
        path: "forest-products/create",
        name: "ForestProductsCreate",
        component: ForestProductsCreate,
        meta: {
          title: "Create Forest Product - Nature Cart",
          requiresRole: [4, 1],
        },
      },
      {
        path: "forest-products/:id",
        name: "ForestProductsView",
        component: ForestProductsView,
        meta: {
          title: "View Forest Product - Nature Cart",
          requiresRole: [4, 2, 3, 1],
        },
      },
      {
        path: "forest-products/:id/edit",
        name: "ForestProductsEdit",
        component: ForestProductsEdit,
        meta: {
          title: "Edit Forest Product - Nature Cart",
          requiresRole: [4, 1],
        },
      },
      {
        path: "forest-products/trash",
        name: "ForestProductsTrash",
        component: ForestProductsTrash,
        meta: {
          title: "Forest Products Trash - Nature Cart",
          requiresRole: [4, 1],
        },
      },
      {
        path: "system-users",
        name: "SystemUsers",
        component: SystemUsersIndex,
        meta: {
          title: "System Users - Nature Cart",
          requiresRole: [4, 2, 3, 1],
        },
      },
      {
        path: "system-users/:id",
        name: "SystemUsersView",
        component: SystemUsersView,
        meta: {
          title: "View System User - Nature Cart",
          requiresRole: [4, 2, 3, 1],
        },
      },
      {
        path: "collection-records",
        name: "CollectionRecords",
        component: CollectionRecordsIndex,
        meta: {
          title: "Collection Records - Nature Cart",
          requiresRole: [4, 2, 3, 1],
        },
      },
      {
        path: "fpc-collection-records",
        name: "FPCCollectionRecords",
        component: FPCCollectionRecordsIndex,
        meta: {
          title: "FPC Collection Records - Nature Cart",
          requiresRole: [2],
        },
      },
      {
        path: "collection-records/:id",
        name: "CollectionRecordsView",
        component: CollectionRecordsView,
        meta: {
          title: "View Collection Record - Nature Cart",
          requiresRole: [4, 2, 3, 1],
        },
      },
      {
        path: "collection-records/:id/edit",
        name: "CollectionRecordsEdit",
        component: CollectionRecordsEdit,
        meta: {
          title: "Edit Collection Record - Nature Cart",
          requiresRole: [4, 1],
        },
      },
      {
        path: "collection-records/create",
        name: "CollectionRecordsCreate",
        component: CollectionRecordsCreate,
        meta: {
          title: "Create Collection Record - Nature Cart",
          requiresRole: [4, 1],
        },
      },
      {
        path: "collection-records/trash",
        name: "CollectionRecordsTrash",
        component: CollectionRecordsTrash,
        meta: {
          title: "Collection Records Trash - Nature Cart",
          requiresRole: [4, 2, 3, 1],
        },
      },
      {
        path: "collection-requests",
        name: "RequestIndex",
        component: FPCRequestIndex,
        meta: { title: "Collection Requests - Nature Cart", requiresRole: [2] },
      },
      {
        path: "collection-requests/trash",
        name: "RequestTrash",
        component: FPCRequestTrash,
        meta: {
          title: "Collection Requests Trash - Nature Cart",
          requiresRole: [2],
        },
      },
      {
        path: "collection-request/create",
        name: "RequestCreate",
        component: FPCRequestCreate,
        meta: {
          title: "Create a Collection Request - Nature Cart",
          requiresRole: [2],
        },
      },
      {
        path: "collection-requests/:id",
        name: "RequestView",
        component: FPCRequestView,
        meta: {
          title: "View Collection Request - Nature Cart",
          requiresRole: [2, 4, 1, 3],
        },
      },
      {
        path: "collection-requests/:id/edit",
        name: "RequestEdit",
        component: FPCRequestEdit,
        meta: {
          title: "Edit Collection Request - Nature Cart",
          requiresRole: [2],
        },
      },
      {
        path: "collection-requests/all",
        name: "RequestIndex2",
        component: FPCRequestIndex2,
        meta: {
          title: "All Collection Requests - Nature Cart",
          requiresRole: [4, 1, 3],
        },
      },
      {
        path: "sales-report",
        name: "SalesReport",
        component: SalesReport,
        meta: {
          title: "Sales Report - Nature Cart",
          requiresRole: [4, 3, 1],
        },
      },
      {
        path: "locations",
        name: "LocationsIndex",
        component: LocationsIndex,
        meta: { title: "Locations - Nature Cart", requiresRole: [4, 2, 3, 1] },
      },
      {
        path: "locations/create",
        name: "LocationsCreate",
        component: LocationsCreate,
        meta: { title: "Create Locations - Nature Cart", requiresRole: [4, 1] },
      },
      {
        path: "locations/:id",
        name: "LocationsView",
        component: LocationsView,
        meta: {
          title: "View Location - Nature Cart",
          requiresRole: [4, 2, 3, 1],
        },
      },
      {
        path: "locations/trash",
        name: "LocationsTrash",
        component: LocationsTrash,
        meta: {
          title: "Trash Locations - Nature Cart",
          requiresRole: [4, 2, 3, 1],
        },
      },
      {
        path: "locations/:id/edit",
        name: "LocationsEdit",
        component: LocationsEdit,
        meta: { title: "Edit Location - Nature Cart", requiresRole: [4, 1] },
      },
      {
        path: "profile",
        name: "Profile",
        component: ProfileIndex,
        meta: { title: "Profile - Nature Cart", requiresRole: [4, 2, 3, 1] },
      },
      {
        // Catch-all route for authenticated section
        path: ":pathMatch(.*)*",
        redirect: { name: "Dashboard" },
      },
    ],
  },
  // Catch-all route for public section
  {
    path: "/:pathMatch(.*)*",
    redirect: { name: "Index" },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Check if the route exists
  if (!to.matched.length) {
    if (session) {
      next({ name: "Dashboard" });
      return;
    }
    next({ name: "Index" });
    return;
  }

  if (to.matched.some((record) => record.meta.requiresAuth)) {
    if (!session) {
      next({ name: "Index" });
    } else {
      if (!user.value) {
        await fetchUserDetails();
      }
      if (to.matched.some((record) => record.meta.requiresRole)) {
        const requiredRoles = to.meta.requiresRole;
        if (!requiredRoles.includes(user.value.role_id)) {
          next({ name: "Dashboard" });
        } else {
          next();
        }
      } else {
        next();
      }
    }
  } else {
    if (session && to.name === "Index") {
      next({ name: "Dashboard" });
    } else {
      next();
    }
  }

  // Set the document title
  if (to.meta.title) {
    document.title = to.meta.title;
  } else {
    document.title = "Nature Cart";
  }
});

export default router;
