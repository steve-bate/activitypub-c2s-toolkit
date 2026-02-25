<script setup lang="ts">
import HttpRequestPanel from '@/components/http/HttpRequestPanel.vue'
import HttpResponsePanel from '@/components/http/HttpResponsePanel.vue'
import DisclosureIcon from '@/components/icons/DisclosureIcon.vue'
import type { HttpExchange, HttpRequestData, HttpResponseData } from '@/types/http'

interface Props {
  title?: string
  exchange: HttpExchange<HttpRequestData, HttpResponseData>
}

withDefaults(defineProps<Props>(), {
  title: 'HTTP Exchange Details',
})
</script>

<template>
  <details class="group">
    <summary class="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-200 select-none">
      <DisclosureIcon class="w-4 h-4 transition-transform group-open:rotate-90" />
      <span>{{ title }}</span>
    </summary>
    <div class="mt-4 space-y-4">
      <HttpRequestPanel
        title="Request"
        :url="exchange.request?.url"
        :headers="exchange.request?.headers"
        :payload="exchange.request?.params"
      />
      <HttpResponsePanel
        title="Response"
        v-if="exchange.response"
        :statusCode="exchange.response.status_code"
        :statusText="exchange.response.status_text || '(Unknown)'"
        :headers="exchange.response.headers"
        :payload="exchange.response.payload"
      />
      <slot />
    </div>
  </details>
</template>
