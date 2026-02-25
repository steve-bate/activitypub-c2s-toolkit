<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'

const settingsStore = useSettingsStore()

// Local state for OAuth2 defaults
const oauth2ClientName = ref(settingsStore.settings.oauth2Defaults.clientName)
const oauth2Scopes = ref(settingsStore.settings.oauth2Defaults.scopes)

function handleSaveOAuth2Defaults() {
  settingsStore.setOAuth2Defaults(oauth2ClientName.value, oauth2Scopes.value)
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-6">
    <div class="mb-6">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
    </div>

    <!-- Appearance section -->
    <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
      <div class="px-5 py-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Appearance</h3>
      </div>

      <!-- Theme row -->
      <div class="px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Color theme</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ settingsStore.isDark ? 'Dark mode is on' : 'Light mode is on' }}
          </p>
        </div>

        <!-- Three-way toggle: Light / System / Dark -->
        <div class="flex items-center rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm">
          <!-- Light -->
          <button
            @click="settingsStore.isDark && settingsStore.toggleTheme()"
            :class="!settingsStore.isDark
              ? 'bg-white dark:bg-gray-100 text-gray-900 shadow-sm'
              : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
            class="flex items-center gap-1.5 px-3 py-2 transition-colors font-medium"
            title="Light mode"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Light
          </button>
          <!-- Dark -->
          <button
            @click="!settingsStore.isDark && settingsStore.toggleTheme()"
            :class="settingsStore.isDark
              ? 'bg-gray-700 text-white shadow-sm'
              : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
            class="flex items-center gap-1.5 px-3 py-2 transition-colors font-medium"
            title="Dark mode"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            Dark
          </button>
        </div>
      </div>
    </div>

    <!-- Authentication section -->
    <div class="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
      <div class="px-5 py-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Authentication Methods</h3>
      </div>
      <div class="px-5 py-3">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Enable the methods you want to use when adding a new server. If only one method is enabled, that method will be selected automatically.
        </p>
      </div>

      <!-- OAuth2 toggle -->
      <div class="px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100">OAuth2</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Delegated authorization via the OAuth2 flow. Your app will be auto-registered with the server.
          </p>
          <p v-if="settingsStore.settings.authMethods.oauth2 && !settingsStore.settings.authMethods.bearer" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Enable Bearer Token first to disable OAuth2.
          </p>
        </div>
        <button
          @click="settingsStore.setAuthMethod('oauth2', !settingsStore.settings.authMethods.oauth2)"
          :class="settingsStore.settings.authMethods.oauth2
            ? 'bg-blue-600'
            : 'bg-gray-200 dark:bg-gray-600'"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          role="switch"
          :aria-checked="settingsStore.settings.authMethods.oauth2"
          title="Toggle OAuth2"
        >
          <span
            :class="settingsStore.settings.authMethods.oauth2 ? 'translate-x-5' : 'translate-x-0'"
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
          />
        </button>
      </div>

      <!-- Bearer Token toggle -->
      <div class="px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Preshared Bearer Token</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Authenticate using a pre-generated application token or application password.
          </p>
          <p v-if="settingsStore.settings.authMethods.bearer && !settingsStore.settings.authMethods.oauth2" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Enable OAuth2 first to disable Bearer Token.
          </p>
        </div>
        <button
          @click="settingsStore.setAuthMethod('bearer', !settingsStore.settings.authMethods.bearer)"
          :class="settingsStore.settings.authMethods.bearer
            ? 'bg-blue-600'
            : 'bg-gray-200 dark:bg-gray-600'"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          role="switch"
          :aria-checked="settingsStore.settings.authMethods.bearer"
          title="Toggle Preshared Bearer Token"
        >
          <span
            :class="settingsStore.settings.authMethods.bearer ? 'translate-x-5' : 'translate-x-0'"
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
          />
        </button>
      </div>
    </div>

    <!-- OAuth2 Defaults section (separate panel, only when OAuth2 is enabled) -->
    <div v-if="settingsStore.settings.authMethods.oauth2" class="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
      <div class="px-5 py-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">OAuth2 Defaults</h3>
      </div>
      <div class="px-5 py-3">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          These defaults are used when registering OAuth2 clients with servers.
        </p>
      </div>

      <!-- Client Name -->
      <div class="px-5 py-4">
        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
          Client Name
        </label>
        <input
          v-model="oauth2ClientName"
          @blur="handleSaveOAuth2Defaults"
          type="text"
          placeholder="ActivityPub C2S Client"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Default name for your OAuth2 client application
        </p>
      </div>

      <!-- Scopes -->
      <div class="px-5 py-4">
        <label class="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
          Scopes
        </label>
        <input
          v-model="oauth2Scopes"
          @blur="handleSaveOAuth2Defaults"
          type="text"
          placeholder="read write follow"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Space-separated list of default OAuth2 scopes
        </p>
      </div>
    </div>
  </div>
</template>
