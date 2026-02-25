<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/vue3-json-viewer.css'
import { useSettingsStore } from '@/stores/settingsStore'

const emit = defineEmits<{
  fetchUri: [uri: string, property?: string]
}>()

const props = defineProps({
  data: {
    type: Object,
    default: null
  }
})

const settingsStore = useSettingsStore()
const jsonViewerContainer = ref<HTMLElement | null>(null)

function collapseJsonLdContext() {
  const container = jsonViewerContainer.value
  if (!container) {
    return
  }

  const keys = container.querySelectorAll<HTMLElement>('.jv-key')
  for (const key of keys) {
    if (key.textContent?.trim() !== '@context:') {
      continue
    }

    const node = key.closest('.jv-node.toggle')
    if (!node) {
      continue
    }

    let ancestorCount = 0
    let parentNode = node.parentElement?.closest('.jv-node.toggle')
    while (parentNode) {
      ancestorCount += 1
      parentNode = parentNode.parentElement?.closest('.jv-node.toggle')
    }

    if (ancestorCount !== 1) {
      continue
    }

    const toggle = node.querySelector<HTMLElement>(':scope > .jv-toggle')
    if (toggle?.classList.contains('open')) {
      toggle.click()
    }
    return
  }
}

function scheduleContextCollapse() {
  void nextTick(() => {
    collapseJsonLdContext()
    setTimeout(collapseJsonLdContext, 0)
  })
}

watch(
  () => props.data,
  () => {
    scheduleContextCollapse()
  },
  { deep: true, immediate: true }
)

/**
 * Handle click events to detect and emit URL clicks
 */
function handleClick(event: MouseEvent) {
  // TODO provide the link generation function from the parent component
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
        
        // Try to find the property key for this value
        let propertyName: string | undefined
        const node = element.closest('.jv-node')
        if (node) {
          const keyElement = node.querySelector('.jv-key')
          if (keyElement) {
            propertyName = keyElement.textContent?.trim().replace(/:$/, '') || undefined
          }
        }
        
        emit('fetchUri', text, propertyName)
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
      <div v-if="data" ref="jsonViewerContainer" class="font-mono text-sm" @click="handleClick">
        <!-- https://github.com/qiuquanwu/vue3-json-viewer -->
        <JsonViewer
          :value="data"
          :theme="settingsStore.isDark ? 'dark': 'light'"
          :darkMode="settingsStore.isDark"
          :expandDepth="4"
          :copyable="true"
          class="json-viewer-wrapper"
        />
      </div>
      <div v-else class="text-center py-12 text-gray-400 dark:text-gray-500">
        No data yet. Make a request to see the response.
      </div>
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
