<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  queryParams?: Record<string, string> | null
}

const props = withDefaults(defineProps<Props>(), {
  queryParams: null
})

const queryParamEntries = computed(() => {
  if (!props.queryParams) return []
  return Object.entries(props.queryParams).map(([key, value]) => ({ key, value }))
})
</script>

<template>
  <div v-if="queryParamEntries.length">
    <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Query Parameters</div>
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <table class="w-full text-xs">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th class="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Key</th>
            <th class="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in queryParamEntries"
            :key="entry.key"
            class="border-t border-gray-200 dark:border-gray-700"
          >
            <td class="px-3 py-2 font-mono text-gray-800 dark:text-gray-200 align-top">{{ entry.key }}</td>
            <td class="px-3 py-2 font-mono text-gray-700 dark:text-gray-300 break-all">{{ entry.value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
