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
    .select('locations (id, name, latitude, longitude), quantity')
    .eq('forest_product_id', productId)

  if (fetchError) {
    error.value = fetchError.message
  } else {
    locations.value = data.map(fp => ({
      ...fp.locations,
      quantity: fp.quantity
    }))
    nextTick(() => {
      initializeMap()
    })
  }
}

const fetchAllLocations = async () => {
  let { data, error: fetchError } = await supabase
    .from('locations')
    .select('*')

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

  if (mapInstance.value) {
    mapInstance.value.remove()
  }

  mapInstance.value = L.map('locationMap')

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapInstance.value)

  const bounds = L.latLngBounds(locations.value.map(location => [location.latitude, location.longitude]))

  locations.value.forEach(location => {
    L.marker([location.latitude, location.longitude])
      .addTo(mapInstance.value)
      .bindTooltip(location.name, {
        permanent: true,
        direction: 'top',
        className: 'bg-white px-2 py-1 rounded shadow-lg'
      })
  })

  mapInstance.value.fitBounds(bounds)
}

const totalPages = computed(() => {
  if (!locations.value) return 1
  return Math.ceil(locations.value.length / itemsPerPage)
})


const initializeModalMap = () => {
  if (mapInstance.value) {
    mapInstance.value.remove()
  }

  mapInstance.value = L.map("modalMap").setView([10.744340, 124.791995], 16);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(mapInstance.value);

  // Add existing location markers with tooltips
  allLocations.value.forEach(location => {
    L.marker([location.latitude, location.longitude])
      .addTo(mapInstance.value)
      .bindTooltip(location.name, {
        permanent: true,
        direction: 'top',
        className: 'bg-white px-2 py-1 rounded shadow-lg'
      })
      .on('click', async () => {
        // Check if the location is already added for the forest product
        const existingLocation = locations.value.find(loc => loc.id === location.id);
        if (existingLocation) {
          toast.error('Location already added for this forest product', { duration: 2000 });
          return;
        }

        const { value: quantity } = await Swal.fire({
          title: "Forest Product's Quantity",
          input: 'number',
          inputLabel: `Enter quantity (${forestProduct.value.measurement_units.unit_name})`,
          showCancelButton: true,
          inputValidator: (value) => {
            if (!value) return 'Quantity is required';
          }
        });

        if (quantity) {
          selectedLocation.value = location;
          selectedLocation.value.quantity = quantity; // Add quantity to selectedLocation
          showLocationModal.value = false;
          await upsertLocation();
        }
      });
  });

  // Handle map click for new location
  mapInstance.value.on('click', async (e) => {
    if (tempMarker.value) {
      mapInstance.value.removeLayer(tempMarker.value);
    }

    const { value: locationName } = await Swal.fire({
      title: 'New Location',
      input: 'text',
      inputLabel: 'Enter location name',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return 'Location name is required';
      }
    });

    if (locationName) {
      const { value: quantity } = await Swal.fire({
        title: 'Quantity',
        input: 'number',
        inputLabel: `Enter quantity (${forestProduct.value.measurement_units.unit_name})`,
        showCancelButton: true,
        inputValidator: (value) => {
          if (!value) return 'Quantity is required';
        }
      });

      if (quantity) {
        const newLocation = {
          name: locationName,
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        };

        const { data, error } = await supabase
          .from('locations')
          .insert([newLocation])
          .select()
          .single();

        if (error) {
          toast.error(error.message, { duration: 2000 });
        } else {
          selectedLocation.value = data;
          selectedLocation.value.quantity = quantity; // Add quantity to selectedLocation
          showLocationModal.value = false;
          await upsertLocation();
        }
      }
    }
  });
};

const paginatedLocations = computed(() => {
  if (!locations.value) return []
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return locations.value.slice(start, end)
})

const nextPage = () => {
  if ((currentPage.value * itemsPerPage) < (locations.value?.length || 0)) {
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
      class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 mt-2 space-y-4 sm:space-y-0"
    >
      <div class="flex items-center space-x-4">
        <img
          src="@/assets/forest-product.png"
          alt="Forest Product"
          class="w-10 h-10"
        />
        <h2 class="text-3xl font-bold text-gray-900">Forest Product Details</h2>
      </div>
      <div
        v-if="loading"
        class="px-3 py-1 rounded-full text-sm font-medium bg-gray-200 animate-pulse w-36"
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
        <div class="p-3">
          <div
            class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4"
          >
            <h3 class="text-2xl font-semibold text-gray-900">
              {{ forestProduct.name }}
            </h3>
            <span class="text-sm text-gray-500 mt-2 sm:mt-0"
              >ID: {{ forestProduct.id }}</span
            >
          </div>

          <!-- Image Section -->
          <div v-if="forestProduct.image_url" class="relative mb-6">
            <img
              :src="forestProduct.image_url"
              alt="Forest Product Image"
              class="w-full h-auto rounded-lg shadow-sm"
            />
            <button
              v-if="isForestRanger || isFPUAdmin && forestProduct.deleted_at === null"
              @click="showImageModal = true"
              class="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 focus:outline-none"
            >
              <div class="flex justify-between">
                <img src="@/assets/edit.png" alt="Edit" class="w-5 h-5" />
                <p class="ml-1 text-sm text-gray-500">Edit</p>
              </div>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Left Column -->
            <div class="space-y-4">
              <div class="flex items-center space-x-3">
                <div class="p-2 bg-gray-50 rounded-lg">
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
                  <p class="text-sm text-gray-500">Created At</p>
                  <p class="text-gray-900">{{ forestProduct.created_at }}</p>
                </div>
              </div>

              <div class="flex items-center space-x-3">
                <div class="p-2 bg-gray-50 rounded-lg">
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
                  <p class="text-sm text-gray-500">Updated At</p>
                  <p class="text-gray-900">{{ forestProduct.updated_at }}</p>
                </div>
              </div>
            </div>

            <!-- Right Column -->
            <div class="space-y-4">
              <div class="flex items-center space-x-3">
                <div class="p-2 bg-gray-50 rounded-lg">
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
                  <p class="text-sm text-gray-500">
                    Price Based on Measurement Unit
                  </p>
                  <p class="text-xl font-semibold text-gray-900">
                    ₱{{ forestProduct.price_based_on_measurement_unit ? forestProduct.price_based_on_measurement_unit.toLocaleString() : 'N/A' }}
                    per {{ forestProduct.measurement_units.unit_name }}
                  </p>
                </div>
              </div>

              <div class="flex items-center space-x-3">
                <div class="p-2 bg-gray-50 rounded-lg">
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
                  <p class="text-sm text-gray-500">Locations Available</p>
                  <p class="text-xl font-semibold text-gray-900">
                    {{ locations.length }} Location(s)
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Description Section -->
          <div class="mt-6 pt-6 border-t border-gray-100">
            <h4 class="text-sm font-medium text-gray-500 mb-2">Description</h4>
            <p class="text-gray-700">{{ forestProduct.description }}</p>
          </div>
        </div>
      </div>
      <!-- Additional Images Section -->
      <div class="mt-10 pt-8 border-t border-gray-200">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-gray-900">Additional Images</h3>
          <span class="text-sm text-gray-500"
            >{{ additionalImages.length }} image(s)</span
          >
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-5 mt-4">
          <!-- Display existing images -->
          <div
            v-for="(image, index) in additionalImages"
            :key="index"
            class="relative group overflow-hidden rounded-lg transition-all duration-300 hover:shadow-lg border border-gray-200 cursor-pointer"
            @click="viewImage(image, index)"
          >
            <img
              :src="image"
              alt="Additional Image"
              class="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>

          <!-- Add Image Placeholder -->
          <label
            v-if="(isForestRanger || isFPUAdmin) && additionalImages.length < 8 && forestProduct.deleted_at === null"
            for="additional-image-upload"
            class="relative border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center p-8 transition-all hover:border-gray-500 bg-gray-50 hover:bg-gray-100 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-12 w-12 text-gray-400"
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
            <span class="mt-2 text-sm font-medium text-gray-600"
              >Add Image(s)</span
            >
            <input
              id="additional-image-upload"
              type="file"
              multiple
              @change="handleAdditionalImageUpload"
              class="hidden"
            />
          </label>
        </div>

        <!-- Image Modal -->
        <div
          v-if="showExtraImageModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        >
          <div class="relative bg-white rounded-lg shadow-lg max-w-3xl w-full">
            <button
              class="absolute top-2 right-2 text-gray-500 hover:text-gray-700 focus:outline-none"
              @click="closeImageModal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              :src="currentImage"
              alt="Full Image"
              class="w-full h-auto rounded-t-lg"
            />
            <div class="p-4 text-center">
              <button
                v-if="isForestRanger || isFPUAdmin"
                class="px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 focus:outline-none"
                @click="deleteImage(currentImageIndex)"
              >
                Delete Image
              </button>
            </div>
          </div>
        </div>
      </div>
      <!-- Locations Section -->
      <div
        class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <!-- Header -->
        <div class="p-6 border-b border-gray-100">
          <div
            class="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0"
          >
            <div class="flex items-center space-x-2">
              <svg
                class="w-6 h-6 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <h3 class="text-xl font-semibold text-gray-900">
                Product Locations
              </h3>
            </div>

            <button
              v-if="isForestRanger || isFPUAdmin && forestProduct.deleted_at === null"
              @click="showLocationModal = true; $nextTick(() => initializeModalMap())"
              class="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              <svg
                class="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add Location
            </button>
          </div>
        </div>
        <!-- Conditional Rendering for No Locations -->
        <div
          v-if="locations.length === 0"
          class="p-6 text-center text-gray-500"
        >
          This forest product doesn't have a location.
        </div>
        <!-- Locations List -->
        <div v-else class="divide-y divide-gray-100">
          <div
            @click="goToLocation(location)"
            v-for="location in paginatedLocations"
            :key="location.id"
            class="p-4 hover:bg-gray-50 transition-all duration-200 cursor-pointer"
          >
            <div class="flex flex-col sm:flex-row items-start sm:items-center">
              <div class="p-2 bg-gray-100 rounded-lg ml-3">
                <svg
                  class="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>

              <div class="ml-4 flex-grow mt-2 sm:mt-0">
                <h4 class="font-medium text-gray-900">{{ location.name }}</h4>
                <div
                  class="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600"
                >
                  <div class="flex items-center space-x-1">
                    <span class="font-medium">Lat:</span>
                    <span>{{ location.latitude }}</span>
                  </div>
                  <div class="flex items-center space-x-1">
                    <span class="font-medium">Long:</span>
                    <span>{{ location.longitude }}</span>
                  </div>
                    <div class="flex items-center space-x-1">
                      <span class="font-medium">Quantity:</span>
                      <span
                      :class="{
                        'text-red-500 font-bold': !location.quantity || location.quantity === 0
                      }"
                      >
                      {{ location.quantity ? location.quantity : 'N/A' }}
                      {{ location.quantity ? forestProduct.measurement_units.unit_name + '(s)' : '' }}
                      </span>
                      <span
                      v-if="!location.quantity || location.quantity === 0"
                      class="ml-2 text-xs text-white bg-red-500 px-2 py-1 rounded-full"
                      >
                      Out of Stock
                      </span>
                    </div>
                </div>
              </div>

              <div
                class="ml-4 flex items-center space-x-2 mt-2 sm:mt-0"
                v-if="forestProduct.deleted_at === null"
              >
                <button
                  @click.stop="editLocation(location)"
                  class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  title="Edit Location"
                  v-if="isForestRanger || isFPUAdmin"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      @click.stop="confirmDeleteLocation(location.id)"
                      class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      title="Delete Location"
                      v-if="isForestRanger || isFPUAdmin"
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Location?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Delete this location of the forest product?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction @click="deleteLocation"
                        >Delete</AlertDialogAction
                      >
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>

        <!-- In the template section, update the pagination controls -->
        <div class="flex justify-between items-center mt-4 p-4">
          <button
            @click="prevPage"
            :disabled="currentPage === 1"
            class="ml-3 inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            v-if="locations.length > 0"
          >
            <svg
              class="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5"
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
          <span class="text-sm text-gray-700" v-if="locations.length > 0">
            {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            v-if="locations.length > 0"
            @click="nextPage"
            :disabled="(currentPage * itemsPerPage) >= (locations.value?.length || 0)"
            class="mr-3 inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <svg
              class="ml-1 sm:ml-2 h-4 w-4 sm:h-5 sm:w-5"
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

        <!-- Edit Location Modal -->
        <div
          v-if="showEditLocationModal"
          class="fixed inset-0 z-50 overflow-y-auto"
        >
          <div
            class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0"
          >
            <!-- Background overlay -->
            <div
              class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              @click="showEditLocationModal = false"
            ></div>

            <div
              class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
            >
              <div
                class="relative max-h-full w-full max-w-md p-4 sm:p-6 md:max-w-lg"
              >
                <div class="rounded-lg bg-white shadow-xl">
                  <!-- Header -->
                  <div class="border-b border-gray-200 px-4 py-4 sm:px-6">
                    <div class="flex items-center justify-between">
                      <h3 class="text-lg font-medium text-gray-900">
                        Edit Quantity
                      </h3>
                      <button
                        @click="showEditLocationModal = false"
                        class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <span class="sr-only">Close</span>
                        <svg
                          class="h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
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
                  </div>

                  <!-- Body -->
                  <div class="px-4 py-5 sm:p-6">
                    <div class="mb-4">
                      <p class="text-sm text-gray-500">
                        Update the quantity of {{ forestProduct.name }} at this
                        location.
                      </p>
                    </div>

                    <div class="mt-4">
                      <label
                        for="quantity"
                        class="block text-sm font-medium text-gray-700"
                      >
                        Quantity ({{ forestProduct.measurement_units.unit_name
                        }})
                      </label>
                      <div class="relative mt-1 rounded-md shadow-sm">
                        <div class="relative mt-1 rounded-md shadow-sm">
                          <Input
                            type="number"
                            id="quantity"
                            v-model="editLocationQuantity"
                            class="block w-full rounded-md border-gray-300 sm:text-sm pl-3 pr-12 mt-4"
                            placeholder="Enter quantity"
                            min="0"
                            step="0.01"
                          />
                          <div
                            class="absolute inset-y-0 right-0 flex items-center pr-3"
                          >
                            <span
                              class="text-gray-500 sm:text-sm"
                              >{{ forestProduct.measurement_units.unit_name }}</span
                            >
                          </div>
                        </div>
                        <div
                          class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"
                        >
                          <span
                            class="text-gray-500 sm:text-sm"
                            >{{ forestProduct.measurement_units.unit_name }}</span
                          >
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Footer -->
                  <div
                    class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 rounded-b-lg"
                  >
                    <button
                      type="button"
                      @click="updateLocationQuantity"
                      class="inline-flex w-full justify-center rounded-md border border-transparent bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700 sm:ml-3 sm:w-auto"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      @click="showEditLocationModal = false"
                      class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Map Container -->
        <div class="w-1/2 mx-auto rounded-full" v-if="locations.length != 0">
          <h3
            class="text-lg text-center font-medium text-gray-900 bg-green-100 py-2 rounded-full shadow-sm"
          >
            {{ forestProduct.name }}s Map Locations
          </h3>
        </div>
        <div
          v-if="!loading && locations.length != 0"
          id="locationMap"
          class="mt-6 h-[400px] w-full rounded-lg overflow-hidden border border-gray-200 shadow-inner"
          style="z-index: 1"
        ></div>
      </div>
    </div>

    <!-- Map Modal -->
    <div v-if="showLocationModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div
        class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0"
      >
        <!-- Background overlay -->
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          @click="showLocationModal = false"
        ></div>

        <!-- Modal panel -->
        <div
          class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle"
        >
          <div class="px-6 pt-5 pb-6">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center space-x-2">
                <svg
                  class="w-6 h-6 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <h3 class="text-lg font-medium text-gray-900">
                  Select Location
                </h3>
              </div>
              <button
                @click="showLocationModal = false"
                class="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg
                  class="h-6 w-6"
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

            <div
              id="modalMap"
              class="h-[400px] w-full rounded-lg border border-gray-200 shadow-inner mb-4"
            ></div>

            <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                @click="cancelMapModal"
                class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showExtraImageModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 transition-opacity duration-300"
      @keydown.esc="closeImageModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="imageModalTitle"
    >
      <div
        class="relative flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-[95%] sm:w-[90%] max-h-[90vh] overflow-hidden transition-transform duration-300 scale-100 border border-gray-200 dark:border-gray-700/50"
      >
        <div
          class="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700/50 flex-shrink-0"
        >
          <div class="flex items-center space-x-2">
            <img
              src="@/assets/image-viewer.png"
              alt="Dashboard"
              class="w-6 h-6 group-hover:scale-110 transition-transform"
            />
            <h2
              id="imageModalTitle"
              class="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate"
            >
              Image Viewer
            </h2>
          </div>
          <button
            class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 rounded-md p-1 -mr-2"
            @click="closeImageModal"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div
          class="relative flex-grow overflow-hidden bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center p-4"
        >
          <div
            v-if="isLoading"
            class="absolute inset-0 flex items-center justify-center z-10 bg-gray-50/50 dark:bg-gray-800/50"
          >
            <div
              class="w-12 h-12 border-4 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin"
            ></div>
          </div>

          <img
            :src="currentImage"
            alt="Image Preview"
            class="block max-w-full max-h-[calc(90vh-150px)] object-contain transition-opacity duration-300"
            :class="{'opacity-0': isLoading, 'opacity-100': !isLoading}"
            @load="isLoading = false"
          />

          <button
            v-if="imageCount > 1"
            @click="showPreviousImage"
            :disabled="!hasPreviousImage"
            aria-label="Previous image"
            class="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 sm:h-6 sm:w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            v-if="imageCount > 1"
            @click="showNextImage"
            :disabled="!hasNextImage"
            aria-label="Next image"
            class="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 sm:h-6 sm:w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        <div
          v-if="isForestRanger || isFPUAdmin"
          class="flex items-center justify-end px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/80 flex-shrink-0"
        >
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 dark:focus:ring-offset-gray-900 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 mr-1.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
                Delete Image
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Image?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this image? This action cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter class="flex justify-end space-x-3 mt-4">
                <AlertDialogCancel
                  class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900"
                  >Cancel</AlertDialogCancel
                >
                <AlertDialogAction
                  @click="deleteImage(currentImageIndex)"
                  class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-900"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>

    <div v-if="showImageModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div
        class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0"
      >
        <!-- Background overlay -->
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          @click="showImageModal = false"
        ></div>

        <!-- Modal panel -->
        <div
          class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle"
        >
          <div class="px-6 pt-5 pb-6">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center space-x-2">
                <svg
                  class="w-6 h-6 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <h3 class="text-lg font-medium text-gray-900">Update Image</h3>
              </div>
              <button
                @click="showImageModal = false"
                class="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg
                  class="h-6 w-6"
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

            <div class="mt-2">
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >Choose an image</label
              >
              <div
                class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg"
              >
                <div class="space-y-1 text-center">
                  <div class="flex text-sm text-gray-600">
                    <label
                      class="relative cursor-pointer rounded-md font-medium text-gray-900 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
                    >
                      <span>Upload a file</span>
                      <input
                        type="file"
                        @change="handleImageChange"
                        class="sr-only"
                      />
                    </label>
                    <p class="pl-1">(image files only)</p>
                  </div>
                  <!-- <p class="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p> -->
                </div>
              </div>
            </div>

            <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                @click="handleImageSubmit"
                class="inline-flex w-full justify-center rounded-md border border-transparent bg-gray-900 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Update
              </button>
              <button
                type="button"
                @click="showImageModal = false"
                class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Toaster />
  </div>
</template>

<style>
@import "leaflet/dist/leaflet.css";
</style>
