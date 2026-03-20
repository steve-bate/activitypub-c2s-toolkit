<script setup lang="ts">
import JsonBrowser from '@/components/JsonBrowser.vue'
import HttpExchangePanel from '@/components/http/HttpExchangePanel.vue'
import PersonPreview from '@/components/preview/PersonPreview.vue'
import ActivityPreview from '@/components/preview/ActivityPreview.vue'
import DocumentPreview from '@/components/preview/DocumentPreview.vue'
import type { HttpExchange, HttpRequestData, HttpResponseData } from '@/types/http'
import { ref, watch, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'
import RunningIcon from '@/components/icons/RunningIcon.vue'

const route = useRoute()
const router = useRouter()
const serverStore = useServerStore()

const responseData = ref<Record<string, unknown> | undefined>(undefined)
const isLoading = ref(false)
const error = ref<string | null>(null)
const httpExchange = ref<HttpExchange<HttpRequestData, HttpResponseData> | undefined>(undefined)
const showPreview = ref(false)
const referringProperty = ref<string | undefined>(undefined)

const isActivityPub = computed(() => {
  const context = responseData.value?.['@context']
  if (!context) return false
  const activityPubUrl = 'https://www.w3.org/ns/activitystreams'
  return JSON.stringify(context).includes(activityPubUrl)
})

const isCreate = computed(() => {
  return isActivityPub.value && String(responseData.value?.type).toLowerCase() === 'create'
})


const isDocument = computed(() => {
  if (!isActivityPub.value) return false
  const type = String(responseData.value?.type || '').toLowerCase()
  const documentTypes = ['note', 'article', 'page', 'document']
  return documentTypes.includes(type)
})

const canShowPreview = computed(() => {
  return (
    isActivityPub.value && (
      responseData.value?.type === 'Person' ||
      isCreate.value ||
      isDocument.value
    )
  )
})

function togglePreview() {
  showPreview.value = !showPreview.value
}

// Initialize showPreview from query param if present
onMounted(() => {
  const previewParam = route.query.preview
  if (previewParam === 'true') {
    showPreview.value = true
  } else if (previewParam === 'false') {
    showPreview.value = false
  }
})

/**
 * Handle clicked URI - push to router for back button support
 */
function handleClickedUri(uri: string, property?: string) {
  const query: Record<string, string> = { uri }
  if (property) {
    query.property = property
  }
  void router.push({ name: 'json', query })
}

/**
 * Fetch URI with ActivityPub headers and access token
 */
async function handleFetch(uri: string) {
  if (!uri || !uri.trim()) return
  
  isLoading.value = true
  error.value = null
  responseData.value = undefined
  httpExchange.value = undefined
  
  try {
    const activeServer = serverStore.activeServer
    const requestHeadersData: Record<string, string> = {}
    
    // Add authorization if we have a token
    const accessToken = activeServer?.auth?.bearerToken;
    if (accessToken && activeServer.origin && uri.startsWith(activeServer.origin)) {
      requestHeadersData['Authorization'] = `Bearer ${accessToken}`
    }
    
    const fetchHeaders: Record<string, string> = {
      ...requestHeadersData,
      'Accept': 'application/activity+json'
    }

    let response: Response
    try {
      response = await fetch(uri, { headers: fetchHeaders })
    } catch (err) {
      // If CORS error (likely due to Accept header), retry without it
      if (err instanceof Error && (err.message?.includes('CORS') || err.name === 'TypeError')) {
        console.warn('Possible CORS error with Accept header, retrying without Accept header')
        delete fetchHeaders['Accept']
        response = await fetch(uri, { headers: fetchHeaders })
      } else {
        throw err
      }
    }
    
    if (!response.ok) {
      error.value = `HTTP ${response.status} ${response.statusText}`
      httpExchange.value = {
        success: false,
        error: `HTTP ${response.status} ${response.statusText}`,
        request: {
          url: uri,
          headers: fetchHeaders
        },
        response: {
          status_code: response.status,
          status_text: response.statusText,
          headers: {}
        }
      }
      return
    }
    
    // Capture response headers
    const responseHeadersObj: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeadersObj[key] = value
    })
    
    const data = await response.json()
    
    responseData.value = data
    
    // Build HTTP exchange object
    httpExchange.value = {
      success: true,
      request: {
        url: uri,
        headers: fetchHeaders
      },
      response: {
        status_code: response.status,
        status_text: response.statusText,
        headers: responseHeadersObj,
        payload: data
      }
    }
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('CORS') || err.name === 'TypeError')) {
      error.value = 'CORS Error: The server does not allow cross-origin requests. This is a server configuration issue. To fix: the server needs to add "Accept" and "Authorization" to Access-Control-Allow-Headers.'
    } else {
      error.value = err instanceof Error ? err.message : 'Failed to fetch URI'
    }
    console.error('Fetch error:', err)
  } finally {
    isLoading.value = false
  }
}

function getRouteUri(): string | undefined {
  const value = route.query.uri
  if (typeof value === 'string' && value.trim()) {
    return value
  }
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0]
  }
  return undefined
}

function getRouteProperty(): string | undefined {
  const value = route.query.property
  if (typeof value === 'string' && value.trim()) {
    return value
  }
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0]
  }
  return undefined
}

// Watch for changes to the URI query parameter
watch(
  () => route.fullPath,
  () => {
    const uri = getRouteUri()
    referringProperty.value = getRouteProperty()
    if (uri) {
      void handleFetch(uri)
    }
  },
  { immediate: true }
)

// Watch for changes to active server - if JSON is being displayed, fetch actor for new server
watch(
  () => serverStore.activeServerId,
  async (newServerId, oldServerId) => {
    // Only proceed if:
    // 1. Server actually changed
    // 2. There's JSON data currently being displayed
    // 3. The new server has an authorized status and actor info
    if (!newServerId || newServerId === oldServerId || !responseData.value) {
      return
    }

    const server = serverStore.activeServer
    if (!server || server.auth?.authStatus !== 'authorized' || !server.actor?.profile.id) {
      return
    }

    // If the current server doesn't have token/metadata, try to discover actor
    if (!server.auth?.oauth2?.authServerDiscovery?.authorizationServerMetadata &&
        !server.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload) {
      return
    }

    // Fetch the actor profile for the newly selected server
    try {
      const actorUri = server.actor.profile.id
      if (actorUri) {
      console.debug('Server changed, fetching actor for new server:', actorUri)
        await handleFetch(actorUri)
      }
    } catch (err) {
      console.error('Error fetching actor after server change:', err)
      error.value = `Failed to fetch actor: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  }
)
</script>

<template>
  <div class="flex h-[calc(100vh-57px)]">
    <!-- Main content -->
    <div class="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Referring property badge -->
        <div v-if="referringProperty && referringProperty !== 'id'" class="mb-3">
          <span class="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full border border-blue-200 dark:border-blue-800">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
            </svg>
            {{ referringProperty }}
          </span>
        </div>

        <!-- Preview/JSON toggle button panel -->
        <div v-if="canShowPreview" class="pb-2 mb-4">
          <button 
            @click="togglePreview"
            class="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {{ showPreview ? 'JSON' : 'Preview' }}
          </button>
        </div>

        <!-- Loading state -->
        <div v-if="isLoading" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-8">
          <div class="flex items-center justify-center">
            <RunningIcon/>
            <span class="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
          </div>
        </div>
        
        <!-- Error state -->
        <div v-else-if="error" class="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 shadow-sm p-4">
          <div class="text-red-600 dark:text-red-400">{{ error }}</div>
        </div>
        
        <!-- Preview view -->
        <PersonPreview 
          v-if="showPreview && responseData?.type === 'Person' && responseData"
          :data="responseData" 
        />
        <ActivityPreview 
          v-else-if="showPreview && isCreate && responseData"
          :data="responseData" 
        />
        <DocumentPreview 
          v-else-if="showPreview && isDocument && !isCreate && responseData"
          :data="responseData"
          :show-preview="showPreview"
        />
        
        <!-- JSON view -->
        <JsonBrowser 
          v-if="(!showPreview || !canShowPreview) && !error"
          :data="responseData" 
          @fetch-uri="handleClickedUri" 
        />

        <!-- HTTP Exchange Panel -->
        <div v-if="httpExchange" class="mt-4">
          <HttpExchangePanel :exchange="httpExchange" title="HTTP Exchange Details" />
        </div>
      </div>
    </div>
  </div>
</template>
