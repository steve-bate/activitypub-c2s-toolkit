<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface Props {
  attachment: Record<string, unknown>
}

const props = defineProps<Props>()
const router = useRouter()
const route = useRoute()

function resolveUri(uri: string): string {
  const base = typeof route.query.uri === 'string' ? route.query.uri : window.location.origin
  try {
    return new URL(uri, base).toString()
  } catch {
    return uri
  }
}

function navigateToJson(uri: string) {
  if (!uri || !uri.toString().startsWith('http')) return
  void router.push({
    name: 'json',
    query: { uri: resolveUri(uri) }
  })
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return String(value)
  if (value === null) return 'null'
  if (Array.isArray(value)) return `[Array: ${value.length} items]`
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (obj.url) return String(obj.url)
    if (obj.id) return String(obj.id)
    return '[Object]'
  }
  return String(value)
}

function isNavigableUri(value: string): boolean {
  return value.startsWith('http') || value.startsWith('/')
}

const metadataItems = computed(() => {
  const items: Array<{ key: string; value: string; isUri: boolean }> = []
  
  for (const [key, value] of Object.entries(props.attachment)) {
    const formatted = formatValue(value)
    const isUri = typeof value === 'string' && isNavigableUri(value)
    items.push({ key, value: formatted, isUri })
  }
  
  return items
})
</script>

<template>
  <table class="min-w-full border-collapse border border-gray-300 dark:border-gray-600 text-xs">
    <thead>
      <tr class="border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
        <th class="px-2 py-1 text-left font-semibold text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-600">Property</th>
        <th class="px-2 py-1 text-left font-semibold text-gray-900 dark:text-white">Value</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(item, index) in metadataItems"
        :key="index"
        class="border border-gray-300 dark:border-gray-600"
      >
        <td class="px-2 py-1 font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 border-r border-gray-300 dark:border-gray-600 whitespace-nowrap">
          {{ item.key }}
        </td>
        <td class="px-2 py-1 text-gray-700 dark:text-gray-300 break-all">
          <a
            v-if="item.isUri"
            href="#"
            class="text-blue-600 dark:text-blue-400 hover:underline"
            @click.prevent="navigateToJson(item.value)"
          >
            {{ item.value }}
          </a>
          <div v-else>{{ item.value }}</div>
        </td>
      </tr>
    </tbody>
  </table>
</template>
