<script setup lang="ts">
import { useRouter } from 'vue-router'
import ResourceServersTable from '@/components/server/ResourceServersTable.vue'
import { useServerStore } from '@/stores/serverStore'

const router = useRouter()
const serverStore = useServerStore()

function handleAddServer() {
  console.log('STUB: Add new server')
  router.push('/servers/new')
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Servers</h2>
      <button
        v-if="serverStore.servers.length > 0"
        @click="handleAddServer"
        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-md transition-colors"
      >
        Add Server
      </button>
    </div>

    <!-- Table -->
    <ResourceServersTable />
  </div>
</template>
