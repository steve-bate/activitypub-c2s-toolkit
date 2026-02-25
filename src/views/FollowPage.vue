<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useServerStore } from '@/stores/serverStore'
import { resolveHandle } from '@/services/webfingerService'
import { postActivityToOutbox, createFollowActivity } from '@/services/activitypubService'
import { syntaxHighlightJson } from '@/utils/jsonHighlighter'
import RunningIcon from '@/components/icons/RunningIcon.vue'

const serverStore = useServerStore()

const actorInput = ref('')
const isSubmitting = ref(false)
const isResolving = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const resolveStatus = ref<string>('')

// HTTP details tracking
const showHttpDetails = ref(false)
const lastHttpStatus = ref<number | null>(null)
const lastHttpStatusText = ref<string | null>(null)
const lastRequestHeaders = ref<Record<string, string> | null>(null)
const lastResponseHeaders = ref<Record<string, string> | null>(null)
const lastResponseBody = ref<string | null>(null)
const lastFollowPayload = ref<Record<string, unknown> | null>(null)

// Resolved actor info
const resolvedActorUri = ref<string | null>(null)
const resolvedActorData = ref<Record<string, unknown> | null>(null)

const STORAGE_KEY = 'activitypub-follow-form-data'

const activeActor = computed(() => serverStore.activeServer?.actor)
const outboxUrl = computed(() => activeActor.value?.profile?.outbox || '')
const outboxDisplay = computed(() => {
  if (!outboxUrl.value) return ''
  try {
    const url = new URL(outboxUrl.value)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return outboxUrl.value.replace(/^https?:\/\/[^/]+/i, '')
  }
})

const highlightedRequestJson = computed(() => {
  if (!lastFollowPayload.value) return ''
  const formatted = JSON.stringify(lastFollowPayload.value, null, 2)
  return syntaxHighlightJson(formatted)
})

const highlightedResponseJson = computed(() => {
  if (!lastResponseBody.value) return ''
  try {
    const parsed = JSON.parse(lastResponseBody.value)
    const formatted = JSON.stringify(parsed, null, 2)
    return syntaxHighlightJson(formatted)
  } catch {
    return ''
  }
})

const highlightedActorData = computed(() => {
  if (!resolvedActorData.value) return ''
  const formatted = JSON.stringify(resolvedActorData.value, null, 2)
  return syntaxHighlightJson(formatted)
})

/**
 * Detect if a string is a complete fedi handle (with domain)
 */
function isFediHandle(value: string): boolean {
  const handleRegex = /^@?[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return handleRegex.test(value.trim())
}

/**
 * Detect if a string is an incomplete fedi handle (just username, no domain)
 */
function isIncompleteHandle(value: string): boolean {
  const incompleteRegex = /^@?[a-zA-Z0-9._-]+$/
  return incompleteRegex.test(value.trim()) && !value.includes('@', 1) // No @ after first character
}

/**
 * Extract domain from actor URI
 */
function getServerDomain(): string | null {
  if (!activeActor.value?.profile?.id) {
    return null
  }
  
  try {
    const actorUrl = new URL(activeActor.value.profile.id)
    return actorUrl.hostname
  } catch {
    return null
  }
}

/**
 * Complete an incomplete handle by appending server domain
 */
function completeHandle(username: string): string | null {
  const domain = getServerDomain()
  if (!domain) {
    return null
  }
  
  // Remove leading @ if present
  const cleanUsername = username.startsWith('@') ? username.substring(1) : username
  return `${cleanUsername}@${domain}`
}

/**
 * Detect if a string is a URI
 */
function isUri(value: string): boolean {
  try {
    new URL(value.trim())
    return true
  } catch {
    return false
  }
}

/**
 * Resolve the actor input to a URI
 */
async function resolveActor() {
  if (!actorInput.value.trim()) {
    errorMessage.value = 'Please enter an actor URI or fedi handle'
    return
  }

  errorMessage.value = null
  successMessage.value = null
  resolvedActorUri.value = null
  resolvedActorData.value = null
  isResolving.value = true
  resolveStatus.value = ''

  try {
    let input = actorInput.value.trim()

    // Handle incomplete handles by appending server domain
    if (isIncompleteHandle(input)) {
      const completedHandle = completeHandle(input)
      if (!completedHandle) {
        errorMessage.value = 'Cannot determine server domain from active actor. Please enter a complete handle or actor URI.'
        isResolving.value = false
        return
      }
      
      const serverDomain = getServerDomain()
      resolveStatus.value = `Completing handle with server domain @${serverDomain}...`
      input = completedHandle
    }

    if (isFediHandle(input)) {
      resolveStatus.value = `Resolving fedi handle: ${input}...`
      const actorUri = await resolveHandle(input)
      
      if (!actorUri) {
        errorMessage.value = `Failed to resolve handle: ${input}`
        isResolving.value = false
        return
      }
      
      resolvedActorUri.value = actorUri
      resolveStatus.value = `Resolved to: ${actorUri}`
    } else if (isUri(input)) {
      resolvedActorUri.value = input
      resolveStatus.value = `Using actor URI: ${input}`
    } else {
      errorMessage.value = 'Invalid input. Please enter a valid actor URI (https://...) or fedi handle (@user@domain.com)'
      isResolving.value = false
      return
    }

    // Fetch actor data to display
    try {
      resolveStatus.value = `Fetching actor data...`
      const response = await fetch(resolvedActorUri.value, {
        headers: {
          'Accept': 'application/activity+json, application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        resolvedActorData.value = data
        successMessage.value = `Actor resolved successfully`
      } else {
        errorMessage.value = `Failed to fetch actor data: HTTP ${response.status}`
      }
    } catch (fetchError) {
      errorMessage.value = `Failed to fetch actor data: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
    }

    isResolving.value = false
    resolveStatus.value = ''
  } catch (error) {
    errorMessage.value = `Error: ${error instanceof Error ? error.message : String(error)}`
    isResolving.value = false
  }
}

function getAccessToken(): string | null {
  return serverStore.activeServer?.auth?.oauth2?.tokenExchange?.response?.payload?.access_token ||
    serverStore.activeServer?.auth?.bearerToken ||
    null
}

/**
 * Submit the follow activity
 */
async function handleSubmit() {
  if (!resolvedActorUri.value) {
    errorMessage.value = 'Please resolve an actor first'
    return
  }

  errorMessage.value = null
  successMessage.value = null
  lastFollowPayload.value = null
  lastHttpStatus.value = null
  lastHttpStatusText.value = null
  lastRequestHeaders.value = null
  lastResponseHeaders.value = null
  lastResponseBody.value = null
  showHttpDetails.value = false

  if (!activeActor.value?.profile.id) {
    errorMessage.value = 'No active actor is available for following.'
    return
  }

  if (!outboxUrl.value) {
    errorMessage.value = 'Actor outbox URL is not available.'
    return
  }

  const token = getAccessToken()
  if (!token) {
    errorMessage.value = 'No access token is available for following.'
    return
  }

  const activity = createFollowActivity(activeActor.value.profile.id, resolvedActorUri.value)
  lastFollowPayload.value = activity

  isSubmitting.value = true

  try {
    const exchange = await postActivityToOutbox({
      outboxUrl: outboxUrl.value,
      activity,
      accessToken: token
    })

    // Capture request details
    if (exchange.request) {
      lastRequestHeaders.value = exchange.request.headers
    }

    // Capture response details
    if (exchange.response) {
      lastHttpStatus.value = exchange.response.status_code
      lastHttpStatusText.value = exchange.response.status_text || ''
      lastResponseHeaders.value = exchange.response.headers
      
      // Convert payload to string for display
      if (exchange.response.payload) {
        lastResponseBody.value = typeof exchange.response.payload === 'string'
          ? exchange.response.payload
          : JSON.stringify(exchange.response.payload, null, 2)
      }
    }

    if (!exchange.success) {
      errorMessage.value = exchange.error || 'Failed to follow'
      showHttpDetails.value = true
      isSubmitting.value = false
      return
    }

    successMessage.value = `Followed successfully: HTTP ${lastHttpStatus.value} ${lastHttpStatusText.value}`
    showHttpDetails.value = true
    isSubmitting.value = false
  } catch (error) {
    errorMessage.value = `Follow failed: ${error instanceof Error ? error.message : String(error)}`
    isSubmitting.value = false
  }
}

/**
 * Reset form
 */
function resetForm() {
  actorInput.value = ''
  errorMessage.value = null
  successMessage.value = null
  resolvedActorUri.value = null
  resolvedActorData.value = null
  lastFollowPayload.value = null
  lastHttpStatus.value = null
  lastHttpStatusText.value = null
  lastRequestHeaders.value = null
  lastResponseHeaders.value = null
  lastResponseBody.value = null
  showHttpDetails.value = false

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear form data from storage:', error)
  }
}

// Restore form data from localStorage on mount and setup watchers
watch(
  () => actorInput.value,
  () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ actorInput: actorInput.value }))
    } catch (error) {
      console.error('Failed to save form data:', error)
    }
  }
)

// Clear results when server changes
watch(
  () => serverStore.activeServer,
  () => {
    errorMessage.value = null
    successMessage.value = null
    lastFollowPayload.value = null
    lastHttpStatus.value = null
    lastHttpStatusText.value = null
    lastRequestHeaders.value = null
    lastResponseHeaders.value = null
    lastResponseBody.value = null
    showHttpDetails.value = false
  }
)
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
    <div class="max-w-3xl mx-auto px-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Follow</h1>
            <p class="text-sm text-gray-600 dark:text-gray-400">Send a Follow activity to follow an actor.</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-gray-500 dark:text-gray-400">Outbox</p>
            <p class="text-xs text-gray-900 dark:text-gray-100 break-all max-w-xs">{{ outboxDisplay || 'Not available' }}</p>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-700 dark:text-red-200">{{ errorMessage }}</p>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p class="text-sm text-green-700 dark:text-green-200">{{ successMessage }}</p>
        </div>

        <!-- Main Form -->
        <div class="space-y-4 mb-6">
          <!-- Actor Input -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Actor URI or Fedi Handle
            </label>
            <div class="flex gap-2">
              <input
                v-model="actorInput"
                type="text"
                placeholder="Enter actor URI, fedi handle (@user@domain.com), or username (@bob)"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                @keyup.enter="resolveActor"
              />
              <button
                @click="resolveActor"
                :disabled="isResolving || !actorInput.trim()"
                class="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <RunningIcon v-if="isResolving" class="w-4 h-4 animate-spin" />
                {{ isResolving ? 'Resolving...' : 'Resolve' }}
              </button>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Enter an ActivityPub actor URI, a Fediverse handle, or just a username (e.g., @bob). Incomplete handles will use the server's domain.
            </p>
          </div>

          <!-- Resolve Status -->
          <div v-if="resolveStatus" class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p class="text-sm text-blue-700 dark:text-blue-200">{{ resolveStatus }}</p>
          </div>

          <!-- Resolved Actor Info -->
          <div v-if="resolvedActorUri" class="space-y-3">
            <div class="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Resolved Actor URI</p>
              <p class="text-sm text-gray-900 dark:text-gray-100 break-all font-mono">{{ resolvedActorUri }}</p>
            </div>

            <!-- Actor Data Display -->
            <div v-if="resolvedActorData" class="space-y-2">
              <details class="group">
                <summary class="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Actor Profile Data</span>
                  <svg class="w-4 h-4 text-gray-500 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </summary>
                <div class="mt-2 p-3 bg-gray-900 dark:bg-gray-950 rounded-md border border-gray-700 dark:border-gray-800 overflow-x-auto">
                  <pre class="text-xs text-gray-100 font-mono" v-html="highlightedActorData" />
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div v-if="resolvedActorUri" class="flex gap-2 mb-6">
          <button
            @click="handleSubmit"
            :disabled="isSubmitting || !resolvedActorUri"
            class="px-6 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <RunningIcon v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            {{ isSubmitting ? 'Submitting...' : 'Submit Follow' }}
          </button>
          <button
            @click="resetForm"
            :disabled="isSubmitting"
            class="px-6 py-2 bg-gray-600 text-white rounded-md font-medium hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>
        </div>

        <!-- HTTP Exchange Details -->
        <div v-if="showHttpDetails" class="space-y-4">
          <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">HTTP Exchange Details</h2>

            <!-- Status -->
            <div class="mb-4 p-3 rounded-lg" :class="lastHttpStatus && lastHttpStatus < 300 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'">
              <p class="text-sm" :class="lastHttpStatus && lastHttpStatus < 300 ? 'text-green-700 dark:text-green-200' : 'text-red-700 dark:text-red-200'">
                <span class="font-semibold">Status:</span> {{ lastHttpStatus }} {{ lastHttpStatusText }}
              </p>
            </div>

            <!-- Request Section -->
            <details class="group mb-4">
              <summary class="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Request</span>
                <svg class="w-4 h-4 text-gray-500 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </summary>
              <div class="mt-2 space-y-2">
                <!-- Headers -->
                <div class="p-3 bg-gray-900 dark:bg-gray-950 rounded-md border border-gray-700 dark:border-gray-800">
                  <p class="text-xs font-semibold text-gray-300 mb-2">Headers</p>
                  <div class="text-xs text-gray-200 font-mono space-y-1">
                    <div v-for="(value, key) in lastRequestHeaders" :key="key" class="flex gap-2">
                      <span class="text-blue-400">{{ key }}:</span>
                      <span class="text-gray-300">{{ value }}</span>
                    </div>
                  </div>
                </div>
                <!-- Body -->
                <div class="p-3 bg-gray-900 dark:bg-gray-950 rounded-md border border-gray-700 dark:border-gray-800 overflow-x-auto">
                  <p class="text-xs font-semibold text-gray-300 mb-2">Body</p>
                  <pre class="text-xs text-gray-100 font-mono" v-html="highlightedRequestJson" />
                </div>
              </div>
            </details>

            <!-- Response Section -->
            <details class="group">
              <summary class="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Response</span>
                <svg class="w-4 h-4 text-gray-500 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </summary>
              <div class="mt-2 space-y-2">
                <!-- Headers -->
                <div class="p-3 bg-gray-900 dark:bg-gray-950 rounded-md border border-gray-700 dark:border-gray-800">
                  <p class="text-xs font-semibold text-gray-300 mb-2">Headers</p>
                  <div class="text-xs text-gray-200 font-mono space-y-1">
                    <div v-for="(value, key) in lastResponseHeaders" :key="key" class="flex gap-2">
                      <span class="text-blue-400">{{ key }}:</span>
                      <span class="text-gray-300">{{ value }}</span>
                    </div>
                  </div>
                </div>
                <!-- Body -->
                <div v-if="lastResponseBody" class="p-3 bg-gray-900 dark:bg-gray-950 rounded-md border border-gray-700 dark:border-gray-800 overflow-x-auto">
                  <p class="text-xs font-semibold text-gray-300 mb-2">Body</p>
                  <pre class="text-xs text-gray-100 font-mono" v-html="highlightedResponseJson || lastResponseBody" />
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
