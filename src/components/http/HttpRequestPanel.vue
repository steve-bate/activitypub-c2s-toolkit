<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatJson, syntaxHighlightJson } from '@/utils/jsonHighlighter'
import HttpHeaders from '@/components/http/HttpHeaders.vue'
import CopyIcon from '@/components/icons/CopyIcon.vue'

interface Props {
  title?: string
  headers?: Record<string, string> | null
  url?: string | null
  queryParams?: Record<string, string> | null
  payload?: unknown
  contentType?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  title: 'HTTP Request',
  headers: null,
  url: null,
  queryParams: null,
  payload: undefined,
  contentType: null
})

const isOpen = ref(false)
const copyState = ref<'idle' | 'copied' | 'error'>('idle')

const headerContentType = computed(() => {
  if (!props.headers) return ''
  const entry = Object.entries(props.headers).find(([key]) => key.toLowerCase() === 'content-type')
  return entry ? entry[1] : ''
})

const normalizedContentType = computed(() => {
  return (props.contentType || headerContentType.value || '').toLowerCase()
})

const hasPayload = computed(() => {
  if (props.payload === null || props.payload === undefined) return false
  if (typeof props.payload === 'string') return props.payload.length > 0
  return true
})

const isJsonPayload = computed(() => {
  if (!hasPayload.value) return false
  if (normalizedContentType.value.includes('json')) return true
  return typeof props.payload === 'object'
})

const isFormPayload = computed(() => {
  if (!hasPayload.value) return false
  return normalizedContentType.value.includes('application/x-www-form-urlencoded') ||
    normalizedContentType.value.includes('multipart/form-data')
})

const payloadLabel = computed(() => {
  if (isJsonPayload.value) return 'JSON'
  if (isFormPayload.value) return 'Form'
  return 'Text'
})

const highlightedJson = computed(() => {
  if (!isJsonPayload.value || !props.payload) return ''
  return syntaxHighlightJson(formatJson(props.payload as object))
})

const jsonCopyText = computed(() => {
  if (!isJsonPayload.value) return ''
  if (typeof props.payload === 'string') return props.payload
  if (props.payload === null || props.payload === undefined) return ''
  return formatJson(props.payload as object)
})

const copyJson = async () => {
  const text = jsonCopyText.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copyState.value = 'copied'
  } catch {
    copyState.value = 'error'
  }
  window.setTimeout(() => {
    copyState.value = 'idle'
  }, 1200)
}

const formattedForm = computed(() => {
  if (!isFormPayload.value) return ''
  if (typeof props.payload === 'string') return props.payload
  if (typeof props.payload === 'object' && props.payload !== null) {
    const params = new URLSearchParams()
    Object.entries(props.payload as Record<string, unknown>).forEach(([key, value]) => {
      if (value === undefined || value === null) return
      params.append(key, JSON.stringify(value))
    })
    return params.toString()
  }
  return String(props.payload)
})

const formattedText = computed(() => {
  if (!hasPayload.value || isJsonPayload.value || isFormPayload.value) return ''
  if (typeof props.payload === 'string') return props.payload
  return String(props.payload)
})

const queryParamEntries = computed(() => {
  if (!props.queryParams) return []
  return Object.entries(props.queryParams).map(([key, value]) => ({ key, value }))
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <button
      @click="isOpen = !isOpen"
      class="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-gray-50 dark:bg-gray-800"
    >
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': isOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
        <span class="font-medium text-gray-900 dark:text-white">{{ title }}</span>
      </div>
    </button>
    <div v-if="isOpen" class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 space-y-4">
      <div>
        <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Request URL</div>
        <div v-if="url" class="text-xs font-mono text-gray-800 dark:text-gray-200 break-all">{{ url }}</div>
        <div v-else class="text-xs text-gray-500 dark:text-gray-400 italic">No URL captured</div>
      </div>
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
      <div>
        <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Headers</div>
        <HttpHeaders :headers="headers" />
      </div>
      <div>
        <div v-if="hasPayload" class="flex items-center justify-between mb-2">
          <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Payload</div>
          <button
            v-if="isJsonPayload"
            type="button"
            class="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            @click="copyJson"
          >
            <CopyIcon class="w-3.5 h-3.5" />
            {{ copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy JSON' }}
          </button>
        </div>
        <div v-if="hasPayload && !isJsonPayload" class="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {{ payloadLabel }}
        </div>
        <div v-if="hasPayload">
          <pre v-if="isJsonPayload" class="text-xs font-mono whitespace-pre-wrap break-words" v-html="highlightedJson"></pre>
          <pre v-else-if="isFormPayload" class="text-xs font-mono whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">{{ formattedForm }}</pre>
          <pre v-else class="text-xs font-mono whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">{{ formattedText }}</pre>
        </div>
        
      </div>
    </div>
  </div>
</template>
