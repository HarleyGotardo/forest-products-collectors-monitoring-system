<script setup>
import Input from '@/components/ui/input/Input.vue'
import { ref, onMounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabaseClient'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Swal from 'sweetalert2'
import { toast, Toaster } from 'vue-sonner'
import { format } from 'date-fns'
import {isFPCollector ,isVSUAdmin, isFPUAdmin, isForestRanger, fetchUserDetails } from '@/router/routeGuard';
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
// Fix for Leaflet default marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
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

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
})
const loading = ref(false)
const route = useRoute()
const router = useRouter()
const productId = route.params.id
const forestProduct = ref(null)
const locations = ref([])
const allLocations = ref([]) // Store all existing locations
const error = ref(null)
const mapInstance = ref(null)
const showLocationModal = ref(false)
const showImageModal = ref(false)
const showExtraImageModal = ref(false)
const selectedLocation = ref(null)
const tempMarker = ref(null)
const newImage = ref(null)
const showEditLocationModal = ref(false)
const editLocationQuantity = ref(null)
const locationToEdit = ref(null)
const currentPage = ref(1) // Current page for pagination
const itemsPerPage = 4 // Items per page for pagination
const additionalImages = ref([]); // Store additional images
const currentImage = ref(null); // Store the currently selected image
const currentImageIndex = ref(null); // Store the index of the selected image
const modalMapInstance = ref(null)
const isAddingLocation = ref(false)
const newLocation = ref({
  name: '',
  latitude: null,
  longitude: null,
  quantity: null
})

// Add these new reactive variables at the top with other refs
const imageViewerZoom = ref(1)
const imageViewerRotation = ref(0)
const isDragging = ref(false)
const startX = ref(0)
const startY = ref(0)
const translateX = ref(0)
const translateY = ref(0)

const viewImage = (image, index) => {
  currentImage.value = image; // Set the selected image
  currentImageIndex.value = index; // Set the index of the selected image
  showExtraImageModal.value = true; // Show the modal
};

const closeImageModal = () => {
  showExtraImageModal.value = false; // Close the modal
};

const fetchAdditionalImages = async () => {
  const { data, error } = await supabase
    .from('forest_product_images')
    .select('image_link')
    .eq('forest_product_id', productId);

  if (error) {
    console.error('Error fetching additional images:', error);
  } else {
    additionalImages.value = data.map((img) => img.image_link);
  }
};

const cancelMapModal = () => {
  showLocationModal.value = false
  initializeMap();
}

const goToLocation = (location) => {
  router.push(`/authenticated/locations/${location.id}`)
}

const editLocation = (location) => {
  locationToEdit.value = location
  editLocationQuantity.value = location.quantity
  showEditLocationModal.value = true
}

const updateLocationQuantity = async () => {
  if (!locationToEdit.value) {
    toast.error('No location selected', { duration: 2000 })
    return
  }

  const { error: updateError } = await supabase
    .from('fp_and_locations')
    .update({ quantity: editLocationQuantity.value })
    .eq('forest_product_id', forestProduct.value.id)
    .eq('location_id', locationToEdit.value.id)

  if (updateError) {
    toast.error(updateError.message, { duration: 2000 })
    return
  }

  toast.success('Location quantity updated successfully', { duration: 2000 })
  showEditLocationModal.value = false
  fetchLocations()
}

const locationToDelete = ref(null)

const confirmDeleteLocation = (locationId) => {
  locationToDelete.value = locationId
}

const deleteLocation = async () => {
  if (locationToDelete.value !== null) {
    const locationId = locationToDelete.value
    const { error: deleteError } = await supabase
      .from('fp_and_locations')
      .delete()
      .eq('forest_product_id', forestProduct.value.id)
      .eq('location_id', locationId)

    if (deleteError) {
      toast.error(deleteError.message, { duration: 2000 })
    } else {
      toast.success('Location deleted successfully', { duration: 2000 })
      fetchLocations()
    }
    locationToDelete.value = null
  }
}

const fetchForestProduct = async () => {
  let { data, error: fetchError } = await supabase
    .from('forest_products')
    .select(`
      *,
      measurement_units:measurement_unit_id (
        unit_name
      )
    `)
    .eq('id', productId)
    .single()

  if (fetchError) {
    error.value = fetchError.message
  } else {
    if (data.image_url) {
      try {
        const imageUrlData = JSON.parse(data.image_url)
        data.image_url = imageUrlData.data.publicUrl
      } catch (e) {
        console.error('Error parsing image_url:', e)
      }
    }
    data.created_at = format(new Date(data.created_at), 'MMMM dd, yyyy')
    data.updated_at = format(new Date(data.updated_at), 'MMMM dd, yyyy')
    forestProduct.value = data
    fetchLocations()
  }
}
const fetchLocations = async () => {
  let { data, error: fetchError } = await supabase
    .from('fp_and_locations')
    .select(`
      locations (
        id, 
        name, 
        latitude, 
        longitude,
        deleted_at
      ), 
      quantity
    `)
    .eq('forest_product_id', productId)

  if (fetchError) {
    error.value = fetchError.message
  } else {
    // Filter out locations that have been deleted
    locations.value = data
      .filter(fp => fp.locations && fp.locations.deleted_at === null)
      .map(fp => ({
        ...fp.locations,
        quantity: fp.quantity
      }))
    
    // Ensure map is properly initialized after locations are loaded
    nextTick(() => {
      if (mapInstance.value) {
        mapInstance.value.remove()
        mapInstance.value = null
      }
      initializeMap()
    })
  }
}

const fetchAllLocations = async () => {
  let { data, error: fetchError } = await supabase
    .from('locations')
    .select('*')
    .is('deleted_at', null)  // Only select non-deleted locations

  if (fetchError) {
    error.value = fetchError.message
  } else {
    allLocations.value = data
  }
}

const initializeMap = () => {
  if (!document.getElementById('locationMap')) {
    console.error('Map container not found.')
    return
  }

  // Ensure the map container is empty
  const mapContainer = document.getElementById('locationMap')
  mapContainer.innerHTML = ''

  // Create new map instance
  mapInstance.value = L.map('locationMap')

  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapInstance.value)

  // Add markers for locations
  locations.value.forEach(location => {
    L.marker([location.latitude, location.longitude])
      .addTo(mapInstance.value)
      .bindTooltip(location.name, {
        permanent: true,
        direction: 'top',
        className: 'bg-white px-2 py-1 rounded shadow-lg'
      })
  })

  // Fit bounds to show all markers
  if (locations.value.length > 0) {
    const bounds = L.latLngBounds(locations.value.map(location => [location.latitude, location.longitude]))
    mapInstance.value.fitBounds(bounds)
  } else {
    // Default view for Philippines if no locations
    mapInstance.value.setView([10.744340, 124.791995], 16)
  }
}

const paginatedLocations = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return locations.value.slice(start, end)
})

const totalPages = computed(() => Math.ceil(locations.value.length / itemsPerPage))

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

const upsertLocation = async () => {
  if (!selectedLocation.value) {
    error.value = 'Please select a location';
    return;
  }

  const { error: fpLocationError } = await supabase
    .from('fp_and_locations')
    .upsert([{
      forest_product_id: forestProduct.value.id,
      location_id: selectedLocation.value.id,
      quantity: selectedLocation.value.quantity // Include quantity
    }]);

  if (fpLocationError) {
    toast.error(fpLocationError.message, { duration: 2000 });
    return;
  }

  toast.success('Location added successfully', { duration: 2000 });
  fetchLocations();
};

const handleImageChange = (event) => {
  newImage.value = event.target.files[0]
}

const handleAdditionalImageUpload = async (event) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  // Filter files to only allow image types (e.g., png, jpg, jpeg, gif)
  const validExtensions = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
  const filteredFiles = Array.from(files).filter(file => validExtensions.includes(file.type));

  if (filteredFiles.length === 0) {
    toast.error('Only image files (png, jpg, jpeg, gif) are allowed');
    return;
  }

  // Check the current number of images in the database
  const { count, error: countError } = await supabase
    .from('forest_product_images')
    .select('*', { count: 'exact', head: true })
    .eq('forest_product_id', productId);

  if (countError) {
    console.error('Error checking image count:', countError);
    toast.error('Failed to check image limit');
    return;
  }

  if (count >= 8) {
    toast.error('You can only upload up to 8 additional images');
    return;
  }

  const remainingSlots = 8 - count;
  const filesToUpload = filteredFiles.slice(0, remainingSlots);

  for (const file of filesToUpload) {
    const fileName = `fp_images/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('nature_cart_images')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Error uploading additional image:', uploadError);
      toast.error('Failed to upload image');
      continue;
    }

    const imageUrl = supabase.storage.from('nature_cart_images').getPublicUrl(uploadData.path).data.publicUrl;

    const { error: insertError } = await supabase
      .from('forest_product_images')
      .insert({
        forest_product_id: productId,
        image_link: imageUrl,
      });

    if (insertError) {
      console.error('Error saving image link:', insertError);
      toast.error('Failed to save image link');
      continue;
    }

    additionalImages.value.push(imageUrl);
  }

  if (filteredFiles.length > remainingSlots) {
    toast.error(`Only ${remainingSlots} images were uploaded due to the 8-image limit`);
  } else {
    toast.success('Images uploaded successfully');
  }
};

const deleteImage = async (index) => {
  if (!isFPUAdmin && !isForestRanger) {
    toast.error("You don't have permission to delete images.");
    return;
  }

  const imageToDelete = additionalImages.value[index];
  if (!imageToDelete) {
    toast.error("Image not found.");
    return;
  }

  try {
    // Delete the image from the bucket
    const fileName = imageToDelete.split('/').pop(); // Extract the file name from the URL
    const { error: deleteError } = await supabase
      .storage
      .from('nature_cart_images')
      .remove([`fp_images/${fileName}`]);

    if (deleteError) {
      console.error('Error deleting image from bucket:', deleteError);
      toast.error('Failed to delete image from bucket.');
      return;
    }

    // Delete the image link from the database
    const { error: dbError } = await supabase
      .from('forest_product_images')
      .delete()
      .eq('forest_product_id', productId)
      .eq('image_link', imageToDelete);

    if (dbError) {
      console.error('Error deleting image link from database:', dbError);
      toast.error('Failed to delete image link from database.');
      return;
    }

    // Remove the image from the local array
    additionalImages.value.splice(index, 1);
    toast.success('Image deleted successfully.');
    showExtraImageModal.value = false; // Close the modal after deletion
  } catch (error) {
    console.error('Unexpected error:', error);
    toast.error('An unexpected error occurred.');
  }
};

const handleImageSubmit = async () => {
  if (!newImage.value) {
    error.value = 'Please select an image'
    return
  }

  const currentDate = new Date()
  const formattedDate = format(currentDate, 'yyyy-MM-dd HH:mm:ss')

  // Upload image to Supabase bucket using S3 protocol
  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('nature_cart_images')
    .upload(`forest_products/${Date.now()}_${newImage.value.name}`, newImage.value, {
      cacheControl: '3600',
      upsert: false,
      contentType: newImage.value.type,
      endpoint: 'https://cikbihrqwkfgvkrdgmqi.supabase.co/storage/v1/s3',
      region: 'ap-southeast-1'
    })

  if (uploadError) {
    error.value = uploadError.message
    return
  }

  const imageUrl = supabase
    .storage
    .from('nature_cart_images')
    .getPublicUrl(uploadData.path)

  // Update forest product with new image URL
  const { error: updateError } = await supabase
    .from('forest_products')
    .update({ image_url: imageUrl, updated_at: formattedDate })
    .eq('id', productId)

  if (updateError) {
    error.value = updateError.message
    return
  }

  toast.success('Image updated successfully', { duration: 2000 })
  showImageModal.value = false
  fetchForestProduct()
}

const isDeleted = computed(() => {
  return forestProduct.value && forestProduct.value.deleted_at !== null;
});

const initializeModalMap = () => {
  if (!document.getElementById('modalMap')) {
    console.error('Modal map container not found.')
    return
  }

  if (modalMapInstance.value) {
    modalMapInstance.value.remove()
  }

  // Initialize map with Philippines view
  modalMapInstance.value = L.map('modalMap').setView([10.744340, 124.791995], 16)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(modalMapInstance.value)

  // Add click handler for selecting location
  modalMapInstance.value.on('click', (e) => {
    if (isAddingLocation.value) {
      // Remove existing temporary marker if it exists
      if (tempMarker.value) {
        modalMapInstance.value.removeLayer(tempMarker.value)
      }

      // Add new marker at clicked location
      tempMarker.value = L.marker(e.latlng).addTo(modalMapInstance.value)
      
      // Update coordinates
      newLocation.value.latitude = e.latlng.lat
      newLocation.value.longitude = e.latlng.lng
      newLocation.value.name = '' // Reset name for new location
      newLocation.value.quantity = null // Reset quantity
    }
  })

  // Add existing locations as markers with tooltips
  if (allLocations.value && allLocations.value.length > 0) {
    allLocations.value.forEach(loc => {
      if (loc.latitude && loc.longitude) {
        L.marker([loc.latitude, loc.longitude])
          .addTo(modalMapInstance.value)
          .bindTooltip(loc.name, {
            permanent: true,
            direction: 'top',
            className: 'bg-white px-2 py-1 rounded shadow-lg'
          })
          .on('click', () => {
            // Check if the location is already added for the forest product
            const existingLocation = locations.value.find(l => l.id === loc.id);
            if (existingLocation) {
              toast.error('Location already added for this forest product', { duration: 2000 });
              return;
            }

            // Remove temporary marker if it exists
            if (tempMarker.value) {
              modalMapInstance.value.removeLayer(tempMarker.value)
              tempMarker.value = null
            }

            // Populate the form with selected location data
            newLocation.value = {
              name: loc.name,
              latitude: loc.latitude,
              longitude: loc.longitude,
              quantity: null
            }
          });
      }
    })
  }
}

const openAddLocationModal = async () => {
  isAddingLocation.value = true
  showLocationModal.value = true
  
  // Fetch all locations if not already fetched
  if (allLocations.value.length === 0) {
    await fetchAllLocations()
  }

  nextTick(() => {
    initializeModalMap()
  })
}

const closeAddLocationModal = () => {
  showLocationModal.value = false
  isAddingLocation.value = false
  newLocation.value = {
    name: '',
    latitude: null,
    longitude: null,
    quantity: null
  }
  // Remove temporary marker if it exists
  if (tempMarker.value) {
    modalMapInstance.value?.removeLayer(tempMarker.value)
    tempMarker.value = null
  }
}

const saveLocation = async () => {
  if (!newLocation.value.name || !newLocation.value.latitude || !newLocation.value.longitude || !newLocation.value.quantity) {
    toast.error('Please fill in all required fields and select a location on the map')
    return
  }

  try {
    // First, save the location
    const { data: locationData, error: locationError } = await supabase
      .from('locations')
      .insert([{
        name: newLocation.value.name,
        latitude: newLocation.value.latitude,
        longitude: newLocation.value.longitude
      }])
      .select()
      .single()

    if (locationError) throw locationError

    // Then, save the forest product location with quantity
    const { error: fpLocationError } = await supabase
      .from('fp_and_locations')
      .insert([{
        forest_product_id: forestProduct.value.id,
        location_id: locationData.id,
        quantity: newLocation.value.quantity
      }])

    if (fpLocationError) throw fpLocationError

    toast.success('Location added successfully')
    closeAddLocationModal()
    fetchLocations() // Refresh the locations list
  } catch (error) {
    console.error('Error adding location:', error)
    toast.error(error.message || 'Failed to add location')
  }
}

const reloadMap = () => {
  // Remove existing map instance
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }
  
  // Small delay to ensure cleanup is complete
  setTimeout(() => {
    nextTick(() => {
      initializeMap()
    })
  }, 100)
}

const resetImageViewer = () => {
  imageViewerZoom.value = 1
  imageViewerRotation.value = 0
  translateX.value = 0
  translateY.value = 0
}

const handleWheel = (e) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  imageViewerZoom.value = Math.max(0.5, Math.min(3, imageViewerZoom.value + delta))
}

const startDrag = (e) => {
  isDragging.value = true
  startX.value = e.clientX - translateX.value
  startY.value = e.clientY - translateY.value
}

const onDrag = (e) => {
  if (!isDragging.value) return
  translateX.value = e.clientX - startX.value
  translateY.value = e.clientY - startY.value
}

const endDrag = () => {
  isDragging.value = false
}

const rotateImage = () => {
  imageViewerRotation.value = (imageViewerRotation.value + 90) % 360
}

onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([
      fetchForestProduct(),
      fetchAdditionalImages(),
      fetchAllLocations(),
      fetchUserDetails()
    ]);
  } catch (err) {
    console.error('Error during initialization:', err);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="max-w-4xl mx-auto p-3">
    <!-- Header Section -->
    <div
      class="flex flex-col sm:flex-row items-center justify-between mb-6 sm:mb-8 mt-2 space-y-3 sm:space-y-0"
    >
      <div class="flex items-center justify-between w-full sm:w-auto">
      <div class="flex items-center space-x-3">
        <button
        @click="router.back()"
        class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
        >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
          ></path>
        </svg>
        </button>
        <img
        src="@/assets/forest-product.png"
        alt="Forest Product"
        class="w-8 h-8 sm:w-10 sm:h-10"
        />
        <h2
        class="text-xl sm:text-3xl font-bold text-gray-900 text-center sm:text-left"
        >
        Forest Product Details
        </h2>
      </div>
      </div>
      <div
      class="flex flex-col sm:flex-row items-center sm:items-center space-y-2 sm:space-y-0 sm:space-x-3"
      >
      <div
        v-if="loading"
        class="px-3 py-1 rounded-full text-sm font-medium bg-gray-200 animate-pulse w-24 sm:w-36"
      >
        &nbsp;
      </div>
      <div
        v-else-if="forestProduct"
        class="px-3 py-1 rounded-full text-sm font-medium"
        :class="forestProduct.type === 'Timber' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'"
      >
        {{ forestProduct.type === 'Timber' ? 'Timber' : 'Non-Timber' }}
      </div>
      <div
        v-if="isDeleted"
        class="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800"
      >
        Deleted at
        {{ format(new Date(forestProduct.deleted_at), 'MMMM dd, yyyy - hh:mm a') }}
      </div>
      </div>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error"
      class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700"
    >
      <div class="flex flex-col sm:flex-row items-start sm:items-center">
        <svg
          class="h-5 w-5 text-red-400 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <p class="ml-3 mt-2 sm:mt-0">{{ error }}</p>
      </div>
    </div>
    <!-- Loading Skeleton for Product Information Card -->
    <div
      v-if="loading"
      class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse"
    >
      <div class="p-3">
        <!-- Title and ID skeleton -->
        <div
          class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4"
        >
          <div class="h-8 bg-gray-200 rounded w-3/4"></div>
          <div class="h-4 bg-gray-200 rounded w-20 mt-2 sm:mt-0"></div>
        </div>

        <!-- Image Skeleton -->
        <div class="relative mb-6">
          <div class="w-full h-64 bg-gray-200 rounded-lg"></div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Left Column Skeleton -->
          <div class="space-y-4">
            <div class="flex items-center space-x-3">
              <div class="p-2 bg-gray-200 rounded-lg h-9 w-9"></div>
              <div class="flex-1">
                <div class="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                <div class="h-5 bg-gray-200 rounded w-32"></div>
              </div>
            </div>

            <div class="flex items-center space-x-3">
              <div class="p-2 bg-gray-200 rounded-lg h-9 w-9"></div>
              <div class="flex-1">
                <div class="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                <div class="h-5 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
          </div>

          <!-- Right Column Skeleton -->
          <div class="space-y-4">
            <div class="flex items-center space-x-3">
              <div class="p-2 bg-gray-200 rounded-lg h-9 w-9"></div>
              <div class="flex-1">
                <div class="h-4 bg-gray-200 rounded w-40 mb-2"></div>
                <div class="h-6 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>

            <div class="flex items-center space-x-3">
              <div class="p-2 bg-gray-200 rounded-lg h-9 w-9"></div>
              <div class="flex-1">
                <div class="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                <div class="h-6 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Description Skeleton -->
        <div class="mt-6 pt-6 border-t border-gray-100">
          <div class="h-4 bg-gray-200 rounded w-24 mb-4"></div>
          <div class="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div class="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    </div>
    <!-- Main Content -->
    <div v-if="!loading && forestProduct" class="space-y-6">
      <!-- Product Information Card -->
      <div
        class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="p-4 bg-white rounded-lg shadow-sm">
          <!-- Header Section -->
          <div
            class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5"
          >
            <h3 class="text-2xl font-semibold text-gray-800">
              {{ forestProduct.name }}
            </h3>
            <span class="text-sm text-gray-500 mt-1 sm:mt-0"
              >ID: {{ forestProduct.id }}</span
            >
          </div>

          <!-- Image Section -->
          <div v-if="forestProduct.image_url" class="relative mb-6">
            <img
              :src="forestProduct.image_url"
              alt="Forest Product Image"
              class="w-full h-auto rounded-lg shadow-sm object-cover"
            />
            <button
              v-if="isForestRanger || (isFPUAdmin && forestProduct.deleted_at === null)"
              @click="showImageModal = true"
              class="absolute top-3 right-3 p-2 bg-white bg-opacity-90 rounded-md shadow hover:bg-gray-100 focus:outline-none transition duration-150"
            >
              <div class="flex items-center">
                <img src="@/assets/edit.png" alt="Edit" class="w-4 h-4" />
                <span class="ml-1.5 text-sm font-medium text-gray-600"
                  >Edit</span
                >
              </div>
            </button>
          </div>

          <!-- Info Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <!-- Left Column -->
            <div class="space-y-4">
              <div
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg transition hover:bg-gray-100"
              >
                <div class="p-2 bg-white rounded-full">
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p
                    class="text-xs font-medium text-gray-500 uppercase tracking-wide"
                  >
                    Created At
                  </p>
                  <p class="text-gray-900 font-medium">
                    {{ forestProduct.created_at }}
                  </p>
                </div>
              </div>

              <div
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg transition hover:bg-gray-100"
              >
                <div class="p-2 bg-white rounded-full">
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
                <div>
                  <p
                    class="text-xs font-medium text-gray-500 uppercase tracking-wide"
                  >
                    Updated At
                  </p>
                  <p class="text-gray-900 font-medium">
                    {{ forestProduct.updated_at }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Right Column -->
            <div class="space-y-4">
                <div
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg transition hover:bg-gray-100"
                >
                <div class="p-2 bg-white rounded-full">
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
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  </svg>
                </div>
                <div>
                  <p
                  class="text-xs font-medium text-gray-500 uppercase tracking-wide"
                  >
                  Price
                  </p>
                  <p
                  class="text-gray-900 font-semibold"
                  :class="{
                    'text-green-600': !forestProduct.price_based_on_measurement_unit || forestProduct.price_based_on_measurement_unit === 0
                  }"
                  >
                  {{
                    !forestProduct.price_based_on_measurement_unit || forestProduct.price_based_on_measurement_unit === 0
                    ? 'Free'
                    : `₱${forestProduct.price_based_on_measurement_unit.toLocaleString()}`
                  }}
                  <span
                    v-if="forestProduct.price_based_on_measurement_unit && forestProduct.price_based_on_measurement_unit !== 0"
                    class="text-sm font-normal text-gray-500"
                  >
                    per {{ forestProduct.measurement_units.unit_name }}
                  </span>
                  </p>
                </div>
                </div>

              <div
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg transition hover:bg-gray-100"
              >
                <div class="p-2 bg-white rounded-full">
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
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <div>
                  <p
                    class="text-xs font-medium text-gray-500 uppercase tracking-wide"
                  >
                    Locations Available
                  </p>
                  <p class="text-gray-900 font-semibold">
                    {{ locations.length }}
                    <span class="text-sm font-normal text-gray-500"
                      >Location{{ locations.length !== 1 ? 's' : '' }}</span
                    >
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Description Section -->
          <div class="mt-4 pt-4 border-t border-gray-100">
            <h4
              class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2"
            >
              Description
            </h4>
            <div class="p-3 bg-gray-50 rounded-lg">
              <p class="text-gray-700 leading-relaxed">
                {{ forestProduct.description || 'No description available' }}
              </p>
            </div>
          </div>
        </div>
      </div>
      <!-- Additional Images Section -->
      <div class="mt-10 pt-8 border-t bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <!-- Section Header -->
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-gray-800">Additional Images</h3>
          <span
        class="px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full"
          >
        {{ additionalImages.length }}
        image{{ additionalImages.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <!-- Image Gallery -->
        <div
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4"
        >
          <!-- Display existing images -->
          <div
        v-for="(image, index) in additionalImages"
        :key="index"
        class="relative group h-64 overflow-hidden rounded-lg transition-all duration-300 hover:shadow-lg border border-gray-200 cursor-pointer bg-white"
        @click="viewImage(image, index)"
          >
        <img
          :src="image"
          alt="Additional Image"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        ></div>
        <div
          class="absolute bottom-0 left-0 p-3 w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <p class="text-white text-sm font-medium">View Image</p>
        </div>
          </div>

          <!-- Add Image Placeholder -->
          <label
        v-if="(isForestRanger || isFPUAdmin) && additionalImages.length < 8 && forestProduct.deleted_at === null"
        for="additional-image-upload"
        class="relative h-64 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center p-6 transition-all hover:border-gray-400 bg-gray-50 hover:bg-gray-100 cursor-pointer"
          >
        <div class="p-3 rounded-full bg-gray-100 mb-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-8 w-8 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
            />
          </svg>
        </div>
        <span class="text-sm font-medium text-gray-700">Add Image</span>
        <span class="text-xs text-gray-500 mt-1"
          >{{ 8 - additionalImages.length }} slots remaining</span
        >
        <input
          id="additional-image-upload"
          type="file"
          multiple
          @change="handleAdditionalImageUpload"
          class="hidden"
          accept="image/*"
        />
          </label>
        </div>

        <!-- Image Modal -->
        <div
          v-if="showExtraImageModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity duration-300"
          @keydown.esc="closeImageModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="imageModalTitle"
        >
          <div
            class="relative flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-6xl w-[95%] sm:w-[90%] max-h-[90vh] overflow-hidden transition-all duration-300 transform scale-100 border border-gray-200/20 dark:border-gray-700/20"
          >
            <!-- Header -->
            <div
              class="flex items-center justify-between px-6 py-4 border-b border-gray-200/20 dark:border-gray-700/20 bg-white/5 backdrop-blur-sm"
            >
              <div class="flex items-center space-x-3">
                <div class="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <svg class="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2
                    id="imageModalTitle"
                    class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Image Viewer
                  </h2>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Image {{ currentImageIndex + 1 }} of {{ additionalImages.length }}
                  </p>
                </div>
              </div>
              <div class="flex items-center space-x-3">
                <!-- Zoom Controls -->
                <div class="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button
                    @click="imageViewerZoom = Math.max(0.5, imageViewerZoom - 0.1)"
                    class="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                    </svg>
                  </button>
                  <span class="text-sm text-gray-600 dark:text-gray-300">{{ Math.round(imageViewerZoom * 100) }}%</span>
                  <button
                    @click="imageViewerZoom = Math.min(3, imageViewerZoom + 0.1)"
                    class="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                <!-- Rotate Button -->
                <button
                  @click="rotateImage"
                  class="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <!-- Close Button -->
                <button
                  @click="closeImageModal"
                  class="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Image Container -->
            <div
              class="relative flex-grow overflow-hidden bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center p-4"
              @wheel.prevent="handleWheel"
              @mousedown="startDrag"
              @mousemove="onDrag"
              @mouseup="endDrag"
              @mouseleave="endDrag"
            >
              <!-- Loading Spinner -->
              <div
                v-if="isLoading"
                class="absolute inset-0 flex items-center justify-center z-10 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm"
              >
                <div class="w-12 h-12 border-4 border-gray-300 dark:border-gray-600 border-t-indigo-500 rounded-full animate-spin"></div>
              </div>

              <!-- Image -->
              <img
                :src="currentImage"
                alt="Image Preview"
                class="block max-w-full max-h-[calc(90vh-150px)] object-contain transition-all duration-300"
                :class="{'opacity-0': isLoading, 'opacity-100': !isLoading}"
                :style="{
                  transform: `scale(${imageViewerZoom}) rotate(${imageViewerRotation}deg)`,
                  transformOrigin: 'center',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  translate: `${translateX}px ${translateY}px`
                }"
                @load="isLoading = false"
              />

              <!-- Navigation Buttons -->
              <button
                v-if="imageCount > 1"
                @click="showPreviousImage"
                :disabled="!hasPreviousImage"
                class="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/30 text-white hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all backdrop-blur-sm"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                v-if="imageCount > 1"
                @click="showNextImage"
                :disabled="!hasNextImage"
                class="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/30 text-white hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all backdrop-blur-sm"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <!-- Footer -->
            <div
              v-if="isForestRanger || isFPUAdmin"
              class="flex items-center justify-between px-6 py-4 border-t border-gray-200/20 dark:border-gray-700/20 bg-white/5 backdrop-blur-sm"
            >
              <div class="flex items-center space-x-2">
                <button
                  @click="resetImageViewer"
                  class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Reset View
                </button>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    class="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Image
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Image?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this image? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter class="flex justify-end space-x-3 mt-4">
                    <AlertDialogCancel
                      class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      @click="deleteImage(currentImageIndex)"
                      class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div class="px-6 py-5 border-b border-gray-200">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <div class="flex items-center space-x-3">
              <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <h3 class="text-xl font-semibold text-gray-800">
                Product Locations
              </h3>
            </div>

            <button
              v-if="isForestRanger || isFPUAdmin && forestProduct.deleted_at === null"
              @click="openAddLocationModal"
              class="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              Add Location
            </button>
          </div>
        </div>

        <div v-if="locations.length === 0" class="p-8 text-center">
           <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0zm6-7l-2.828 2.828m-10.344 0L5 4" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No locations</h3>
          <p class="mt-1 text-sm text-gray-500">This forest product currently has no registered locations.</p>
        </div>

        <div v-else class="divide-y divide-gray-200">
          <div
            v-for="location in paginatedLocations"
            :key="location.id"
            @click="goToLocation(location)"
            class="p-5 hover:bg-gray-50 transition-colors duration-150 ease-in-out cursor-pointer"
          >
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between">
              <div class="flex items-start flex-grow mb-3 sm:mb-0">
                <svg class="w-5 h-5 text-gray-500 mr-4 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>

                <div class="flex-grow">
                  <h4 class="font-medium text-gray-900">{{ location.name }}</h4>
                  <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    <div class="flex items-center space-x-1">
                      <span class="font-medium text-gray-700">Lat:</span>
                      <span>{{ location.latitude }}</span>
                    </div>
                    <div class="flex items-center space-x-1">
                      <span class="font-medium text-gray-700">Long:</span>
                      <span>{{ location.longitude }}</span>
                    </div>
                    <div class="flex items-center space-x-1">
                      <span class="font-medium text-gray-700">Quantity:</span>
                      <span 
                        :class="{
                          'text-red-600 font-semibold': !location.quantity || location.quantity === 0,
                          'text-orange-600 font-semibold': location.quantity > 0 && location.quantity <= 10,
                          'text-green-600 font-semibold': location.quantity > 0 && location.quantity > 10
                        }"
                      >
                        {{ location.quantity ? location.quantity : 'N/A' }}
                        {{ location.quantity ? ' ' + forestProduct.measurement_units.unit_name + (location.quantity !== 1 ? 's' : '') : '' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import "leaflet/dist/leaflet.css";
</style>
