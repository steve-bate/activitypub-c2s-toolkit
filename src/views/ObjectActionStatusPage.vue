<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import HttpExchangePanel from '@/components/http/HttpExchangePanel.vue'
import type { HttpExchange, HttpRequestData, HttpResponseData } from '@/types/http'

const router = useRouter()

const actionType = ref<string>('')
const success = ref<boolean>(false)
const message = ref<string>('')
const exchange = ref<HttpExchange<HttpRequestData, HttpResponseData> | null>(null)
const objectUri = ref<string>('')
const showPreview = ref<boolean>(false)

onMounted(() => {
  // Get data from route state
  const state = history.state as {
    actionType?: string
    success?: boolean
    message?: string
    exchangeJson?: string
    objectUri?: string
    showPreview?: boolean
  }

  if (state && state.actionType) {
    actionType.value = state.actionType
    success.value = state.success ?? false
    message.value = state.message ?? ''
    objectUri.value = state.objectUri ?? ''
    showPreview.value = state.showPreview ?? false
    
    // Parse exchange from JSON
    if (state.exchangeJson) {
      try {
        exchange.value = JSON.parse(state.exchangeJson)
      } catch (error) {
        console.error('Failed to parse exchange data:', error)
      }
    }
  }
})

const title = computed(() => {
  return `${actionType.value} ${success.value ? 'Successful' : 'Failed'}`
})

function goBack() {
  if (objectUri.value) {
    // Navigate back to JSON page with preview state preserved
    void router.push({
      name: 'json',
      query: {
        uri: objectUri.value,
        preview: String(showPreview.value)
      }
    })
  } else {
    router.back()
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
    <div class="max-w-4xl mx-auto px-4">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ title }}</h1>
        <p v-if="objectUri" class="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all">
          Object: {{ objectUri }}
        </p>
      </div>

      <!-- Status Message -->
      <div 
        class="mb-6 p-4 rounded-lg"
        :class="success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'"
      >
        <p 
          class="text-sm font-medium"
          :class="success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'"
        >
          {{ message }}
        </p>
      </div>

      <!-- HTTP Exchange -->
      <div v-if="exchange" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
        <HttpExchangePanel :exchange="exchange" title="HTTP Exchange Details" />
      </div>

      <!-- Back Button -->
      <div class="flex justify-start">
        <button
          @click="goBack"
          class="bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  </div>
</template>
