<script setup lang="ts">
import { useServerStore, type ResourceServerMetadata } from '@/stores/serverStore'
import DataPanel from '@/components/DataPanel.vue'

const props = defineProps<{
  server: ResourceServerMetadata
}>()

function saveNotes() {
  if (props.server) {
    const serverStore = useServerStore()
    serverStore.saveServerNotes(props.server.id, props.server.notes ?? '')
  }
}
</script>

<template>
  <DataPanel>
    <template #header>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Server Notes</h2>
    </template>

    <div class="space-y-4">
      <textarea id="templateDescription" v-model="server.notes" rows="5" cols="60"
                    class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 text-xs font-mono 
                    text-gray-900 dark:text-gray-100 truncate"
                    placeholder="Enter notes here..."
                    @blur="saveNotes"
                    title="Enter notes for the server to be included in reports"></textarea>

      <!-- <div class="space-y-4">
        <DataField
          v-for="endpoint in endpointEntries"
          :key="`${endpoint.label}:${endpoint.value}`"
          :label="endpoint.label"
          :value="endpoint.value"
          :is-link="true"
          :copyable="true"
        />
      </div> -->
    </div>
  </DataPanel>
</template>