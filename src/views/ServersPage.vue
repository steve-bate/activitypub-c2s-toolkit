<script setup lang="ts">
import { useRouter } from 'vue-router'
import ServersTable from '@/components/ServersTable.vue'

const router = useRouter()

function handleAddServer() {
  void router.push('/servers/new')
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Servers</h2>
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
