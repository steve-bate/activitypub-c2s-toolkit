<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatJson, syntaxHighlightJson } from '@/utils/jsonHighlighter'
import HttpHeaders from '@/components/http/HttpHeaders.vue'
import CopyIcon from '@/components/icons/CopyIcon.vue'

interface Props {
  title?: string
  status?: number | null
  statusText?: string | null
  headers?: Record<string, string> | null
  payload?: unknown
  payloadRaw?: string | null
  contentType?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  title: 'HTTP Response',
  status: null,
  statusText: null,
  headers: null,
  payload: null,
  payloadRaw: null,
  contentType: null
})

const isOpen = ref(false)
const copyState = ref<'idle' | 'copied' | 'error'>('idle')

const statusLabel = computed(() => {
  if (props.status === null || props.status === undefined) return 'No status'
  const suffix = props.statusText ? ` ${props.statusText}` : ''
  return `${props.status}${suffix}`
})

const statusClass = computed(() => {
  if (props.status === null || props.status === undefined) return 'text-gray-500 dark:text-gray-400'
  if (props.status >= 200 && props.status < 300) return 'text-green-600 dark:text-green-400'
  if (props.status >= 300 && props.status < 400) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
})

const headerContentType = computed(() => {
  if (!props.headers) return ''
  const entry = Object.entries(props.headers).find(([key]) => key.toLowerCase() === 'content-type')
  return entry ? entry[1] : ''
})

const normalizedContentType = computed(() => {
  return (props.contentType || headerContentType.value || '').toLowerCase()
})

const hasPayload = computed(() => {
  if (props.payload === null || props.payload === undefined) {
    return !!(props.payloadRaw && props.payloadRaw.length > 0)
  }
  if (typeof props.payload === 'string') return props.payload.length > 0
  return true
})

const isJsonPayload = computed(() => {
  if (!hasPayload.value) return false
  if (normalizedContentType.value.includes('json')) return true
  if (props.payload && typeof props.payload === 'object') return true
  return false
})

const payloadLabel = computed(() => {
  if (isJsonPayload.value) return 'JSON'
  if (normalizedContentType.value.includes('text/')) return 'Text'
  return 'Body'
})

const highlightedJson = computed(() => {
  if (!isJsonPayload.value) return ''
  return syntaxHighlightJson(formatJson(props.payload as object))
})

const jsonCopyText = computed(() => {
  if (!isJsonPayload.value) return ''
  if (typeof props.payload === 'string') return props.payload
  if ((props.payload === null || props.payload === undefined) && props.payloadRaw) return props.payloadRaw
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

const formattedText = computed(() => {
  if (!hasPayload.value || isJsonPayload.value) return ''
  if (typeof props.payload === 'string') return props.payload
  if (props.payloadRaw) return props.payloadRaw
  if (props.payload === null || props.payload === undefined) return ''
  return String(props.payload)
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <button
      @click="isOpen = !isOpen"
      class="w-full px-4 py-3 flex items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-gray-50 dark:bg-gray-800"
    >
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': isOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
        <span class="font-medium text-gray-900 dark:text-white">{{ title }}</span>
        <span class="text-xs font-mono font-semibold ml-3" :class="statusClass">{{ statusLabel }}</span>
      </div>
    </button>
    <div v-if="isOpen" class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 space-y-4">
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
          <pre v-else class="text-xs font-mono whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">{{ formattedText }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
