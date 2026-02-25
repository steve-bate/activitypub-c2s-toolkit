<script setup lang="ts">
import { computed } from 'vue'
import type { ResourceServerMetadata } from '@/stores/serverStore'
import type { HttpExchange, HttpRequestData, HttpResponseData } from '@/types/http'
import DataField from '@/components/DataField.vue'
import HttpExchangePanel from '@/components/http/HttpExchangePanel.vue'
import RefreshIcon from '@/components/icons/RefreshIcon.vue';

const props = defineProps<{
  server: ResourceServerMetadata
}>()

const emit = defineEmits<{
  load: []
  refresh: []
}>()

const nodeinfoIndexUrl = computed(() => {
  const baseUrl = props.server.auth?.oauth2?.authServerOrigin?.replace(/\/+$/, '')
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

const nodeinfoIndexExchange = computed((): HttpExchange<HttpRequestData, HttpResponseData> => ({
  success: !!props.server.nodeinfo?.index?.response?.payload,
  request: {
    url: nodeinfoIndexUrl.value || '',
    headers: { 'Accept': 'application/json' }
  },
  response: props.server.nodeinfo?.index?.response?.payload ? {
    status_code: 200,
    status_text: 'OK',
    headers: { 'Content-Type': 'application/json' },
    payload: props.server.nodeinfo?.index?.response?.payload
  } : undefined
}))

const nodeinfoDocumentExchange = computed((): HttpExchange<HttpRequestData, HttpResponseData> => ({
  success: !!props.server.nodeinfo?.data?.response?.payload,
  request: {
    url: nodeinfoDocumentUrl.value || '',
    headers: { 'Accept': 'application/json' }
  },
  response: props.server.nodeinfo?.data?.response?.payload ? {
    status_code: 200,
    status_text: 'OK',
    headers: { 'Content-Type': 'application/json' },
    payload: props.server.nodeinfo?.data?.response?.payload
  } : undefined
}))

const nodeinfoData = computed(() => props.server.nodeinfo?.data?.response?.payload)

const shouldShowProtocols = computed(() => {
  const protocols = nodeinfoData.value?.protocols
  if (!protocols || protocols.length === 0) return false
  return !(protocols.length === 1 && protocols[0]?.toLowerCase() === 'activitypub')
})

const hasServices = computed(() => {
  const inbound = nodeinfoData.value?.services?.inbound
  const outbound = nodeinfoData.value?.services?.outbound
  return Boolean((inbound && inbound.length > 0) || (outbound && outbound.length > 0))
})

const nodeName = computed(() => {
  const metadata = nodeinfoData.value?.metadata
  const value = metadata?.nodeName
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }
  return null
})

const nodeDescription = computed(() => {
  const metadata = nodeinfoData.value?.metadata
  const value = metadata?.nodeDescription
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }
  return null
})

const hasNodeMetadata = computed(() => Boolean(nodeName.value || nodeDescription.value))
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">NodeInfo</h2>
      <div class="flex gap-2">
        <button
          @click="emit('refresh')"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
        >
          <span v-if="server.nodeinfo" class="flex items-center gap-1">
            <RefreshIcon/>
            Refresh
          </span>
          <span v-else>
            Fetch
          </span>
        </button>
      </div>
    </div>

    <!-- NodeInfo Display -->
    <div v-if="server.nodeinfo?.data?.success && !server.nodeinfo?.data?.error" class="space-y-4">
      <!-- Software Name and Version -->
      <div class="grid grid-cols-2 gap-4">
        <DataField
          label="Software Name"
          :value="nodeinfoData?.software?.name"
        />
        <DataField
          label="Version"
          :value="nodeinfoData?.software?.version"
        />
      </div>

      <!-- Software Repository -->
      <DataField
        v-if="nodeinfoData?.software?.repository"
        label="Repository"
        :value="nodeinfoData?.software?.repository"
        :is-link="true"
      />

      <!-- Software Homepage -->
      <DataField
        v-if="nodeinfoData?.software?.homepage"
        label="Home Page"
        :value="nodeinfoData?.software?.homepage"
        :is-link="true"
      />

      <!-- Metadata -->
      <div v-if="hasNodeMetadata" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DataField
          label="Node Name"
          :value="nodeName"
          placeholder="No name provided"
        />
        <DataField
          label="Node Description"
          :value="nodeDescription"
          placeholder="No description provided"
        />
      </div>

      <!-- Protocols -->
      <div v-if="shouldShowProtocols">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Protocols
        </label>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="protocol in nodeinfoData?.protocols"
            :key="protocol"
            class="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium rounded"
          >
            {{ protocol }}
          </span>
        </div>
      </div>

      <!-- Services -->
      <div v-if="hasServices" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-if="nodeinfoData?.services?.inbound && nodeinfoData?.services?.inbound.length > 0">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Inbound Services
          </label>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="service in nodeinfoData?.services?.inbound"
              :key="`inbound-${service}`"
              class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium rounded"
            >
              {{ service }}
            </span>
          </div>
        </div>
        <div v-if="nodeinfoData?.services?.outbound && nodeinfoData?.services?.outbound.length > 0">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Outbound Services
          </label>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="service in nodeinfoData?.services?.outbound"
              :key="`outbound-${service}`"
              class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium rounded"
            >
              {{ service }}
            </span>
          </div>
        </div>
      </div>

      <!-- HTTP Exchange Panels -->
      <div v-if="server.nodeinfo?.data?.success" class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <HttpExchangePanel
          title="NodeInfo Index Details"
          :exchange="nodeinfoIndexExchange"
        />
        <HttpExchangePanel
          title="NodeInfo Document Details"
          :exchange="nodeinfoDocumentExchange"
        />
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
            {{ server.nodeinfo?.data?.error ?? "NodeInfo request failed" }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
