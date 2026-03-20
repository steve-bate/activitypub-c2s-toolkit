<script setup lang="ts">
import { ResourceServerMetadata, useServerStore } from '@/stores/serverStore'

const serverStore = useServerStore()

function handleDelete(server: ResourceServerMetadata) {
  if (confirm(`Delete server "${server.name}"?`)) {
    serverStore.deleteServer(server.id)
  }
}

function formatAuthStatus(status: string): string {
  switch (status) {
    case 'authorized':
      return 'Authorized'
    case 'token-expired':
      return 'Token expired'
    default:
      return 'No token'
  }
}

function formatLastUsed(dateString: string | undefined): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleString()
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-gray-800/50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Name
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Base URL
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Auth Type
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Status
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Last Used
          </th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        <tr v-if="serverStore.servers.length === 0">
          <td colspan="6" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            No servers configured yet.
          </td>
        </tr>
        <tr v-for="server in serverStore.servers" :key="server.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <td class="px-6 py-4 whitespace-nowrap">
            <RouterLink
              :to="`/servers/${server.id}`"
              class="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              {{ server.name }}
            </RouterLink>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-mono">
            {{ server.origin ?? '—' }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
            {{ server.auth?.authType === 'oauth2' ? 'OAuth2' : 'Bearer' }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm" :class="server.auth?.authStatus === 'authorized' ? 'text-green-600 dark:text-green-400 font-medium' : server.auth?.authStatus === 'token-expired' ? 'text-gray-700 dark:text-gray-300' : 'text-orange-600 dark:text-orange-400 font-medium'">
            {{ formatAuthStatus(server.auth?.authStatus!) }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {{ formatLastUsed(server.lastUsed) }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
            <button
              @click="handleDelete(server)"
              class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
              title="Delete server"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
