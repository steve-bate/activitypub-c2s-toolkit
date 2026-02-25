<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ResourceServerMetadata } from '@/stores/serverStore'
import { useServerStore } from '@/stores/serverStore'
import { initiateAuthorizationFlow } from '@/services/authorizationService'
import CopyIcon from '@/components/icons/CopyIcon.vue'
import RunningIcon from '@/components/icons/RunningIcon.vue'
import RefreshIcon from '../icons/RefreshIcon.vue'
import DataPanel from '@/components/DataPanel.vue'
import DataField from '@/components/DataField.vue'

interface Props {
  server: ResourceServerMetadata
}

const props = defineProps<Props>()

const serverStore = useServerStore()

const isAuthorizing = ref(false)
const authError = ref<string | null>(null)
const discoveredMetadata = computed(() =>
  props.server.auth?.oauth2?.authServerDiscovery?.authorizationServerMetadata ??
  props.server.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload
)

const canAuthorize = computed(() => {
  return discoveredMetadata.value?.authorization_endpoint &&
         props.server.auth?.oauth2?.clientConfig?.clientId &&
         props.server.auth?.oauth2?.clientConfig?.redirectUri
})

const hasAuthCode = computed(() => {
  return !!props.server.auth?.oauth2?.authCode
})

async function handleAuthorize() {
  if (!canAuthorize.value) return

  isAuthorizing.value = true
  authError.value = null

  const metadata = discoveredMetadata.value
  const clientConfig = props.server.auth?.oauth2?.clientConfig

  if (!metadata || !clientConfig) return

  try {
    await initiateAuthorizationFlow({
      serverOrigin: props.server.id,
      serverMetadata: metadata,
      clientConfig: clientConfig
    })
    // Redirects on success — code below this point is not reached
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Failed to initiate authorization'
    isAuthorizing.value = false
  }
}

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text)
}

async function handleReauthorize() {
  if (!canAuthorize.value) return

  serverStore.clearOAuthToken(props.server.id)
  await new Promise(resolve => setTimeout(resolve, 100))
  await handleAuthorize()
}
</script>

<template>
  <DataPanel>
    <template #header>
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Client Authorization</h3>
    </template>

    <template #header-action>
      <div class="flex items-center gap-2">
        <button
          v-if="!hasAuthCode"
          @click="handleAuthorize"
          :disabled="!canAuthorize || isAuthorizing"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
        >
          <RunningIcon v-if="isAuthorizing" />
          {{ isAuthorizing ? 'Authorizing...' : 'Authorize' }}
        </button>
        <template v-else>
          <span class="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm font-medium rounded-md flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Authorization Code Received
          </span>
          <button
            @click="handleReauthorize"
            :disabled="!canAuthorize || isAuthorizing"
            class="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
            title="Clear current authorization and restart the OAuth flow"
          >
            <RunningIcon v-if="isAuthorizing" />
            <RefreshIcon v-else/>
            {{ isAuthorizing ? 'Refreshing...' : 'Refresh' }}
          </button>
        </template>
      </div>
    </template>

    <!-- Error Message -->
    <div v-if="authError" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-red-800 dark:text-red-200">Authorization failed</p>
          <p class="text-xs text-red-700 dark:text-red-300 mt-1">{{ authError }}</p>
        </div>
        <button @click="authError = null" class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Not Ready Message -->
    <div v-if="!canAuthorize && !hasAuthCode" class="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <div>
          <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">Prerequisites not met</p>
          <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
            Please ensure:
            <span v-if="!discoveredMetadata?.authorization_endpoint"> Authorization server metadata is discovered.</span>
            <span v-if="!server.auth?.oauth2?.clientRegistration?.exchange?.response?.payload?.client_id"> Client is registered.</span>
            <span v-if="!server.auth?.oauth2?.clientConfig?.redirectUri"> Redirect URI is configured.</span>
          </p>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <!-- Authorization Endpoint -->
      <div v-if="discoveredMetadata?.authorization_endpoint">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Authorization Endpoint</label>
        <div class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
            {{ discoveredMetadata?.authorization_endpoint }}
          </code>
          <button
            @click="copyToClipboard(discoveredMetadata?.authorization_endpoint)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Copy to clipboard"
          >
            <CopyIcon class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Authorization Code -->
      <div v-if="server.auth?.oauth2?.authCode">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Authorization Code</label>
        <div class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
            {{ server.auth?.oauth2?.authCode }}
          </code>
          <button
            @click="copyToClipboard(server.auth?.oauth2?.authCode)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Copy to clipboard"
          >
            <CopyIcon class="w-4 h-4" />
          </button>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          This authorization code can be exchanged for an access token.
        </p>
      </div>

      <!-- Client Configuration -->
      <div v-if="server.auth?.oauth2?.clientConfig?.clientId" class="grid grid-cols-1 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client ID</label>
          <code class="block px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
            {{ server.auth?.oauth2?.clientConfig?.clientId }}
          </code>
        </div>

        <div v-if="server.auth?.oauth2?.clientConfig?.redirectUri">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Redirect URIs</label>
          <code class="block px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
            {{ server.auth?.oauth2?.clientConfig?.redirectUri }}
          </code>
        </div>

        <div v-if="server.auth?.oauth2?.clientConfig?.scopes">
          <DataField
            label="Requested Scopes"
            :value="server.auth?.oauth2?.clientConfig?.scopes"
            :copyable="true"
          />
        </div>
      </div>
    </div>

  </DataPanel>
</template>

