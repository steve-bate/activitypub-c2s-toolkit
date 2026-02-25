<script setup lang="ts">
import AttachmentMetadataTable from './AttachmentMetadataTable.vue'

interface Props {
  attachment: Record<string, unknown>
}

defineProps<Props>()
</script>

<template>
  <div class="border border-gray-300 dark:border-gray-600 rounded p-4">
    <AttachmentMetadataTable :attachment="attachment" />
  </div>
</template>
