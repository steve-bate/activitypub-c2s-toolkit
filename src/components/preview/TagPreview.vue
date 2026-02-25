<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface Props {
  tags: Array<Record<string, unknown>>
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
  if (!uri) return
  void router.push({
    name: 'json',
    query: { uri: resolveUri(uri) }
  })
}

const normalizedTags = computed(() => {
  return props.tags.filter(tag => typeof tag === 'object' && tag !== null)
})

function getPrimaryValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null) {
    const objectValue = value as Record<string, unknown>
    if (typeof objectValue.id === 'string') return objectValue.id
    if (typeof objectValue.href === 'string') return objectValue.href
    if (typeof objectValue.url === 'string') return objectValue.url
  }
  return ''
}

function getExtraJson(tag: Record<string, unknown>): string {
  const rest = Object.fromEntries(
    Object.entries(tag).filter(([key]) => !['type', 'name', 'href'].includes(key))
  )
  if (Object.keys(rest).length === 0) {
    return ''
  }
  return JSON.stringify(rest, null, 2)
}
</script>

<template>
  <table class="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
    <thead>
      <tr class="border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
        <th class="px-4 py-2 text-left font-medium text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-600">Type</th>
        <th class="px-4 py-2 text-left font-medium text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-600">Name</th>
        <th class="px-4 py-2 text-left font-medium text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-600">Href</th>
        <th class="px-4 py-2 text-left font-medium text-gray-900 dark:text-white">Other JSON</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(tag, index) in normalizedTags"
        :key="String(tag.id || tag.href || index)"
        class="border border-gray-300 dark:border-gray-600"
      >
        <td class="px-4 py-2 text-gray-700 dark:text-gray-300 border-r border-gray-300 dark:border-gray-600">{{ getPrimaryValue(tag.type) }}</td>
        <td class="px-4 py-2 text-gray-700 dark:text-gray-300 border-r border-gray-300 dark:border-gray-600">{{ getPrimaryValue(tag.name) }}</td>
        <td class="px-4 py-2 text-gray-700 dark:text-gray-300 border-r border-gray-300 dark:border-gray-600 break-all">
          <a
            v-if="getPrimaryValue(tag.href)"
            href="#"
            class="text-blue-600 dark:text-blue-400 hover:underline"
            @click.prevent="navigateToJson(getPrimaryValue(tag.href))"
          >
            {{ getPrimaryValue(tag.href) }}
          </a>
          <span v-else></span>
        </td>
        <td class="px-4 py-2 text-gray-700 dark:text-gray-300">
          <pre v-if="getExtraJson(tag)" class="text-xs whitespace-pre-wrap break-all">{{ getExtraJson(tag) }}</pre>
        </td>
      </tr>
    </tbody>
  </table>
</template>
