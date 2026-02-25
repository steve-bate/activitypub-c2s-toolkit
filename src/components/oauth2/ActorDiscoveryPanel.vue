<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ResourceServerMetadata } from '@/stores/serverStore'
import { formatJson, syntaxHighlightJson } from '@/utils/jsonHighlighter'
import { tryDecodeJWT } from '@/utils/jwt'
import DataPanel from '@/components/DataPanel.vue'
import HttpExchangePanel from '@/components/http/HttpExchangePanel.vue'
import RefreshIcon from '../icons/RefreshIcon.vue'
import RunningIcon from '../icons/RunningIcon.vue'

interface Props {
  server: ResourceServerMetadata
  isRefreshingActor: boolean
  actorError: string | null
  actorSuccess: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'discover'): void
  (e: 'refresh'): void
  (e: 'clear-error'): void
}>()

const showJwtClaims = ref(false)

const tokenExchange = computed(() => props.server.auth?.oauth2?.tokenExchange)
const tokenPayload = computed(() => tokenExchange.value?.response?.payload)

const actorDiscovery = computed(() => props.server.actor?.discovery)
const actorExchange = computed(() => actorDiscovery.value?.actorFetchExchange || actorDiscovery.value?.mastodonExchange)

const decodedJwtClaims = computed(() => {
  if (!tokenPayload.value?.access_token) return null
  return tryDecodeJWT(tokenPayload.value.access_token)
})

const highlightedJwtClaims = computed(() => {
  if (!tokenPayload.value?.access_token) return ''
  const claims = decodedJwtClaims.value
  if (!claims) return ''
  return syntaxHighlightJson(formatJson(claims))
})

const discoveryMethodBadgeLabel: Record<string, string> = {
  'token_response': 'Token Response (me)',
  'introspection': 'Introspection (me)',
  'verify_credentials': 'Mastodon',
  'jwt': 'JWT',
}

function formatDiscoveryMethod(method?: string): string {
  const methodMap: Record<string, string> = {
    'token_response': 'Token Response (me property)',
    'introspection': 'RFC 7662 Token Introspection',
    'verify_credentials': 'Mastodon verify_credentials',
    'jwt': 'JWT Token Claims'
  }
  return method ? methodMap[method] : 'Unknown'
}

function copyToClipboard(text: string) {
 void  navigator.clipboard.writeText(text)
}

function copyDecodedJwtClaims() {
  if (!decodedJwtClaims.value) return
  copyToClipboard(formatJson(decodedJwtClaims.value))
}
</script>

<template>
  <div v-if="tokenPayload && 'access_token' in tokenPayload">
    <DataPanel>
      <template #header>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Actor Discovery</h2>
        <span
          v-if="server.actor?.discovery.success"
          class="px-2.5 py-1 rounded-full text-xs font-semibold"
          :class="{
            'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200': server.actor.discovery.method === 'token_response',
            'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200': server.actor.discovery.method === 'introspection',
            'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200': server.actor.discovery.method === 'verify_credentials',
            'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200': server.actor.discovery.method === 'jwt',
          }"
          :title="`Discovered via: ${formatDiscoveryMethod(server.actor.discovery.method)}`"
        >
          {{ discoveryMethodBadgeLabel[server.actor.discovery.method ?? ''] ?? 'Unknown' }}
        </span>
      </template>

      <template #header-action>
        <button
          v-if="server.actor?.discovery.success"
          @click="emit('refresh')"
          :disabled="isRefreshingActor || !tokenPayload?.access_token"
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
        >
          <RunningIcon v-if="isRefreshingActor"/>
          <RefreshIcon v-else/>
          {{ isRefreshingActor ? (actorError ? 'Retrying...' : 'Refreshing...') : (actorError ? 'Retry' : 'Refresh') }}
        </button>
      </template>

      <!-- Success Message -->
      <div v-if="actorSuccess" class="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div class="flex items-start gap-2">
          <svg class="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="text-sm font-medium text-green-800 dark:text-green-200">{{ actorSuccess }}</p>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="actorError" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div class="flex items-start gap-2">
          <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="flex-1 text-sm font-medium text-red-800 dark:text-red-200">{{ actorError }}</p>
          <button @click="emit('clear-error')" class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Pre-discovery state -->
      <template v-if="!server.actor?.discovery.success">
        <HttpExchangePanel v-if="actorExchange" :exchange="actorExchange" title="HTTP Exchange Details" />
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Click the button below to discover actor information from the authorization server.
        </p>
        <button
          @click="emit('discover')"
          :disabled="isRefreshingActor"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
        >
          <RunningIcon v-if="isRefreshingActor"/>
          {{ isRefreshingActor ? 'Discovering...' : 'Discover' }}
        </button>
      </template>

      <!-- Post-discovery state -->
      <template v-else>
        <div class="space-y-3">
          <!-- Actor URI -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actor URI</label>
            <div class="flex items-center gap-2">
              <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                {{ server.actor.profile.id }}
              </code>
              <button
                :disabled="!server.actor.profile.id"
                @click="copyToClipboard(server.actor.profile.id!)"
                class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                title="Copy to clipboard"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- JWT Claims Panel -->
          <div v-if="server.actor.discovery.method === 'jwt' && showJwtClaims && highlightedJwtClaims" class="bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex justify-between items-center mb-2">
              <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100">JWT Claims</h4>
              <button
                @click="copyDecodedJwtClaims"
                class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1"
                title="Copy JSON to clipboard"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                Copy JSON
              </button>
            </div>
            <pre class="text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto" v-html="highlightedJwtClaims"></pre>
          </div>
        </div>
      </template>
    </DataPanel>
  </div>
</template>
