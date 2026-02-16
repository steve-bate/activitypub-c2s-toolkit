<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useServerStore } from '@/stores/serverStore'
import { resolveHandle } from '@/services/webfingerService'
import HttpRequestPanel from '@/components/http/HttpRequestPanel.vue'
import HttpResponsePanel from '@/components/http/HttpResponsePanel.vue'

const serverStore = useServerStore()

const targetInput = ref('')
const resolvedUri = ref<string | null>(null)

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const lastPostedPayload = ref<Record<string, unknown> | null>(null)
const resolvingHandle = ref(false)
const resolveStatus = ref<string>('')

// Tab mode: 'form' or 'json'
const viewMode = ref<'form' | 'json'>('form')
const rawJsonInput = ref('')

// HTTP details tracking
const lastHttpStatus = ref<number | null>(null)
const lastHttpStatusText = ref<string | null>(null)
const lastRequestHeaders = ref<Record<string, string> | null>(null)
const lastResponseHeaders = ref<Record<string, string> | null>(null)
const lastResponseBody = ref<string | null>(null)

const STORAGE_KEY = 'activitypub-follow-form-data'

// Restore form data from localStorage on mount
onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      targetInput.value = data.targetInput || ''
      rawJsonInput.value = data.rawJsonInput || ''
      viewMode.value = data.viewMode || 'form'
    }
  } catch (error) {
    console.error('Failed to restore form data:', error)
  }
})

// Save form data to localStorage when any field changes
watch(
  [targetInput, rawJsonInput, viewMode],
  () => {
    try {
      const data = {
        targetInput: targetInput.value,
        rawJsonInput: rawJsonInput.value,
        viewMode: viewMode.value
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save form data:', error)
    }
  },
  { deep: true }
)

// Clear results when server changes
watch(
  () => serverStore.activeServer,
  () => {
    errorMessage.value = null
    successMessage.value = null
    lastPostedPayload.value = null
    lastHttpStatus.value = null
    lastHttpStatusText.value = null
    lastRequestHeaders.value = null
    lastResponseHeaders.value = null
    lastResponseBody.value = null
  }
)

const activeActor = computed(() => serverStore.activeServer?.actor)
const outboxUrl = computed(() => activeActor.value?.profile?.outbox || '')
const parsedResponseBody = computed(() => {
  if (!lastResponseBody.value) return null
  try {
    return JSON.parse(lastResponseBody.value)
  } catch {
    return null
  }
})

const outboxDisplay = computed(() => {
  if (!outboxUrl.value) return ''
  try {
    const url = new URL(outboxUrl.value)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return outboxUrl.value.replace(/^https?:\/\/[^/]+/i, '')
  }
})

/**
 * Detect if a string is a fedi handle
 */
function isFediHandle(value: string): boolean {
  const handleRegex = /^@?[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return handleRegex.test(value.trim())
}

/**
 * Resolve the target input to a URI (handles WebFinger resolution)
 */
async function resolveTarget(input: string): Promise<string | null> {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (isFediHandle(trimmed)) {
    resolvingHandle.value = true
    resolveStatus.value = `Resolving ${trimmed}...`
    try {
      const result = await resolveHandle(trimmed)
      if (result.success && result.actorUri) {
        resolvedUri.value = result.actorUri
        return result.actorUri
      } else {
        errorMessage.value = `Failed to resolve handle ${trimmed}: ${result.error || 'Unknown error'}`
        return null
      }
    } catch (error) {
      errorMessage.value = `Error resolving ${trimmed}: ${error instanceof Error ? error.message : String(error)}`
      return null
    } finally {
      resolvingHandle.value = false
      resolveStatus.value = ''
    }
  }

  // Already a URI
  resolvedUri.value = null
  return trimmed
}

// Clear resolved URI when input changes
watch(targetInput, () => {
  resolvedUri.value = null
})

function resetForm() {
  targetInput.value = ''
  resolvedUri.value = null
  rawJsonInput.value = ''
  viewMode.value = 'form'
  errorMessage.value = null
  successMessage.value = null
  lastPostedPayload.value = null
  lastHttpStatus.value = null
  lastHttpStatusText.value = null
  lastRequestHeaders.value = null
  lastResponseHeaders.value = null
  lastResponseBody.value = null

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear form data from storage:', error)
  }
}

function getAccessToken(): string | null {
  return serverStore.activeServer?.tokenResponse?.access_token ||
    serverStore.activeServer?.bearerToken ||
    null
}

async function handleSubmit() {
  errorMessage.value = null
  successMessage.value = null
  lastPostedPayload.value = null
  lastHttpStatus.value = null
  lastHttpStatusText.value = null
  lastRequestHeaders.value = null
  lastResponseHeaders.value = null
  lastResponseBody.value = null

  if (!activeActor.value?.uri) {
    errorMessage.value = 'No active actor is available.'
    return
  }

  if (!outboxUrl.value) {
    errorMessage.value = 'Actor outbox URL is not available.'
    return
  }

  let activity: Record<string, unknown>

  try {
    if (viewMode.value === 'json') {
      if (!rawJsonInput.value.trim()) {
        errorMessage.value = 'JSON input is empty.'
        return
      }

      try {
        activity = JSON.parse(rawJsonInput.value)
      } catch (parseError) {
        errorMessage.value = `Invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        return
      }
    } else {
      const targetUri = await resolveTarget(targetInput.value)
      if (!targetUri) {
        if (!errorMessage.value) {
          errorMessage.value = 'Please enter a target actor URI or handle.'
        }
        return
      }

      activity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Follow',
        actor: activeActor.value.uri,
        object: targetUri
      }
    }

    lastPostedPayload.value = activity

    const token = getAccessToken()
    if (!token) {
      errorMessage.value = 'No access token is available.'
      return
    }

    isSubmitting.value = true

    const requestHeaders = {
      'Authorization': `Bearer ${token.substring(0, 20)}...`,
      'Content-Type': 'application/activity+json',
      'Accept': 'application/activity+json, application/json'
    }
    lastRequestHeaders.value = requestHeaders

    const response = await fetch(outboxUrl.value, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/activity+json',
        'Accept': 'application/activity+json, application/json'
      },
      body: JSON.stringify(activity)
    })

    lastHttpStatus.value = response.status
    lastHttpStatusText.value = response.statusText

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    lastResponseHeaders.value = responseHeaders

    const responseText = await response.text()
    lastResponseBody.value = responseText

    if (!response.ok) {
      errorMessage.value = `Failed to send Follow: HTTP ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ''}`
      isSubmitting.value = false
      return
    }

    successMessage.value = `Follow activity sent successfully: HTTP ${response.status} ${response.statusText}`

    isSubmitting.value = false
  } catch (error) {
    errorMessage.value = `Follow failed: ${error instanceof Error ? error.message : String(error)}`
    resolvingHandle.value = false
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
    <div class="max-w-3xl mx-auto px-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Follow Actor</h1>
            <p class="text-sm text-gray-600 dark:text-gray-400">Send a Follow activity to the actor outbox.</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-gray-500 dark:text-gray-400">Outbox</p>
            <p class="text-xs text-gray-900 dark:text-gray-100 break-all max-w-xs">{{ outboxDisplay || 'Not available' }}</p>
          </div>
        </div>

        <div v-if="errorMessage" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-700 dark:text-red-200 mb-3">{{ errorMessage }}</p>
          <div v-if="lastPostedPayload" class="bg-red-50/70 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md p-3">
            <p class="text-xs font-medium text-red-700 dark:text-red-200 mb-2">Posted Payload</p>
            <pre class="text-xs text-red-900 dark:text-red-100 whitespace-pre-wrap break-words font-mono">{{ JSON.stringify(lastPostedPayload, null, 2) }}</pre>
          </div>
        </div>

        <div v-if="successMessage" class="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-200">
          {{ successMessage }}
        </div>

        <!-- Tab Navigation -->
        <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav class="-mb-px flex space-x-4" aria-label="Tabs">
            <button
              @click="viewMode = 'form'"
              :class="[
                viewMode === 'form'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600',
                'whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors'
              ]"
            >
              Form
            </button>
            <button
              @click="viewMode = 'json'"
              :class="[
                viewMode === 'json'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600',
                'whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors'
              ]"
            >
              Raw JSON
            </button>
          </nav>
        </div>

        <!-- Form View -->
        <form v-if="viewMode === 'form'" class="space-y-4" @submit.prevent="handleSubmit">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Actor</label>
            <input
              v-model="targetInput"
              type="text"
              placeholder="Actor URI or @user@domain handle"
              class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Enter an actor URI (e.g., https://mastodon.social/users/alice) or a fedi handle (e.g., @alice@mastodon.social)</p>
          </div>

          <div v-if="resolvedUri" class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <p class="text-xs font-medium text-green-700 dark:text-green-200">Resolved URI</p>
            <p class="text-sm text-green-900 dark:text-green-100 break-all font-mono">{{ resolvedUri }}</p>
          </div>

          <div v-if="resolvingHandle" class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p class="text-sm text-blue-700 dark:text-blue-200">{{ resolveStatus }}</p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3">
            <button
              type="button"
              @click="resetForm"
              class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm font-medium rounded-md transition-colors"
            >
              Reset
            </button>
            <button
              type="submit"
              :disabled="isSubmitting || resolvingHandle"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
            >
              {{ resolvingHandle ? 'Resolving handle...' : isSubmitting ? 'Sending...' : 'Follow' }}
            </button>
          </div>
        </form>

        <!-- Raw JSON View -->
        <div v-if="viewMode === 'json'" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Activity JSON
            </label>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Enter the complete Follow activity JSON to post. The JSON should include the @context, type, actor, and object fields.
            </p>
            <textarea
              v-model="rawJsonInput"
              rows="12"
              placeholder='{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Follow",
  "actor": "...",
  "object": "https://example.com/users/alice"
}'
              class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 font-mono"
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-3">
            <button
              type="button"
              @click="resetForm"
              class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm font-medium rounded-md transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              @click="handleSubmit"
              :disabled="isSubmitting"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
            >
              {{ isSubmitting ? 'Sending...' : 'Follow' }}
            </button>
          </div>
        </div>

        <!-- HTTP Details Panels -->
        <div v-if="lastHttpStatus !== null" class="mt-6 space-y-3">
          <HttpRequestPanel
            title="Follow Request"
            :url="outboxUrl"
            :headers="lastRequestHeaders"
            :payload="lastPostedPayload"
            content-type="application/activity+json"
          />
          <HttpResponsePanel
            title="Server Response"
            :status="lastHttpStatus"
            :status-text="lastHttpStatusText"
            :headers="lastResponseHeaders"
            :payload="parsedResponseBody"
            :payload-raw="lastResponseBody"
            content-type="application/json"
          />
        </div>
      </div>
    </div>
  </div>
</template>
