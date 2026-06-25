<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <!-- Resource Templates Table -->
    <h2 v-if="viewMode === 'table'" class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Resource Templates</h2>
    <div v-if="viewMode === 'table'" class="mt-4">
      <TemplateTable :items="[...resourceTemplateStore.items]" @add="addTemplate" @edit="editTemplate"
        @duplicate="duplicateTemplate" @delete="deleteTemplate" @post="postTemplate">
      </TemplateTable>
    </div>

    <!-- Posting to Outbox -->
    <h2 v-if="viewMode === 'post'" class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Post to Outbox</h2>
    <div v-if="viewMode === 'post'" class="mt-4">
      <div class="space-y-3">
        <div v-if="errorMessage"
          class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
          role="alert" aria-live="polite">
          <div class="flex items-start gap-3">
            <svg class="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" viewBox="0 0 20 20"
              fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-11a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1zm0 8a1.25 1.25 0 100-2.5A1.25 1.25 0 0010 15z"
                clip-rule="evenodd" />
            </svg>
            <p>{{ errorMessage }}</p>
          </div>
        </div>

        <div v-if="successMessage"
          class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
          role="status" aria-live="polite">
          <div class="flex items-start gap-3">
            <svg class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" viewBox="0 0 20 20"
              fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 10-1.4-1.4L9 10.59 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z"
                clip-rule="evenodd" />
            </svg>
            <p>{{ successMessage }}</p>
          </div>
        </div>
      </div>

      <HttpExchangePanel class="mt-4" v-if="postResult" :exchange="postResult.exchange" />
      
      <button @click="viewMode = 'table'"
        class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Back to Templates</button>
    </div>
  </div>


</template>
    
<script setup lang='ts'>
import TemplateTable from '@/components/templates/TemplateTable.vue'
import { useResourceTemplatesStore } from '@/stores/templateStore'
import { useServerStore } from '@/stores/serverStore'
import { JsonObject, ResourceTemplate } from '@/lib/templates/types'
import router from '@/router'
import { computed, ref } from 'vue'
import { HttpExchange, HttpRequestData, HttpResponseData } from '@/types/http'
import HttpExchangePanel from '@/components/http/HttpExchangePanel.vue'

const resourceTemplateStore = useResourceTemplatesStore()
const serverStore = useServerStore()

const viewMode = ref<"table" | "post">("table")

//
// Table event handlers
//

function addTemplate(selectedEditorType: "form" | "json") {
    router.push({
      name: 'resourceTemplateNew',
      query: { editorType: selectedEditorType },
    })
}

function editTemplate(row: ResourceTemplate) {
  router.push({
    name: 'resourceTemplateEdit',
    params: { id: String(row.id) },
  })
}

function duplicateTemplate(row: ResourceTemplate) {
  console.log('Duplicating resource template:', row)
  let newName = row.name
  const match = newName.match(/\((\d+)\)$/)
  if (match) {
    const num = parseInt(match[1], 10) + 1
    newName = newName.replace(/\(\d+\)$/, `(${num})`)
  } else {
    newName = `${newName} (1)`
  }
  const newTemplate = { ...row, id: Date.now().toString(), name: newName }
  resourceTemplateStore.add(newTemplate)
}

function deleteTemplate(row: ResourceTemplate) {
  console.log('Deleting resource template:', row)
  resourceTemplateStore.remove(row.id!)
}

//
// Post to Outbox
//

const outbox = computed(() => serverStore.activeServer?.actor?.profile?.outbox)
const document = ref<JsonObject | undefined>(undefined)

const isPosting = ref(false)

interface PostResult {
  startedAt: string
  finishedAt: string
  durationMs: number
  exchange: HttpExchange<HttpRequestData<string>, HttpResponseData<unknown>>
}

const postResult = ref<PostResult | undefined>(undefined)

const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

function maybeParseJson(responseText: string): unknown {
  const trimmed = responseText.trim()
  if (!trimmed) {
    return undefined
  }

  const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[")
  if (!looksLikeJson) {
    return undefined
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

async function postToOutbox(outboxUrl: string, document: JsonObject) {
  try {
    const startedAt = new Date().toISOString()
    const startTime = performance.now()

    const controller = new AbortController()
    const timeoutMs = 10000 // 10 seconds
    // @ts-expect-error ref needed to prevent GC
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const timeoutHandle = window.setTimeout(() => controller.abort(), timeoutMs)

    const token = serverStore.activeServer?.auth?.bearerToken
    if (!token) {
      throw Error('No access token is available for posting.')
    }

    isPosting.value = true
    
    const requestHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/activity+json',
      'Accept': 'application/activity+json, application/json'
    }
    
    const requestBody = JSON.stringify(document)

    const requestExchange: HttpRequestData<string> = {
      url: outboxUrl,
      headers: requestHeaders,
      params: requestBody,
      timestamp: startedAt,
    }

    const response = await fetch(outboxUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
    })

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
 
    const responseText = await response.text()


    const responseJson = maybeParseJson(responseText)

    const finishedAt = new Date().toISOString()
    const durationMs = Math.round(performance.now() - startTime)

    const responseExchange: HttpResponseData<unknown> = {
      status_code: response.status,
      status_text: response.statusText,
      headers: responseHeaders,
      payload: responseJson ?? responseText,
    }

    const exchange: HttpExchange<
      HttpRequestData<string>,
      HttpResponseData<unknown>
    > = {
      success: response.ok,
      error: response.ok
        ? undefined
        : `HTTP ${response.status} ${response.statusText}`,
      request: requestExchange,
      response: responseExchange,
    }

    return {
      startedAt,
      finishedAt,
      durationMs,
      exchange
    }
  }
  finally {
    isPosting.value = false
  }
}

async function postTemplate(resourceTemplate: ResourceTemplate) {
  document.value = resourceTemplate.document
  viewMode.value = "post"

  try {
    if (!outbox.value) {
      throw new Error('No outbox URL is available for posting.')
    }
    if (!resourceTemplate.document) {
      throw new Error('No document is available in the resource template for posting.')
    }
    postResult.value = await postToOutbox(outbox.value, resourceTemplate.document)

    if (postResult.value.exchange.success) {
      successMessage.value = 'Document posted successfully.'
    } else {
      errorMessage.value = postResult.value.exchange.error || 'An unknown error occurred during posting.'
    }
  }
  catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : 'An unknown error occurred during posting.'
  }
}
</script>
    
<style>
    
</style>