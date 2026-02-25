<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { ResourceServerMetadata } from '@/stores/serverStore'
import type { TokenResponsePayload } from '@/services/authorizationService'
import DataPanel from '@/components/DataPanel.vue'
import HttpExchangePanel from '@/components/http/HttpExchangePanel.vue'
import RefreshIcon from '../icons/RefreshIcon.vue'
import RunningIcon from '../icons/RunningIcon.vue'

interface Props {
  server: ResourceServerMetadata
  isRefreshing: boolean
  isRevoking: boolean
  tokenError: string | null
  tokenSuccess: string | null
}

const props = defineProps<Props>()

const tokenExchange = computed(() => props.server.auth?.oauth2?.tokenExchange)
const tokenResponse = computed((): TokenResponsePayload | null => {
  const exchange = tokenExchange.value
  if (!exchange?.response) return null
  // Check if response has payload property (HttpResponseData structure)
  if ('payload' in exchange.response) {
    const payload = exchange.response.payload
    // Only return if it's a TokenResponsePayload (has access_token, not revoked)
    if (payload && typeof payload === 'object' && 'access_token' in payload && !('revoked' in payload)) {
      return payload
    }
  }
  return null
})
const isRevoked = computed(() => {
  const exchange = tokenExchange.value
  if (!exchange?.response) return false
  if ('payload' in exchange.response) {
    const payload = exchange.response.payload
    return payload && typeof payload === 'object' && 'revoked' in payload && (payload as { revoked: boolean }).revoked === true
  }
  return false
})

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'revoke'): void
  (e: 'clear-error'): void
}>()

const currentTime = ref(Date.now())
let timerInterval: ReturnType<typeof setInterval> | null = null

const tokenExpiresIn = computed(() => {
  if (!tokenResponse.value?.expires_in) return null

  const createdAt = props.server.auth?.oauth2?.tokenExchange?.request?.timestamp

  if (!createdAt) {
    return formatExpirationTime(tokenResponse.value.expires_in)
  }

  let createdAtMs: number
  if (typeof createdAt === 'string') {
    createdAtMs = new Date(createdAt).getTime()
  } else {
    createdAtMs = createdAt * 1000
  }

  const expiresAtMs = createdAtMs + (tokenResponse.value.expires_in * 1000)
  const remainingMs = expiresAtMs - currentTime.value

  if (remainingMs <= 0) {
    return 'Expired'
  }

  const remainingSeconds = Math.floor(remainingMs / 1000)
  return formatExpirationTime(remainingSeconds)
})

function formatExpirationTime(seconds: number): string {
  if (seconds <= 0) return 'Expired'

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)

  return parts.join(' ')
}

onMounted(() => {
  timerInterval = setInterval(() => {
    currentTime.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval)
  }
})
</script>

<template>
  <DataPanel v-if="tokenExchange">
    <template #header>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Access Token</h2>
    </template>
    <template #header-action>
      <div v-if="tokenResponse" class="flex gap-2">
        <button
          v-if="tokenResponse.refresh_token"
          @click="emit('refresh')"
          :disabled="isRefreshing"
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
        >
          <RunningIcon v-if="isRefreshing"/>
          <RefreshIcon v-else/>
          {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
        </button>
        <button
          @click="emit('revoke')"
          :disabled="isRevoking"
          class="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
        >
          <RunningIcon v-if="isRevoking"/>
          {{ isRevoking ? 'Revoking...' : 'Revoke' }}
        </button>
      </div>
    </template>

    <!-- Success Message -->
    <div v-if="tokenSuccess" class="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p class="text-sm font-medium text-green-800 dark:text-green-200">
          {{ tokenSuccess }}
        </p>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="tokenError" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-red-800 dark:text-red-200">
            {{ tokenError }}
          </p>
        </div>
        <button @click="emit('clear-error')" class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Revoked Token Message -->
    <div v-if="isRevoked" class="mb-4 p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg text-center">
      <svg class="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
      </svg>
      <h3 class="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">Token Revoked</h3>
      <p class="text-sm text-red-700 dark:text-red-300">
        This access token has been revoked. Re-authorize to obtain a new token.
      </p>
    </div>

    <div v-if="tokenResponse && !isRevoked" class="space-y-3">
      <div v-if="tokenResponse.access_token" class="flex items-start gap-4">
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Access Token</p>
          <p class="text-sm text-gray-900 dark:text-gray-100 break-all font-mono">{{ tokenResponse.access_token.substring(0, 50) }}...</p>
        </div>
      </div>
      <div v-if="tokenResponse.refresh_token" class="flex items-start gap-4">
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Refresh Token</p>
          <p class="text-sm text-gray-900 dark:text-gray-100 break-all font-mono">{{ tokenResponse.refresh_token.substring(0, 50) }}...</p>
        </div>
      </div>
      <div v-if="tokenResponse.expires_in" class="flex items-start gap-4">
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Expires In</p>
          <div v-if="tokenExpiresIn === 'Expired'" class="inline-block px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full text-sm font-semibold">
            ⚠ EXPIRED
          </div>
          <p v-else class="text-sm text-gray-900 dark:text-gray-100">
            {{ tokenExpiresIn }}
          </p>
        </div>
      </div>
    </div>

    <template #footer v-if="tokenResponse">
      <HttpExchangePanel v-if="tokenExchange?.request" :exchange="tokenExchange" title="Token Exchange Details">
        <div v-if="tokenExchange.request?.timestamp" class="text-xs text-gray-500 dark:text-gray-400">
          Token exchanged: {{ new Date(tokenExchange.request.timestamp).toLocaleString() }}
        </div>
      </HttpExchangePanel>
    </template>
  </DataPanel>
</template>
