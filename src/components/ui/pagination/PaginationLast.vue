<script setup>
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronsRight } from 'lucide-vue-next';
import { PaginationLast } from 'radix-vue';
import { computed } from 'vue';

const props = defineProps({
  asChild: { type: Boolean, required: false, default: true },
  as: { type: null, required: false },
  class: { type: null, required: false },
});

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props;
  return delegated;
});
</script>

<template>
  <PaginationLast v-bind="delegatedProps">
    <Button 
      :class="cn(
        'w-10 h-10 p-0 sm:w-8 sm:h-8',
        'hover:bg-gray-100 active:bg-gray-200',
        'focus:outline-none focus:ring-2 focus:ring-gray-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-colors duration-200',
        props.class
      )" 
      variant="outline"
    >
      <slot>
        <ChevronsRight class="h-5 w-5 sm:h-4 sm:w-4" />
      </slot>
    </Button>
  </PaginationLast>
</template>
