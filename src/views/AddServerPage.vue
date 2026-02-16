<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'
import OAuth2InitiateFlow from '@/components/server/OAuth2InitiateFlow.vue'
import BearerTokenForm from '@/components/server/BearerTokenForm.vue'
import { parseUrl, discoverServerMetadata, AuthServerDiscoveryResult, UrlComponents } from '@/services/authServerDiscoveryService'
import { registerClient, defaultClientRegistrationParams } from '@/services/clientRegistrationService'

const router = useRouter()
const serverStore = useServerStore()

// Get redirect URI safely
const redirectUri = ref(`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/callback`)

// Form states
const step = ref('auth-type') // auth-type | identifier | discovering | registering | edit | edit-bearer | success
const authType = ref<'oauth2' | 'bearer'>('oauth2')
const identifier = ref('')
const discoveryError = ref(null)
const isDiscovering = ref(false)
const isRegistering = ref(false)
const registrationError = ref<string | null>(null)

/**
 * Handle auth type selection
 */
function handleAuthTypeSelect(type: 'oauth2' | 'bearer') {
  authType.value = type
  if (type === 'oauth2') {
    step.value = 'identifier'
  } else {
    step.value = 'edit-bearer'
  }
}

/**
 * Handle identifier input and start discovery
 */
async function handleIdentifierSubmit() {
  if (!identifier.value.trim()) return

  step.value = 'discovering'
  isDiscovering.value = true
  discoveryError.value = null

  try {
    // Attempt RFC 8414 discovery
    const serverUrl = parseUrl(identifier.value)
    const result = await discoverServerMetadata(serverUrl)

    if (result.exchange.success) {
      // Success - use discovered metadata
      console.log('Auth Server discovery successful', result)
      await createServerWithAuthDiscoveryResult(serverUrl, result)
    } else {
      // Discovery failed - show form for manual configuration
      // FIXME
      // discoveryError.value = result.error
      step.value = 'edit'
    }
  } catch (error) {
    console.error('Discovery error:', error)
    //FIXME
    //discoveryError.value = error.message
    step.value = 'edit'
  } finally {
    isDiscovering.value = false
  }
}

/**
 * Create server with discovered metadata and auto-register if possible
 */
async function createServerWithAuthDiscoveryResult(
  serverUrl: UrlComponents,
  authDiscoveryResult: AuthServerDiscoveryResult
) {
  // Create the server first
  const server = serverStore.addServer({
    identifier: identifier.value,
    name: serverUrl.hostname,
    baseUrl: serverUrl.baseUrl,
    authType: 'oauth2',
    oauth2: {
      clientId: '',
      clientSecret: '',
      redirectUri: redirectUri.value,
    }
  })

  serverStore.saveAuthServerDiscoveryResult(server.id, authDiscoveryResult)

  // Attempt automatic client registration if supported
  step.value = 'registering'
  isRegistering.value = true
  registrationError.value = null

  try {
    const clientMetadata = defaultClientRegistrationParams(
      serverUrl.hostname,
      [redirectUri.value],
    )

    if (authDiscoveryResult.discoveryMethod === 'Mastodon') {
      clientMetadata.redirect_uris = clientMetadata.redirect_uris[0] // Mastodon expects single string
    }
    
    const registrationEndpoint = authDiscoveryResult.exchange.response?.payload?.registration_endpoint;
    
    const registrationResult = await registerClient(
      serverUrl,
      registrationEndpoint,
      clientMetadata
    )

    serverStore.updateServerProperty(server.id, 'auth.oauth2.clientRegistration', registrationResult)

    // TODO temporary hack to support refactoring

    server.oauth2 = {
      ...server.oauth2,
      clientId: registrationResult.exchange.response?.payload?.client_id || '',
      clientSecret: registrationResult.exchange.response?.payload?.client_secret || '',
      redirectUri: redirectUri.value,
      scopes: 'read write follow'
    }
    serverStore.updateServerProperty(server.id, 'oauth2', server.oauth2)

  } catch (error) {
    console.error('Client registration error:', error)
    registrationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isRegistering.value = false
  }

  // Navigate to server detail page to show exchange details (success or failure)
  step.value = 'success'
  serverStore.markServerForAutoAuth(server.id)
  serverStore.setActiveServer(server.id)
  
  setTimeout(() => {
    void router.push(`/servers/${server.id}`)
  }, 1000)
}

/**
 * Handle bearer token form submission
 */
function handleBearerTokenSave(formData: { identifier: string; name: string; bearerToken: string }) {
  const serverInfo = parseUrl(formData.identifier)

  const newServer = serverStore.addServer({
    identifier: formData.identifier,
    name: formData.name,
    baseUrl: serverInfo.baseUrl,
    authType: 'bearer',
    bearerToken: formData.bearerToken,
    oauth2: {
      clientId: '',
      clientSecret: '',
      redirectUri: redirectUri.value,
    }
  })

  serverStore.setAuthStatus(newServer.id, 'authorized')

  step.value = 'success'

  // Set as active server and navigate to detail page
  serverStore.setActiveServer(newServer.id)

  setTimeout(() => {
    void router.push(`/servers/${newServer.id}`)
  }, 1000)
}

/**
 * Handle bearer token form cancel
 */
function handleBearerTokenCancel() {
  step.value = 'auth-type'
}

/**
 * Handle manual form submission
 */
// FIXME
// @ts-expect-error FIXME
function handleFormSave(formData) {
  const serverInfo = parseUrl(formData.identifier)

  const newServer = serverStore.addServer({
    identifier: formData.identifier,
    name: formData.name,
    baseUrl: serverInfo.baseUrl,
    authType: formData.authType,
    oauth2: formData.oauth2
  })

  serverStore.setAuthStatus(newServer.id, 'configured')

  step.value = 'success'
  
  // Set as active server and navigate to detail page
  serverStore.markServerForAutoAuth(newServer.id)
  serverStore.setActiveServer(newServer.id)
  
  setTimeout(() => {
    void router.push(`/servers/${newServer.id}`)
  }, 1000)
}

/**
 * Handle cancel
 */
function handleFormCancel() {
  void router.push('/servers')
}

/**
 * Handle back to auth type selection
 */
function handleBackToAuthType() {
  step.value = 'auth-type'
  identifier.value = ''
  discoveryError.value = null
}

/**
 * Handle back to identifier input
 */
function handleBackToIdentifier() {
  step.value = 'identifier'
  discoveryError.value = null
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
    <div class="max-w-2xl mx-auto px-4 py-12">
    <div class="text-center mb-12">
        <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-2">Add ActivityPub Server</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400">Choose an authentication method to configure your server</p>
      </div>

      <!-- Step 0: Auth Type Selection -->
      <div
        v-show="step === 'auth-type'"
        class="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 mb-6 animate-fadeIn"
      >
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">Select Authentication Method</h2>

        <div class="space-y-4">
          <!-- OAuth2 Option -->
          <button
            @click="handleAuthTypeSelect('oauth2')"
            class="w-full p-6 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
          >
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0">
                <div class="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </svg>
                </div>
              </div>
              <div class="flex-1 text-left">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">OAuth2</h3>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  The secure, standard protocol for delegated authorization. Your application will be automatically discovered and registered with your server.
                </p>
              </div>
            </div>
          </button>

          <!-- Bearer Token Option -->
          <button
            @click="handleAuthTypeSelect('bearer')"
            class="w-full p-6 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
          >
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0">
                <div class="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                  <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                  </svg>
                </div>
              </div>
              <div class="flex-1 text-left">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">Bearer Token</h3>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Use a pre-generated application token (also called an application password) for direct authentication.
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Step 1: Identifier Input -->
      <div
        v-show="step === 'identifier'"
        class="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 mb-6 animate-fadeIn"
      >
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">Authorization Server</h2>

        <form @submit.prevent="handleIdentifierSubmit" class="space-y-4">
          <div>
            <label for="server-identifier" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Enter server domain or full URL
            </label>
            <input
              id="server-identifier"
              v-model="identifier"
              type="text"
              autofocus
              placeholder="example.com or https://example.com:8080"
              class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-gray-800 dark:text-white transition"
            />
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Format: <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">example.com</code> or
              <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">https://example.com:8080</code>
            </p>
          </div>

          <button
            type="submit"
            :disabled="!identifier.trim()"
            class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            Continue
          </button>
        </form>

        <div class="mt-4 text-center">
          <button
            @click="handleBackToAuthType"
            class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            ← Choose different authentication method
          </button>
        </div>
      </div>

      <!-- Step 2: Discovering -->
      <div v-show="step === 'discovering'" class="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 animate-fadeIn">
        <div class="text-center space-y-4">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full">
            <svg class="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Discovering server metadata...</h3>
          <p class="text-gray-600 dark:text-gray-400">Attempting to retrieve OAuth2 configuration from {{ identifier }}</p>
        </div>
      </div>

      <!-- Step 2.5: Registering Client -->
      <div v-show="step === 'registering'" class="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 animate-fadeIn">
        <div class="text-center space-y-4">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full">
            <svg class="w-8 h-8 text-green-600 dark:text-green-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Registering OAuth2 client...</h3>
          <p class="text-gray-600 dark:text-gray-400">Automatically registering your application with {{ identifier }}</p>
        </div>
      </div>

      <!-- Step 3: Discovery Failed, Show Edit Form -->
      <div v-show="step === 'edit'" class="animate-fadeIn">
        <div v-if="discoveryError" class="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
            <span class="font-bold">RFC 8414 Discovery Failed:</span>
            {{ discoveryError }}
          </p>
          <p class="text-xs text-amber-700 dark:text-amber-300 mt-2">Please configure the server manually below.</p>
        </div>

        <OAuth2InitiateFlow
          v-if="step === 'edit' && identifier.trim()"
          :server="{
            identifier,
            name: '',
            baseUrl: parseUrl(identifier).baseUrl,
            authType: 'oauth2',
            oauth2: {
              clientId: '',
              clientSecret: '',
              redirectUri: redirectUri,
              scopes: 'read write follow'
            }
          }"
          @save="handleFormSave"
          @cancel="handleFormCancel"
        />

        <div class="mt-4 text-center">
          <button
            @click="handleBackToIdentifier"
            class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            ← Change server identifier
          </button>
        </div>
      </div>

      <!-- Step 3.5: Bearer Token Configuration -->
      <div v-show="step === 'edit-bearer'" class="animate-fadeIn">
        <BearerTokenForm
          :identifier="identifier"
          @save="handleBearerTokenSave"
          @cancel="handleBearerTokenCancel"
        />

        <div class="mt-4 text-center">
          <button
            @click="handleBackToAuthType"
            class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            ← Choose different authentication method
          </button>
        </div>
      </div>

      <!-- Step 4: Success -->
      <div v-show="step === 'success'" class="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 animate-fadeIn">
        <div class="text-center space-y-4">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full">
            <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Server configuration saved!</h3>
          <p class="text-gray-600 dark:text-gray-400">Redirecting to server details...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}
</style>
