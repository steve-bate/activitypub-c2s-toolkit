<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DocumentPreview from './DocumentPreview.vue'

interface Props {
  data: Record<string, unknown>
}

const props = defineProps<Props>()
const router = useRouter()
const route = useRoute()

function resolveUri(uri: string): string {
  const base = typeof route.query.uri === 'string' ? route.query.uri : window.location.origin
  try {
    return new URL(uri, base).toString()
  } catch {
    return uri
  }
}

function isNavigableUri(uri: string): boolean {
  return uri.startsWith('http') || uri.startsWith('/')
}

function navigateToJson(uri: string) {
  if (!uri || !isNavigableUri(uri)) return
  void router.push({
    name: 'json',
    query: { uri: resolveUri(uri) }
  })
}

const activityType = computed(() => {
  return (props.data.type as string) || 'Activity'
})

const publishedDate = computed(() => {
  if (props.data.published) {
    const date = new Date(props.data.published as string)
    return date.toLocaleString()
  }
  return ''
})

const actor = computed(() => {
  const act = props.data.actor
  if (!act) return ''
  if (typeof act === 'string') return act
  if (typeof act === 'object' && act !== null && typeof (act as Record<string, unknown>).id === 'string') {
    return ((act as Record<string, unknown>).id as string)
  }
  return ''
})

const objectData = computed(() => {
  const obj = props.data.object
  if (typeof obj === 'object' && obj !== null) {
    return obj as Record<string, unknown>
  }
  return null
})

const objectId = computed(() => {
  if (!objectData.value) return ''
  return (objectData.value.id as string) || ''
})

const hasObjectPreview = computed(() => {
  if (!objectData.value) return false
  const objType = String(objectData.value.type || '').toLowerCase()
  // Check if it's a document-like type
  const documentTypes = ['note', 'article', 'page', 'document']
  if (!documentTypes.includes(objType)) return false
  
  // Check if it has previewable fields
  const hasContentOrSummary = !!(objectData.value.content || objectData.value.summary)
  const hasAttachment = Array.isArray(objectData.value.attachment)
    ? objectData.value.attachment.length > 0
    : typeof objectData.value.attachment === 'object' && objectData.value.attachment !== null
  const hasTag = Array.isArray(objectData.value.tag)
    ? objectData.value.tag.length > 0
    : typeof objectData.value.tag === 'object' && objectData.value.tag !== null

  return hasContentOrSummary || hasAttachment || hasTag
})

const addressingFields = computed(() => {
  const fields: Array<{ name: string; value: string }> = []
  
  const addressingProps = ['to', 'cc', 'bcc', 'audience']
  
  addressingProps.forEach(prop => {
    const value = props.data[prop]
    if (value) {
      if (typeof value === 'string') {
        fields.push({ name: prop.toUpperCase(), value })
      } else if (Array.isArray(value)) {
        const urls = value
          .map(v => (typeof v === 'string' ? v : (v as Record<string, unknown>).id || ''))
          .filter(Boolean)
        if (urls.length > 0) {
          fields.push({ name: prop.toUpperCase(), value: urls.join('\n') })
        }
      }
    }
  })
  
  return fields
})

const metadata = computed(() => {
  const items: Array<{ name: string; value: string }> = []

  if (props.data.id) {
    items.push({ name: 'ID', value: String(props.data.id) })
  }

  if (activityType.value) {
    items.push({ name: 'Type', value: activityType.value })
  }
  
  if (publishedDate.value) {
    items.push({ name: 'Published', value: publishedDate.value })
  }
  
  if (actor.value) {
    items.push({ name: 'Actor', value: actor.value })
  }
  
  // Add addressing fields
  items.push(...addressingFields.value)
  
  return items
})
</script>

<template>
  <div class="activity-preview bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
    <!-- Activity Metadata Table -->
    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity</h2>
      <table class="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
        <tbody>
          <tr v-for="(item, index) in metadata" :key="index" class="border border-gray-300 dark:border-gray-600">
            <td class="px-4 py-2 font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 border-r border-gray-300 dark:border-gray-600 w-1/4">
              {{ item.name }}
            </td>
            <td class="px-4 py-2 text-gray-700 dark:text-gray-300 break-all">
              <template v-if="item.value.includes('\n')">
                <div v-for="(line, idx) in item.value.split('\n')" :key="idx">
                  <a
                    v-if="isNavigableUri(line)"
                    href="#"
                    class="text-blue-600 dark:text-blue-400 hover:underline"
                    @click.prevent="navigateToJson(line)"
                  >
                    {{ line }}
                  </a>
                  <div v-else>{{ line }}</div>
                </div>
              </template>
              <template v-else>
                <a
                  v-if="isNavigableUri(item.value)"
                  href="#"
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                  @click.prevent="navigateToJson(item.value)"
                >
                  {{ item.value }}
                </a>
                <div v-else>{{ item.value }}</div>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Object Preview or Link (Embedded) -->
    <div v-if="objectData">
      <div v-if="hasObjectPreview" class="p-6 border-t border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Object</h2>
        <DocumentPreview :data="objectData" />
      </div>
      <div v-else-if="objectId" class="p-6 border-t border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Object</h2>
        <a
          href="#"
          class="text-blue-600 dark:text-blue-400 hover:underline"
          @click.prevent="navigateToJson(objectId)"
        >
          {{ objectId }}
        </a>
      </div>
    </div>
  </div>
</template>


