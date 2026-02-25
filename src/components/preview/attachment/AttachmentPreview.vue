<script setup lang="ts">
import { computed } from 'vue'
import ObjectAttachmentPreview from './ObjectAttachmentPreview.vue'
import ImageAttachmentPreview from './ImageAttachmentPreview.vue'

interface Props {
  attachments: Array<Record<string, unknown>>
}

const props = defineProps<Props>()

const normalizedAttachments = computed(() => {
  return props.attachments.filter(item => typeof item === 'object' && item !== null)
})

function getAttachmentComponent(attachment: Record<string, unknown>) {
  const mediaType = String(attachment.mediaType || '').toLowerCase()
  
  if (mediaType.startsWith('image/')) {
    return ImageAttachmentPreview
  }
  
  return ObjectAttachmentPreview
}
</script>

<template>
  <div class="space-y-4">
    <component
      v-for="(attachment, index) in normalizedAttachments"
      :key="String(attachment.id || attachment.url || index)"
      :is="getAttachmentComponent(attachment)"
      :attachment="attachment"
    />
  </div>
</template>
