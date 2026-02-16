<script setup lang="ts">
import { computed } from 'vue'
import type { ResourceServerMetadata } from '@/stores/serverStore'
import HttpRequestPanel from '@/components/http/HttpRequestPanel.vue'
import HttpResponsePanel from '@/components/http/HttpResponsePanel.vue'

const props = defineProps<{
  server: ResourceServerMetadata
}>()

const emit = defineEmits<{
  load: []
  refresh: []
}>()

const nodeinfoIndexUrl = computed(() => {
  const baseUrl = props.server.baseUrl?.replace(/\/+$/, '')
  if (!baseUrl) return null
  return `${baseUrl}/.well-known/nodeinfo`
})

const nodeinfoDocumentUrl = computed(() => {
  const index = props.server.nodeinfo?.index?.response?.payload
  if (!index?.links?.length) return null
  const links = index.links.filter(link =>
    link.rel?.startsWith('http://nodeinfo.diaspora.software/ns/schema/')
  )
  if (!links.length) return null
  const v21 = links.find(link => link.rel.includes('/2.1'))
  if (v21) return v21.href
  const v20 = links.find(link => link.rel.includes('/2.0'))
  if (v20) return v20.href
  return links[links.length - 1].href
})

const nodeinfoRequestHeaders = computed(() => ({
  'Accept': 'application/json'
}))

const nodeinfoResponseHeaders = computed(() => ({
  'Content-Type': 'application/json'
}))

const nodeinfoIndexStatus = computed(() => (props.server.nodeinfo?.index?.response?.payload ? 200 : null))
const nodeinfoDocumentStatus = computed(() => (props.server.nodeinfo ? 200 : null))
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Server Metadata</h2>
      <div class="flex gap-2">
        <button
          @click="emit('refresh')"
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
          :title="server.nodeinfo ? 'Refresh NodeInfo' : 'Fetch NodeInfo'"
        >
          {{ server.nodeinfo ? 'Refresh' : 'Fetch' }}
        </button>
      </div>
    </div>

    <!-- NodeInfo Display -->
    <div v-if="server.nodeinfo?.data?.success && !server.nodeinfo?.data?.error" class="space-y-4">
      <!-- Software Name and Version -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Software Name
          </label>
          <div class="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-900 dark:text-gray-100">
            {{ server.nodeinfo?.data?.response?.payload?.software?.name }}
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Version
          </label>
          <div class="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-900 dark:text-gray-100">
            {{ server.nodeinfo?.data?.response?.payload?.software?.version }}
          </div>
        </div>
      </div>

      <!-- Protocols -->
      <div v-if="server.nodeinfo?.data?.response?.payload?.protocols && server.nodeinfo?.data?.response?.payload?.protocols.length > 0">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Protocols
        </label>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="protocol in server.nodeinfo?.data?.response?.payload?.protocols"
            :key="protocol"
            class="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium rounded"
          >
            {{ protocol }}
          </span>
        </div>
      </div>

      <!-- HTTP Exchange Panels -->
      <div v-if="server.nodeinfo?.data?.success" class="pt-4 border-t border-gray-200 dark:border-gray-700">
        <details class="group">
          <summary class="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-200 select-none">
            <svg class="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            <span>NodeInfo Details</span>
          </summary>
          <div class="mt-4 space-y-6">
            <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">NodeInfo Index</div>
            <HttpRequestPanel
              title="NodeInfo Index Request"
              :headers="nodeinfoRequestHeaders"
              :url="nodeinfoIndexUrl"
            />
            <HttpResponsePanel
              title="NodeInfo Index Response"
              :status="nodeinfoIndexStatus"
              status-text="OK"
              :headers="nodeinfoResponseHeaders"
              :payload="server.nodeinfo?.index?.response?.payload"
              content-type="application/json"
            />

            <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">NodeInfo Document</div>
            <HttpRequestPanel
              title="NodeInfo Document Request"
              :headers="nodeinfoRequestHeaders"
              :url="nodeinfoDocumentUrl"
            />
            <HttpResponsePanel
              title="NodeInfo Document Response"
              :status="nodeinfoDocumentStatus"
              status-text="OK"
              :headers="nodeinfoResponseHeaders"
              :payload="server.nodeinfo.data?.response?.payload"
              content-type="application/json"
            />
          </div>
        </details>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="!server.nodeinfo?.data?.success" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-red-800 dark:text-red-200">
            {{ server.nodeinfo?.data?.error ?? "NodeInfo fetch failed" }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
