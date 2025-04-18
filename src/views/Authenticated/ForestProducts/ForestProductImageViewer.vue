<template>
    <div
      v-if="showExtraImageModal"
      class="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 bg-black/75"
      @keydown.esc="closeImageModal"
      tabindex="0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="imageModalTitle"
    >
      <div
        class="relative flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[95%] sm:w-[90%] max-w-5xl max-h-[95vh] overflow-hidden transition-transform duration-300 scale-100"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-200 dark:border-gray-700/50 flex-shrink-0"
        >
          <div class="flex items-center space-x-2">
            <img
              src="@/assets/image-viewer.png"
              alt="Image Viewer"
              class="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform"
            />
            <h2
              id="imageModalTitle"
              class="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 truncate"
            >
              Additional Images
            </h2>
          </div>
          
          <!-- Controls -->
          <div class="flex items-center space-x-1 sm:space-x-2">
            <button
              @click="resetImage"
              class="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Reset View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              @click="rotateImage('left')"
              class="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Rotate Left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <button
              @click="rotateImage('right')"
              class="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Rotate Right"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
            <button
              @click="zoomIn"
              class="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Zoom In"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <button
              @click="zoomOut"
              class="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Zoom Out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <button
              @click="closeImageModal"
              class="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close modal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 sm:h-5 sm:w-5"
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
        </div>
  
        <!-- Image Container -->
        <div
          class="relative flex-grow overflow-hidden bg-gray-100 dark:bg-gray-800/80 flex items-center justify-center p-2 sm:p-4"
          @wheel.prevent="handleWheel"
          @mousedown="startDrag"
          @mousemove="onDrag"
          @mouseup="stopDrag"
          @mouseleave="stopDrag"
          @touchstart="startTouch"
          @touchmove="onTouch"
          @touchend="stopTouch"
        >
          <!-- Loading Spinner -->
          <div
            v-if="isLoading"
            class="absolute inset-0 flex items-center justify-center z-10 bg-gray-50/50 dark:bg-gray-800/50"
          >
            <div
              class="w-10 h-10 sm:w-12 sm:h-12 border-4 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin"
            ></div>
          </div>
  
          <!-- Image -->
          <img
            ref="imageRef"
            :src="currentImage"
            alt="Image Preview"
            class="block object-contain transition-all duration-300"
            :style="{
              transform: `scale(${scale}) rotate(${rotation}deg) translate(${translateX}px, ${translateY}px)`,
              opacity: isLoading ? 0 : 1,
              maxHeight: 'calc(95vh - 150px)',
              cursor: isDragging ? 'grabbing' : 'grab'
            }"
            @load="onImageLoad"
          />
  
          <!-- Image counter -->
          <div 
            class="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm"
            v-if="imageCount > 1"
          >
            {{ currentImageIndex + 1 }} / {{ imageCount - 1 }}
          </div>
  
          <!-- Navigation buttons -->
          <button
            v-if="imageCount > 1"
            @click="showPreviousImage"
            :disabled="!hasPreviousImage"
            aria-label="Previous image"
            class="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/40 text-white hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
            class="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/40 text-white hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
  
        <!-- Image thumbnail gallery -->
        <div v-if="imageCount > 1" class="flex items-center justify-center p-1 sm:p-2 bg-gray-50 dark:bg-gray-900/80 border-t border-gray-200 dark:border-gray-700/50">
          <div class="flex space-x-1 sm:space-x-2 overflow-x-auto py-1 sm:py-2 px-2 sm:px-4 max-w-full">
            <button
              v-for="(image, index) in allImages"
              :key="index"
              @click="selectImage(image, index)"
              class="w-12 h-12 sm:w-16 sm:h-16 rounded-md overflow-hidden flex-shrink-0 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              :class="{'ring-2 ring-blue-500 scale-105': currentImageIndex === index}"
            >
              <img
                :src="image"
                :alt="`Thumbnail ${index + 1}`"
                class="w-full h-full object-cover"
              />
            </button>
          </div>
        </div>
  
        <!-- Footer with delete button -->
        <div
          v-if="isForestRanger || isFPUAdmin"
          class="flex items-center justify-end px-3 sm:px-6 py-2 sm:py-3 border-t border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/80 flex-shrink-0"
        >
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                class="inline-flex items-center justify-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 dark:focus:ring-offset-gray-900 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-1.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v11a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
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
                  class="px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900"
                  >Cancel</AlertDialogCancel
                >
                <AlertDialogAction
                  @click="deleteImage(currentImageIndex)"
                  class="px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-900"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted, watch } from 'vue'
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
  
  const props = defineProps({
    showExtraImageModal: Boolean,
    currentImage: String,
    currentImageIndex: Number,
    additionalImages: Array,
    mainImage: String, // Add prop for main product image
    isForestRanger: Boolean,
    isFPUAdmin: Boolean,
    imageTitle: String, // Optional title for the image
  })
  
  const emit = defineEmits([
    'close-modal', 
    'delete-image', 
    'previous-image', 
    'next-image',
    'select-image'
  ])
  
  // Image manipulation state
  const scale = ref(1)
  const rotation = ref(0)
  const translateX = ref(0)
  const translateY = ref(0)
  const isLoading = ref(true)
  const isDragging = ref(false)
  const lastPos = ref({ x: 0, y: 0 })
  const imageRef = ref(null)
  
  // Image navigation
  const showPreviousImage = () => {
    if (hasPreviousImage.value) {
      emit('previous-image')
      resetImageView()
    }
  }
  
  const showNextImage = () => {
    if (hasNextImage.value) {
      emit('next-image')
      resetImageView()
    }
  }
  
  const closeImageModal = () => {
    emit('close-modal')
    resetImageView()
  }
  
  const deleteImage = (index) => {
    emit('delete-image', index)
  }
  
  const selectImage = (image, index) => {
    emit('select-image', image, index)
    resetImageView()
  }
  
  // Image manipulation functions
  const zoomIn = () => {
    scale.value = Math.min(scale.value + 0.25, 5)
  }
  
  const zoomOut = () => {
    scale.value = Math.max(scale.value - 0.25, 0.5)
  }
  
  const rotateImage = (direction) => {
    rotation.value += direction === 'right' ? 90 : -90
  }
  
  const resetImage = () => {
    resetImageView()
  }
  
  const resetImageView = () => {
    scale.value = 1
    rotation.value = 0
    translateX.value = 0
    translateY.value = 0
  }
  
  const handleWheel = (e) => {
    if (e.deltaY < 0) {
      zoomIn()
    } else {
      zoomOut()
    }
  }
  
  // Pan/drag functionality
  const startDrag = (e) => {
    isDragging.value = true
    lastPos.value = {
      x: e.clientX,
      y: e.clientY
    }
  }
  
  const onDrag = (e) => {
    if (!isDragging.value) return
    
    const deltaX = e.clientX - lastPos.value.x
    const deltaY = e.clientY - lastPos.value.y
    
    translateX.value += deltaX
    translateY.value += deltaY
    
    lastPos.value = {
      x: e.clientX,
      y: e.clientY
    }
  }
  
  const stopDrag = () => {
    isDragging.value = false
  }
  
  // Touch support
  const startTouch = (e) => {
    if (e.touches.length !== 1) return
    isDragging.value = true
    lastPos.value = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
  }
  
  const onTouch = (e) => {
    if (!isDragging.value || e.touches.length !== 1) return
    
    const deltaX = e.touches[0].clientX - lastPos.value.x
    const deltaY = e.touches[0].clientY - lastPos.value.y
    
    translateX.value += deltaX
    translateY.value += deltaY
    
    lastPos.value = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
  }
  
  const stopTouch = () => {
    isDragging.value = false
  }
  
  
  // Image loading
  const onImageLoad = () => {
    isLoading.value = false
  }
  
  // Watch for currentImage changes to show loading state
  watch(() => props.currentImage, () => {
    isLoading.value = true
    resetImageView()
  })
  
  // Computed properties
  const imageCount = computed(() => {
    let count = 0
    if (props.additionalImages) count += props.additionalImages.length
    if (props.mainImage) count += 1
    return count
  })
  
  const hasPreviousImage = computed(() => {
    return props.currentImageIndex > 0
  })
  
  const hasNextImage = computed(() => {
    return (props.currentImageIndex < imageCount.value -2)
  })
  
  const allImages = computed(() => {
    const images = []
    if (props.additionalImages) images.push(...props.additionalImages)
    return images
  })
  
  // Keyboard navigation
  const handleKeydown = (e) => {
    if (!props.showExtraImageModal) return
    
    switch (e.key) {
      case 'ArrowLeft':
        showPreviousImage()
        break
      case 'ArrowRight':
        showNextImage()
        break
      case 'Escape':
        closeImageModal()
        break
      case '+':
        zoomIn()
        break
      case '-':
        zoomOut()
        break
      case 'r':
        rotateImage('right')
        break
      case 'l':
        rotateImage('left')
        break
      case '0':
        resetImage()
        break
    }
  }
  
  // Listen for keyboard events
  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })
  
  // Cleanup
  const onBeforeUnmount = () => {
    window.removeEventListener('keydown', handleKeydown)
  }
  
  // Make sure to set default isLoading state
  watch(() => props.showExtraImageModal, (newVal) => {
    if (newVal) {
      isLoading.value = true
    }
  })
  </script>