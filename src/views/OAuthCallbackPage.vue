<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { parseAuthorizationCallback, validateState, exchangeCodeForToken } from '@/services/authorizationService'
import { discoverActor } from '@/services/actorDiscoveryService'
import { useServerStore } from '@/stores/serverStore'
import RunningIcon from '@/components/icons/RunningIcon.vue'

const router = useRouter()
const serverStore = useServerStore()
const status = ref<'processing' | 'success' | 'error'>('processing')
const message = ref<string>('Processing authorization...')
const errorDetails = ref<string | null>(null)

onMounted(async () => {
  try {
    // Parse callback parameters
    const callback = parseAuthorizationCallback()
    
    if (callback.error) {
      status.value = 'error'
      message.value = 'Authorization failed'
      errorDetails.value = `${callback.error}${callback.errorDescription ? ': ' + callback.errorDescription : ''}`
      return
    }

    if (!callback.code || !callback.state) {
      status.value = 'error'
      message.value = 'Invalid callback'
      errorDetails.value = 'Missing authorization code or state parameter'
      return
    }

    // Get serverId from sessionStorage (saved during authorization initiation)
    const serverId = sessionStorage.getItem('oauth_current_server_id')
    
    if (!serverId) {
      status.value = 'error'
      message.value = 'Server not found'
      errorDetails.value = 'No server ID found in session. Please restart the authorization flow.'
      return
    }

    const server = serverStore.servers.find(s => s.id === serverId)
    const authServerMetadata =
      server?.auth?.oauth2?.authServerDiscovery?.authorizationServerMetadata ??
      server?.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload
    if (!server || !authServerMetadata || !server.auth?.oauth2) {
      status.value = 'error'
      message.value = 'Server configuration not found'
      errorDetails.value = 'Unable to find server configuration. Please try again.'
      return
    }

    // Validate state parameter (CSRF protection)
    if (!validateState(serverId, callback.state)) {
      status.value = 'error'
      message.value = 'Security validation failed'
      errorDetails.value = 'State parameter mismatch. Possible CSRF attack detected.'
      return
    }

    message.value = 'Exchanging authorization code for access token...'

    // Exchange authorization code for access token
    const exchange = await exchangeCodeForToken({
      serverOrigin: serverId,
      authCode: callback.code,
      authServerMetadata: authServerMetadata,
      clientConfig: server.auth?.oauth2?.clientConfig
    })

    if (exchange.success && exchange.response) {
      // Save token response to store
      serverStore.saveTokenExchange(serverId, exchange)
      serverStore.saveAuthCode(serverId, callback.code)
      
      // Discover actor information
      message.value = 'Discovering actor information...'

      const clientId = server.auth?.oauth2?.clientConfig?.clientId
      const clientSecret = server.auth?.oauth2?.clientConfig?.clientSecret

      try {
        const actorDiscovery = await discoverActor(
          exchange.response.payload!,
          authServerMetadata,
          clientId,
          clientSecret
        )

        serverStore.saveActorDiscovery(serverId, actorDiscovery)

        if (!actorDiscovery.success) 
        {
          console.warn('Actor discovery failed:', !actorDiscovery.success)
        }

      } catch (error) {
        console.warn('Actor discovery error:', error)
        // Don't fail the whole flow if actor discovery fails
      }
      
      status.value = 'success'
      message.value = 'Authorization successful!'
      
      // Set as active server
      serverStore.setActiveServer(serverId)
      
      // Clean up session storage
      sessionStorage.removeItem('oauth_current_server_id')
      
      // Redirect to server detail page after a short delay
      setTimeout(() => {
        void router.push(`/servers/${serverId}`)
      }, 1500)
    } else {
      status.value = 'error'
      message.value = 'Token exchange failed'
      errorDetails.value = exchange.error || 'Unknown error occurred during token exchange'
    }
  } catch (error) {
    status.value = 'error'
    message.value = 'An error occurred'
    errorDetails.value = error instanceof Error ? error.message : 'Unexpected error during OAuth callback processing'
    console.error('OAuth callback error:', error)
  }
})

function handleRetry() {
  const serverId = sessionStorage.getItem('oauth_current_server_id')
  if (serverId) {
    serverStore.setActiveServer(serverId)
    void router.push(`/servers/${serverId}/auth`)
  } else {
    void router.push('/servers')
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
    <div class="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <!-- Processing State -->
      <div v-if="status === 'processing'" class="text-center">
        <div class="mb-4">
          <RunningIcon/>
        </div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {{ message }}
        </h1>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Please wait while we complete your authorization.
        </p>
      </div>

      <!-- Success State -->
      <div v-else-if="status === 'success'" class="text-center">
        <div class="mb-4">
          <svg class="w-16 h-16 mx-auto text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {{ message }}
        </h1>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Redirecting you back to the server configuration...
        </p>
      </div>

      <!-- Error State -->
      <div v-else-if="status === 'error'" class="text-center">
        <div class="mb-4">
          <svg class="w-16 h-16 mx-auto text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {{ message }}
        </h1>
        <div v-if="errorDetails" class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-800 dark:text-red-200">
            {{ errorDetails }}
          </p>
        </div>
        <button
          @click="handleRetry"
          class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
        >
          Back to Server
        </button>
      </div>
    </div>
  </div>
</template>
