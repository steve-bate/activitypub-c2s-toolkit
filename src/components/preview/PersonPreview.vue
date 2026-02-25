<script setup lang="ts">
import { computed } from 'vue'
import { useServerStore } from '@/stores/serverStore'

interface Props {
  data: Record<string, unknown>
}

const props = defineProps<Props>()
const serverStore = useServerStore()

const actorName = computed(() => {
  return (props.data.name as string) || 'Person'
})

const actorId = computed(() => {
  return (props.data.id as string) || ''
})

const isSelf = computed(() => {
  const activeActorId = serverStore.activeServer?.actor?.profile?.id
  return activeActorId && actorId.value && activeActorId === actorId.value
})

const actorUrl = computed(() => {
  return (props.data.url as string) || ''
})

const actorSummary = computed(() => {
  let summary = (props.data.summary as string) || ''
  // Strip leading/trailing p tags
  summary = summary.replace(/^<p>/, '').replace(/<\/p>$/, '')
  return summary
})

const actorAvatar = computed(() => {
  const icon = props.data.icon as Record<string, unknown> | undefined
  if (typeof icon === 'object' && icon !== null) {
    return (icon.url as string) || ''
  }
  return ''
})

const actorHeader = computed(() => {
  const image = props.data.image as Record<string, unknown> | undefined
  if (typeof image === 'object' && image !== null) {
    return (image.url as string) || ''
  }
  return ''
})

const attachments = computed(() => {
  const attachmentList = props.data.attachment as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(attachmentList)) return []
  
  return attachmentList
    .filter(item => item.type === 'PropertyValue')
    .map(item => ({
      name: (item.name as string) || '',
      value: (item.value as string) || ''
    }))
})

const metadata = computed(() => {
  const items: Array<{ name: string; value: string }> = []
  
  if (props.data.discoverable !== undefined) {
    items.push({ name: 'Discoverable', value: String(props.data.discoverable) })
  }
  
  if (props.data.indexable !== undefined) {
    items.push({ name: 'Indexable', value: String(props.data.indexable) })
  }
  
  if (props.data.published) {
    const publishedDate = new Date(props.data.published as string)
    items.push({ name: 'Published', value: publishedDate.toLocaleString() })
  }
  
  if (props.data.memorial !== undefined) {
    items.push({ name: 'Memorial', value: String(props.data.memorial) })
  }
  
  return items
})
</script>

<template>
  <div class="person-preview bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
    <!-- Header Image (Mastodon style) -->
    <div v-if="actorHeader" class="relative h-48 bg-gradient-to-b from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-600 overflow-hidden">
      <img 
        :src="actorHeader" 
        :alt="actorName"
        class="w-full h-full object-cover"
      />
    </div>

    <!-- Profile Content -->
    <div class="p-8">
      <!-- Avatar (overlaid on header or positioned normally) -->
      <div v-if="actorAvatar" class="mb-4" :style="{ marginTop: actorHeader ? '-4.5rem' : '0' }">
        <img 
          :src="actorAvatar" 
          :alt="actorName"
          class="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-800 relative z-10"
        />
      </div>

      <!-- Name -->
      <div class="flex items-center gap-2 mb-4">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          {{ actorName }}
        </h1>
        <span v-if="isSelf" class="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full border border-green-200 dark:border-green-800">
          Self
        </span>
      </div>

      <!-- ID/URI -->
      <p v-if="actorId" class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        <a 
          :href="actorId"
          class="text-blue-600 dark:text-blue-400 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ actorId }}
        </a>
      </p>

      <!-- Profile URL -->
      <p v-if="actorUrl && actorUrl !== actorId" class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        <strong>Profile:</strong>
        <a 
          :href="actorUrl"
          class="ml-1 text-blue-600 dark:text-blue-400 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ actorUrl }}
        </a>
      </p>

      <!-- Summary (rendered as HTML) -->
      <div v-if="actorSummary" class="mb-6">
        <div 
          class="prose dark:prose-invert max-w-none"
          v-html="actorSummary"
        />
      </div>

      <!-- PropertyValue Attachments Table -->
      <div v-if="attachments.length > 0" class="mt-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Properties</h2>
        <table class="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
          <tbody>
            <tr v-for="(item, index) in attachments" :key="index" class="border border-gray-300 dark:border-gray-600">
              <td class="px-4 py-2 font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 border-r border-gray-300 dark:border-gray-600">
                {{ item.name }}
              </td>
              <td class="px-4 py-2 text-gray-700 dark:text-gray-300">
                <a 
                  v-if="item.value.startsWith('http')"
                  :href="item.value"
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ item.value }}
                </a>
                <div v-else v-html="item.value"></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Metadata Table -->
      <div v-if="metadata.length > 0" class="mt-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Metadata</h2>
        <table class="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
          <tbody>
            <tr v-for="(item, index) in metadata" :key="index" class="border border-gray-300 dark:border-gray-600">
              <td class="px-4 py-2 font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 border-r border-gray-300 dark:border-gray-600">
                {{ item.name }}
              </td>
              <td class="px-4 py-2 text-gray-700 dark:text-gray-300">
                {{ item.value }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.person-preview {
  padding: 0;
}
</style>
