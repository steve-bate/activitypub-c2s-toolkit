<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'
import ActorEndpointsPanel from '@/components/ActorEndpointsPanel.vue'
import ServerNotesPanel from '@/components/ServerNotesPanel.vue'
import NodeInfoPanel from '@/components/NodeInfoPanel.vue'
import { getNodeInfo } from '@/services/nodeinfoService'

const router = useRouter()
const route = useRoute()
const serverStore = useServerStore()

const serverId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? id[0] : id
})

const server = computed(() =>
  serverStore.servers.find(s => s.id === serverId.value)
)

const isLoadingNodeInfo = ref(false)
const nodeinfoError = ref<string | null>(null)

async function handleLoadNodeInfo() {
  if (!server.value) return
  isLoadingNodeInfo.value = true
  nodeinfoError.value = null
  try {
    // FIXME - shouldn't use authServerOrigin
    const origin = server.value.origin ?? server.value.auth?.oauth2?.authServerOrigin ?? ''
    const [indexExchange, dataExchange] = await getNodeInfo(origin)
    serverStore.saveNodeInfo(server.value.id, dataExchange, indexExchange)
    if (!indexExchange?.success || !dataExchange?.success) {
      nodeinfoError.value =
        indexExchange?.error ?? dataExchange?.error ?? 'NodeInfo not available'
    }
  } catch (error) {
    nodeinfoError.value =
      error instanceof Error ? error.message : 'Unexpected error loading NodeInfo'
  } finally {
    isLoadingNodeInfo.value = false
  }
}

onMounted(() => {
  if (serverId.value) {
    serverStore.setActiveServer(serverId.value)
    if (!server.value?.nodeinfo && !isLoadingNodeInfo.value) {
      void handleLoadNodeInfo()
    }
  }
})

/**
 * Delete server
 */
function handleDeleteServer() {
  if (server.value && confirm(`Are you sure you want to delete "${server.value.name}"?`)) {
    if (!serverId.value) return
    serverStore.deleteServer(serverId.value)
    void router.push('/servers')
  }
}

// Follow active-server switches made from the header dropdown
watch(
  () => serverStore.activeServerId,
  (newActiveId) => {
    if (
      newActiveId &&
      serverId.value &&
      newActiveId !== serverId.value &&
      route.name === 'server-detail' &&
      server.value
    ) {
      void router.push(`/servers/${newActiveId}`)
    }
  }
)
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
    <!-- Not found -->
    <div v-if="!server" class="max-w-2xl mx-auto px-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
        <p class="text-gray-600 dark:text-gray-400">Server not found</p>
        <button
          @click="router.push('/servers')"
          class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          Back to Servers
        </button>
      </div>
    </div>

    <div v-else class="max-w-4xl mx-auto px-4 space-y-8">

      <!-- Header -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            <a
              target="_blank"
              rel="noopener noreferrer"
              :href="server.origin ?? server.auth?.oauth2?.authServerOrigin"
              class="hover:underline"
            >
              {{ server.origin ?? server.auth?.oauth2?.authServerOrigin }}
            </a>
          </h1>
        </div>

        <!-- Badges -->
        <div class="flex flex-wrap gap-2 shrink-0 items-start pt-1">
          <!-- Auth status -->
          <span
            v-if="server.auth?.authStatus === 'authorized'"
            class="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-sm font-medium"
          >
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
            Authorized
          </span>
          <span
            v-else-if="server.auth?.authStatus === 'configured'"
            class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium"
          >
            ⚙ Configured
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-sm"
          >
            Not configured
          </span>

          <!-- Auth type -->
          <RouterLink
            v-if="server.auth?.authType === 'oauth2'"
            :to="`/servers/${server.id}/auth`"
            class="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            OAuth2
          </RouterLink>
          <span
            v-else-if="server.auth?.authType === 'bearer'"
            class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-full text-sm font-medium"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Bearer Token
          </span>
        </div>
      </div>

      <!-- NodeInfo -->
      <NodeInfoPanel
        :server="server"
        @load="handleLoadNodeInfo"
        @refresh="handleLoadNodeInfo"
      />

      <ActorEndpointsPanel :server="server" />

      <ServerNotesPanel :server="server" />

      <!-- Danger Zone -->
      <div class="bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200 dark:border-red-800 p-6">
        <h2 class="text-lg font-semibold text-red-900 dark:text-red-200 mb-4">Danger Zone</h2>
        <button
          @click="handleDeleteServer"
          class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors"
        >
          Delete Server
        </button>
        <p class="text-sm text-red-800 dark:text-red-300 mt-2">This action cannot be undone.</p>
      </div>
    </div>
  </div>
</template>
