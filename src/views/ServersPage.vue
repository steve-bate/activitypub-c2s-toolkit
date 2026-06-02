<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'
import ServersTable from '@/components/ServersTable.vue'

const router = useRouter()
const serverStore = useServerStore()

const hasServers = computed(() => serverStore.servers.length > 0)

function handleAddServer() {
  void router.push('/servers/new')
}

function handleExportServers() {
  const payload = JSON.stringify(serverStore.servers, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  anchor.href = url
  anchor.download = `servers-${timestamp}.json`
  anchor.click()

  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <!-- Toolbar -->
    <div class="flex items-center justify-between gap-3 mb-6">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Servers</h2>
      <div class="flex items-center gap-2">
        <button
          @click="handleExportServers"
          :disabled="!hasServers"
          class="px-4 py-2 text-sm font-medium rounded-md transition-colors border border-gray-300 dark:border-gray-600"
          :class="hasServers
            ? 'text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
            : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'"
        >
          Export JSON
        </button>
      </div>
    </div>

    <!-- Table -->
    <ServersTable />

    <!-- Add Server button -->
    <div class="mt-4">
      <button
        @click="handleAddServer"
        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-md transition-colors"
      >
        Add Server
      </button>
    </div>
  </div>
</template>
