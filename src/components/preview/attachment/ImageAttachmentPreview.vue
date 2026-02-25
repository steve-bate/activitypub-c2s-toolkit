<script setup lang="ts">
import { computed } from 'vue'
import AttachmentMetadataTable from './AttachmentMetadataTable.vue'

interface Props {
  attachment: Record<string, unknown>
}

const props = defineProps<Props>()

const imageUrl = computed(() => {
  return (props.attachment.url as string) || ''
})

const imageAlt = computed(() => {
  return (props.attachment.name as string) || 'Attachment image'
})

const imageTitle = computed(() => {
  return (props.attachment.name as string) || ''
})
</script>

<template>
  <div class="border border-gray-300 dark:border-gray-600 rounded p-4">
    <div v-if="imageUrl" class="flex flex-wrap gap-6">
      <!-- Image section -->
      <div class="flex flex-col space-y-3">
        <img
          :src="imageUrl"
          :alt="imageAlt"
          :title="imageTitle"
          class="max-w-xs h-auto rounded"
        />
        <div v-if="imageTitle" class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ imageTitle }}
        </div>
      </div>
      <!-- Metadata section -->
      <div class="flex-1 min-w-64">
        <AttachmentMetadataTable :attachment="attachment" />
      </div>
    </div>
    <div v-else class="text-sm text-gray-600 dark:text-gray-400">
      No image URL provided
    </div>
  </div>
</template>
