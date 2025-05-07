<script setup>
import { ref } from 'vue';
import { CustomButton } from '.';
import { ChevronRight, Plus, Save, Trash } from 'lucide-vue-next';

// Demo loading state
const isLoading = ref(false);

const toggleLoading = () => {
  isLoading.value = true;
  setTimeout(() => {
    isLoading.value = false;
  }, 2000);
};
</script>

<template>
  <div class="p-6 space-y-8 max-w-4xl mx-auto">
    <div>
      <h2 class="text-2xl font-bold text-gray-800 mb-4">Forest Products System Custom Button</h2>
      <p class="text-gray-600 mb-6">
        A consistent button component with forest-themed styling for use throughout the application.
      </p>
    </div>

    <!-- Variants -->
    <div>
      <h3 class="text-lg font-semibold text-gray-700 mb-3">Button Variants</h3>
      <div class="flex flex-wrap gap-4">
        <CustomButton variant="primary">Primary</CustomButton>
        <CustomButton variant="secondary">Secondary</CustomButton>
        <CustomButton variant="danger">Danger</CustomButton>
        <CustomButton variant="outline">Outline</CustomButton>
        <CustomButton variant="ghost">Ghost</CustomButton>
        <CustomButton variant="link">Link</CustomButton>
      </div>
    </div>

    <!-- Sizes -->
    <div>
      <h3 class="text-lg font-semibold text-gray-700 mb-3">Button Sizes</h3>
      <div class="flex flex-wrap items-center gap-4">
        <CustomButton variant="primary" size="sm">Small</CustomButton>
        <CustomButton variant="primary" size="default">Default</CustomButton>
        <CustomButton variant="primary" size="lg">Large</CustomButton>
        <CustomButton variant="primary" size="icon"><Plus /></CustomButton>
      </div>
    </div>

    <!-- With Icons -->
    <div>
      <h3 class="text-lg font-semibold text-gray-700 mb-3">Buttons with Icons</h3>
      <div class="flex flex-wrap gap-4">
        <CustomButton variant="primary" :icon="Save">Save</CustomButton>
        <CustomButton variant="outline" :icon="Plus">Add New</CustomButton>
        <CustomButton variant="danger" :icon="Trash">Delete</CustomButton>
        <CustomButton variant="secondary" :iconRight="ChevronRight">Next</CustomButton>
      </div>
    </div>

    <!-- States -->
    <div>
      <h3 class="text-lg font-semibold text-gray-700 mb-3">Button States</h3>
      <div class="flex flex-wrap gap-4">
        <CustomButton variant="primary" disabled>Disabled</CustomButton>
        <CustomButton variant="primary" :loading="isLoading" @click="toggleLoading">
          {{ isLoading ? 'Loading...' : 'Click to Load' }}
        </CustomButton>
      </div>
    </div>

    <!-- Usage Examples -->
    <div>
      <h3 class="text-lg font-semibold text-gray-700 mb-3">Common Usage Examples</h3>
      <div class="space-y-4">
        <!-- Form Actions -->
        <div class="p-4 border border-gray-200 rounded-md">
          <h4 class="text-sm font-medium text-gray-600 mb-3">Form Actions</h4>
          <div class="flex gap-3">
            <CustomButton variant="primary" :icon="Save">Save Changes</CustomButton>
            <CustomButton variant="outline">Cancel</CustomButton>
          </div>
        </div>

        <!-- Data Table Actions -->
        <div class="p-4 border border-gray-200 rounded-md">
          <h4 class="text-sm font-medium text-gray-600 mb-3">Data Table Actions</h4>
          <div class="flex gap-3">
            <CustomButton variant="primary" size="sm" :icon="Plus">Add Record</CustomButton>
            <CustomButton variant="outline" size="sm">Export</CustomButton>
            <CustomButton variant="danger" size="sm" :icon="Trash">Delete Selected</CustomButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Code Example -->
    <div>
      <h3 class="text-lg font-semibold text-gray-700 mb-3">How to Use</h3>
      <div class="bg-gray-100 p-4 rounded-md">
        <pre class="text-sm text-gray-800">
import { CustomButton } from '@/components/ui/button';
import { Save } from 'lucide-vue-next';

&lt;CustomButton 
  variant="primary" 
  size="default"
  :icon="Save"
  :loading="isLoading"
  @click="handleClick"
&gt;
  Save Changes
&lt;/CustomButton&gt;
        </pre>
      </div>
    </div>
  </div>
</template>
