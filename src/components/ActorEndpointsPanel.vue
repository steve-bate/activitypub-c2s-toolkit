<script setup lang="ts">
import { computed } from 'vue'
import type { ResourceServerMetadata } from '@/stores/serverStore'
import DataField from '@/components/DataField.vue'
import DataPanel from '@/components/DataPanel.vue'

const props = defineProps<{
  server: ResourceServerMetadata
}>()

function formatEndpointLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase())
}

const endpointEntries = computed(() => {
  const profile = props.server.actor?.profile
  if (!profile) return [] as Array<{ label: string; value: string }>

  const entries: Array<{ label: string; value: string }> = []
  if (profile.endpoints && typeof profile.endpoints === 'object') {
    for (const [key, value] of Object.entries(profile.endpoints as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        entries.push({
          label: formatEndpointLabel(key),
          value,
        })
      }
    }
  }

  return entries
})

const shouldShow = computed(() =>
  props.server.auth?.authStatus === 'authorized' && endpointEntries.value.length > 0
)
</script>

<template>
  <DataPanel v-if="shouldShow">
    <template #header>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Actor Endpoints</h2>
    </template>

    <div class="space-y-4">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Endpoints discovered from the authorized actor profile.
      </p>
      <div class="space-y-4">
        <DataField
          v-for="endpoint in endpointEntries"
          :key="`${endpoint.label}:${endpoint.value}`"
          :label="endpoint.label"
          :value="endpoint.value"
          :is-link="true"
          :copyable="true"
        />
      </div>
    </div>
  </DataPanel>
</template>