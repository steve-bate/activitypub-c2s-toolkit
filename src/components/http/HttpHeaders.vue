<script setup lang="ts">

interface Props {
  headers?: Record<string, string> | null
  emptyLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  headers: null,
  emptyLabel: 'No headers captured'
})

const getEntries = () => {
  if (!props.headers) return []
  return Object.entries(props.headers).sort(([a], [b]) => a.localeCompare(b))
}

const hasHeaders = () => getEntries().length > 0

</script>

<template>
  <div class="text-xs">
    <div v-if="hasHeaders()" class="grid grid-cols-1 gap-2">
      <div v-for="([key, value], index) in getEntries()" :key="`${key}-${index}`" class="flex items-start gap-2">
        <span class="min-w-[120px] font-medium text-gray-700 dark:text-gray-300 break-words">{{ key }}:</span>
        <span class="text-gray-600 dark:text-gray-400 break-all font-mono">{{ value }}</span>
      </div>
    </div>
    <div v-else class="text-gray-500 dark:text-gray-400 italic">
      {{ emptyLabel }}
    </div>
  </div>
</template>
