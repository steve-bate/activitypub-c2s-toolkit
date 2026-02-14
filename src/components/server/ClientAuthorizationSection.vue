<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ResourceServerMetadata } from '@/stores/serverStore'
import { useServerStore } from '@/stores/serverStore'
import {
  initiateAuthorizationFlow
} from '@/services/authorizationService'
import CopyIcon from '@/components/icons/CopyIcon.vue'
import HttpRequestPanel from '@/components/http/HttpRequestPanel.vue'
import HttpResponsePanel from '@/components/http/HttpResponsePanel.vue'

interface Props {
  server: ResourceServerMetadata
}

const props = defineProps<Props>()

const serverStore = useServerStore()
const isAuthorizing = ref(false)
const authError = ref<string | null>(null)
const authSuccess = ref(false)

const canAuthorize = computed(() => {
  return props.server.authorizationServer?.metadata?.links?.oauth_authorize &&
         props.server.oauth2?.clientId &&
         props.server.oauth2?.redirectUri
})

const hasAuthCode = computed(() => {
  return !!props.server.authCode
})

const authRequestParams = computed(() => {
  if (!props.server.oauth2) return null

  const authRequest: Record<string, string> = {
    response_type: 'code',
    client_id: props.server.oauth2.clientId,
    redirect_uri: props.server.oauth2.redirectUri
  }

  if (props.server.oauth2.scopes) {
    authRequest.scope = props.server.oauth2.scopes
  }

  if (props.server.authorizationServer?.metadata?.features?.codeChallengeMethodsSupported?.length) {
    authRequest.code_challenge = '(SHA-256 hash of code_verifier)'
    authRequest.code_challenge_method = 'S256'
  }

  authRequest.state = '(random CSRF protection token)'

  return authRequest
})

const authRequestUrl = computed(() => {
  const baseUrl = props.server.authorizationServer?.metadata?.links?.oauth_authorize
  const params = authRequestParams.value
  if (!baseUrl || !params) return null

  const query = new URLSearchParams(params).toString()
  const separator = baseUrl.includes('?') ? '&' : '?'
  return query ? `${baseUrl}${separator}${query}` : baseUrl
})


const authResponseStatus = computed(() => {
  return props.server.authCode ? 302 : null
})

const authResponseStatusText = computed(() => {
  return props.server.authCode ? 'Found' : null
})

const authResponseHeaders = computed(() => {
  if (!props.server.authCode || !props.server.oauth2?.redirectUri) return null

  const params = new URLSearchParams({
    code: props.server.authCode,
    state: '(validated CSRF token)'
  })
  const redirectUri = props.server.oauth2.redirectUri
  const separator = redirectUri.includes('?') ? '&' : '?'
  return {
    Location: `${redirectUri}${separator}${params.toString()}`
  }
})

const authResponsePayload = computed(() => {
  if (!props.server.authCode) return null

  return {
    code: props.server.authCode,
    state: '(validated CSRF token)'
  }
})

async function handleAuthorize() {
  if (!canAuthorize.value) return
  
  isAuthorizing.value = true
  authError.value = null
  authSuccess.value = false
  
  try {
    console.log('Initiating authorization flow for server:', props.server.id)
    
    await initiateAuthorizationFlow({
      serverId: props.server.id,
      serverMetadata: props.server.authorizationServer.metadata!,
      oauth2Config: props.server.oauth2!
    })
    
    // This will redirect, so we shouldn't reach here
  } catch (error) {
    console.error('Authorization initiation failed:', error)
    authError.value = error?.message || 'Failed to initiate authorization'
    isAuthorizing.value = false
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

async function handleReauthorize() {
  if (!canAuthorize.value) return
  
  // Clear existing authorization and token data
  serverStore.clearToken(props.server.id)
  
  // Small delay to ensure state is cleared
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Restart authorization flow
  await handleAuthorize()
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Client Authorization</h3>
      <div class="flex items-center gap-2">
        <button
          v-if="!hasAuthCode"
          @click="handleAuthorize"
          :disabled="!canAuthorize || isAuthorizing"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
        >
          <svg v-if="isAuthorizing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isAuthorizing ? 'Authorizing...' : 'Authorize' }}
        </button>
        <template v-else>
          <span
            class="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm font-medium rounded-md flex items-center gap-2"
          >
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
            <svg v-if="isAuthorizing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isAuthorizing ? 'Refreshing...' : 'Refresh' }}
          </button>
        </template>
      </div>
    </div>

    <!-- Success Message -->
    <div v-if="authSuccess" class="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <p class="text-sm font-medium text-green-800 dark:text-green-200">
            Authorization code received!
          </p>
          <p class="text-xs text-green-700 dark:text-green-300 mt-1">
            The authorization code can be exchanged for an access token.
          </p>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="authError" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-red-800 dark:text-red-200">
            Authorization failed
          </p>
          <p class="text-xs text-red-700 dark:text-red-300 mt-1">
            {{ authError }}
          </p>
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
          <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Prerequisites not met
          </p>
          <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
            Please ensure:
            <span v-if="!server.authorizationServer?.metadata?.links?.oauth_authorize"> Authorization server metadata is discovered.</span>
            <span v-if="!server.oauth2?.clientId"> Client is registered.</span>
            <span v-if="!server.oauth2?.redirectUri"> Redirect URI is configured.</span>
          </p>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <!-- Authorization Endpoint -->
      <div v-if="server.authorizationServer?.metadata?.links?.oauth_authorize">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Authorization Endpoint
        </label>
        <div class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
            {{ server.authorizationServer.metadata.links.oauth_authorize }}
          </code>
          <button
            @click="copyToClipboard(server.authorizationServer.metadata.links.oauth_authorize)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Copy to clipboard"
          >
            <CopyIcon class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Authorization Code -->
      <div v-if="server.authCode">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Authorization Code
        </label>
        <div class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
            {{ server.authCode }}
          </code>
          <button
            @click="copyToClipboard(server.authCode)"
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
      <div v-if="server.oauth2?.clientId" class="grid grid-cols-1 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client ID
          </label>
          <code class="block px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
            {{ server.oauth2.clientId }}
          </code>
        </div>
        
        <div v-if="server.oauth2.redirectUri">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Redirect URI
          </label>
          <code class="block px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
            {{ server.oauth2.redirectUri }}
          </code>
        </div>

        <div v-if="server.oauth2.scopes">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Requested Scopes
          </label>
          <div class="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-900 dark:text-gray-100">
            {{ server.oauth2.scopes }}
          </div>
        </div>
      </div>

      <!-- Authorization Request/Response -->
      <div v-if="server.oauth2" class="pt-4 border-t border-gray-200 dark:border-gray-700">
        <details class="group">
          <summary class="cursor-pointer list-none">
            <div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
              <svg class="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
              Authorization Details
            </div>
          </summary>
          <div class="mt-4 space-y-4">
            <HttpRequestPanel
              title="Request"
              :headers="{ 'Accept': 'text/html' }"
              :url="authRequestUrl"
              :query-params="authRequestParams"
            />
            <HttpResponsePanel
              title="Response"
              :status="authResponseStatus"
              :status-text="authResponseStatusText"
              :headers="authResponseHeaders"
              :payload="authResponsePayload"
            />
          </div>
        </details>
      </div>
    </div>

    <!-- No Authorization Code state -->
    <div v-if="!hasAuthCode && canAuthorize" class="text-center py-8 border-t border-gray-200 dark:border-gray-700 mt-4">
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        Click "Authorize" to initiate the OAuth 2.0 authorization code flow
      </p>
    </div>
  </div>
</template>

