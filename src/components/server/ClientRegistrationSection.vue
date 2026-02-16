<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { ResourceServerMetadata } from '@/stores/serverStore'
import { useServerStore } from '@/stores/serverStore'
import HttpRequestPanel from '@/components/http/HttpRequestPanel.vue'
import HttpResponsePanel from '@/components/http/HttpResponsePanel.vue'
import CopyIcon from '@/components/icons/CopyIcon.vue'

interface Props {
  server: ResourceServerMetadata
  editable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  editable: false
})

const serverStore = useServerStore()

const emit = defineEmits<{
  'retry-registration': []
}>()

const showClientSecret = ref(false)
const registrationError = ref<string | null>(null)
const registrationSuccess = ref(false)
const viewMode = ref<'dynamic' | 'preregistered'>('dynamic')
const preregClientId = ref('')
const preregClientSecret = ref('')
const preregShowSecret = ref(false)
const preregError = ref<string | null>(null)
const preregSuccess = ref<string | null>(null)
const isPreregSaving = ref(false)
const isRetrying = ref(false)

// Initialize view mode based on registration method
onMounted(() => {
  updateViewMode()
  updateRegistrationError()
  updateRegistrationSuccess()
})

// Watch for changes in registration method
watch(() => props.server.oauth2?.registrationMethod, () => {
  updateViewMode()
})

// Watch for changes in registration error
watch(() => props.server.oauth2?.registrationError, () => {
  updateRegistrationError()
})

// Watch for changes in client registration
watch(() => props.server.auth?.oauth2?.clientRegistration?.exchange.success, () => {
  updateRegistrationSuccess()
})

function updateRegistrationError() {
  if (props.server.auth?.oauth2?.clientRegistration?.exchange.error) {
    registrationError.value = props.server.auth.oauth2.clientRegistration.exchange.error
  }
}

function updateRegistrationSuccess() {
  // Show success if we have client credentials and no error
  registrationSuccess.value = props.server.auth?.oauth2?.clientRegistration?.exchange.success ?? false
}

function updateViewMode() {
  if (props.server.oauth2?.registrationMethod === 'Manual') {
    viewMode.value = 'preregistered'
  } else if (props.server.oauth2?.registrationMethod) {
    viewMode.value = 'dynamic'
  }
}

/**
 * Handle retry of failed dynamic client registration
 */
function handleRetryRegistration() {
  isRetrying.value = true
  registrationError.value = null
  try {
    emit('retry-registration')
  } finally {
    isRetrying.value = false
  }
}

const registrationExchange = computed(() => {
  return props.server.auth?.oauth2?.clientRegistration?.exchange
})

// const registrationData = computed(() => {
//   return registrationExchange.value?.response?.payload
// });

const registrationMethod = computed(() => {
  return props.server.auth?.oauth2?.clientRegistration?.registrationMethod;
})

const requestHeaders = computed(() => {
  return registrationExchange.value?.request?.headers || null
})

const responseHeaders = computed(() => {
  return registrationExchange.value?.response?.headers || null
})

const responseStatus = computed(() => {
  return registrationExchange.value?.response?.status_code ?? null
})

const requestContentType = computed(() => {
  if (!requestHeaders.value) return null
  const entry = Object.entries(requestHeaders.value).find(([key]) => key.toLowerCase() === 'content-type')
  return entry ? entry[1] : null
})

const responseContentType = computed(() => {
  if (!responseHeaders.value) return null
  const entry = Object.entries(responseHeaders.value).find(([key]) => key.toLowerCase() === 'content-type')
  return entry ? entry[1] : null
})



function copyToClipboard(text: string) {
 void  navigator.clipboard.writeText(text)
}

/**
 * Handle saving pre-registered client
 */
function handleSavePreregisteredClient() {
  preregError.value = null
  preregSuccess.value = null

  if (!preregClientId.value.trim()) {
    preregError.value = 'Client ID is required'
    return
  }

  isPreregSaving.value = true

  try {
    serverStore.updateServerProperty(props.server.id, 'oauth2', {
      ...(props.server.oauth2 || {}),
      clientId: preregClientId.value.trim(),
      clientSecret: preregClientSecret.value.trim(),
      registrationMethod: 'Manual'
    })

    preregSuccess.value = 'Pre-registered client saved successfully'
    // Stay in preregistered view after saving
    preregClientId.value = ''
    preregClientSecret.value = ''
    
  } catch (error) {
    preregError.value = (error instanceof Error ? error.message : 'Failed to save pre-registered client')
  } finally {
    isPreregSaving.value = false
  }
}

/**
 * Switch to pre-registered view
 */
function switchToPreregistered() {
  viewMode.value = 'preregistered'
  preregClientId.value = ''
  preregClientSecret.value = ''
  preregError.value = null
  preregSuccess.value = null
}

/**
 * Switch to dynamic registration view
 */
function switchToDynamic() {
  viewMode.value = 'dynamic'
  preregClientId.value = ''
  preregClientSecret.value = ''
}

</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Client Registration</h3>
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
      <!-- FIXME: Re-enable client registration button when handleRegisterClient is implemented -->
    </div>

    <!-- Mode Toggle Tabs -->
    <div class="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
      <button
        @click="switchToDynamic"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
        :class="viewMode === 'dynamic' 
          ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
      >
        Dynamic Registration
      </button>
      <button
        @click="switchToPreregistered"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
        :class="viewMode === 'preregistered' 
          ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
      >
        Pre-Registered
      </button>
    </div>

    <!-- Dynamic Registration View -->
    <div v-if="viewMode === 'dynamic'">
      <!-- <div class="ml-auto mt-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Client Name
        </label>
        <div class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
            {{ registrationData?.client_name ?? registrationData?.name ?? 'Not defined'  }}
          </code>
          <button
            v-if="registrationData?.client_name || registrationData?.name"
            @click="copyToClipboard(registrationData?.client_name ?? registrationData?.name ?? '')"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Copy to clipboard"
          >
            <CopyIcon class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="ml-auto mt-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Client ID
        </label>
        <div class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
            {{ registrationData?.client_id ?? 'Not defined'  }}
          </code>
          <button
            v-if="registrationData?.client_id"
            @click="copyToClipboard(registrationData?.client_id ?? '')"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Copy to clipboard"
          >
            <CopyIcon class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="ml-auto mt-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Client Secret
        </label>
        <div class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
            {{ registrationData?.client_secret ?? 'Not defined'  }}
          </code>
          <button
            v-if="registrationData?.client_secret"
            @click="copyToClipboard(registrationData?.client_name ?? registrationData?.name ?? '')"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Copy to clipboard"
          >
            <CopyIcon class="w-4 h-4" />
          </button>
        </div>
      </div> -->

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
                <svg v-if="!isRetrying" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m0 0H9"></path>
                </svg>
                <svg v-else class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2v4m6.364 1.636l-2.828 2.828m4 8h-4m-6.364-1.636l-2.828-2.828m2.828-2.828l-2.828-2.828"></path>
                </svg>
                {{ isRetrying ? 'Retrying...' : 'Retry' }}
              </button>
              <button
                @click="registrationError = null"
                class="px-3 py-1 text-xs font-medium border border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 rounded transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Registration Method Badge (for dynamic registration) -->
      <div v-if="registrationMethod !== 'Manual' && server.oauth2.clientId" class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <span class="text-sm text-gray-600 dark:text-gray-400">Registration Method:</span>
        <span 
          class="px-3 py-1 rounded-full text-xs font-semibold"
          :class="{
            'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200': registrationMethod === 'RFC7591',
            'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200': registrationMethod === 'Mastodon'
          }"
        >
          {{ registrationMethod }}
        </span>
        <span v-if="registrationMethod === 'RFC7591'" class="text-xs text-gray-500 dark:text-gray-400">
          (Standard Dynamic Client Registration)
        </span>
        <span v-else-if="registrationMethod === 'Mastodon'" class="text-xs text-gray-500 dark:text-gray-400">
          (Mastodon API /api/v1/apps)
        </span>
      </div>

      <!-- Client Credentials Section (showing for both dynamic and pre-registered) -->
      <div v-if="server.auth?.oauth2?.clientRegistration?.exchange.response?.payload?.client_id" class="space-y-4">
        <!-- Client ID -->
        <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Client ID
        </label>
        <div v-if="!editable && server.oauth2.clientId" class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
            {{ server.oauth2.clientId }}
          </code>
          <button
            @click="copyToClipboard(server.oauth2.clientId)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Copy to clipboard"
          >
            <CopyIcon class="w-4 h-4" />
          </button>
        </div>
        <div v-else-if="!server.oauth2.clientId" class="text-sm text-gray-500 dark:text-gray-400 italic">
          Not configured
        </div>
      </div>

      <!-- Client Secret -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Client Secret
        </label>
        <div v-if="!editable && server.oauth2.clientSecret" class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
            {{ showClientSecret ? server.oauth2.clientSecret : '••••••••••••••••' }}
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
            @click="copyToClipboard(server.oauth2.clientSecret)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Copy to clipboard"
          >
            <CopyIcon class="w-4 h-4" />
          </button>
        </div>
        <div v-else-if="!server.oauth2.clientSecret" class="text-sm text-gray-500 dark:text-gray-400 italic">
          Not configured
        </div>
      </div>

      <!-- Client Name -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Client Name
        </label>
        <div v-if="!editable && server.name" class="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-900 dark:text-gray-100">
          {{ server.name }}
        </div>
        <div v-else-if="!server.name" class="text-sm text-gray-500 dark:text-gray-400 italic">
          Not configured
        </div>
      </div>

      <!-- Redirect URIs -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Redirect URI
        </label>
        <div v-if="!editable && server.oauth2.redirectUri" class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
            {{ server.oauth2.redirectUri }}
          </code>
          <button
            @click="copyToClipboard(server.oauth2.redirectUri)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Copy to clipboard"
          >
            <CopyIcon class="w-4 h-4" />
          </button>
        </div>
        <div v-else-if="!server.oauth2.redirectUri" class="text-sm text-gray-500 dark:text-gray-400 italic">
          Not configured
        </div>
      </div>

      </div>

      <!-- HTTP Registration Exchange (only for dynamic registration) -->
      <div v-if="registrationExchange && server.auth?.oauth2?.clientRegistration?.registrationMethod !== 'Manual'" class="pt-4 border-t border-gray-200 dark:border-gray-700">
        <details class="group">
          <summary class="cursor-pointer list-none">
            <div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
              <svg class="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
              Registration Details
            </div>
          </summary>
          <div class="mt-4 space-y-4">
            <HttpRequestPanel
              title="Request"
              :headers="requestHeaders"
              :url="registrationExchange.request?.url"
              :payload="registrationExchange.request?.params"
              :content-type="requestContentType"
            />
            <HttpResponsePanel
              title="Response"
              :status="responseStatus"
              :headers="responseHeaders"
              :payload="registrationExchange.response?.payload"
              :content-type="responseContentType"
            />
          </div>
        </details>
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

      <!-- Show existing pre-registered client info -->
      <div v-if="server.oauth2?.registrationMethod === 'Manual' && server.oauth2?.clientId" class="space-y-4">
        <!-- Registration Method Badge -->
        <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <span class="text-sm text-gray-600 dark:text-gray-400">Method:</span>
          <span class="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200">
            Pre-Registered (Manual)
          </span>
        </div>

        <!-- Client ID -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client ID
          </label>
          <div class="flex items-center gap-2">
            <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
              {{ server.oauth2.clientId }}
            </code>
            <button
              @click="copyToClipboard(server.oauth2.clientId)"
              class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              title="Copy to clipboard"
            >
              <CopyIcon class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Client Secret (if available) -->
        <div v-if="server.oauth2.clientSecret">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client Secret
          </label>
          <div class="flex items-center gap-2">
            <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
              {{ showClientSecret ? server.oauth2.clientSecret : '••••••••••••••••' }}
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
              @click="copyToClipboard(server.oauth2.clientSecret)"
              class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              title="Copy to clipboard"
            >
              <CopyIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Pre-Registered Client Form (when not configured) -->
      <div v-else class="space-y-4">
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

        <!-- Action Buttons -->
        <div class="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            @click="handleSavePreregisteredClient"
            :disabled="isPreregSaving || !preregClientId.trim()"
            class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
          >
            <span v-if="!isPreregSaving">Save</span>
            <span v-else class="flex items-center justify-center gap-2">
              <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2v4m6.364 1.636l-2.828 2.828m4 8h-4m-6.364-1.636l-2.828-2.828m2.828-2.828l-2.828-2.828"></path>
              </svg>
              Saving...
            </span>
          </button>
          <button
            @click="switchToDynamic"
            :disabled="isPreregSaving"
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- No OAuth2 config state -->
    <div v-if="viewMode === 'dynamic' && !server.oauth2" class="text-center py-8">
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        OAuth2 client metadata not configured
      </p>
    </div>
  </div>
</template>

