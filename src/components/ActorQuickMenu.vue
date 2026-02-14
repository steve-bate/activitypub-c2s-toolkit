<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'
import type { Actor } from '@/stores/serverStore'
import { getActorDisplayName } from '@/services/actorDiscoveryService'

interface Props {
  actor?: Actor
}

const props = defineProps<Props>()
const router = useRouter()
const serverStore = useServerStore()

const isOpen = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const showNotImplemented = ref(false)
const sendActivitySubmenuOpen = ref(false)

const displayName = computed(() => getActorDisplayName(props.actor))

// Debug: Log actor changes
watch(() => props.actor, (newActor) => {
  console.log('ActorQuickMenu actor prop changed:', newActor)
  console.log('Display name:', displayName.value)
}, { immediate: true })

/**
 * Fetch document from URI and display in JSON explorer
 */
async function handleMenuClick(item: string) {
  console.log('Navigate to', item)
  isOpen.value = false
  sendActivitySubmenuOpen.value = false
  
  if (item === 'create') {
    router.push({ path: '/post' })
    return
  }
  
  if (item === 'update' || item === 'delete') {
    showNotImplemented.value = true
    return
  }
  
  if (!props.actor) return
  
  let uri: string | null = null
  
  switch (item) {
    case 'actor':
      uri = props.actor.uri
      break
    case 'inbox':
      uri = props.actor.profile?.inbox
      break
    case 'outbox':
      uri = props.actor.profile?.outbox
      break
    case 'followers':
      uri = props.actor.profile?.followers
      break
    case 'following':
      uri = props.actor.profile?.following
      break
  }
  
  if (!uri) {
    console.warn(`${item} endpoint URI not found in actor profile`)
    return
  }

  isLoading.value = true
  errorMessage.value = null
  
  try {
    // Build headers with access token if available
    const headers: HeadersInit = {
      'Accept': 'application/activity+json, application/json'
    }
    
    if (serverStore.activeServer?.tokenResponse?.access_token) {
      headers['Authorization'] = `Bearer ${serverStore.activeServer.tokenResponse.access_token}`
    }
    
    // Fetch the document from the URI
    const response = await fetch(uri, { headers })

    if (!response.ok) {
      const errorMsg = `Failed to fetch ${item}: HTTP ${response.status} ${response.statusText}`
      console.error(errorMsg)
      errorMessage.value = errorMsg
      return
    }

    const document = await response.json()
    console.log(`Fetched ${item}:`, document)

    // Navigate to JSON browser page with the URI and document
    router.push({ 
      path: '/json', 
      query: { uri }
    })
  } catch (error) {
    const errorMsg = `Error fetching ${item}: ${error instanceof Error ? error.message : String(error)}`
    console.error(errorMsg)
    errorMessage.value = errorMsg
  } finally {
    isLoading.value = false
  }
}

/**
 * Toggle main menu and reset submenu
 */
function toggleMenu() {
  isOpen.value = !isOpen.value
  if (!isOpen.value) {
    sendActivitySubmenuOpen.value = false
  }
}

/**
 * Close all menus
 */
function closeAllMenus() {
  isOpen.value = false
  sendActivitySubmenuOpen.value = false
}
</script>

<template>
  <div class="relative">
    <button
      @click="toggleMenu"
      class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      {{ displayName }} ▾
    </button>

    <!-- Dropdown menu -->
    <div
      v-if="isOpen"
      class="absolute left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
    >
      <button
        @click="handleMenuClick('actor')"
        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Actor
      </button>
      <button
        @click="handleMenuClick('inbox')"
        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Inbox
      </button>
      <button
        @click="handleMenuClick('outbox')"
        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Outbox
      </button>
      <button
        @click="handleMenuClick('followers')"
        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Followers
      </button>
      <button
        @click="handleMenuClick('following')"
        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Following
      </button>
      <div class="my-1 border-t border-gray-200 dark:border-gray-700"></div>
      
      <!-- Send Activity submenu -->
      <div class="relative">
        <button
          @click.stop="sendActivitySubmenuOpen = !sendActivitySubmenuOpen"
          class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
        >
          <span>Send Activity</span>
          <svg 
            class="w-4 h-4 transition-transform"
            :class="{ 'rotate-180': sendActivitySubmenuOpen }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>
        
        <!-- Submenu items -->
        <div v-if="sendActivitySubmenuOpen" class="bg-gray-50 dark:bg-gray-900 border-l-2 border-blue-500 dark:border-blue-400">
          <button
            @click="handleMenuClick('create')"
            class="w-full px-6 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Create
          </button>
          <button
            @click="handleMenuClick('update')"
            class="w-full px-6 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Update
          </button>
          <button
            @click="handleMenuClick('delete')"
            class="w-full px-6 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Close dropdown on outside click -->
    <div
      v-if="isOpen"
      @click="closeAllMenus"
      class="fixed inset-0 z-40"
    ></div>

    <!-- Error Modal Dialog -->
    <div
      v-if="errorMessage"
      class="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50"
      @click="errorMessage = null"
    >
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-auto"
        @click.stop
      >
        <div class="flex items-start gap-3">
          <svg class="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Error
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {{ errorMessage }}
            </p>
            <button
              @click="errorMessage = null"
              class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Not Implemented Modal Dialog -->
    <div
      v-if="showNotImplemented"
      class="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50"
      @click="showNotImplemented = false"
    >
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-auto"
        @click.stop
      >
        <div class="flex items-start gap-3">
          <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Not Implemented Yet
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This feature is not yet available.
            </p>
            <button
              @click="showNotImplemented = false"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
