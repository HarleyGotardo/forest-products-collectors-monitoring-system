<script setup>
import { cn } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-vue-next';
import { PaginationEllipsis } from 'radix-vue';
import { computed } from 'vue';

const props = defineProps({
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  class: { type: null, required: false },
});

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props;
  return delegated;
});
</script>

<template>
  <PaginationEllipsis
    v-bind="delegatedProps"
    :class="cn(
      'w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center',
      'text-gray-500 hover:text-gray-700',
      'transition-colors duration-200',
      props.class
    )"
  >
    <slot>
      <MoreHorizontal class="h-5 w-5 sm:h-4 sm:w-4" />
    </slot>
  </PaginationEllipsis>
</template>
