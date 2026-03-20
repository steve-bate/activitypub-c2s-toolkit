<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'
import { useSettingsStore } from '@/stores/settingsStore'
import BearerTokenForm from '@/components/BearerTokenForm.vue'
import { resolveHandle as resolveWebFingerResource } from '@/services/webfingerService'
import { fetchActorInfo } from '@/services/actorDiscoveryService'

const router = useRouter()
const serverStore = useServerStore()
const settingsStore = useSettingsStore()

const OAUTH2_IDENTIFIER_KEY = 'c2s_oauth2_identifier'

/** Whether the user has a choice of auth method (both enabled). */
const hasAuthChoice = computed(() =>
  settingsStore.settings.authMethods.oauth2 && settingsStore.settings.authMethods.bearer
)

/**
 * Determine the initial step based on which auth methods are enabled.
 * If only one method is enabled, skip straight to that method's step.
 */
function initialStep(): string {
  if (!settingsStore.settings.authMethods.oauth2 && settingsStore.settings.authMethods.bearer) {
    return 'edit-bearer'
  }
  if (settingsStore.settings.authMethods.oauth2 && !settingsStore.settings.authMethods.bearer) {
    return 'identifier'
  }
  return 'auth-type'
}

// Form states
const step = ref(initialStep())
const identifier = ref('')
const identifierError = ref<string | null>(null)
const bearerIdentifierError = ref<string | null>(null)

// Restore saved identifier on mount so it is pre-filled when the identifier step is shown
onMounted(() => {
  const saved = localStorage.getItem(OAUTH2_IDENTIFIER_KEY)
  if (saved) {
    identifier.value = saved
  }
})

/**
 * Handle auth type selection
 */
function handleAuthTypeSelect(type: 'oauth2' | 'bearer') {
  if (type === 'oauth2') {
    step.value = 'identifier'
  } else {
    step.value = 'edit-bearer'
  }
}

/**
 * Resolve a raw identifier string to an origin URL.
 * Supports fedi handles (@user@domain), full URLs, and bare domains.
 */
async function resolveIdentifierToOrigin(raw: string): Promise<URL> {
  if (raw.startsWith('@')) {
    const actorUri = await resolveWebFingerResource(raw)
    if (!actorUri) throw new Error('Failed to resolve handle to ActivityPub actor')
    const u = new URL(actorUri)
    return new URL(`${u.protocol}//${u.host}`)
  }

  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('Only http/https URLs are supported')
    }
    return new URL(u.origin)
  } catch {
    // Bare domain – assume HTTPS
    return new URL(`https://${raw}`)
  }
}

/**
 * Handle identifier input: create server entry, mark it for the automatic
 * OAuth2 flow that runs on the server detail page, then navigate there.
 */
async function handleAuthServerOriginSubmit() {
  if (!identifier.value.trim()) return

  identifierError.value = null
  localStorage.setItem(OAUTH2_IDENTIFIER_KEY, identifier.value)

  let authServerUrl: URL
  try {
    authServerUrl = await resolveIdentifierToOrigin(identifier.value)
  } catch (error) {
    identifierError.value = error instanceof Error ? error.message : String(error)
    return
  }

  const server = serverStore.addServer({
    userInput: identifier.value,
    authServerOrigin: authServerUrl.origin,
    authType: 'oauth2',
  })

  serverStore.markServerForAutoAuth(server.id)
  serverStore.setActiveServer(server.id)

  step.value = 'success'

  // The delay is not completely necessary
  setTimeout(() => {
    void router.push(`/servers/${server.id}/auth`)
  }, 800)
}

/**
 * Handle bearer token form submission
 */
async function handleBearerTokenSave(formData: { identifier: string; name: string; bearerToken: string }) {
  bearerIdentifierError.value = null

  const id = formData.identifier.trim()
  let actorUri: string

  if (id.startsWith('@')) {
    const resolved = await resolveWebFingerResource(id)
    if (!resolved) {
      bearerIdentifierError.value = 'Failed to resolve WebFinger handle to an actor URI'
      return
    }
    actorUri = resolved
  } else if (id.startsWith('http://') || id.startsWith('https://')) {
    actorUri = id
  } else {
    bearerIdentifierError.value = 'Identifier must be a WebFinger handle (@user@domain) or an HTTP(S) URL'
    return
  }

  const actorFetchResult = await fetchActorInfo(actorUri, formData.bearerToken)
  if (!actorFetchResult.success || !actorFetchResult.response?.payload) {
    bearerIdentifierError.value = actorFetchResult.error ?? 'Failed to retrieve actor profile'
    return
  }
  const actorProfile = actorFetchResult.response.payload

  const newServer = serverStore.addServer({
    authType: 'bearer',
    bearerToken: formData.bearerToken,
    userInput: formData.identifier,
    // Used for some services like NodeInfo
    // Probably shouldn't be called authServerOrigin
    origin: new URL(actorUri).origin,
    actor: {
      profile: actorProfile,
      discovery: { success: true, method: 'user' },
    }
  })

  serverStore.setAuthStatus(newServer.id, 'authorized')
  serverStore.setActiveServer(newServer.id)

  step.value = 'success'
  setTimeout(() => {
    void router.push(`/servers/${newServer.id}`)
  }, 800)
}

/**
 * Handle bearer token form cancel
 */
function handleBearerTokenCancel() {
  if (hasAuthChoice.value) {
    step.value = 'auth-type'
  } else {
    void router.push('/servers')
  }
}

/**
 * Handle back to auth type selection
 */
function handleBackToAuthType() {
  step.value = 'auth-type'
  identifier.value = ''
  identifierError.value = null
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
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">OAuth2 Authorization Server</h2>

        <form @submit.prevent="handleAuthServerOriginSubmit" class="space-y-4">
          <div>
            <label for="server-identifier" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Enter server domain, actor URI, or Fediverse/WebFinger handle:
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
              <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">https://example.com:8080</code> or
              <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">@user@domain</code>
            </p>
            <p v-if="identifierError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ identifierError }}</p>
          </div>

          <button
            type="submit"
            :disabled="!identifier.trim()"
            class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            Continue
          </button>
        </form>

        <div v-if="hasAuthChoice" class="mt-4 text-center">
          <button
            @click="handleBackToAuthType"
            class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            ← Choose different authentication method
          </button>
        </div>
      </div>

      <!-- Bearer Token Configuration -->
      <div v-show="step === 'edit-bearer'" class="animate-fadeIn">
        <BearerTokenForm
          :identifier="identifier"
          @save="handleBearerTokenSave"
          @cancel="handleBearerTokenCancel"
        />
        <p v-if="bearerIdentifierError" class="mt-3 text-sm text-red-600 dark:text-red-400 text-center">{{ bearerIdentifierError }}</p>

        <div v-if="hasAuthChoice" class="mt-4 text-center">
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
