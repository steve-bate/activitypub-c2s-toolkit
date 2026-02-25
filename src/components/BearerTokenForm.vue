<script setup lang="ts">
import { reactive, computed, ref } from 'vue'
import ArrowDownIcon from '@/components/icons/ArrowDownIcon.vue'

interface BearerTokenFormProps {
  identifier?: string
}

interface FormErrors {
  actorIdentifier?: string
  bearerToken?: string
}

const props = defineProps<BearerTokenFormProps>()

const emit = defineEmits<{
  save: [data: {
    identifier: string
    name: string
    bearerToken: string
  }]
  cancel: []
}>()

const showBearerTokenInfo = ref(false)

const form = reactive({
  actorIdentifier: props.identifier || '',
  bearerToken: ''
})

const errors = reactive<FormErrors>({})

const isValid = computed(() => {
  const hasErrors = Object.keys(errors).length > 0
  const hasRequired = form.actorIdentifier.trim() && form.bearerToken.trim()
  return !hasErrors && hasRequired
})

function validateField(field: keyof FormErrors): void {
  delete errors[field]

  if (field === 'actorIdentifier') {
    if (!form.actorIdentifier.trim()) {
      errors.actorIdentifier = 'Actor handle or URL is required'
    }
  } else if (field === 'bearerToken') {
    if (!form.bearerToken.trim()) {
      errors.bearerToken = 'Bearer token is required'
    }
  }
}

function handleSave(): void {
  validateField('actorIdentifier')
  validateField('bearerToken')

  if (isValid.value) {
    emit('save', {
      identifier: form.actorIdentifier,
      name: form.actorIdentifier.replace(/^@/, ''),
      bearerToken: form.bearerToken
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
      <!-- Collapsible Info Box -->
      <div class="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
        <button
          type="button"
          @click="showBearerTokenInfo = !showBearerTokenInfo"
          class="w-full px-4 py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 flex items-center justify-between transition-colors"
        >
          <h3 class="font-medium text-blue-900 dark:text-blue-100">About Bearer Tokens</h3>
          <ArrowDownIcon
            class="w-5 h-5 text-blue-900 dark:text-blue-100 transition-transform"
            :class="{ 'rotate-180': showBearerTokenInfo }"
          />
        </button>
        <div
          v-show="showBearerTokenInfo"
          class="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800 space-y-2"
        >
          <p class="text-sm text-blue-800 dark:text-blue-200">
            A Bearer token (also called an application password or pre-generated application token) is a long-lived token that you can generate 
            from your server's settings to authenticate requests.
          </p>
          <p class="text-sm text-blue-800 dark:text-blue-200">
            Since automatic discovery cannot be performed with Bearer tokens, you must manually provide your ActivityPub handle or profile URL.
          </p>
        </div>
      </div>

      <!-- Actor Identifier (Handle or URL) -->
      <div>
        <label for="actorIdentifier" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          ActivityPub Handle or Profile URL <span class="text-red-500">*</span>
        </label>
        <input
          id="actorIdentifier"
          v-model="form.actorIdentifier"
          type="text"
          placeholder="@user@example.com or https://example.com/users/user"
          @blur="validateField('actorIdentifier')"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
        />
        <p v-if="errors.actorIdentifier" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors.actorIdentifier }}</p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Format: <code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">@user@example.com</code> or 
          <code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">https://example.com/users/user</code>
        </p>
      </div>

      <!-- Bearer Token -->
      <div>
        <label for="bearerToken" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Bearer Token <span class="text-red-500">*</span>
        </label>
        <textarea
          id="bearerToken"
          v-model="form.bearerToken"
          placeholder="Paste your bearer token here"
          @blur="validateField('bearerToken')"
          rows="4"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white font-mono text-sm"
        />
        <p v-if="errors.bearerToken" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors.bearerToken }}</p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          This token will be used to authenticate API requests as a Bearer token
        </p>
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
