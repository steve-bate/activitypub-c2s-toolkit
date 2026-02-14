<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useServerStore } from '@/stores/serverStore'
import { resolveHandle } from '@/services/webfingerService'
import { syntaxHighlightJson } from '@/utils/jsonHighlighter'

const serverStore = useServerStore()

// TODO special editors for Event and Question types with additional fields
const typeOptions = ['Note', 'Article', 'Document', 'Image', 'Video', 'Question']
const activityType = ref('Note')
const toInput = ref('https://www.w3.org/ns/activitystreams#Public')
const ccInput = ref('')
const replyToInput = ref('')
const summary = ref('')
const content = ref('')
const submitNakedObject = ref(false)

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const lastPostedPayload = ref<Record<string, unknown> | null>(null)
const resolvingHandles = ref(false)
const resolveStatus = ref<string>('')

// Tab mode: 'form' or 'json'
const viewMode = ref<'form' | 'json'>('form')
const rawJsonInput = ref('')

// JSON templates
interface JsonTemplate {
  name: string
  json: string
  createdAt: string
}

const TEMPLATES_STORAGE_KEY = 'activitypub-json-templates'
const savedTemplates = ref<JsonTemplate[]>([])
const showTemplates = ref(false)
const saveTemplateName = ref('')
const showSaveTemplateDialog = ref(false)

// Load saved templates from localStorage
function loadTemplates() {
  try {
    const saved = localStorage.getItem(TEMPLATES_STORAGE_KEY)
    if (saved) {
      savedTemplates.value = JSON.parse(saved)
    }
  } catch (error) {
    console.error('Failed to load templates:', error)
  }
}

// Save templates to localStorage
function saveTemplatesToStorage() {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(savedTemplates.value))
  } catch (error) {
    console.error('Failed to save templates:', error)
  }
}

// Save current JSON as template
function saveAsTemplate() {
  if (!saveTemplateName.value.trim()) {
    return
  }
  
  if (!rawJsonInput.value.trim()) {
    errorMessage.value = 'Cannot save empty JSON as template'
    return
  }
  
  // Validate JSON before saving
  try {
    JSON.parse(rawJsonInput.value)
  } catch {
    errorMessage.value = 'Cannot save invalid JSON as template'
    return
  }
  
  const template: JsonTemplate = {
    name: saveTemplateName.value.trim(),
    json: rawJsonInput.value,
    createdAt: new Date().toISOString()
  }
  
  savedTemplates.value.push(template)
  saveTemplatesToStorage()
  saveTemplateName.value = ''
  showSaveTemplateDialog.value = false
  successMessage.value = `Template "${template.name}" saved`
  setTimeout(() => {
    successMessage.value = null
  }, 3000)
}

// Load a template
function loadTemplate(template: JsonTemplate) {
  rawJsonInput.value = template.json
  showTemplates.value = false
}

// Delete a template
function deleteTemplate(index: number) {
  const template = savedTemplates.value[index]
  if (confirm(`Delete template "${template.name}"?`)) {
    savedTemplates.value.splice(index, 1)
    saveTemplatesToStorage()
  }
}

// HTTP details tracking
const showHttpDetails = ref(false)
const lastHttpStatus = ref<number | null>(null)
const lastHttpStatusText = ref<string | null>(null)
const lastRequestHeaders = ref<Record<string, string> | null>(null)
const lastResponseHeaders = ref<Record<string, string> | null>(null)
const lastResponseBody = ref<string | null>(null)

const STORAGE_KEY = 'activitypub-create-form-data'

// Restore form data from localStorage on mount
onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      activityType.value = data.activityType || 'Note'
      toInput.value = data.toInput || 'https://www.w3.org/ns/activitystreams#Public'
      ccInput.value = data.ccInput || ''
      replyToInput.value = data.replyToInput || ''
      summary.value = data.summary || ''
      content.value = data.content || ''
      rawJsonInput.value = data.rawJsonInput || ''
      viewMode.value = data.viewMode || 'form'
      submitNakedObject.value = data.submitNakedObject || false
    }
  } catch (error) {
    console.error('Failed to restore form data:', error)
  }
  
  // Load saved templates
  loadTemplates()
})

// Save form data to localStorage when any field changes
watch(
  [activityType, toInput, ccInput, replyToInput, summary, content, rawJsonInput, viewMode, submitNakedObject],
  () => {
    try {
      const data = {
        activityType: activityType.value,
        toInput: toInput.value,
        ccInput: ccInput.value,
        replyToInput: replyToInput.value,
        summary: summary.value,
        content: content.value,
        rawJsonInput: rawJsonInput.value,
        viewMode: viewMode.value,
        submitNakedObject: submitNakedObject.value
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
    showHttpDetails.value = false
  }
)

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
  if (!lastPostedPayload.value) return ''
  const formatted = JSON.stringify(lastPostedPayload.value, null, 2)
  return syntaxHighlightJson(formatted)
})

const highlightedResponseJson = computed(() => {
  if (!lastResponseBody.value) return ''
  try {
    const parsed = JSON.parse(lastResponseBody.value)
    const formatted = JSON.stringify(parsed, null, 2)
    return syntaxHighlightJson(formatted)
  } catch {
    // Not valid JSON, return as-is
    return ''
  }
})

/**
 * Detect if a string is a fedi handle
 */
function isFediHandle(value: string): boolean {
  // Match @user@domain or user@domain
  const handleRegex = /^@?[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return handleRegex.test(value.trim())
}

/**
 * Parse audience field and resolve fedi handles to URIs
 */
async function parseAudience(input: string): Promise<string[]> {
  const values = input
    .split(/[\n,]/)
    .map(value => value.trim())
    .filter(value => value.length > 0)
  
  const resolved: string[] = []
  
  for (const value of values) {
    if (isFediHandle(value)) {
      resolveStatus.value = `Resolving ${value}...`
      try {
        const result = await resolveHandle(value)
        if (result.success && result.actorUri) {
          resolved.push(result.actorUri)
          console.log(`Resolved ${value} to ${result.actorUri}`)
        } else {
          console.warn(`Failed to resolve ${value}:`, result.error)
          // Keep the original value if resolution fails
          resolved.push(value)
        }
      } catch (error) {
        console.error(`Error resolving ${value}:`, error)
        resolved.push(value)
      }
    } else {
      // Already a URI or other value
      resolved.push(value)
    }
  }
  
  return resolved
}

/**
 * Extract fedi handles from content
 */
function extractMentions(text: string): Array<{ handle: string; name: string }> {
  // Match @user@domain.com patterns
  const mentionRegex = /@([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
  const mentions: Array<{ handle: string; name: string }> = []
  
  let match
  while ((match = mentionRegex.exec(text)) !== null) {
    const handle = match[1] // Without leading @
    const name = match[0] // With leading @
    mentions.push({ handle, name })
  }
  
  return mentions
}

/**
 * Resolve mentions to actor URIs and create Mention objects
 */
async function resolveMentions(text: string): Promise<Array<{ type: string; href: string; name: string }>> {
  const mentions = extractMentions(text)
  const resolved: Array<{ type: string; href: string; name: string }> = []
  
  for (const mention of mentions) {
    resolveStatus.value = `Resolving mention ${mention.name}...`
    try {
      const result = await resolveHandle(mention.handle)
      if (result.success && result.actorUri) {
        resolved.push({
          type: 'Mention',
          href: result.actorUri,
          name: mention.name
        })
        console.log(`Resolved mention ${mention.name} to ${result.actorUri}`)
      } else {
        console.warn(`Failed to resolve mention ${mention.name}:`, result.error)
      }
    } catch (error) {
      console.error(`Error resolving mention ${mention.name}:`, error)
    }
  }
  
  return resolved
}

function resetForm() {
  activityType.value = 'Note'
  toInput.value = 'https://www.w3.org/ns/activitystreams#Public'
  ccInput.value = ''
  replyToInput.value = ''
  summary.value = ''
  content.value = ''
  rawJsonInput.value = ''
  viewMode.value = 'form'
  submitNakedObject.value = false
  errorMessage.value = null
  successMessage.value = null
  lastPostedPayload.value = null
  lastHttpStatus.value = null
  lastHttpStatusText.value = null
  lastRequestHeaders.value = null
  lastResponseHeaders.value = null
  lastResponseBody.value = null
  showHttpDetails.value = false
  
  // Clear from localStorage
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
  showHttpDetails.value = false
  resolvingHandles.value = true
  resolveStatus.value = ''

  if (!activeActor.value?.uri) {
    errorMessage.value = 'No active actor is available for posting.'
    resolvingHandles.value = false
    return
  }

  if (!outboxUrl.value) {
    errorMessage.value = 'Actor outbox URL is not available.'
    resolvingHandles.value = false
    return
  }

  let activity: Record<string, unknown>

  try {
    if (viewMode.value === 'json') {
      // Parse and use raw JSON input
      if (!rawJsonInput.value.trim()) {
        errorMessage.value = 'JSON input is empty.'
        resolvingHandles.value = false
        return
      }
      
      try {
        activity = JSON.parse(rawJsonInput.value)
        resolvingHandles.value = false
      } catch (parseError) {
        errorMessage.value = `Invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        resolvingHandles.value = false
        return
      }
    } else {
      // Build activity from form inputs
      const toAudience = await parseAudience(toInput.value)
      const ccAudience = await parseAudience(ccInput.value)
      
      // Resolve mentions in content
      const mentions = await resolveMentions(content.value)
      
      resolvingHandles.value = false
      resolveStatus.value = ''

      const resource: Record<string, unknown> = {
        type: activityType.value
      }

      if (summary.value.trim()) {
        resource.summary = summary.value.trim()
      }

      if (content.value.trim()) {
        resource.content = content.value.trim()
      }

      if (toAudience.length > 0) {
        resource.to = toAudience
      }

      if (ccAudience.length > 0) {
        resource.cc = ccAudience
      }

      if (replyToInput.value.trim()) {
        resource.inReplyTo = replyToInput.value.trim()
      }
      
      // Add mentions as tags (Mastodon-compatible)
      if (mentions.length > 0) {
        resource.tag = mentions
      }

      // Add attributedTo current actor
      resource.attributedTo = activeActor.value.uri

      if (submitNakedObject.value) {
        // Submit the object directly without wrapping in activity
        activity = resource
      } else {
        // Wrap object in Create activity
        activity = {
          '@context': 'https://www.w3.org/ns/activitystreams',
          type: 'Create',
          actor: activeActor.value.uri,
          object: resource
        }

        if (toAudience.length > 0) {
          activity.to = toAudience
        }

        if (ccAudience.length > 0) {
          activity.cc = ccAudience
        }
      }
    }

    lastPostedPayload.value = activity

    const token = getAccessToken()
    if (!token) {
      errorMessage.value = 'No access token is available for posting.'
      return
    }

    isSubmitting.value = true
    
    // Capture request headers
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

    // Capture response details
    lastHttpStatus.value = response.status
    lastHttpStatusText.value = response.statusText
    
    // Capture response headers
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    lastResponseHeaders.value = responseHeaders
    
    const responseText = await response.text()
    lastResponseBody.value = responseText

    if (!response.ok) {
      errorMessage.value = `Failed to post: HTTP ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ''}`
      showHttpDetails.value = true
      isSubmitting.value = false
      return
    }

    successMessage.value = `Resource posted successfully: HTTP ${response.status} ${response.statusText}`
    showHttpDetails.value = true
    isSubmitting.value = false
  } catch (error) {
    errorMessage.value = `Post failed: ${error instanceof Error ? error.message : String(error)}`
    resolvingHandles.value = false
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
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Create Resource</h1>
            <p class="text-sm text-gray-600 dark:text-gray-400">Send a Create activity to the actor outbox.</p>
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
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select
              v-model="activityType"
              class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100"
            >
              <option v-for="option in typeOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
            <textarea
              v-model="toInput"
              rows="2"
              placeholder="Comma or newline separated URIs or fedi handles (@user@domain)"
              class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cc</label>
            <textarea
              v-model="ccInput"
              rows="2"
              placeholder="Comma or newline separated URIs or fedi handles (@user@domain)"
              class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reply To</label>
            <input
              v-model="replyToInput"
              type="text"
              placeholder="URI of the object this is replying to (optional)"
              class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary</label>
            <input
              v-model="summary"
              type="text"
              placeholder="Optional summary"
              class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
            <textarea
              v-model="content"
              rows="6"
              placeholder="Write your content (mention users with @user@domain)"
              class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100"
            ></textarea>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Tip: Mention users with @user@domain format, and they'll be automatically resolved and added as Mention tags</p>
          </div>

          <div class="flex items-center gap-2">
            <input
              id="submitNakedObject"
              v-model="submitNakedObject"
              type="checkbox"
              class="w-4 h-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-blue-600 focus:ring-blue-500"
            />
            <label for="submitNakedObject" class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Submit as naked object (not wrapped in Create activity)
            </label>
          </div>

          <div v-if="resolvingHandles" class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
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
              :disabled="isSubmitting || resolvingHandles"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
            >
              {{ resolvingHandles ? 'Resolving handles...' : isSubmitting ? 'Posting...' : 'Post' }}
            </button>
          </div>
        </form>

        <!-- Raw JSON View -->
        <div v-if="viewMode === 'json'" class="space-y-4">
          <!-- Template Management -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="showTemplates = !showTemplates"
                class="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path>
                </svg>
                Saved Activities ({{ savedTemplates.length }})
              </button>
              <button
                type="button"
                @click="showSaveTemplateDialog = true"
                class="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-1"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                </svg>
                Save
              </button>
            </div>
          </div>

          <!-- Save Template Dialog -->
          <div v-if="showSaveTemplateDialog" class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Save JSON Template</h3>
            <div class="flex items-center gap-2">
              <input
                v-model="saveTemplateName"
                type="text"
                placeholder="Template name"
                class="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100"
                @keyup.enter="saveAsTemplate"
              />
              <button
                type="button"
                @click="saveAsTemplate"
                class="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                @click="showSaveTemplateDialog = false; saveTemplateName = ''"
                class="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm font-medium rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          <!-- Templates List -->
          <div v-if="showTemplates && savedTemplates.length > 0" class="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
            <div class="max-h-60 overflow-y-auto">
              <div
                v-for="(template, index) in savedTemplates"
                :key="index"
                class="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                <div class="flex-1 min-w-0">
                  <button
                    type="button"
                    @click="loadTemplate(template)"
                    class="text-left w-full"
                  >
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ template.name }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ new Date(template.createdAt).toLocaleString() }}</p>
                  </button>
                </div>
                <button
                  type="button"
                  @click="deleteTemplate(index)"
                  class="ml-2 p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Delete template"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div v-if="showTemplates && savedTemplates.length === 0" class="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400 text-center">
            No saved templates yet
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Activity JSON
            </label>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Enter the complete Activity Streams 2.0 activity to post. The JSON should include the @context, type, and all required fields.
            </p>
            <textarea
              v-model="rawJsonInput"
              rows="20"
              placeholder='{\n  "@context": "https://www.w3.org/ns/activitystreams",\n  "type": "Create",\n  "actor": "...",\n  "object": {\n    "type": "Note",\n    "content": "Hello world"\n  }\n}'
              class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 font-mono"
            ></textarea>
          </div>

          <div v-if="resolvingHandles" class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
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
              type="button"
              @click="handleSubmit"
              :disabled="isSubmitting || resolvingHandles"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
            >
              {{ resolvingHandles ? 'Processing...' : isSubmitting ? 'Posting...' : 'Post' }}
            </button>
          </div>
        </div>

        <!-- HTTP Details Panel -->
        <div v-if="lastHttpStatus !== null" class="mt-6 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            type="button"
            @click="showHttpDetails = !showHttpDetails"
            class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center justify-between text-left transition-colors"
          >
            <div class="flex items-center gap-3">
              <span
                :class="[
                  'px-2 py-0.5 rounded text-xs font-semibold',
                  lastHttpStatus >= 200 && lastHttpStatus < 300
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                ]"
              >
                {{ lastHttpStatus }} {{ lastHttpStatusText }}
              </span>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">HTTP Request/Response Details</span>
            </div>
            <svg
              :class="['w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform', showHttpDetails ? 'rotate-180' : '']"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div v-if="showHttpDetails" class="p-4 bg-white dark:bg-gray-900 space-y-4">
            <!-- Request Headers -->
            <div>
              <h3 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Request Headers</h3>
              <div class="bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3">
                <div v-for="(value, key) in lastRequestHeaders" :key="key" class="flex text-xs mb-1 last:mb-0">
                  <span class="font-medium text-gray-600 dark:text-gray-400 min-w-[140px]">{{ key }}:</span>
                  <span class="text-gray-900 dark:text-gray-100 break-all">{{ value }}</span>
                </div>
              </div>
            </div>

            <!-- Response Headers -->
            <div>
              <h3 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Response Headers</h3>
              <div class="bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3">
                <div v-if="lastResponseHeaders && Object.keys(lastResponseHeaders).length > 0">
                  <div v-for="(value, key) in lastResponseHeaders" :key="key" class="flex text-xs mb-1 last:mb-0">
                    <span class="font-medium text-gray-600 dark:text-gray-400 min-w-[140px]">{{ key }}:</span>
                    <span class="text-gray-900 dark:text-gray-100 break-all">{{ value }}</span>
                  </div>
                </div>
                <p v-else class="text-xs text-gray-500 dark:text-gray-400">No response headers</p>
              </div>
            </div>

            <!-- Request Payload -->
            <div>
              <h3 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Request Payload (JSON)</h3>
              <div class="bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3 overflow-x-auto">
                <pre class="text-xs font-mono" v-html="highlightedRequestJson"></pre>
              </div>
            </div>

            <!-- Response Body -->
            <div v-if="lastResponseBody">
              <h3 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Response Body</h3>
              <div class="bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3 overflow-x-auto">
                <pre v-if="highlightedResponseJson" class="text-xs font-mono" v-html="highlightedResponseJson"></pre>
                <pre v-else class="text-xs text-gray-900 dark:text-gray-100 font-mono whitespace-pre-wrap break-words">{{ lastResponseBody }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
