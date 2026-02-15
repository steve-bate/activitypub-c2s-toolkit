<script setup lang="ts">
import JsonBrowser from '@/components/JsonBrowser.vue'
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'

const route = useRoute()
const serverStore = useServerStore()

const responseData = ref<Record<string, unknown> | undefined>(undefined)
const isLoading = ref(false)
const error = ref<string | null>(null)
const requestUrl = ref<string | undefined>(undefined)
const requestHeaders = ref<Record<string, string> | undefined>(undefined)
const responseStatus = ref<number | undefined>(undefined)
const responseStatusText = ref<string | undefined>(undefined)
const responseHeaders = ref<Record<string, string> | undefined>(undefined)
const duration = ref<number | undefined>(undefined)

/**
 * Fetch URI with ActivityPub headers and access token
 */
async function handleFetch(uri: string) {
  if (!uri || !uri.trim()) return
  
  isLoading.value = true
  error.value = null
  responseData.value = undefined
  requestUrl.value = uri
  requestHeaders.value = undefined
  responseStatus.value = undefined
  responseStatusText.value = undefined
  responseHeaders.value = undefined
  duration.value = undefined
  
  const startTime = Date.now()
  
  try {
    const activeServer = serverStore.activeServer
    const headers: HeadersInit = {}
    
    // Add authorization if we have a token
    if (activeServer?.tokenResponse?.access_token) {
      headers['Authorization'] = `Bearer ${activeServer.tokenResponse.access_token}`
    }
    
    // Store request headers
    requestHeaders.value = { ...headers }
    
    // Try with Accept header first
    let response: Response
    try {
      const fetchHeaders = {
        ...headers,
        'Accept': 'application/activity+json'
      }
      requestHeaders.value = { ...fetchHeaders }
      response = await fetch(uri, { headers: fetchHeaders })
    } catch (err) {
      // If CORS error (likely due to Accept header), retry without it
      if (err instanceof Error && (err.message?.includes('CORS') || err.name === 'TypeError')) {
        console.warn('CORS error with Accept header, retrying without custom Accept header')
        requestHeaders.value = { ...headers }
        response = await fetch(uri, { headers })
      } else {
        throw err
      }
    }
    
    duration.value = Date.now() - startTime
    responseStatus.value = response.status
    responseStatusText.value = response.statusText
    
    if (!response.ok) {
      error.value = `HTTP ${response.status} ${response.statusText}`
      return
    }
    
    // Capture response headers
    const headersObj: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headersObj[key] = value
    })
    responseHeaders.value = headersObj
    
    const data = await response.json()
    
    responseData.value = data
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

// Check if there's a URI in the route query on mount
onMounted(() => {
  const uri = route.query.uri as string
  if (uri) {
    void handleFetch(uri)
  }
})

// Watch for changes to the URI query parameter
watch(
  () => route.query.uri,
  (newUri) => {
    if (newUri && typeof newUri === 'string') {
      void handleFetch(newUri)
    }
  }
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
    if (!server || server.authStatus !== 'authorized' || !server.actor?.uri) {
      return
    }

    // If the current server doesn't have token/metadata, try to discover actor
    if (!server.tokenResponse || !server.authorizationServer.metadata) {
      return
    }

    // Fetch the actor profile for the newly selected server
    try {
      const actorUri = server.actor.uri
      console.debug('Server changed, fetching actor for new server:', actorUri)
      await handleFetch(actorUri)
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
        <!-- Loading state -->
        <div v-if="isLoading" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-8">
          <div class="flex items-center justify-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span class="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
          </div>
        </div>
        
        <!-- Error state -->
        <div v-else-if="error" class="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 shadow-sm p-4">
          <div class="text-red-600 dark:text-red-400">{{ error }}</div>
        </div>
        
        <!-- Response data -->
        <JsonBrowser 
          v-else 
          :data="responseData" 
          :request-url="requestUrl"
          :request-headers="requestHeaders"
          :response-status="responseStatus"
          :response-status-text="responseStatusText"
          :response-headers="responseHeaders"
          :duration="duration"
          @fetch-uri="handleFetch" 
        />
      </div>
    </div>
  </div>
</template>
