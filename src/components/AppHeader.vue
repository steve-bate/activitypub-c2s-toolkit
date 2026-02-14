<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'
import { useThemeStore } from '@/stores/themeStore'
import ServerSelector from './ServerSelector.vue'
import ActorQuickMenu from './ActorQuickMenu.vue'

const router = useRouter()
const serverStore = useServerStore()
const themeStore = useThemeStore()
</script>

<template>
  <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
    <div class="px-4 py-3 flex items-center justify-between gap-4">
      <!-- Left: App title as home link -->
      <RouterLink to="/" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130" width="32" height="32">
          <!-- Gray shape (left arrow) -->
          <path d="M 54.456209,22.295602 L 1.4244898,53.713252 L 1.4244898,66.279912 L 43.677319,41.146452 L 43.677319,91.415162 L 54.556210,97.701002 L 54.456209,22.295602 Z M 32.686773,59.996502 L 10.912337,72.562902 L 32.686773,85.126392 L 32.686773,59.996502 Z" fill="#6d6d6d" />
          
          <!-- Magenta shape (right arrow) -->
          <path d="M 65.335109,47.429102 L 86.108894,59.996502 L 65.335109,72.562902 L 65.335109,47.429102 Z M 65.335109,22.295602 L 119.754669,53.713252 L 119.754669,66.279912 L 65.335115,97.69902 L 65.335115,85.13146 L 108.87072,59.98023 L 65.335096,34.82901 L 65.335109,22.295602 Z" fill="#f10180" />
        </svg>
        <span class="text-xl font-semibold text-gray-900 dark:text-gray-100">
        <span class="hidden sm:inline">ActivityPub </span>C2S Toolkit
        </span>
      </RouterLink>

      <!-- Right: Actor menu, server selector, settings, and theme toggle -->
      <div class="flex items-center gap-4">
        <ActorQuickMenu 
          v-if="serverStore.activeServer?.authStatus === 'authorized' && serverStore.activeServer?.actor" 
          :actor="serverStore.activeServer?.actor"
        />
        
        <!-- Server selector and settings buttons (closer together) -->
        <div class="flex items-center gap-1">
          <ServerSelector />

          <!-- Settings button (Server details) -->
          <button
            v-if="serverStore.activeServer"
            @click="router.push(`/servers/${serverStore.activeServer.id}`)"
            class="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Server settings"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </button>
          <button
            v-else
            disabled
            class="p-2 text-gray-400 dark:text-gray-600 rounded-md cursor-not-allowed opacity-50"
            title="No server selected"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </button>
        </div>

        <!-- Theme toggle button -->
        <button
          @click="themeStore.toggleTheme"
          class="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          :title="themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <!-- Sun icon (show when dark) -->
          <svg v-if="themeStore.isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
          </svg>
          <!-- Moon icon (show when light) -->
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

