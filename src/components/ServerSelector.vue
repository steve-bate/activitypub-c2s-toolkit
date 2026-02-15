<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'

const router = useRouter()
const serverStore = useServerStore()
const isOpen = ref(false)

function selectServer(serverId: string) {
  serverStore.setActiveServer(serverId)
  isOpen.value = false
}

function goToManageServers() {
  void router.push('/servers')
  isOpen.value = false
}
</script>

<template>
  <div class="relative">
    <!-- Dropdown trigger button -->
    <button
      @click="isOpen = !isOpen"
      class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 transition-colors"
    >
      <span class="truncate max-w-xs">{{ serverStore.activeServer?.name || 'Select Server' }}</span>
      <svg class="w-4 h-4 flex-shrink-0 transition-transform" :class="{ 'rotate-180': isOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
      </svg>
    </button>

    <!-- Dropdown menu -->
    <div
      v-if="isOpen"
      class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-50"
    >
      <!-- Server list -->
      <div v-if="serverStore.servers.length > 0" class="py-1">
        <button
          v-for="server in serverStore.servers"
          :key="server.id"
          @click="selectServer(server.id)"
          class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-between"
          :class="serverStore.activeServerId === server.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''"
        >
          <span class="truncate">{{ server.name }}</span>
          <svg v-if="serverStore.activeServerId === server.id" class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"></path>
          </svg>
        </button>
      </div>

      <!-- Empty state -->
      <div v-else class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
        No servers configured
      </div>

      <!-- Divider -->
      <div class="border-t border-gray-200 dark:border-gray-600"></div>

      <!-- Manage Servers option -->
      <button
        @click="goToManageServers"
        class="w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        Manage Servers...
      </button>
    </div>

    <!-- Close dropdown on outside click -->
    <div
      v-if="isOpen"
      @click="isOpen = false"
      class="fixed inset-0 z-40"
    ></div>
  </div>
</template>

