<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'
import AuthServerMetadataSection from '@/components/server/AuthServerMetadataSection.vue'
import ClientRegistrationSection from '@/components/server/ClientRegistrationSection.vue'
import ClientAuthorizationSection from '@/components/server/ClientAuthorizationSection.vue'
import ResourceServerMetadataSection from '@/components/server/ResourceServerMetadataSection.vue'
import AccessTokenSection from '@/components/server/AccessTokenSection.vue'
import ActorDiscoverySection from '@/components/server/ActorDiscoverySection.vue'
import { parseUrl, discoverServerMetadata } from '@/services/authServerDiscoveryService'
import { refreshAccessToken, revokeToken, initiateAuthorizationFlow } from '@/services/authorizationService'
import { discoverActor as getActor } from '@/services/actorDiscoveryService'
import { getNodeInfo } from '@/services/nodeinfoService'
import { registerClient, defaultClientRegistrationParams, isDefined } from '@/services/clientRegistrationService'

const router = useRouter()
const route = useRoute()
const serverStore = useServerStore()

const serverId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? id[0] : id
})

const server = computed(() => {
  return serverStore.servers.find(s => s.id === serverId.value)
})

// Set active server when component mounts
onMounted(() => {
  if (serverId.value && serverId.value !== 'new') {
    serverStore.setActiveServer(serverId.value)
    
    // Automatically load NodeInfo if not already loaded
    const serverValue = server.value
    const nodeinfo = server.value?.nodeinfo
    if (!nodeinfo && !isLoadingNodeInfo.value) {
      void handleLoadNodeInfo()
    }
    
    // Start automatic authorization flow only for newly added servers
    if (serverValue && serverStore.consumeAutoAuthForServer(serverValue.id)) {
      void handleAutomaticAuthFlow()
    }
  }
})

// Watch for activeServerId changes and navigate if needed (e.g., from header dropdown)
// This allows switching servers from the header without circular loops
watch(
  () => serverStore.activeServerId,
  (newActiveId) => {
    // Only navigate if we're on ServerDetailPage and the activeServerId changed
    // and it's different from the current page's serverId
    if (newActiveId && serverId.value && newActiveId !== serverId.value && route.name === 'server-detail') {
      void router.push(`/servers/${newActiveId}`)
    }
  }
)

// Watch for server changes to auto-load NodeInfo and start automatic auth flow
watch(
  () => server.value,
  (newServer) => {
    if (newServer && !newServer.nodeinfo && !isLoadingNodeInfo.value) {
      void handleLoadNodeInfo()
    }
    
    // Start automatic authorization flow only for newly added servers
    if (newServer && serverStore.consumeAutoAuthForServer(newServer.id)) {
      void handleAutomaticAuthFlow()
    }
  }
)

/**
 * Delete server
 */
function handleDeleteServer() {
  if (server.value && confirm(`Are you sure you want to delete "${server.value.name}"?`)) {
    if (!serverId.value) return
    serverStore.deleteServer(serverId.value)
    void router.push('/servers')
  }
}

const isRefreshing = ref(false)
const isRevoking = ref(false)
const tokenError = ref<string | null>(null)
const tokenSuccess = ref<string | null>(null)

const isRefreshingActor = ref(false)
const actorError = ref<string | null>(null)
const actorSuccess = ref<string | null>(null)

const isLoadingNodeInfo = ref(false)
const nodeinfoError = ref<string | null>(null)
const nodeinfoSuccess = ref<string | null>(null)

const isDiscoveringMetadata = ref(false)
const isRegisteringClient = ref(false)
const isInitiatingAuth = ref(false)

/**
 * Automatic authorization flow
 */
async function handleAutomaticAuthFlow() {
  if (!server.value) return
  
  // Step 1: Discover authorization server metadata if not present
  if (!server.value.auth?.oauth2?.authServerDiscovery && !isDiscoveringMetadata.value) {
    await handleAutoDiscoverMetadata()
  }
  
  // Step 2: Register client if metadata exists but no client credentials
  if (server.value.auth?.oauth2?.authServerDiscovery && 
      (!server.value.oauth2?.clientId || server.value.oauth2.clientId === '') && 
      !isRegisteringClient.value) {
    await handleAutoRegisterClient()
  }
  
  // Step 3: Initiate authorization if client is registered but no token
  if (server.value.auth?.oauth2?.authServerDiscovery && 
      server.value.oauth2?.clientId && 
      !server.value.tokenResponse?.access_token && 
      !isInitiatingAuth.value) {
    await handleAutoInitiateAuth()
  }
  
  // Step 4: Discover actor if token exists but no actor
  if (server.value.tokenResponse?.access_token && 
      !server.value.actor && 
      !server.value.actorError && 
      !isRefreshingActor.value) {
    await handleDiscoverActor()
  }
}

/**
 * Automatically discover authorization server metadata
 */
async function handleAutoDiscoverMetadata() {
  if (!server.value?.identifier || isDiscoveringMetadata.value) return
  
  isDiscoveringMetadata.value = true
  
  try {
    const serverUrl = parseUrl(server.value.identifier)
    const result = await discoverServerMetadata(serverUrl)
    
    if (result.exchange.success) {
      serverStore.saveAuthServerDiscoveryResult(server.value.id, result)
      serverStore.setAuthStatus(server.value.id, 'configured')
      
      // Continue to next step
      setTimeout(() => void handleAutomaticAuthFlow(), 500)
    }
  } catch (error) {
    console.warn('Auto-discovery failed:', error)
  } finally {
    isDiscoveringMetadata.value = false
  }
}

/**
 * Automatically register client
 */
async function handleAutoRegisterClient() {
  const authServerMetadata = server.value?.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload
  if (!authServerMetadata?.registration_endpoint) return
  if (!isDefined(authServerMetadata.registration_endpoint)) return
  if (isRegisteringClient.value) return
  
  isRegisteringClient.value = true
  
  if (!server.value) {
    isRegisteringClient.value = false
    console.error('No server found for client registration')
    return
  }

  try {
    const serverScopes = authServerMetadata.scopes_supported?.join(' ') || 
                        server.value.oauth2?.scopes || 
                        'read write follow'
    
    const clientMetadata = defaultClientRegistrationParams(
      server.value.name,
      [server.value.oauth2?.redirectUri || `${window.location.origin}/callback`],
      serverScopes
    )
    
    if (server.value.auth?.oauth2?.authServerDiscovery?.discoveryMethod === 'Mastodon') {
      clientMetadata.redirect_uris = clientMetadata.redirect_uris[0] // Mastodon expects single string
    }

    const serverUrl = parseUrl(server.value.identifier)
    
    const result = await registerClient(
      serverUrl,
      authServerMetadata.registration_endpoint,
      clientMetadata
    )
    
    // Save registration exchange even on failure so user can see what went wrong
    if (result.exchange.request) {
      const oauth2Config = server.value.oauth2 || {
        clientId: '',
        clientSecret: '',
        redirectUri: '',
        scopes: ''
      }
      
      // Store error if registration failed
      if (!result.exchange.success) {
        serverStore.updateServerProperty(server.value.id, 'oauth2', {
          ...oauth2Config,
          registrationError: result.exchange.error || 'Registration failed'
        })
      }
    }
    
    if (result.exchange.success && result.exchange.response?.payload) {
      serverStore.updateServerProperty(server.value.id, 'oauth2', {
        clientId: result.exchange.response.payload.client_id,
        clientSecret: result.exchange.response.payload.client_secret || '',
        redirectUri: result.exchange.response.payload.redirect_uris?.[0] || server.value.oauth2?.redirectUri || '',
        scopes: result.exchange.response.payload.scope || server.value.oauth2?.scopes || 'read write follow',
        registrationMethod: result.registrationMethod || 'Manual',
        registrationError: undefined
      })
      
      // Continue to next step
      setTimeout(() => void handleAutomaticAuthFlow(), 500)
    }
  } catch (error) {
    console.warn('Auto-registration failed:', error)
  } finally {
    isRegisteringClient.value = false
  }
}

/**
 * Automatically initiate authorization
 */
async function handleAutoInitiateAuth() {
  const authServerMetadata = server.value?.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload
  if (!authServerMetadata?.authorization_endpoint) return

  if (!server.value) {
    isInitiatingAuth.value = false
    console.error('No server found for initiating authorization')
    return
  }

  if (!server.value.oauth2?.clientId || !server.value.oauth2?.redirectUri) return
  if (isInitiatingAuth.value) return
  
  isInitiatingAuth.value = true
  
  try {
    await initiateAuthorizationFlow({
      serverId: server.value.id,
      serverMetadata: authServerMetadata,
      oauth2Config: server.value.oauth2
    })
    // This will redirect, so we shouldn't reach here
  } catch (error) {
    console.warn('Auto-authorization failed:', error)
  } finally {
    isInitiatingAuth.value = false
  }
}

/**
 * Refresh access token
 */
async function handleRefreshToken() {
  if (!server.value || !server.value.tokenResponse?.refresh_token) return
  const authServerMetadata = server.value?.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload
  if (!authServerMetadata || !server.value.oauth2) return

  isRefreshing.value = true
  tokenError.value = null
  tokenSuccess.value = null

  try {
    const result = await refreshAccessToken(
      server.value.id,
      server.value.tokenResponse.refresh_token,
      authServerMetadata,
      server.value.oauth2
    )

    if (result.success && result.response) {
      serverStore.updateServerProperty(server.value.id, 'tokenResponse', result.response)
      
      // Discover actor information after token refresh
      try {
        const actorResult = await getActor(
          result.response,
          authServerMetadata,
          server.value.oauth2.clientId,
          server.value.oauth2.clientSecret
        )
        
        if (actorResult.success && actorResult.actor) {
          serverStore.saveActorInfo(server.value.id, actorResult.actor)
        }
      } catch (error) {
        console.warn('Actor discovery error during refresh:', error)
      }
      
      tokenSuccess.value = 'Token refreshed successfully'
      setTimeout(() => {
        tokenSuccess.value = null
      }, 5000)
    } else {
      tokenError.value = result.error || 'Token refresh failed'
    }
  } catch (error) {
    tokenError.value = error instanceof Error ? error.message : 'Unexpected error during token refresh'
  } finally {
    isRefreshing.value = false
  }
}

/**
 * Discover actor information
 */
async function handleDiscoverActor() {
  if (!server.value?.tokenResponse?.access_token) return
  const authServerMetadata = server.value?.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload
  if (!authServerMetadata || !server.value.oauth2) return

  isRefreshingActor.value = true
  actorError.value = null
  actorSuccess.value = null

  try {
    const actorResult = await getActor(
      server.value.tokenResponse,
      authServerMetadata,
      server.value.oauth2.clientId,
      server.value.oauth2.clientSecret
    )
    
    if (actorResult.success && actorResult.actor) {
      serverStore.saveActorInfo(server.value.id, actorResult.actor)
      actorSuccess.value = 'Actor discovered successfully'
      setTimeout(() => {
        actorSuccess.value = null
      }, 5000)
    } else {
      const errorMessage = actorResult.error || 'Actor discovery failed'
      actorError.value = errorMessage;
      serverStore.saveActorError(server.value.id, errorMessage)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error during actor discovery'
    actorError.value = errorMessage;
    serverStore.saveActorError(server.value.id, errorMessage)
  } finally {
    isRefreshingActor.value = false
  }
}

/**
 * Refresh actor information
 */
async function handleRefreshActor() {
  if (!server.value?.tokenResponse?.access_token) return
  const authServerMetadata = server.value?.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload
  if (!authServerMetadata || !server.value.oauth2) return

  isRefreshingActor.value = true
  actorError.value = null
  actorSuccess.value = null

  try {
    const actorResult = await getActor(
      server.value.tokenResponse,
      authServerMetadata,
      server.value.oauth2.clientId,
      server.value.oauth2.clientSecret
    )
    
    if (actorResult.success && actorResult.actor) {
      serverStore.saveActorInfo(server.value.id, actorResult.actor)
      actorSuccess.value = 'Actor information refreshed successfully'
      setTimeout(() => {
        actorSuccess.value = null
      }, 5000)
    } else {
      // TODO REVIEW the error display
      const errorMessage = actorResult.error || 'Actor discovery failed'
      actorError.value = `${errorMessage} (possible CORS issue)`;
      serverStore.saveActorError(server.value.id, actorError.value)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error during actor discovery'
    actorError.value = errorMessage;
    serverStore.saveActorError(server.value.id, errorMessage)
  } finally {
    isRefreshingActor.value = false
  }
}

const actorErrorDisplay = computed(() => {
  return actorError.value || server.value?.actorError || null
})

/**
 * Load NodeInfo information
 */
async function handleLoadNodeInfo() {
  if (!server.value) return

  isLoadingNodeInfo.value = true
  nodeinfoError.value = null
  nodeinfoSuccess.value = null

  try {
    const [indexExchange, dataExchange] = await getNodeInfo(server.value.baseUrl)
    serverStore.saveNodeInfo(server.value.id, dataExchange, indexExchange)
    
    if (indexExchange && dataExchange && 
        indexExchange?.success && dataExchange?.success && 
        indexExchange?.response?.payload && dataExchange?.response?.payload) {
      nodeinfoSuccess.value = 'NodeInfo loaded successfully'
      setTimeout(() => {
        nodeinfoSuccess.value = null
      }, 5000)
    } else {
      // Determine which part failed and construct error message
      let errorMessage = ''
      if (!indexExchange?.success) {
        errorMessage = indexExchange?.error || 'NodeInfo index fetch failed'
        if (indexExchange?.response) {
          errorMessage += ` (HTTP ${indexExchange?.response?.status_code || 'unknown'})`
        }
      } else if (!dataExchange?.success) {
        errorMessage = dataExchange?.error || 'NodeInfo data fetch failed'
        if (dataExchange?.response) {
          errorMessage += ` (HTTP ${dataExchange?.response?.status_code || 'unknown'})`
        }
      } else {
        errorMessage = 'NodeInfo loading failed'
      }
      nodeinfoError.value = errorMessage
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error loading NodeInfo'
    nodeinfoError.value = errorMessage
  } finally {
    isLoadingNodeInfo.value = false
  }
}

/**
 * Revoke access token
 */
async function handleRevokeToken() {
  if (!server.value || !server.value.tokenResponse?.access_token) return
  const authServerMetadata = server.value?.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload
  if (!authServerMetadata || !server.value.oauth2) return

  if (!confirm('Are you sure you want to revoke this access token? You will need to authorize again.')) {
    return
  }

  isRevoking.value = true
  tokenError.value = null
  tokenSuccess.value = null

  try {
    const result = await revokeToken(
      server.value.id,
      server.value.tokenResponse.access_token,
      'access_token',
      authServerMetadata,
      server.value.oauth2
    )

    if (result.success) {
      serverStore.clearToken(server.value.id)
      tokenSuccess.value = 'Token revoked successfully'
      setTimeout(() => {
        tokenSuccess.value = null
      }, 5000)
    } else {
      tokenError.value = result.error || 'Token revocation failed'
    }
  } catch (error) {
    tokenError.value = error instanceof Error ? error.message : 'Unexpected error during token revocation'
  } finally {
    isRevoking.value = false
  }
}

function handleClearActorError() {
  actorError.value = null
  if (server.value) {
    serverStore.saveActorError(server.value.id, '')
  }
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
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ server.nodeinfo?.data?.response?.payload?.metadata?.nodeName ?? server.name }}</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-2"><a target="_blank" rel="noopener noreferrer" :href="server.baseUrl">{{ server.baseUrl }}</a></p>
        </div>
        <div class="text-right">
          <div v-if="server.authStatus === 'authorized'" class="inline-block px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
            ✓ Authorized
          </div>
          <div v-else-if="server.authStatus === 'configured'" class="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
            ⚙ Configured
          </div>
          <div v-else class="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-full text-sm font-medium">
            Not Configured
          </div>
        </div>
      </div>

      <!-- Server Information Section (NodeInfo) -->
      <ResourceServerMetadataSection 
        :server="server" 
        @load="handleLoadNodeInfo" 
        @refresh="handleLoadNodeInfo"
      />

      <!-- Authorization Server Metadata Section -->
      <AuthServerMetadataSection :server="server" />

      <!-- Client Metadata Section -->
      <ClientRegistrationSection :server="server" @retry-registration="handleAutoRegisterClient" />

      <!-- Client Authorization Section -->
      <ClientAuthorizationSection :server="server" />

      <AccessTokenSection
        v-if="server.tokenResponse"
        :server="server"
        :is-refreshing="isRefreshing"
        :is-revoking="isRevoking"
        :token-error="tokenError"
        :token-success="tokenSuccess"
        @refresh="handleRefreshToken"
        @revoke="handleRevokeToken"
        @clear-error="tokenError = null"
      />

      <ActorDiscoverySection
        v-if="server.tokenResponse"
        :server="server"
        :is-refreshing-actor="isRefreshingActor"
        :actor-error="actorErrorDisplay"
        :actor-success="actorSuccess"
        @discover="handleDiscoverActor"
        @refresh="handleRefreshActor"
        @clear-error="handleClearActorError"
      />

      <!-- Danger Zone -->
      <div class="bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200 dark:border-red-800 p-6">
        <h2 class="text-lg font-semibold text-red-900 dark:text-red-200 mb-4">Danger Zone</h2>
        <button
          @click="handleDeleteServer"
          class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors"
        >
          Delete Server
        </button>
        <p class="text-sm text-red-800 dark:text-red-300 mt-2">This action cannot be undone.</p>
      </div>
    </div>
  </div>
</template>

