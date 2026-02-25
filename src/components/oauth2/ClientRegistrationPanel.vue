<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ResourceServerMetadata } from '@/stores/serverStore'
import { useServerStore } from '@/stores/serverStore'
import { useSettingsStore } from '@/stores/settingsStore'
import DataPanel from '@/components/DataPanel.vue'
import DataField from '@/components/DataField.vue'
import HttpExchangePanel from '@/components/http/HttpExchangePanel.vue'
import CopyIcon from '@/components/icons/CopyIcon.vue'
import MethodBadge from '@/components/oauth2/MethodBadge.vue'
import RunningIcon from '../icons/RunningIcon.vue'
import RefreshIcon from '../icons/RefreshIcon.vue'

interface Props {
  server: ResourceServerMetadata
  editable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  editable: false
})

const serverStore = useServerStore()
const settingsStore = useSettingsStore()

const emit = defineEmits<{
  'retry-registration': []
}>()

// UI state
const showClientSecret = ref(false)
const isRetrying = ref(false)
const viewMode = ref<'dynamic' | 'preregistered'>('dynamic')

// Pre-registered form state
const preregClientId = ref('')
const preregClientSecret = ref('')
const preregRedirectUri = ref('')
const preregScopes = ref('')
const preregShowSecret = ref(false)
const preregError = ref<string | null>(null)
const preregSuccess = ref<string | null>(null)
const isPreregSaving = ref(false)

// Derived from server props
const registrationExchange = computed(() => props.server.auth?.oauth2?.clientRegistration?.exchange)
const registrationMethod = computed(() => props.server.auth?.oauth2?.clientRegistration?.registrationMethod)
const registrationSuccess = computed(() => registrationExchange.value?.success ?? false)
const registrationError = computed(() => registrationExchange.value?.error ?? null)

function populatePreregisteredForm() {
  const clientConfig = props.server.auth?.oauth2?.clientConfig
  preregClientId.value = clientConfig?.clientId ?? ''
  preregClientSecret.value = clientConfig?.clientSecret ?? ''
  preregRedirectUri.value = clientConfig?.redirectUri || `${window.location.origin}/callback`
  preregScopes.value = clientConfig?.scopes || settingsStore.settings.oauth2Defaults.scopes
}

watch(
  registrationMethod,
  (method) => {
    viewMode.value = method === 'Pre-registered' ? 'preregistered' : 'dynamic'
    if (viewMode.value === 'preregistered') {
      populatePreregisteredForm()
    }
  },
  { immediate: true },
)

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text)
}

function handleRetryRegistration() {
  isRetrying.value = true
  try {
    emit('retry-registration')
  } finally {
    isRetrying.value = false
  }
}

function onViewModeChange(mode: 'dynamic' | 'preregistered') {
  viewMode.value = mode
  if (mode === 'preregistered') {
    populatePreregisteredForm()
  } else {
    preregClientId.value = ''
    preregClientSecret.value = ''
    preregRedirectUri.value = ''
    preregScopes.value = ''
  }
  preregError.value = null
  preregSuccess.value = null
}

function handleSavePreregisteredClient() {
  preregError.value = null
  preregSuccess.value = null

  if (!preregClientId.value.trim()) {
    preregError.value = 'Client ID is required'
    return
  }

  isPreregSaving.value = true
  try {
    const clientId = preregClientId.value.trim()
    const clientSecret = preregClientSecret.value.trim()
    const redirectUri = preregRedirectUri.value.trim()
    const scopes = preregScopes.value.trim()

    serverStore.saveClientConfig(props.server.id, {
      clientId,
      clientSecret,
      redirectUri,
      scopes,
    })
    serverStore.saveClientRegistrationResult(props.server.id, {
      registrationMethod: 'Pre-registered',
      exchange: {
        success: true,
        request: {
          url: 'local://pre-registered',
          headers: {},
          params: {
            client_name: props.server.name || settingsStore.settings.oauth2Defaults.clientName,
            redirect_uris: redirectUri || `${window.location.origin}/callback`,
            scopes,
            scope: scopes,
          },
        },
      },
    })
    preregSuccess.value = 'Pre-registered client saved successfully'
  } catch (error) {
    preregError.value = error instanceof Error ? error.message : 'Failed to save pre-registered client'
  } finally {
    isPreregSaving.value = false
  }
}
</script>

<template>
  <DataPanel>
    <template #header>
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Client Registration</h3>
    </template>

    <template #header-action>
      <div class="flex items-center gap-2">
        <span
          v-if="registrationSuccess"
          class="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm font-medium rounded-md flex items-center gap-2"
          title="Client registered successfully"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Registered
        </span>
        <button
          v-if="viewMode === 'dynamic'"
          @click="handleRetryRegistration"
          :disabled="isRetrying"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
        >
          <RunningIcon v-if="isRetrying" />
          <RefreshIcon v-else/>
          {{ isRetrying ? 'Registering...' : 'Re-register' }}
        </button>
      </div>
    </template>

    <!-- Mode Select -->
    <div class="mb-6">
      <select
        :value="viewMode"
        @change="onViewModeChange(($event.target as HTMLSelectElement).value as 'dynamic' | 'preregistered')"
        class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="dynamic">Dynamic Registration</option>
        <option value="preregistered">Pre-Registered</option>
      </select>
    </div>

    <!-- Dynamic Registration View -->
    <div v-if="viewMode === 'dynamic'">
      <!-- Error Message -->
      <div v-if="registrationError" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div class="flex items-start gap-2">
          <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-red-800 dark:text-red-200">
              Registration failed
            </p>
            <p class="text-xs text-red-700 dark:text-red-300 mt-1">
              {{ registrationError }}
            </p>
            <div class="flex gap-2 mt-3">
              <button
                @click="handleRetryRegistration"
                :disabled="isRetrying"
                class="px-3 py-1 text-xs font-medium bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center gap-1"
              >
                <RunningIcon v-if="isRetrying" />
                <RefreshIcon v-else/>
                {{ isRetrying ? 'Retrying...' : 'Retry' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Registration Method Badge (for dynamic registration) -->
      <div v-if="registrationMethod !== 'Pre-registered' && server.auth?.oauth2?.clientConfig?.clientId" class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <span class="text-sm text-gray-600 dark:text-gray-400">Registration Method:</span>
        <MethodBadge :method="registrationMethod" />
        <span v-if="registrationMethod === 'RFC7591'" class="text-xs text-gray-500 dark:text-gray-400">
          (Standard Dynamic Client Registration)
        </span>
        <span v-else-if="registrationMethod === 'Mastodon'" class="text-xs text-gray-500 dark:text-gray-400">
          (Mastodon API /api/v1/apps)
        </span>
        <span v-else-if="registrationMethod === 'CIMD'" class="text-xs text-gray-500 dark:text-gray-400">
          (Client ID Metadata Document — registration skipped)
        </span>
      </div>

      <!-- Client Credentials Section (showing for dynamic/CIMD) -->
      <div v-if="server.auth?.oauth2?.clientRegistration?.exchange?.response?.payload?.client_id || registrationMethod === 'CIMD'" class="space-y-4">
        <!-- Client ID -->
        <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Client ID
        </label>
        <div v-if="!editable && server.auth?.oauth2?.clientConfig?.clientId" class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
            {{ server.auth?.oauth2?.clientConfig?.clientId }}
          </code>
          <button
            @click="copyToClipboard(server.auth?.oauth2?.clientConfig?.clientId)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Copy to clipboard"
          >
            <CopyIcon class="w-4 h-4" />
          </button>
        </div>
        <div v-else-if="!server.auth?.oauth2?.clientConfig?.clientId" class="text-sm text-gray-500 dark:text-gray-400 italic">
          Not configured
        </div>
      </div>

      <!-- Client Secret -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Client Secret
        </label>
        <div v-if="!editable && server.auth?.oauth2?.clientConfig?.clientSecret" class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
            {{ showClientSecret ? server.auth?.oauth2?.clientConfig?.clientSecret : '••••••••••••••••' }}
          </code>
          <button
            @click="showClientSecret = !showClientSecret"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            :title="showClientSecret ? 'Hide' : 'Show'"
          >
            <svg v-if="showClientSecret" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
          <button
            @click="copyToClipboard(server.auth?.oauth2?.clientConfig?.clientSecret)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Copy to clipboard"
          >
            <CopyIcon class="w-4 h-4" />
          </button>
        </div>
        <div v-else-if="!server.auth?.oauth2?.clientConfig?.clientSecret" class="text-sm text-gray-500 dark:text-gray-400 italic">
          Not configured
        </div>
      </div>

      <!-- Client Name -->
      <div>
        <DataField
          v-if="!editable && server.name"
          label="Client Name"
          :value="server.name"
          :copyable="true"
        />
        <div v-else-if="!server.name" class="text-sm text-gray-500 dark:text-gray-400 italic">
          Not configured
        </div>
      </div>

      <!-- Redirect URIs -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Redirect URIs
        </label>
        <div v-if="!editable && server.auth?.oauth2?.clientConfig?.redirectUri" class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
            {{ server.auth?.oauth2?.clientConfig?.redirectUri }}
          </code>
          <button
            @click="copyToClipboard(server.auth?.oauth2?.clientConfig?.redirectUri)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Copy to clipboard"
          >
            <CopyIcon class="w-4 h-4" />
          </button>
        </div>
        <div v-else-if="!server.auth?.oauth2?.clientConfig?.redirectUri" class="text-sm text-gray-500 dark:text-gray-400 italic">
          Not configured
        </div>
      </div>

      <!-- Scopes -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Scopes 
            <span v-if="server.auth?.oauth2?.clientRegistration?.exchange?.request?.params?.scopes" class="ml-2 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 text-xs font-medium rounded-full">Requested</span>
            <span v-else-if="!server.auth?.oauth2?.clientRegistration?.exchange?.response?.payload?.scope" class="ml-2 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 text-xs font-medium rounded-full">Default</span>
        </label>
        <div v-if="!editable && server.auth?.oauth2?.clientConfig?.scopes">
          <code class="block px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
            {{ server.auth?.oauth2?.clientConfig?.scopes }}
          </code>
        </div>
        <div v-else-if="!server.auth?.oauth2?.clientConfig?.scopes" class="text-sm text-gray-500 dark:text-gray-400 italic">
          Not configured
        </div>
      </div>

      </div>

      <!-- HTTP Registration Exchange (only for dynamic registration) -->
      <div v-if="registrationExchange && server.auth?.oauth2?.clientRegistration?.registrationMethod !== 'Pre-registered'" class="pt-4 border-t border-gray-200 dark:border-gray-700">
        <HttpExchangePanel
          :exchange="registrationExchange"
          title="Registration Details"
        />
      </div>
    </div>

    <!-- Pre-Registered Client View -->
    <div v-else-if="viewMode === 'preregistered'">
      <!-- Success Message -->
      <div v-if="preregSuccess" class="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div class="flex items-start gap-2">
          <svg class="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <p class="text-sm font-medium text-green-800 dark:text-green-200">
              {{ preregSuccess }}
            </p>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="preregError" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div class="flex items-start gap-2">
          <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-red-800 dark:text-red-200">
              Error
            </p>
            <p class="text-xs text-red-700 dark:text-red-300 mt-1">
              {{ preregError }}
            </p>
          </div>
          <button @click="preregError = null" class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Pre-Registered Client Form -->
      <div class="space-y-4">
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p class="text-sm text-blue-800 dark:text-blue-200">
            Use this form if you have already registered your client application with the authorization server and have pre-generated credentials.
          </p>
        </div>

        <!-- Client ID Input -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client ID *
          </label>
          <input
            v-model="preregClientId"
            type="text"
            placeholder="Enter your pre-registered client ID"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            The client ID assigned to your application
          </p>
        </div>

        <!-- Client Secret Input -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client Secret (Optional)
          </label>
          <div class="flex items-center gap-2">
            <input
              v-model="preregClientSecret"
              :type="preregShowSecret ? 'text' : 'password'"
              placeholder="Enter your client secret (if you have one)"
              class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              @click="preregShowSecret = !preregShowSecret"
              class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              :title="preregShowSecret ? 'Hide' : 'Show'"
            >
              <svg v-if="preregShowSecret" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
            </button>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            The client secret is optional. If your server uses public clients (e.g., SPAs), you may not have one.
          </p>
        </div>

        <!-- Redirect URI Input -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Redirect URIs
          </label>
          <input
            v-model="preregRedirectUri"
            type="text"
            placeholder="https://example.com/oauth/callback"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            The redirect URI registered with the authorization server
          </p>
        </div>

        <!-- Scopes Input -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Scopes
          </label>
          <input
            v-model="preregScopes"
            type="text"
            placeholder="read write follow"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Space-separated list of scopes
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            @click="handleSavePreregisteredClient"
            :disabled="isPreregSaving || !preregClientId.trim()"
            class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
          >
            <span v-if="!isPreregSaving">Save</span>
            <span v-else class="flex items-center justify-center gap-2">
              <RunningIcon/>
              Saving...
            </span>
          </button>
          <button
            @click="onViewModeChange('dynamic')"
            :disabled="isPreregSaving"
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- No OAuth2 config state -->
    <div v-if="viewMode === 'dynamic' && !server.auth?.oauth2" class="text-center py-8">
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        OAuth2 client metadata not configured
      </p>
    </div>
  </DataPanel>
</template>

