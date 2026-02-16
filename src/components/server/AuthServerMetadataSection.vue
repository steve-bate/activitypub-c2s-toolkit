<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ResourceServerMetadata } from '@/stores/serverStore'
import { useServerStore } from '@/stores/serverStore'
import { discoverServerMetadata, parseUrl } from '@/services/authServerDiscoveryService'
import CopyIcon from '@/components/icons/CopyIcon.vue'
import HttpRequestPanel from '@/components/http/HttpRequestPanel.vue'
import HttpResponsePanel from '@/components/http/HttpResponsePanel.vue'

interface Props {
  server: ResourceServerMetadata
}

const props = defineProps<Props>()

const serverStore = useServerStore()
const isDiscovering = ref(false)
const discoveryError = ref<string | null>(null)

function copyToClipboard(text: string) {
 void  navigator.clipboard.writeText(text)
}

const authServerResult = computed(() => {
  return props.server.auth?.oauth2?.authServerDiscovery
})

const authServerMetadata = computed(() => {
  return authServerResult.value?.exchange?.response?.payload || null
})

const supportsPKCE = computed(() => {
  const methods = authServerMetadata.value?.code_challenge_methods_supported
  if (!methods || methods.length === 0) return false
  return methods.includes('S256')
})

/**
 * Refresh discovery metadata and auto-register if possible
 */
async function handleRefreshMetadata() {
  if (!props.server.identifier) return

  isDiscovering.value = true
  discoveryError.value = null

  try {
    // Run discovery
    const serverUrl = parseUrl(props.server.identifier)
    const result = await discoverServerMetadata(serverUrl)

    if (result.exchange.success && result.exchange.response?.payload) {
      // Save metadata with discovery method
      serverStore.saveDiscoveryMetadata(props.server.id, result)
      serverStore.setAuthStatus(props.server.id, 'authserver-configured')

    } else {
      discoveryError.value = result.exchange.error || 'Discovery failed'
    }
  } catch (error) {
    discoveryError.value = (error instanceof Error ? error.message : 'Unexpected error during discovery')
  } finally {
    isDiscovering.value = false
  }
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Authorization Server Metadata</h3>
      <button
        @click="handleRefreshMetadata"
        :disabled="isDiscovering"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
      >
        <svg v-if="isDiscovering" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        {{ isDiscovering ? 'Discovering...' : 'Refresh' }}
      </button>
    </div>

    <!-- Error Message -->
    <div v-if="discoveryError" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-red-800 dark:text-red-200">
            Discovery failed
          </p>
          <p class="text-xs text-red-700 dark:text-red-300 mt-1">
            {{ discoveryError }}
          </p>
        </div>
        <button @click="discoveryError = null" class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="authServerMetadata" class="space-y-4">
      <!-- Discovery Method Badge -->
      <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <span class="text-sm text-gray-600 dark:text-gray-400">Discovery Method:</span>
        <span 
          class="px-3 py-1 rounded-full text-xs font-semibold"
          :class="{
            'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200': authServerResult?.discoveryMethod === 'RFC8414',
            'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200': authServerResult?.discoveryMethod === 'Mastodon',
            'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200': authServerResult?.discoveryMethod === 'Manual'
          }"
        >
          {{ authServerResult?.discoveryMethod || 'Manual' }}
        </span>
        <span v-if="authServerResult?.discoveryMethod === 'RFC8414'" class="text-xs text-gray-500 dark:text-gray-400">
          (Standard OAuth 2.0 Authorization Server Metadata)
        </span>
        <span v-else-if="authServerResult?.discoveryMethod === 'Mastodon'" class="text-xs text-gray-500 dark:text-gray-400">
          (Mastodon-compatible fallback)
        </span>
      </div>

      <!-- Key Endpoints -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Authorization Endpoint -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Authorization Endpoint
          </label>
          <div class="flex items-center gap-2">
            <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 truncate" :title="authServerMetadata.authorization_endpoint">
              {{ authServerMetadata.authorization_endpoint }}
            </code>
            <button
              @click="copyToClipboard(authServerMetadata.authorization_endpoint ?? '')"
              class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              title="Copy to clipboard"
            >
              <CopyIcon class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Token Endpoint -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Token Endpoint
          </label>
          <div class="flex items-center gap-2">
            <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 truncate" :title="authServerMetadata.token_endpoint">
              {{ authServerMetadata.token_endpoint }}
            </code>
            <button
              @click="copyToClipboard(authServerMetadata.token_endpoint ?? '')"
              class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              title="Copy to clipboard"
            >
              <CopyIcon class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Introspection Endpoint -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Introspection Endpoint
          </label>
          <div v-if="authServerMetadata.introspection_endpoint" class="flex items-center gap-2">
            <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 truncate" :title="authServerMetadata.introspection_endpoint">
              {{ authServerMetadata.introspection_endpoint }}
            </code>
            <button
              @click="copyToClipboard(authServerMetadata.introspection_endpoint ?? '')"
              class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              title="Copy to clipboard"
            >
              <CopyIcon class="w-4 h-4" />
            </button>
          </div>
          <div v-else class="text-sm text-gray-500 dark:text-gray-400 italic">
            Not provided
          </div>
        </div>

        <!-- Registration Endpoint -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Registration Endpoint
          </label>
          <div v-if="authServerMetadata.registration_endpoint" class="flex items-center gap-2">
            <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 truncate" :title="authServerMetadata.registration_endpoint">
              {{ authServerMetadata.registration_endpoint }}
            </code>
            <button
              @click="copyToClipboard(authServerMetadata.registration_endpoint ?? '')"
              class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              title="Copy to clipboard"
            >
              <CopyIcon class="w-4 h-4" />
            </button>
          </div>
          <div v-else class="text-sm text-gray-500 dark:text-gray-400 italic">
            Not provided
          </div>
        </div>
      </div>

      <!-- PKCE Support -->
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          PKCE (Proof Key for Code Exchange)
        </label>
        <div class="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm">
          <span v-if="supportsPKCE" class="inline-flex items-center gap-1.5 text-green-700 dark:text-green-300">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Supported (S256)
          </span>
          <span v-else class="text-gray-500 dark:text-gray-400">
            Not supported
          </span>
        </div>
      </div>

      <!-- Discovery Method Details -->
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
        <details class="group">
          <summary class="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-200 select-none">
            <svg class="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            <span>Discovery Details</span>
          </summary>
          <div class="mt-4 space-y-6">
            <!-- RFC 8414 Discovery Details -->
            <div v-if="server.auth?.oauth2?.authServerDiscovery?.discoveryMethod === 'RFC8414'" class="space-y-4">
              <HttpRequestPanel
                title="Request"
                :headers="{ 'Accept': 'application/json' }"
                :url="`${server.identifier.includes('://') ? server.identifier : 'https://' + server.identifier}/.well-known/oauth-authorization-server`"
              />
              <HttpResponsePanel
                title="Response"
                :status="server.auth?.oauth2?.authServerDiscovery?.exchange.response?.status_code || 0"
                status-text="OK"
                :headers="{ 'Content-Type': 'application/json' }"
                :payload="authServerMetadata"
                content-type="application/json"
              />
            </div>

            <!-- Mastodon Discovery Details -->
            <div v-else-if="server.auth?.oauth2?.authServerDiscovery?.discoveryMethod === 'Mastodon'" class="space-y-4">
              <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div class="flex gap-3">
                  <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Mastodon-Compatible Discovery
                    </p>
                    <p class="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      OAuth endpoints were inferred from the Mastodon API response and the existence of the /api/v1/instance endpoint.
                    </p>
                  </div>
                </div>
              </div>
              <HttpRequestPanel
                title="Request"
                :headers="{ 'Accept': 'application/json' }"
                :url="`${server.identifier.includes('://') ? server.identifier : 'https://' + server.identifier}/api/v1/instance`"
              />
              <HttpResponsePanel
                title="Response"
                :status="200"
                status-text="OK"
                :headers="{ 'Content-Type': 'application/json' }"
                :payload="authServerMetadata"
                content-type="application/json"
              />
            </div>

          </div>
        </details>
      </div>
    </div>

    <!-- No metadata state -->
    <div v-else class="text-center py-8">
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        No authorization server metadata discovered
      </p>
      <p class="text-gray-400 dark:text-gray-500 text-xs mt-2">
        Run discovery from the server details to fetch metadata
      </p>
    </div>
  </div>
</template>

