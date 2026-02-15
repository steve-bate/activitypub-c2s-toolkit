<script setup lang="ts">
import { reactive, computed } from 'vue'
import type { AuthType } from '@/stores/serverStore'

interface OAuth2InitiateFlowProps {
  server: {
    identifier?: string
    name?: string
    baseUrl?: string
    authType?: AuthType
    oauth2?: {
      clientId?: string
      clientSecret?: string
      redirectUri?: string
      scopes?: string
    }
  }
}

interface FormErrors {
  identifier?: string
  name?: string
  clientId?: string
  redirectUri?: string
}

const props = defineProps<OAuth2InitiateFlowProps>()

const emit = defineEmits<{
  save: [data: {
    identifier: string
    name: string
    baseUrl: string
    authType: AuthType
    oauth2: {
      clientId: string
      clientSecret: string
      redirectUri: string
      scopes: string
    }
  }]
  cancel: []
}>()

const form = reactive({
  identifier: props.server.identifier || '',
  name: props.server.name || '',
  baseUrl: props.server.baseUrl || '',
  authType: (props.server.authType || 'oauth2'),
  oauth2: {
    clientId: props.server.oauth2?.clientId || '',
    clientSecret: props.server.oauth2?.clientSecret || '',
    redirectUri: props.server.oauth2?.redirectUri || '',
    scopes: props.server.oauth2?.scopes || 'read write follow'
  }
})

const errors = reactive<FormErrors>({})

const isValid = computed(() => {
  const hasErrors = Object.keys(errors).length > 0
  const hasRequired = form.identifier.trim() && form.name.trim()
  
  if (form.authType === 'oauth2') {
    return !hasErrors && hasRequired && form.oauth2.clientId && form.oauth2.redirectUri
  }
  
  return !hasErrors && hasRequired
})

function validateField(field: keyof FormErrors): void {
  delete errors[field]
  
  if (field === 'identifier') {
    if (!form.identifier.trim()) {
      errors.identifier = 'Server identifier is required'
    }
  } else if (field === 'name') {
    if (!form.name.trim()) {
      errors.name = 'Server name is required'
    }
  } else if (field === 'clientId') {
    if (form.authType === 'oauth2' && !form.oauth2.clientId.trim()) {
      errors.clientId = 'Client ID is required for OAuth2'
    }
  } else if (field === 'redirectUri') {
    if (form.authType === 'oauth2' && !form.oauth2.redirectUri.trim()) {
      errors.redirectUri = 'Redirect URI is required for OAuth2'
    }
  }
}

function handleSave(): void {
  validateField('identifier')
  validateField('name')
  validateField('clientId')
  validateField('redirectUri')
  
  if (isValid.value) {
    emit('save', {
      identifier: form.identifier,
      name: form.name,
      baseUrl: form.baseUrl,
      authType: form.authType,
      oauth2: form.oauth2
    })
  }
}

function handleCancel(): void {
  emit('cancel')
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <form @submit.prevent="handleSave" class="space-y-6 bg-white dark:bg-gray-900 p-6 rounded-lg shadow">
      <!-- Server Identifier -->
      <div>
        <label for="identifier" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Authorization Server Identifier <span class="text-red-500">*</span>
        </label>
        <input
          id="identifier"
          v-model="form.identifier"
          type="text"
          placeholder="example.com or https://example.com:8080"
          @blur="validateField('identifier')"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
        />
        <p v-if="errors.identifier" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors.identifier }}</p>
      </div>

      <!-- Server Name -->
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Display Name <span class="text-red-500">*</span>
        </label>
        <input
          id="name"
          v-model="form.name"
          type="text"
          placeholder="e.g., My Instance"
          @blur="validateField('name')"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
        />
        <p v-if="errors.name" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors.name }}</p>
      </div>

      <!-- Base URL (read-only, derived from identifier) -->
      <div>
        <label for="baseUrl" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Base URL
        </label>
        <input
          id="baseUrl"
          v-model="form.baseUrl"
          type="text"
          disabled
          class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-800 dark:text-gray-400 text-gray-500"
        />
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Automatically derived from server identifier</p>
      </div>

      <!-- Auth Type -->
      <div>
        <label for="authType" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Authentication Type
        </label>
        <select
          id="authType"
          v-model="form.authType"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
        >
          <option value="oauth2">OAuth2</option>
          <option value="bearer">Bearer Token</option>
        </select>
      </div>

      <!-- OAuth2 Configuration -->
      <div v-if="form.authType === 'oauth2'" class="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 class="font-medium text-gray-900 dark:text-gray-100">OAuth2 Configuration</h3>

        <!-- Client ID -->
        <div>
          <label for="clientId" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Client ID <span class="text-red-500">*</span>
          </label>
          <input
            id="clientId"
            v-model="form.oauth2.clientId"
            type="text"
            autocomplete="username"
            @blur="validateField('clientId')"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          />
          <p v-if="errors.clientId" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors.clientId }}</p>
        </div>

        <!-- Client Secret -->
        <div>
          <label for="clientSecret" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Client Secret
          </label>
          <input
            id="clientSecret"
            v-model="form.oauth2.clientSecret"
            type="password"
            autocomplete="current-password"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <!-- Redirect URI -->
        <div>
          <label for="redirectUri" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Redirect URI <span class="text-red-500">*</span>
          </label>
          <input
            id="redirectUri"
            v-model="form.oauth2.redirectUri"
            type="url"
            placeholder="http://localhost:5173/callback"
            @blur="validateField('redirectUri')"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          />
          <p v-if="errors.redirectUri" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors.redirectUri }}</p>
        </div>

        <!-- Scopes -->
        <div>
          <label for="scopes" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Scopes
          </label>
          <input
            id="scopes"
            v-model="form.oauth2.scopes"
            type="text"
            placeholder="read write follow"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Space-separated list of OAuth2 scopes</p>
        </div>
      </div>

      <!-- Form Actions -->
      <div class="flex gap-3 pt-4">
        <button
          type="submit"
          :disabled="!isValid"
          class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
        >
          Save Configuration
        </button>
        <button
          type="button"
          @click="handleCancel"
          class="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-md transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>
