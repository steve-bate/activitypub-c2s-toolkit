<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'
import { getActorDisplayName } from '@/services/actorDiscoveryService'
import DisclosureIcon from '@/components/icons/DisclosureIcon.vue'
import ActivityPubIcon from '@/components/icons/ActivityPubIcon.vue'
import ServerIcon from '@/components/icons/ServerIcon.vue'
import DocumentIcon from '@/components/icons/DocumentIcon.vue'
import CheckmarkIcon from '@/components/icons/CheckmarkIcon.vue'
import AddIcon from '@/components/icons/AddIcon.vue'
import TrashIcon from '@/components/icons/TrashIcon.vue'
import PersonIcon from '@/components/icons/PersonIcon.vue'
import LetterIcon from '@/components/icons/LetterIcon.vue'
import ExitIcon from '@/components/icons/ExitIcon.vue'
import KeyIcon from '@/components/icons/KeyIcon.vue'
import ProtectIcon from '@/components/icons/ProtectIcon.vue'

const router = useRouter()
const serverStore = useServerStore()

const serverMenuOpen = ref(false)
const actorMenuOpen = ref(false)

const hasServers = computed(() => serverStore.servers.length > 0)
const hasMultipleServers = computed(() => serverStore.servers.length > 1)

const hasActor = computed(() => {
  return serverStore.activeServer?.actor?.profile != null
})

const actorDisplayName = computed(() => {
  const actor = serverStore.activeServer?.actor?.profile
  return actor ? getActorDisplayName(actor) : 'No Actor'
})

const canUploadMedia = computed(() => {
  const uploadMedia = serverStore.activeServer?.actor?.profile?.endpoints?.uploadMedia
  return typeof uploadMedia === 'string' && uploadMedia.trim().length > 0
})

const authLabel = computed(() =>
  serverStore.activeServer?.auth?.authType === 'oauth2' ? 'OAuth2' : 'Bearer Token'
)

function toggleServerMenu() {
  if (!hasServers.value) return
  serverMenuOpen.value = !serverMenuOpen.value
  if (!serverMenuOpen.value) actorMenuOpen.value = false
}

function toggleActorMenu() {
  if (!hasActor.value) return
  actorMenuOpen.value = !actorMenuOpen.value
  if (!actorMenuOpen.value) serverMenuOpen.value = false
}

function closeMenu() {
  serverMenuOpen.value = false
  actorMenuOpen.value = false
}

function selectServer(id: string) {
  serverStore.setActiveServer(id)
  closeMenu()
}

function navigate(path: string) {
  void router.push(path)
  closeMenu()
}

function navigateToActorResource(uriKey: 'id' | 'inbox' | 'outbox') {
  const actor = serverStore.activeServer?.actor?.profile
  if (!actor) return
  const uri = actor[uriKey as keyof typeof actor] as string | undefined
  if (!uri) return
  void router.push({ path: '/json', query: { uri, property: uriKey } })
  closeMenu()
}

function handleDeleteServer() {
  const activeServer = serverStore.activeServer
  if (!activeServer) return
  if (confirm(`Are you sure you want to delete "${activeServer.name}"?`)) {
    serverStore.deleteServer(activeServer.id)
    closeMenu()
    void router.push('/servers')
  }
}
</script>

<template>
  <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
    <div class="px-4 py-3 flex items-center justify-between gap-4">

      <!-- ── Left: Logo + App Name ── -->
      <RouterLink to="/" class="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
        <ActivityPubIcon />
        <span class="text-xl font-semibold text-gray-900 dark:text-gray-100">
          <span class="hidden sm:inline">ActivityPub </span>C2S Toolkit
        </span>
      </RouterLink>

      <!-- ── Right: Controls ── -->
      <div class="flex items-center gap-1">

        <!-- Server Menu -->
        <div class="relative">
          <!-- Trigger button -->
          <button
            @click="toggleServerMenu"
            :disabled="!hasServers"
            :title="hasServers ? serverStore.activeServer?.name : 'No server configured'"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
            :class="hasServers
              ? 'text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
              : 'text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-not-allowed opacity-60'"
          >
            <!-- Server icon -->
            <ServerIcon class="w-4 h-4 shrink-0" />
            <span class="max-w-[10rem] truncate">
              {{ hasServers ? (serverStore.activeServer?.name ?? 'Select server') : 'No server' }}
            </span>
            <!-- Chevron -->
            <DisclosureIcon
              class="w-3.5 h-3.5 shrink-0 transition-transform"
              :class="serverMenuOpen ? '-rotate-90' : 'rotate-90'"
            />
          </button>

          <!-- Dropdown panel -->
          <div
            v-if="serverMenuOpen && hasServers"
            class="absolute right-0 mt-2 w-60 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50"
          >
            <!-- Overview -->
            <button
              @click="navigate(`/servers/${serverStore.activeServer!.id}`)"
              class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <DocumentIcon class="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
              Overview
            </button>

            <!-- Authorization (label and icon adapt to auth type) -->
            <button
              @click="navigate(`/servers/${serverStore.activeServer!.id}/auth`)"
              class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <ProtectIcon v-if="serverStore.activeServer?.auth?.authType === 'oauth2'" class="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
              <KeyIcon v-else class="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
              {{ authLabel }}
            </button>

            <!-- Separator -->
            <div class="my-1 border-t border-gray-200 dark:border-gray-700" />

            <!-- Switch Server (only when multiple servers exist) -->
            <template v-if="hasMultipleServers">
              <p class="px-3 pt-1.5 pb-0.5 text-[0.65rem] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500">
                Switch Server
              </p>
              <button
                v-for="server in serverStore.servers"
                :key="server.id"
                @click="selectServer(server.id)"
                class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
                :class="server.id === serverStore.activeServerId
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'"
              >
                <ServerIcon class="w-3.5 h-3.5 shrink-0 opacity-60" />
                <span class="truncate flex-1">{{ server.name }}</span>
                <CheckmarkIcon v-if="server.id === serverStore.activeServerId" class="w-3.5 h-3.5 shrink-0 text-blue-500" />
              </button>
            </template>

            <!-- Separator -->
            <div class="my-1 border-t border-gray-200 dark:border-gray-700" />

            <!-- Add Server Config -->
            <button
              @click="navigate('/servers/new')"
              class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <AddIcon class="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
              Add Server Config
            </button>

            <!-- Delete Server Config -->
            <button
              @click="handleDeleteServer"
              class="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
            >
              <TrashIcon class="w-4 h-4 shrink-0" />
              Delete Server Config
            </button>
          </div>

          <!-- Clickaway backdrop -->
          <div v-if="serverMenuOpen" @click="closeMenu" class="fixed inset-0 z-40" />
        </div>

        <!-- Actor Menu -->
        <div class="relative">
          <!-- Trigger button -->
          <button
            @click="toggleActorMenu"
            :disabled="!hasActor"
            :title="hasActor ? actorDisplayName : 'No actor discovered'"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
            :class="hasActor
              ? 'text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
              : 'text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-not-allowed opacity-60'"
          >
            <!-- Actor icon -->
            <PersonIcon class="w-4 h-4 shrink-0" />
            <span class="max-w-[10rem] truncate">
              {{ actorDisplayName }}
            </span>
            <!-- Chevron -->
            <DisclosureIcon
              class="w-3.5 h-3.5 shrink-0 transition-transform"
              :class="actorMenuOpen ? '-rotate-90' : 'rotate-90'"
            />
          </button>

          <!-- Dropdown panel -->
          <div
            v-if="actorMenuOpen && hasActor"
            class="absolute right-0 mt-2 w-60 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50"
          >
            <!-- Actor Profile -->
            <button
              @click="navigateToActorResource('id')"
              class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <PersonIcon class="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
              Actor
            </button>

            <!-- Inbox -->
            <button
              @click="navigateToActorResource('inbox')"
              class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <LetterIcon class="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
              Inbox
            </button>

            <!-- Outbox -->
            <button
              @click="navigateToActorResource('outbox')"
              class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <ExitIcon class="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
              Outbox
            </button>

            <div class="my-1 border-t border-gray-200 dark:border-gray-700" />

            <button
              @click="navigate('/post')"
              class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <AddIcon class="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />              Create Resource
            </button>

            <button
              @click="navigate('/upload-media')"
              :disabled="!canUploadMedia"
              class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
              :class="canUploadMedia
                ? 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                : 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-60'"
            >
              <DocumentIcon class="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
              Upload Media
            </button>

            <button
              @click="navigate('/follow')"
              class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <PersonIcon class="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
              Follow
            </button>
          </div>

          <!-- Clickaway backdrop -->
          <div v-if="actorMenuOpen" @click="closeMenu" class="fixed inset-0 z-40" />
        </div>

        <!-- Settings button -->
        <RouterLink
          to="/settings"
          title="Settings"
          class="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </RouterLink>


      </div>
    </div>
  </header>
</template>

