<script setup lang="ts">
import HttpHeaders from '@/components/http/HttpHeaders.vue'
import DisclosurePanel from '@/components/DisclosurePanel.vue'
import QueryParametersTable from '@/components/http/QueryParametersTable.vue'
import JsonCopyButton from '@/components/http/JsonCopyButton.vue'
import { HTTP_CONSTANTS } from '@/constants/http'
import { 
  getNormalizedContentType, 
  hasPayload as checkHasPayload, 
  isJsonPayload as checkIsJsonPayload,
  getHighlightedJson as buildHighlightedJson, 
  getJsonCopyText as buildJsonCopyText 
} from '@/utils/httpJsonPayload'
import { computed } from 'vue'

const { CONTENT_TYPES } = HTTP_CONSTANTS;

interface Props {
  /** Panel title/label */
  title?: string
  /** HTTP request headers */
  headers?: Record<string, string> | null
  /** Full request URL */
  url?: string | null
  /** Query string parameters */
  queryParams?: Record<string, string> | null
  /** Request body content */
  payload?: unknown
  /** Content-Type header value */
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

const hasPayload = computed(() => checkHasPayload(props.payload))

const isJsonPayload = computed(() => checkIsJsonPayload(props.payload, props.contentType, props.headers))

const isFormPayload = computed(() => {
  if (!hasPayload.value) return false
  const normalizedContentType = getNormalizedContentType(props.contentType, props.headers)
  return normalizedContentType.includes(CONTENT_TYPES.FORM_URLENCODED) ||
    normalizedContentType.includes(CONTENT_TYPES.FORM_MULTIPART)
})

const payloadLabel = computed(() => {
  if (isJsonPayload.value) return 'JSON'
  if (isFormPayload.value) return 'Form'
  return 'Text'
})

const getHighlightedJson = () => buildHighlightedJson(props.payload, props.contentType, props.headers)

const getJsonCopyText = () => buildJsonCopyText(props.payload, props.contentType, props.headers)

const getFormattedForm = () => {
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
}

const getFormattedText = () => {
  if (!hasPayload.value || isJsonPayload.value || isFormPayload.value) return ''
  if (typeof props.payload === 'string') return props.payload
  return String(props.payload)
}
</script>

<template>
  <DisclosurePanel :label="title">
    <div>
      <div>
        <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Request URL</div>
        <div v-if="url" class="text-xs font-mono text-gray-800 dark:text-gray-200 break-all mb-2">{{ url }}</div>
        <div v-else class="text-xs text-gray-500 dark:text-gray-400 italic">No URL captured</div>
      </div>
      <QueryParametersTable :query-params="queryParams" />
      <div>
        <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Headers</div>
        <HttpHeaders :headers="headers" />
      </div>
      <div>
        <div v-if="hasPayload" class="flex items-center justify-between mb-2">
          <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mt-2">Payload</div>
          <JsonCopyButton v-if="isJsonPayload" :text="getJsonCopyText()" :disabled="!getJsonCopyText()" />
        </div>
        <div v-if="hasPayload && !isJsonPayload" class="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {{ payloadLabel }}
        </div>
        <div v-if="hasPayload">
          <pre v-if="isJsonPayload" class="text-xs font-mono whitespace-pre-wrap break-words" v-html="getHighlightedJson()"></pre>
          <pre v-else-if="isFormPayload" class="text-xs font-mono whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">{{ getFormattedForm() }}</pre>
          <pre v-else class="text-xs font-mono whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">{{ getFormattedText() }}</pre>
        </div>
      </div>
    </div>
  </DisclosurePanel>
</template>
