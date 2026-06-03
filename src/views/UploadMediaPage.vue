<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useServerStore } from '@/stores/serverStore'
import { postMediaToUploadEndpoint } from '@/services/activitypubService'
import HttpExchangePanel from '@/components/http/HttpExchangePanel.vue'
import type { HttpExchange, HttpRequestData, HttpResponseData } from '@/types/http'
import RunningIcon from '@/components/icons/RunningIcon.vue'

const serverStore = useServerStore()

const objectType = ref('Image')
const nameInput = ref('')
const summaryInput = ref('')
const contentInput = ref('')
const toInput = ref('https://www.w3.org/ns/activitystreams#Public')
const ccInput = ref('')
const selectedFile = ref<File | null>(null)

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const locationHeader = ref<string | null>(null)
const exchange = ref<HttpExchange<HttpRequestData, HttpResponseData> | null>(null)

interface ResponseLink {
  label: string
  href: string
}

const STORAGE_KEY = 'activitypub-upload-media-form-data'

const activeActor = computed(() => serverStore.activeServer?.actor?.profile)
const uploadMediaUrl = computed(() => activeActor.value?.endpoints?.uploadMedia || '')
const canUploadMedia = computed(() => uploadMediaUrl.value.length > 0)

const uploadMediaDisplay = computed(() => {
  if (!uploadMediaUrl.value) return ''
  try {
    const url = new URL(uploadMediaUrl.value)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return uploadMediaUrl.value.replace(/^https?:\/\/[^/]+/i, '')
  }
})

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

const responseLinks = computed<ResponseLink[]>(() => {
  const links: ResponseLink[] = []

  // For 202 Accepted, the object isn't in the response body yet — show the Location header as the id link
  const status = exchange.value?.response?.status_code
  if (status === 202 && locationHeader.value) {
    links.push({ label: 'id (Location)', href: locationHeader.value })
    return links
  }

  const payload = exchange.value?.response?.payload
  if (!payload || typeof payload !== 'object') {
    return links
  }

  const payloadObject = payload as Record<string, unknown>

  if (isHttpUrl(payloadObject.id)) {
    links.push({ label: 'id', href: payloadObject.id })
  }

  const addUrlLink = (labelBase: string, value: unknown, index?: number) => {
    if (isHttpUrl(value)) {
      links.push({
        label: typeof index === 'number' ? `${labelBase}[${index}]` : labelBase,
        href: value
      })
      return
    }

    if (value && typeof value === 'object') {
      const linkObject = value as Record<string, unknown>
      if (isHttpUrl(linkObject.href)) {
        links.push({
          label: 'url',
          href: linkObject.href
        })
      }
    }
  }

  const addUrlFieldLinks = (labelBase: string, urlField: unknown) => {
    if (Array.isArray(urlField)) {
      urlField.forEach((item, index) => addUrlLink(labelBase, item, index))
      return
    }
    addUrlLink(labelBase, urlField)
  }

  if (payloadObject.type === 'Create' && payloadObject.object && typeof payloadObject.object === 'object') {
    const objectPayload = payloadObject.object as Record<string, unknown>
    addUrlFieldLinks('object.url', objectPayload.url)
  } else {
    addUrlFieldLinks('url', payloadObject.url)
  }

  return links
})

function parseAudience(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map(value => value.trim())
    .filter(value => value.length > 0)
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] ?? null
  selectedFile.value = file
}

function getAccessToken(): string | undefined {
  return serverStore.activeServer?.auth?.bearerToken
}

function buildUploadObject(): { type: string; [key: string]: unknown } {
  const actorId = activeActor.value?.id
  const to = parseAudience(toInput.value)
  const cc = parseAudience(ccInput.value)

  const mediaObject: Record<string, unknown> = {
    type: objectType.value,
    attributedTo: actorId,
  }

  if (nameInput.value.trim()) {
    mediaObject.name = nameInput.value.trim()
  }
  if (summaryInput.value.trim()) {
    mediaObject.summary = summaryInput.value.trim()
  }
  if (contentInput.value.trim()) {
    mediaObject.content = contentInput.value.trim()
  }
  if (to.length > 0) {
    mediaObject.to = to
  }
  if (cc.length > 0) {
    mediaObject.cc = cc
  }

  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Create',
    actor: actorId,
    object: mediaObject,
    ...(to.length > 0 ? { to } : {}),
    ...(cc.length > 0 ? { cc } : {})
  }
}

async function handleSubmit() {
  errorMessage.value = null
  successMessage.value = null
  locationHeader.value = null
  exchange.value = null

  if (!activeActor.value?.id) {
    errorMessage.value = 'No active actor is available for media upload.'
    return
  }

  if (!canUploadMedia.value) {
    errorMessage.value = 'No uploadMedia endpoint is available for the active actor.'
    return
  }

  const token = getAccessToken()
  if (!token) {
    errorMessage.value = 'No access token is available for media upload.'
    return
  }

  if (!selectedFile.value) {
    errorMessage.value = 'Please select a file to upload.'
    return
  }

  isSubmitting.value = true

  try {
    const shellObject = buildUploadObject()
    const uploadExchange = await postMediaToUploadEndpoint({
      uploadMediaUrl: uploadMediaUrl.value,
      object: shellObject,
      file: selectedFile.value,
      accessToken: token
    })

    exchange.value = uploadExchange as unknown as HttpExchange<HttpRequestData, HttpResponseData>

    if (!uploadExchange.success) {
      errorMessage.value = uploadExchange.error || 'Media upload failed.'
      isSubmitting.value = false
      return
    }

    const status = uploadExchange.response?.status_code
    locationHeader.value = uploadExchange.response?.headers?.location || null

    if (status === 201 || status === 202) {
      successMessage.value = `Upload accepted: HTTP ${status}${locationHeader.value ? ` (Location: ${locationHeader.value})` : ''}`
    } else {
      successMessage.value = `Upload completed with HTTP ${status}${locationHeader.value ? ` (Location: ${locationHeader.value})` : ''}`
    }

    isSubmitting.value = false
  } catch (error) {
    errorMessage.value = `Upload failed: ${error instanceof Error ? error.message : String(error)}`
    isSubmitting.value = false
  }
}

function resetForm() {
  objectType.value = 'Image'
  nameInput.value = ''
  summaryInput.value = ''
  contentInput.value = ''
  toInput.value = 'https://www.w3.org/ns/activitystreams#Public'
  ccInput.value = ''
  selectedFile.value = null
  errorMessage.value = null
  successMessage.value = null
  locationHeader.value = null
  exchange.value = null

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear upload form data from storage:', error)
  }
}

watch(
  [objectType, nameInput, summaryInput, contentInput, toInput, ccInput],
  () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          objectType: objectType.value,
          nameInput: nameInput.value,
          summaryInput: summaryInput.value,
          contentInput: contentInput.value,
          toInput: toInput.value,
          ccInput: ccInput.value
        })
      )
    } catch (error) {
      console.error('Failed to persist upload form data:', error)
    }
  },
  { deep: true }
)

watch(
  () => serverStore.activeServer,
  () => {
    errorMessage.value = null
    successMessage.value = null
    locationHeader.value = null
    exchange.value = null
  }
)

try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    const parsed = JSON.parse(saved) as Record<string, string>
    objectType.value = parsed.objectType || 'Image'
    nameInput.value = parsed.nameInput || ''
    summaryInput.value = parsed.summaryInput || ''
    contentInput.value = parsed.contentInput || ''
    toInput.value = parsed.toInput || 'https://www.w3.org/ns/activitystreams#Public'
    ccInput.value = parsed.ccInput || ''
  }
} catch (error) {
  console.error('Failed to restore upload form data:', error)
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
    <div class="max-w-4xl mx-auto px-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Upload Media</h1>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Upload a file to the actor's ActivityPub uploadMedia endpoint using multipart/form-data.
            </p>
          </div>
          <div class="text-right">
            <p class="text-xs text-gray-500 dark:text-gray-400">uploadMedia</p>
            <p class="text-xs text-gray-900 dark:text-gray-100 break-all max-w-xs">
              {{ uploadMediaDisplay || 'Not available' }}
            </p>
          </div>
        </div>

        <div v-if="!canUploadMedia" class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p class="text-sm text-yellow-800 dark:text-yellow-200">
            The active actor profile does not define endpoints.uploadMedia. This feature is disabled.
          </p>
        </div>

        <div v-if="errorMessage" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-700 dark:text-red-200">{{ errorMessage }}</p>
        </div>

        <div v-if="successMessage" class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p class="text-sm text-green-700 dark:text-green-200">{{ successMessage }}</p>
          <p v-if="locationHeader" class="text-xs text-green-700 dark:text-green-200 mt-1 break-all">
            Location: {{ locationHeader }}
          </p>
        </div>

        <div v-if="responseLinks.length > 0" class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p class="text-sm font-medium text-blue-900 dark:text-blue-100">Response Links</p>
          <ul class="mt-2 space-y-1">
            <li v-for="link in responseLinks" :key="`${link.label}:${link.href}`" class="text-sm text-blue-900 dark:text-blue-100 break-all">
              <span class="font-medium">{{ link.label }}:</span>
              <a
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
                class="ml-1 underline decoration-blue-400 hover:text-blue-700 dark:hover:text-blue-200"
              >
                {{ link.href }}
              </a>
            </li>
          </ul>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="block">
            <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Media Type</span>
            <select
              v-model="objectType"
              :disabled="isSubmitting || !canUploadMedia"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            >
              <option value="Image">Image</option>
              <option value="Video">Video</option>
              <option value="Audio">Audio</option>
              <option value="Document">Document</option>
            </select>
          </label>

          <label class="block">
            <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File</span>
            <input
              type="file"
              :disabled="isSubmitting || !canUploadMedia"
              @change="onFileChange"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            >
          </label>

          <label class="block md:col-span-2">
            <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</span>
            <input
              v-model="nameInput"
              type="text"
              :disabled="isSubmitting || !canUploadMedia"
              placeholder="Optional title"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            >
          </label>

          <label class="block md:col-span-2">
            <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary</span>
            <textarea
              v-model="summaryInput"
              :disabled="isSubmitting || !canUploadMedia"
              rows="2"
              placeholder="Optional summary"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            />
          </label>

          <label class="block md:col-span-2">
            <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</span>
            <textarea
              v-model="contentInput"
              :disabled="isSubmitting || !canUploadMedia"
              rows="4"
              placeholder="Optional content/body"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            />
          </label>

          <label class="block md:col-span-2">
            <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To (comma or newline separated URIs)</span>
            <textarea
              v-model="toInput"
              :disabled="isSubmitting || !canUploadMedia"
              rows="2"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            />
          </label>

          <label class="block md:col-span-2">
            <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CC (comma or newline separated URIs)</span>
            <textarea
              v-model="ccInput"
              :disabled="isSubmitting || !canUploadMedia"
              rows="2"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            />
          </label>
        </div>

        <div class="flex items-center gap-3">
          <button
            @click="handleSubmit"
            :disabled="isSubmitting || !canUploadMedia"
            class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            <RunningIcon v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            {{ isSubmitting ? 'Uploading...' : 'Upload Media' }}
          </button>

          <button
            @click="resetForm"
            :disabled="isSubmitting"
            class="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
          >
            Reset
          </button>
        </div>

        <div v-if="exchange" class="border-t border-gray-200 dark:border-gray-700 pt-6">
          <HttpExchangePanel :exchange="exchange" title="HTTP Exchange Details" />
        </div>
      </div>
    </div>
  </div>
</template>
