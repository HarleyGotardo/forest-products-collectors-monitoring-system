<script setup>
import { cn } from '@/lib/utils';
import { Primitive } from 'radix-vue';
import { computed } from 'vue';

/**
 * CustomButton component for the Forest Products Collectors Monitoring System
 * 
 * This component provides a consistent button styling across the application
 * with forest-themed variants and flexible configuration options.
 */
const props = defineProps({
  /**
   * Button variant - controls the color scheme and appearance
   * - primary: Green-themed primary action button
   * - secondary: Lighter alternative button
   * - danger: Red-themed button for destructive actions
   * - outline: Bordered button with transparent background
   * - ghost: Button with no background until hovered
   * - link: Button that looks like a link
   */
  variant: { 
    type: String, 
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'danger', 'outline', 'ghost', 'link'].includes(value)
  },
  
  /**
   * Button size
   * - default: Standard size
   * - sm: Small size
   * - lg: Large size
   * - icon: Square button for icons
   */
  size: { 
    type: String, 
    default: 'default',
    validator: (value) => ['default', 'sm', 'lg', 'icon'].includes(value)
  },
  
  /**
   * Additional CSS classes
   */
  class: { type: String, default: '' },
  
  /**
   * Whether to render as a child component
   */
  asChild: { type: Boolean, default: false },
  
  /**
   * Element to render as
   */
  as: { type: String, default: 'button' },
  
  /**
   * Whether the button is disabled
   */
  disabled: { type: Boolean, default: false },
  
  /**
   * Whether to show a loading spinner
   */
  loading: { type: Boolean, default: false },
  
  /**
   * Button type attribute
   */
  type: { type: String, default: 'button' },
  
  /**
   * Icon to display before the button text
   */
  icon: { type: [Object, null], default: null },
  
  /**
   * Icon to display after the button text
   */
  iconRight: { type: [Object, null], default: null },
});

// Emit events
const emit = defineEmits(['click']);

// Handle click event
const handleClick = (event) => {
  if (!props.disabled && !props.loading) {
    emit('click', event);
  }
};

// Compute button classes based on variant and size
const buttonClasses = computed(() => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
  
  // Size classes
  const sizeClasses = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md px-3 text-xs',
    lg: 'h-10 rounded-md px-8 text-base',
    icon: 'h-9 w-9 p-0',
  };
  
  // Variant classes
  const variantClasses = {
    primary: 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm',
    secondary: 'bg-emerald-100 text-green-900 hover:bg-emerald-200 shadow-sm',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-sm',
    ghost: 'hover:bg-gray-100 text-gray-700',
    link: 'text-green-700 underline-offset-4 hover:underline p-0 h-auto',
  };
  
  return cn(
    baseClasses,
    sizeClasses[props.size],
    variantClasses[props.variant],
    props.class
  );
});
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="buttonClasses"
    :disabled="disabled || loading"
    :type="type"
    @click="handleClick"
    v-bind="$attrs"
  >
    <!-- Loading spinner -->
    <svg
      v-if="loading"
      class="animate-spin -ml-1 mr-2 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
    
    <!-- Left icon -->
    <component v-if="icon && !loading" :is="icon" class="h-4 w-4" />
    
    <!-- Button content -->
    <slot />
    
    <!-- Right icon -->
    <component v-if="iconRight" :is="iconRight" class="h-4 w-4" />
  </Primitive>
</template>
