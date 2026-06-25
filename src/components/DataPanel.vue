<script setup lang="ts">
import { useSlots } from 'vue'

const slots = useSlots()

const props = defineProps({
  contentClass: {
    type: String
  }
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">

    <!-- Header -->
    <div v-if="slots.header" class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-3">
        <slot name="header" />
      </div>
      <slot name="header-action" />
    </div>

    <!-- Content -->
    <div :class="props.contentClass ?? 'px-6 py-6'">
      <slot />
    </div>

    <!-- Footer -->
    <div v-if="slots.footer" class="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
      <slot name="footer" />
    </div>

  </div>
</template>
