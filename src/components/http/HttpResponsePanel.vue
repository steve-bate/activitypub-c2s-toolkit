<script setup lang="ts">
import HttpHeaders from '@/components/http/HttpHeaders.vue'
import DisclosurePanel from '@/components/DisclosurePanel.vue'
import JsonCopyButton from '@/components/http/JsonCopyButton.vue'
import { 
  getNormalizedContentType,
  hasPayload as checkHasPayload,
  isJsonPayload as checkIsJsonPayload,
  getHighlightedJson as buildHighlightedJson, 
  getJsonCopyText as buildJsonCopyText 
} from '@/utils/httpJsonPayload'

interface Props {
  /** Panel title/label */
  title?: string
  /** HTTP response status code */
  statusCode?: number | null
  /** HTTP response status text */
  statusText?: string | null
  /** HTTP response headers */
  headers?: Record<string, string> | null
  /** Response body content (parsed) */
  payload?: unknown
  /** Raw response body as string */
  payloadRaw?: string | null
  /** Content-Type header value */
  contentType?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  title: 'HTTP Response',
  status: null,
  statusText: null,
  headers: null,
  payload: undefined,
  payloadRaw: null,
  contentType: null
})

const getStatusLabel = () => {
  if (props.statusCode === null || props.statusCode === undefined) return 'No status'
  const suffix = props.statusText ? ` ${props.statusText}` : ''
  return `${props.statusCode}${suffix}`
}

const getStatusClass = () => {
  if (props.statusCode === null || props.statusCode === undefined) return 'text-gray-500 dark:text-gray-400'
  if (props.statusCode >= 200 && props.statusCode < 300) return 'text-green-600 dark:text-green-400'
  if (props.statusCode >= 300 && props.statusCode < 400) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

const hasPayload = () => checkHasPayload(props.payload, props.payloadRaw)

const isJsonPayload = () => checkIsJsonPayload(props.payload, props.contentType, props.headers)

const getPayloadLabel = () => {
  if (isJsonPayload()) return 'JSON'
  if (getNormalizedContentType(props.contentType, props.headers).includes('text/')) return 'Text'
  return 'Body'
}

const getHighlightedJson = () => buildHighlightedJson(props.payload, props.contentType, props.headers)

const getJsonCopyText = () => buildJsonCopyText(props.payload, props.contentType, props.headers, props.payloadRaw)

const getFormattedText = () => {
  if (!hasPayload() || isJsonPayload()) return ''
  if (typeof props.payload === 'string') return props.payload
  if (props.payloadRaw) return props.payloadRaw
  if (props.payload === null || props.payload === undefined) return ''
  return JSON.stringify(props.payload)
}
</script>

<template>
  <DisclosurePanel :label="title">
    <template #label-extra>
        <span class="text-xs font-mono font-semibold ml-3" :class="getStatusClass()">{{ getStatusLabel() }}</span>
    </template>
    <div>
      <div class="mb-2">
        <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Headers</div>
        <HttpHeaders :headers="headers" />
      </div>
      <div>
        <div v-if="hasPayload()" class="flex items-center justify-between mb-2">
          <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Payload</div>
          <JsonCopyButton v-if="isJsonPayload()" :text="getJsonCopyText()" />
        </div>
        <div v-if="hasPayload() && !isJsonPayload()" class="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {{ getPayloadLabel() }}
        </div>
        <div v-if="hasPayload()">
          <pre v-if="isJsonPayload()" class="text-xs font-mono whitespace-pre-wrap break-words" v-html="getHighlightedJson()"></pre>
          <pre v-else class="text-xs font-mono whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">{{ getFormattedText() }}</pre>
        </div>
      </div>
    </div>
  </DisclosurePanel>
</template>
