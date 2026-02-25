<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'
import { useSettingsStore } from '@/stores/settingsStore'
import AuthServerMetadataPanel from '@/components/oauth2/AuthServerMetadataPanel.vue'
import ClientRegistrationPanel from '@/components/oauth2/ClientRegistrationPanel.vue'
import ClientAuthorizationPanel from '@/components/oauth2/ClientAuthorizationPanel.vue'
import AccessTokenPanel from '@/components/oauth2/AccessTokenPanel.vue'
import ActorDiscoveryPanel from '@/components/oauth2/ActorDiscoveryPanel.vue'
import { useAuthFlow } from '@/composables/useAuthFlow'

const router = useRouter()
const route = useRoute()
const serverStore = useServerStore()
const settingsStore = useSettingsStore()

const serverId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? id[0] : id
})

const server = computed(() => {
  return serverStore.servers.find(s => s.id === serverId.value)
})

const tokenExchange = computed(() => server.value?.auth?.oauth2?.tokenExchange)
const tokenResponse = computed(() => tokenExchange.value?.response?.payload)

// Auth flow composable – manages all five OAuth2 steps with reactive state
const authFlow = useAuthFlow(serverId.value)

// AutoRun setting (persisted in settingsStore)
const autoRun = computed({
  get: () => settingsStore.settings.oauth2AutoRun,
  set: (v: boolean) => settingsStore.setOAuth2AutoRun(v),
})

// Section visibility: show a panel once its prerequisites are met OR it already has data
const showAuthDiscoverySection = computed(() =>
  authFlow.prerequisites.value.authServerMetadata ||
  !!server.value?.auth?.oauth2?.authServerDiscovery
)
const showRegistrationSection = computed(() =>
  authFlow.state.authServerMetadata.status === 'success' ||
  !!server.value?.auth?.oauth2?.clientRegistration ||
  !!server.value?.auth?.oauth2?.clientConfig?.clientId
)
const showAuthSection = computed(() =>
  authFlow.state.clientRegistration.status === 'success' ||
  !!server.value?.auth?.oauth2?.clientConfig?.clientId ||
  !!tokenResponse.value
)

// Next blocked step: the first step whose prerequisite is NOT yet satisfied and has not succeeded
const nextBlockedStep = computed<{ label: string; description: string } | null>(() => {
  const pr = authFlow.prerequisites.value
  const st = authFlow.state

  if (st.authServerMetadata.status !== 'success' && !pr.authServerMetadata)
    return { label: 'Auth Server Metadata Discovery', description: 'Requires an Authorization Server Origin to be configured for this server.' }
  if (st.clientRegistration.status !== 'success' && !pr.clientRegistration)
    return { label: 'Client Registration', description: 'Requires Auth Server Metadata discovery to complete successfully (Step 1).' }
  if (st.authorization.status !== 'success' && !pr.authorization)
    return { label: 'Authorization', description: 'Requires Client Registration to complete successfully (Step 2).' }
  if (!tokenResponse.value && !pr.tokenExchange)
    return { label: 'Token Exchange', description: 'Requires the Authorization redirect and callback to complete (Step 3).' }
  if (st.actorDiscovery.status !== 'success' && !pr.actorDiscovery)
    return { label: 'Actor Discovery', description: 'Requires an Access Token to be available (Step 4).' }
  return null
})

// Set active server when component mounts and trigger auto-advance
onMounted(() => {
  if (serverId.value && serverId.value !== 'new') {
    serverStore.setActiveServer(serverId.value)
    void authFlow.autoAdvance()
  }
})

// Watch for activeServerId changes and navigate if needed (e.g., from header dropdown)
watch(
  () => serverStore.activeServerId,
  (newActiveId) => {
    if (newActiveId && serverId.value && newActiveId !== serverId.value && route.name === 'server-auth') {
      void router.push(`/servers/${newActiveId}/auth`)
    }
  }
)

// ---- Token management (presentation-level actions, not part of the OAuth flow steps) ----

const actorErrorDisplay = computed(() =>
  authFlow.state.actorDiscovery.status === 'error'
    ? (authFlow.state.actorDiscovery.error ?? 'Actor discovery error')
    : null
)

/**
 * Confirm revocation with the user, then delegate to authflow.
 */
function handleRevokeToken() {
  if (!confirm('Are you sure you want to revoke this access token? You will need to authorize again.')) return
  void authFlow.revokeAccessToken()
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
    <div v-if="!server" class="max-w-2xl mx-auto px-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
        <p class="text-gray-600 dark:text-gray-400">Server not found</p>
        <button
          @click="router.push('/servers')"
          class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          Back to Servers
        </button>
      </div>
    </div>

    <div v-else class="max-w-4xl mx-auto px-4 space-y-8">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            <span v-if="server.nodeinfo?.data?.response?.payload?.metadata?.nodeName">
              OAuth2 Flow: {{ server.nodeinfo?.data?.response?.payload?.metadata?.nodeName }}
            </span>
            <span v-else>
              OAuth2 Flow
            </span>
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-2"><a target="_blank" rel="noopener noreferrer" :href="server.auth?.oauth2?.authServerOrigin">{{ server.auth?.oauth2?.authServerOrigin }}</a></p>
        </div>
        <div class="flex flex-col items-end gap-3">
          <!-- Auth status badge -->
          <div v-if="server.auth?.authStatus === 'authorized'" class="inline-block px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
            ✓ Authorized
          </div>
          <div v-else-if="server.auth?.authStatus === 'configured'" class="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
            ⚙ Configured
          </div>
          <!-- AutoRun toggle -->
          <label class="flex items-center gap-2 cursor-pointer select-none" title="When enabled, each step runs automatically once its prerequisites are satisfied">
            <span class="text-sm text-gray-600 dark:text-gray-400">Auto-Run</span>
            <button
              type="button"
              role="switch"
              :aria-checked="autoRun"
              @click="autoRun = !autoRun"
              class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              :class="autoRun ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'"
            >
              <span
                class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
                :class="autoRun ? 'translate-x-4' : 'translate-x-1'"
              />
            </button>
          </label>
        </div>
      </div>

      <!-- Authorization Server Metadata Section -->
      <AuthServerMetadataPanel v-if="showAuthDiscoverySection" :server="server" />

      <!-- Client Registration Section -->
      <ClientRegistrationPanel v-if="showRegistrationSection" :server="server"
        @retry-registration="authFlow.runRegisterClient" />

      <!-- Client Authorization Section -->
      <ClientAuthorizationPanel v-if="showAuthSection" :server="server" />

      <AccessTokenPanel
        v-if="tokenResponse"
        :server="server"
        :is-refreshing="authFlow.tokenActionState.isRefreshing"
        :is-revoking="authFlow.tokenActionState.isRevoking"
        :token-error="authFlow.tokenActionState.error"
        :token-success="authFlow.tokenActionState.success"
        @refresh="authFlow.refreshToken"
        @revoke="handleRevokeToken"
        @clear-error="authFlow.clearTokenActionStatus"
      />

      <ActorDiscoveryPanel
        v-if="tokenResponse"
        :server="server"
        :is-refreshing-actor="authFlow.state.actorDiscovery.status === 'running'"
        :actor-error="actorErrorDisplay"
        :actor-success="null"
        @discover="authFlow.runDiscoverActor"
        @refresh="authFlow.runDiscoverActor"
      />

      <!-- Next blocked step: shown when a step is waiting for prerequisites and autoRun is off -->
      <div
        v-if="nextBlockedStep && !autoRun"
        class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg px-6 py-4 flex items-start gap-4"
      >
        <svg class="w-5 h-5 text-yellow-500 dark:text-yellow-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
        </svg>
        <div>
          <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Next: {{ nextBlockedStep.label }}
          </p>
          <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-0.5">
            {{ nextBlockedStep.description }}
          </p>
        </div>
      </div>

    </div>
  </div>
</template>

