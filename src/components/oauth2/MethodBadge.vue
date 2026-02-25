<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  method: string | null | undefined
  label?: string
}>()

const displayLabel = computed(() => props.label ?? props.method ?? '')

const colorClass = computed(() => {
  switch (props.method) {
    case 'RFC7591':
    case 'RFC8414':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
    case 'Mastodon':
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
    case 'CIMD':
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
  }
})
</script>

<template>
  <span class="px-3 py-1 rounded-full text-xs font-semibold" :class="colorClass">
    {{ displayLabel }}
  </span>
</template>
