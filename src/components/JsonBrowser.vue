<script setup lang="ts">
import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/vue3-json-viewer.css'
import HttpRequestPanel from '@/components/http/HttpRequestPanel.vue'
import HttpResponsePanel from '@/components/http/HttpResponsePanel.vue'
import { useThemeStore } from '@/stores/themeStore'

const emit = defineEmits<{
  fetchUri: [uri: string]
}>()

defineProps({
  data: {
    type: Object,
    default: null
  },
  requestUrl: {
    type: String,
    default: null
  },
  requestHeaders: {
    type: Object,
    default: null
  },
  responseStatus: {
    type: Number,
    default: null
  },
  responseStatusText: {
    type: String,
    default: null
  },
  responseHeaders: {
    type: Object,
    default: null
  },
  duration: {
    type: Number,
    default: null
  }
})

const themeStore = useThemeStore()

/**
 * Handle click events to detect and emit URL clicks
 */
function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  
  // Traverse up the DOM tree to find the jv-string element
  let element: HTMLElement | null = target
  while (element) {
    if (element.classList.contains('jv-string')) {
      // Extract the text content and remove quotes
      let text = element.textContent || ''
      text = text.trim().replace(/^["']|["']$/g, '')
      
      // Check if it's a URL
      if (/^https?:\/\/.+/.test(text)) {
        event.preventDefault()
        event.stopPropagation()
        emit('fetchUri', text)
        return
      }
      break
    }
    element = element.parentElement
  }
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
    <div>
      <div v-if="data" class="font-mono text-sm" @click="handleClick">
        <!-- https://github.com/qiuquanwu/vue3-json-viewer -->
        <JsonViewer
          :value="data"
          :theme="themeStore.isDark ? 'dark': 'light'"
          :darkMode="themeStore.isDark"
          :expandDepth="3"
          :copyable="true"
          class="json-viewer-wrapper"
        />
      </div>
      <div v-else class="text-center py-12 text-gray-400 dark:text-gray-500">
        No data yet. Make a request to see the response.
      </div>
    </div>
    <div class="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4 px-4">
      <HttpRequestPanel 
        :url="requestUrl"
        :headers="requestHeaders"
      />
    </div>
    <div class="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4 px-4 pb-4">
      <HttpResponsePanel 
        :status="responseStatus"
        :status-text="responseStatusText"
        :headers="responseHeaders"
      />
    </div>
  </div>
</template>

<style scoped lang="postcss">
/* Dark mode */
:deep(.jv-container[darkmode=true] .jv-object) {
  color: lightgray;
}

:deep(.jv-container[darkmode=true] .jv-array) {
  color: lightgray;
}

:deep(.jv-container[darkmode=true] .jv-ellipsis) {
  background: lightgray;
  color: black;
}

:deep(.jv-container[darkmode=true] .jv-key) {
  color: orange;
}

:deep(.jv-container[darkmode=true] .jv-number) {
  color: lightgreen;
}

:deep(.jv-container[darkmode=true] .jv-boolean) {
  color: lightgreen;
}

:deep(.jv-container[darkmode=true] .jv-string) {
  color: lightgreen;
}

:deep(.jv-container[darkmode=true] .jv-key-node::after) {
  color: lightgray;
}

:deep(.jv-container[darkmode=true] .jv-item a.jv-link) {
  color: lightblue;
}

/* Light mode */
:deep(.jv-container[darkmode=false] .jv-code) {
  background: #eee;
}

:deep(.jv-container[darkmode=false] .jv-key) {
  font-weight: 600;
}

:deep(.jv-container[darkmode=false] .jv-number) {
  color: darkgreen;
}

:deep(.jv-container[darkmode=false] .jv-boolean) {
  color: darkgreen;
}

:deep(.jv-container[darkmode=false] .jv-string) {
  color: darkgreen;
}

:deep(.jv-container[darkmode=false] .jv-item a.jv-link) {
  font-weight: 500;
  color: navy;
}
/* Reduce left margin for the JSON viewer */
:deep(.jv-container) {
  padding-left: 0;
  margin-left: 0;
  background-color: transparent;
}

:deep(.jv-indent) {
  padding-left: 12px;
  margin-left: 0;
}

/* JSON viewer wrapper spacing */
.json-viewer-wrapper {
  line-height: 1.5;
}

:deep(.jv-container .jv-code) {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

:deep(.jv-toggle.open ~ .jv-push .jv-object:nth-of-type(2)) {
    padding-left: 12px;
}

:deep(.jv-container .jv-item a.jv-link:hover) {
  text-decoration: underline;
}
</style>
