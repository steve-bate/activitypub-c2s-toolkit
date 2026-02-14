<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { ResourceServerMetadata } from '@/stores/serverStore'
import HttpRequestPanel from '@/components/http/HttpRequestPanel.vue'
import HttpResponsePanel from '@/components/http/HttpResponsePanel.vue'

interface Props {
  server: ResourceServerMetadata
  isRefreshing: boolean
  isRevoking: boolean
  tokenError: string | null
  tokenSuccess: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'revoke'): void
  (e: 'clear-error'): void
}>()

const currentTime = ref(Date.now())
let timerInterval: ReturnType<typeof setInterval> | null = null

const tokenExpiresIn = computed(() => {
  if (!props.server.tokenResponse?.expires_in) return null

  const createdAt = props.server.tokenExchange?.timestamp

  if (!createdAt) {
    return formatExpirationTime(props.server.tokenResponse.expires_in)
  }

  let createdAtMs: number
  if (typeof createdAt === 'string') {
    createdAtMs = new Date(createdAt).getTime()
  } else {
    createdAtMs = createdAt * 1000
  }

  const expiresAtMs = createdAtMs + (props.server.tokenResponse.expires_in * 1000)
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
  <div v-if="server.tokenResponse" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Access Token</h2>
      <div class="flex gap-2">
        <button
          v-if="server.tokenResponse.refresh_token"
          @click="emit('refresh')"
          :disabled="isRefreshing"
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
        >
          <svg v-if="isRefreshing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
        </button>
        <button
          @click="emit('revoke')"
          :disabled="isRevoking"
          class="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
        >
          <svg v-if="isRevoking" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isRevoking ? 'Revoking...' : 'Revoke' }}
        </button>
      </div>
    </div>

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

    <div class="space-y-3">
      <div v-if="server.tokenResponse.access_token" class="flex items-start gap-4">
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Access Token</p>
          <p class="text-sm text-gray-900 dark:text-gray-100 break-all font-mono">{{ server.tokenResponse.access_token.substring(0, 50) }}...</p>
        </div>
      </div>
      <div v-if="server.tokenResponse.refresh_token" class="flex items-start gap-4">
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Refresh Token</p>
          <p class="text-sm text-gray-900 dark:text-gray-100 break-all font-mono">{{ server.tokenResponse.refresh_token.substring(0, 50) }}...</p>
        </div>
      </div>
      <div v-if="server.tokenResponse.expires_in" class="flex items-start gap-4">
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

    <!-- Token Exchange Details -->
    <div v-if="server.tokenExchange?.request" class="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
      <details class="group">
        <summary class="cursor-pointer list-none">
          <div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
            <svg class="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            Token Exchange Details
          </div>
        </summary>
        <div class="mt-4 space-y-4">
          <!-- Token Exchange Request Panel -->
          <HttpRequestPanel
            title="Request"
            :payload="server.tokenExchange.request"
            content-type="application/x-www-form-urlencoded"
          />

          <!-- Token Exchange Response Panel -->
          <HttpResponsePanel
            title="Response"
            :payload="server.tokenResponse"
            content-type="application/json"
          />

          <!-- Timestamp -->
          <div v-if="server.tokenExchange?.timestamp" class="text-xs text-gray-500 dark:text-gray-400">
            Token exchanged: {{ new Date(server.tokenExchange.timestamp).toLocaleString() }}
          </div>
        </div>
      </details>
    </div>
  </div>
</template>
