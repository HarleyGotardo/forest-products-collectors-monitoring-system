<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { toast, Toaster } from 'vue-sonner'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import locationPeek from '@/assets/location-peek.png'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

const route = useRoute()
const router = useRouter()
const productId = route.params.id
const name = ref('')
const description = ref('')
const type = ref('Timber')
const price_based_on_measurement_unit = ref('')
const measurementUnits = ref([])
const selectedMeasurementUnit = ref(null)
const error = ref(null)
const locations = ref([])
const selectedLocations = ref([])
const showLocationModal = ref(false)
const showMapModal = ref(false)
const mapInstance = ref(null)
const tempMarker = ref(null)
const currentLocation = ref(null)
const isFormChanged = ref(false)
const isLoading = ref(true)

const originalData = ref({
  name: '',
  description: '',
  type: '',
  price_based_on_measurement_unit: null,
  measurement_unit_id: null,
  image_url: null,
  locations: []
})
const fetchForestProduct = async () => {
  isLoading.value = true

  try {
    let { data, error: fetchError } = await supabase
      .from('forest_products')
      .select(`
        *,
        measurement_units (
          id,
          unit_name
        ),
        fp_and_locations (
          id,
          quantity,
          locations (
            id,
            name,
            latitude,
            longitude
          )
        )
      `)
      .eq('id', productId)
      .single()

    if (fetchError) {
      error.value = fetchError.message
      return
    }

    name.value = data.name
    description.value = data.description
    type.value = data.type || 'Timber'
    price_based_on_measurement_unit.value = data.price_based_on_measurement_unit
    selectedMeasurementUnit.value = data.measurement_unit_id

    // Initialize with empty arrays if no locations found
    selectedLocations.value = []

    // Map locations from fp_and_locations if they exist
    if (data.fp_and_locations && data.fp_and_locations.length > 0) {
      const validLocations = data.fp_and_locations
        .filter(fpLoc => fpLoc.locations) // Filter out any null location entries
        .map(fpLoc => ({
          id: fpLoc.locations.id,
          name: fpLoc.locations.name,
          latitude: fpLoc.locations.latitude,
          longitude: fpLoc.locations.longitude,
          quantity: fpLoc.quantity,
          fp_and_location_id: fpLoc.id
        }))

      selectedLocations.value = validLocations
    }

    // Store original data for comparison with proper handling for empty locations
    originalData.value = {
      name: data.name,
      description: data.description,
      type: data.type || 'Timber',
      price_based_on_measurement_unit: data.price_based_on_measurement_unit,
      measurement_unit_id: data.measurement_unit_id,
      image_url: data.image_url,
      locations: []
    }

    // Only add locations to original data if they exist and are valid
    if (data.fp_and_locations && data.fp_and_locations.length > 0) {
      originalData.value.locations = data.fp_and_locations
        .filter(fpLoc => fpLoc.locations) // Filter out any null location entries
        .map(fpLoc => ({
          id: fpLoc.locations.id,
          name: fpLoc.locations.name,
          latitude: fpLoc.locations.latitude,
          longitude: fpLoc.locations.longitude,
          quantity: fpLoc.quantity,
          fp_and_location_id: fpLoc.id
        }))
    }
  } catch (err) {
    console.error('Error fetching forest product:', err)
    error.value = 'Failed to load forest product data'
  } finally {
    isLoading.value = false
  }
}

const fetchLocations = async () => {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, latitude, longitude')
    .order('name')

  if (error) {
    console.error('Error fetching locations:', error)
  } else {
    locations.value = data
  }
}

const fetchAllMeasurementUnits = async () => {
  const { data, error } = await supabase
    .from('measurement_units')
    .select('*')

  if (error) {
    console.error('Error fetching measurement units:', error)
  } else {
    measurementUnits.value = data
  }
}

const isFormValid = computed(() => {
  // Check required fields (excluding price which can be 0)
  const hasRequiredFields = name.value && 
                          description.value && 
                          type.value && 
                          selectedMeasurementUnit.value &&
                          selectedLocations.value.length > 0
  
  return hasRequiredFields
})

// Computed property to check if there are actual changes to save
// Improved hasChanges computed property
const hasChanges = computed(() => {
  // Compare basic form fields with original data
  const hasBasicChanges = (
    name.value !== originalData.value.name ||
    description.value !== originalData.value.description ||
    type.value !== originalData.value.type ||
    // Special handling for price to avoid issues with null/0/undefined comparisons
    !arePricesEqual(price_based_on_measurement_unit.value, originalData.value.price_based_on_measurement_unit) ||
    selectedMeasurementUnit.value !== originalData.value.measurement_unit_id
  )
  
  return hasBasicChanges || haveLocationsChanged()
})

// Helper function to properly compare price values
const arePricesEqual = (price1, price2) => {
  // Convert both to numbers for comparison
  const num1 = parseFloat(price1)
  const num2 = parseFloat(price2)
  
  // Handle special cases: both null/undefined/empty or both zero
  if ((!price1 && !price2) || (num1 === 0 && num2 === 0)) {
    return true
  }
  
  // Handle NaN cases
  if (isNaN(num1) && isNaN(num2)) {
    return true
  }
  
  // Normal number comparison
  return num1 === num2
}

// Checking for zero-quantity locations
const hasZeroQuantityLocations = computed(() => {
  return selectedLocations.value.some(loc => loc.quantity === 0)
})

// Update the watch function
watch([name, description, type, price_based_on_measurement_unit, selectedMeasurementUnit, selectedLocations], () => {
  // isFormChanged is now managed through the computed properties above
}, { deep: true })

onMounted(async () => {
  await Promise.all([
    fetchForestProduct(),
    fetchLocations(),
    fetchAllMeasurementUnits()
  ])
})

const initializeMap = (latitude, longitude, name) => {
  if (mapInstance.value) {
    mapInstance.value.remove()
  }

  mapInstance.value = L.map("map").setView([latitude, longitude], 16)

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(mapInstance.value)

  L.marker([latitude, longitude])
    .addTo(mapInstance.value)
    .bindTooltip(name, {
      permanent: true,
      direction: 'top',
      className: 'bg-white px-2 py-1 rounded shadow-lg'
    })
}

const visualizeLocation = (location) => {
  currentLocation.value = location
  showMapModal.value = true
  nextTick(() => initializeMap(location.latitude, location.longitude, location.name))
}

const selectedLocationsNote = computed(() => {
  return selectedLocations.value.map(location => location.name).join(", ")
})

// Changed to track only what has changed
const getChangedFields = () => {
  const changes = {}

  if (name.value !== originalData.value.name) changes.name = name.value
  if (description.value !== originalData.value.description) changes.description = description.value
  if (type.value !== originalData.value.type) changes.type = type.value

  const priceOrig = originalData.value.price_based_on_measurement_unit
  const priceNew = parseFloat(price_based_on_measurement_unit.value)
  if (priceNew !== priceOrig) changes.price_based_on_measurement_unit = isNaN(priceNew) ? null : priceNew

  if (selectedMeasurementUnit.value !== originalData.value.measurement_unit_id)
    changes.measurement_unit_id = selectedMeasurementUnit.value

  // Add updated timestamp
  changes.updated_at = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

  return changes
}

// Check if locations have changed (added, removed, or quantity changed)
const haveLocationsChanged = () => {
  if (selectedLocations.value.length !== originalData.value.locations.length) return true

  // Check if quantities have changed
  for (const location of selectedLocations.value) {
    const originalLocation = originalData.value.locations.find(l => l.id === location.id)
    if (!originalLocation || originalLocation.quantity !== location.quantity) return true
  }

  // Check if any locations have been removed
  for (const origLocation of originalData.value.locations) {
    if (!selectedLocations.value.find(l => l.id === origLocation.id)) return true
  }

  return false
}

const handleSubmit = async () => {
  try {
    // Check if any selected location has a zero quantity
    const zeroQuantityLocations = selectedLocations.value.filter(location => location.quantity === 0);
    if (zeroQuantityLocations.length > 0) {
      // Get the names of locations with zero quantity
      const locationNames = zeroQuantityLocations.map(loc => loc.name).join(", ");
      error.value = `Cannot update: The following location(s) have zero quantity: ${locationNames}`;
      toast.error(`Cannot update: Location(s) with zero quantity detected`, { duration: 3000 });
      return;
    }

    // Get only changed fields
    const updates = getChangedFields();

    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('forest_products')
        .update(updates)
        .eq('id', productId);

      if (updateError) {
        error.value = updateError.message;
        return;
      }
    }

    // Handle location changes
    if (haveLocationsChanged()) {
      // Get locations to remove (in original but not in selected)
      const locationsToRemove = originalData.value.locations
        .filter(origLoc => !selectedLocations.value.find(loc => loc.id === origLoc.id))
        .map(loc => loc.fp_and_location_id);

      // Remove locations that are no longer selected
      if (locationsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('fp_and_locations')
          .delete()
          .in('id', locationsToRemove);

        if (deleteError) {
          error.value = deleteError.message;
          return;
        }
      }

      // Update or add locations
      for (const location of selectedLocations.value) {
        const originalLocation = originalData.value.locations.find(loc => loc.id === location.id);

        if (originalLocation) {
          // Update quantity if changed
          if (originalLocation.quantity !== location.quantity) {
            const { error: updateLocationError } = await supabase
              .from('fp_and_locations')
              .update({ quantity: location.quantity })
              .eq('id', originalLocation.fp_and_location_id);

            if (updateLocationError) {
              error.value = updateLocationError.message;
              return;
            }
          }
        } else {
          // Add new location relationship
          const { error: insertError } = await supabase
            .from('fp_and_locations')
            .insert([{
              forest_product_id: productId,
              location_id: location.id,
              quantity: location.quantity
            }]);

          if (insertError) {
            error.value = insertError.message;
            return;
          }
        }
      }
    }

    toast.success('Forest product updated successfully', { duration: 2000 });
    router.push('/authenticated/forest-products');
  } catch (err) {
    error.value = err.message;
  }
}

// Navigate back to products list
const handleCancel = () => {
  router.push('/authenticated/forest-products')
}

// Update location quantity
const updateLocationQuantity = (location, quantity) => {
  const selectedLocation = selectedLocations.value.find(loc => loc.id === location.id)
  if (selectedLocation) {
    selectedLocation.quantity = quantity

    // Show a warning toast if quantity is set to 0
    if (quantity === 0) {
      toast.warning(`Warning: ${location.name} has zero quantity. It won't be saved with zero quantity.`, {
        duration: 3000,
        id: `zero-quantity-${location.id}` // Prevent duplicate toasts for the same location
      })
    }
  }
}

// Toggle location selection
const toggleLocationSelection = (location) => {
  const index = selectedLocations.value.findIndex(loc => loc.id === location.id)

  if (index >= 0) {
    // Remove location if already selected
    selectedLocations.value.splice(index, 1)
  } else {
    // Add location with default quantity if not already selected
    selectedLocations.value.push({
      ...location,
      quantity: 0
    })
  }
}

// Check if a location is selected
const isLocationSelected = (locationId) => {
  return selectedLocations.value.some(loc => loc.id === locationId)
}

// Get the unit name for display
const getUnitName = computed(() => {
  if (!selectedMeasurementUnit.value || !measurementUnits.value.length) return ''
  const unit = measurementUnits.value.find(u => u.id === selectedMeasurementUnit.value)
  return unit ? unit.unit_name : ''
})
</script>

<template>
  <div class="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
    <!-- Add content here -->
    <!-- Header Section with subtle gradient background -->
    <div
      class="mb-8 bg-gradient-to-r bg-gray-100 rounded-xl p-6 shadow-sm border border-green-100"
    >
      <div class="flex flex-col items-center sm:flex-row sm:items-start">
      <div class="flex-shrink-0 bg-gray-50 rounded-full p-3 flex space-x-2">
        <img
        src="@/assets/edit.png"
        alt="Edit"
        class="w-8 h-8 transition-all duration-300 group-hover:scale-110"
        />
        <img
        src="@/assets/forest-product.png"
        alt="Forest Product"
        class="w-8 h-8 transition-all duration-300 group-hover:scale-110"
        />
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-5 text-center sm:text-left">
        <h2 class="text-2xl font-bold text-gray-800">Edit Forest Product</h2>
        <p class="mt-1 text-sm text-gray-600">
        Update the details of your forest product
        </p>
      </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center items-center h-64">
      <div
        class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"
      ></div>
    </div>

    <!-- Error Alert -->
    <div
      v-else-if="error"
      class="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-md flex items-center"
    >
      <svg
        class="h-5 w-5 text-red-400 mr-3 flex-shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
      <p>{{ error }}</p>
    </div>

    <!-- Form with better spacing and organization -->
    <form
      v-else
      @submit.prevent="handleSubmit"
      class="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden"
    >
      <!-- Form content with sections -->
      <div class="p-6 space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Basic Information Section -->
          <div class="md:col-span-2">
            <h3
              class="text-lg font-medium text-gray-800 mb-4 pb-2 border-b border-gray-100"
            >
              Basic Information
            </h3>
          </div>

          <!-- Name input -->
          <div class="space-y-2">
            <Label for="name" class="text-gray-700">Product Name</Label>
            <Input
              id="name"
              v-model="name"
              type="text"
              class="w-full"
              placeholder="Enter product name"
              required
            />
          </div>

          <!-- Type select -->
          <div class="space-y-2">
            <Label for="type" class="text-gray-700">Product Type</Label>
            <Select v-model="type" required>
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select product type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="Timber">Timber</SelectItem>
                  <SelectItem value="Non-Timber">Non-Timber</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <!-- Description input - full width -->
          <div class="md:col-span-2 space-y-2">
            <Label for="description" class="text-gray-700">Description</Label>
            <Textarea
              id="description"
              v-model="description"
              required
              placeholder="Describe the forest product"
              class="min-h-24"
            ></Textarea>
          </div>

          <!-- Measurement section -->
          <div class="md:col-span-2 pt-4">
            <h3
              class="text-lg font-medium text-gray-800 mb-4 pb-2 border-b border-gray-100"
            >
              Measurement & Pricing
            </h3>
          </div>

          <!-- Measurement Unit select -->
          <div class="space-y-2">
            <Label for="measurementUnit" class="text-gray-700"
              >Measurement Unit</Label
            >
            <Select v-model="selectedMeasurementUnit" required>
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select unit of measurement" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="unit in measurementUnits"
                    :key="unit.id"
                    :value="unit.id"
                  >
                    {{ unit.unit_name }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <!-- Price input -->
          <div class="space-y-2">
            <Label for="price" class="text-gray-700">Price per Unit</Label>
            <div class="relative">
              <span
                class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500"
                >₱</span
              >
              <input
                id="price"
                v-model="price_based_on_measurement_unit"
                type="number"
                required
                placeholder="0.00"
                class="pl-8 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                @input="(e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, ''); }"
              />
            </div>
            <p
              v-if="!price_based_on_measurement_unit || price_based_on_measurement_unit == 0"
              class="text-sm text-gray-500 mt-1"
            >
              Setting the price to 0 or leaving it blank indicates that this
              product is free.
            </p>
          </div>

          <!-- Location section -->
          <div class="md:col-span-2 pt-4">
            <h3
              class="text-lg font-medium text-gray-800 mb-4 pb-2 border-b border-gray-100"
            >
              Locations
            </h3>
          </div>

          <!-- Location select -->
          <div class="md:col-span-2 space-y-2">
            <Label class="text-gray-700">Select Locations</Label>
            <button
              type="button"
              @click="showLocationModal = true"
              class="w-full flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <span class="text-gray-700">
                {{ selectedLocations.length ? `${selectedLocations.length} location(s) selected` : 'Select location(s)' }}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-gray-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>

            <!-- Display selected locations with quantities -->
            <div v-if="selectedLocations.length > 0" class="mt-4 space-y-2">
              <div class="bg-gray-50 p-4 rounded-lg">
                <h4 class="font-medium text-gray-700 mb-2">
                  Selected Locations
                </h4>
                <div class="space-y-3">
                  <div
                    v-for="location in selectedLocations"
                    :key="location.id"
                    class="flex justify-between items-center p-2 bg-white rounded border border-gray-200"
                  >
                    <div>
                      <span class="font-medium">{{ location.name }}</span>
                      <div class="text-sm text-gray-500">
                        <span
                          >Quantity: {{ location.quantity }}
                          {{ getUnitName }}</span
                        >
                      </div>
                    </div>
                    <div class="flex items-center space-x-2">
                      <button
                        type="button"
                        @click="visualizeLocation(location)"
                        class="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-full"
                        title="View on map"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- Add this below the selected locations section -->
            <div
              v-if="hasZeroQuantityLocations"
              class="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 rounded-md"
            >
              <div class="flex">
                <svg
                  class="h-5 w-5 text-yellow-400 mr-3 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
                <p>
                  Cannot update: Locations with zero quantity detected. Please
                  enter a quantity for each location.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

<!-- Submit button section -->
<div class="bg-gray-50 px-6 py-4 flex justify-between">
  <Button
    type="button"
    variant="outline"
    @click="handleCancel"
    class="border-gray-300 text-gray-700 hover:bg-gray-100"
  >
    Cancel
  </Button>

  <!-- Form Status Indicator -->
  <div v-if="!name || !description || !type || !selectedMeasurementUnit || selectedLocations.length === 0" 
       class="mr-4 px-4 py-2 bg-blue-50 border-l-4 border-blue-400 text-blue-700 rounded flex items-center">
    <svg class="h-5 w-5 text-blue-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
    </svg>
    <span class="text-sm">Please complete all required fields</span>
  </div>
  
  <!-- Zero Quantity Warning -->
  <div v-else-if="hasZeroQuantityLocations" 
       class="mr-4 px-4 py-2 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 rounded flex items-center">
    <svg class="h-5 w-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
    </svg>
    <span class="text-sm">All locations must have quantity > 0</span>
  </div>
  
  <!-- No Changes Warning -->
  <div v-else-if="!hasChanges" 
       class="mr-4 px-4 py-2 bg-gray-100 border-l-4 border-gray-400 text-gray-700 rounded flex items-center">
    <svg class="h-5 w-5 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
    </svg>
    <span class="text-sm">No changes to save</span>
  </div>

  <AlertDialog>
  <AlertDialogTrigger>
    <button
      type="button"
      :disabled="!isFormValid || hasZeroQuantityLocations || !hasChanges"
      class="px-6 py-2 font-medium rounded-lg shadow-md transition-all duration-200"
      :class="isFormValid && !hasZeroQuantityLocations && hasChanges 
        ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
        : 'bg-gray-300 text-gray-500 cursor-not-allowed'"
    >
      Update Product
    </button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Confirm Update</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to update this forest product with the provided changes?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel class="bg-gray-100 hover:bg-gray-200 text-gray-800">
        Cancel
      </AlertDialogCancel>
      <AlertDialogAction @click="handleSubmit" class="bg-emerald-600 hover:bg-emerald-700">
        Update
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
</div>
    </form>

    <!-- Location Modal -->
    <div v-if="showLocationModal" class="fixed inset-0 z-50 overflow-y-auto">
      <!-- Modal Backdrop -->
      <div
        class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
      ></div>

      <!-- Modal Container -->
      <div class="flex items-center justify-center min-h-screen px-4 py-8">
        <!-- Modal Content -->
        <div class="relative bg-white rounded-xl shadow-xl max-w-4xl w-full">
          <!-- Modal Header -->
          <header class="px-6 py-4 border-b border-gray-100">
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-medium text-gray-800">
                Select Locations
              </h3>
              <button
                @click="showLocationModal = false"
                class="text-gray-400 hover:text-gray-500"
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
            </div>
          </header>

          <!-- Location List -->
          <div class="p-6">
            <div class="max-h-96 overflow-y-auto">
              <div
                v-for="location in locations"
                :key="location.id"
                class="flex items-center justify-between p-4 mb-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <!-- Checkbox and Label -->
                <div class="flex items-center flex-1">
                  <input
                    type="checkbox"
                    :id="`location-${location.id}`"
                    :checked="isLocationSelected(location.id)"
                    @change="toggleLocationSelection(location)"
                    class="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <label
                    :for="`location-${location.id}`"
                    class="ml-3 cursor-pointer"
                  >
                    <span
                      class="font-medium text-gray-800"
                      >{{ location.name }}</span
                    >
                    <span class="text-gray-500 text-sm block">
                      Coordinates: {{ location.latitude }},
                      {{ location.longitude }}
                    </span>
                  </label>
                </div>

                <!-- Quantity Input in the Location Modal -->
                <div class="ml-4 flex items-center">
                  <label class="mr-2 text-sm text-gray-600"
                    >Quantity ({{ getUnitName }}):</label
                  >
                  <input
                    type="number"
                    :value="selectedLocations.find(loc => loc.id === location.id)?.quantity || 0"
                    @input="(e) => updateLocationQuantity(location, parseFloat(e.target.value) || 0)"
                    :disabled="!isLocationSelected(location.id)"
                    placeholder="0"
                    class="w-20 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    :class="{'border-red-500 focus:ring-red-500 focus:border-red-500': isLocationSelected(location.id) && selectedLocations.find(loc => loc.id === location.id)?.quantity === 0}"
                  />
                </div>

                <!-- Visualize Button -->
                <button
                  type="button"
                  @click="visualizeLocation(location)"
                  class="ml-4 flex items-center justify-center px-3 py-1 text-sm font-medium text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  View Map
                </button>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <footer
            class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end"
          >
            <Button
              type="button"
              @click="showLocationModal = false"
              class="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Done
            </Button>
          </footer>
        </div>
      </div>
    </div>

    <!-- Map Modal -->
    <div v-if="showMapModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div
        class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center"
      >
        <div
          class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        ></div>
        <div
          class="relative bg-white rounded-xl shadow-xl p-6 max-w-4xl w-full"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-800">Location Map</h3>
            <button
              type="button"
              @click="showMapModal = false"
              class="text-gray-400 hover:text-gray-500"
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
          </div>
          <div v-if="currentLocation" class="bg-gray-50 p-3 rounded-lg mb-4">
            <h4 class="font-medium text-gray-800">
              {{ currentLocation.name }}
            </h4>
            <p class="text-sm text-gray-500">
              Coordinates: {{ currentLocation.latitude }},
              {{ currentLocation.longitude }}
            </p>
          </div>
          <div
            id="map"
            class="h-96 w-full rounded-lg border border-gray-200"
          ></div>
          <div class="mt-4 flex justify-end">
            <Button
              type="button"
              @click="showMapModal = false"
              class="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Close Map
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <Toaster />
</template>

<style scoped>
.leaflet-container {
  font-family: inherit;
  z-index: 0;
}

.leaflet-tooltip {
  background-color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: none;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Enhancement for input type=number to hide spinners */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}
</style>
