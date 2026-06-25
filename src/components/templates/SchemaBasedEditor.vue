<template>
  <div class="flex-1">
    <SchemaSelector
      v-model="selectedSchemaModel"
      :options="schemas"
      :select-id="selectId"
    />

    <hr class="my-2 border-dashed border-gray-600">

    <FormKit
      :key="'activity-' + schema.name"
      type="form"
      :actions="false"
      :model-value="formData"
      @update:model-value="emit('update:formData', $event)"
      @submit="emit('submit', $event)"
    >
    
    <FormKitSchema :schema="schema.nodes" :data="context" />
    </FormKit>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SchemaSelector from './SchemaSelector.vue'
import type { EditorSchema } from "@/lib/templates/types.ts";

const props = defineProps({
  selectedSchemaName: {
    type: String,
    default: '',
  },
  schemas: {
    type: Array as () => EditorSchema[],
    default: () => [],
  },

  formData: {
    type: Object,
    default: () => ({}),
  },
  context: {
    type: Object,
    default: () => ({}),
  },
  selectId: {
    type: String,
    default: 'schema-select',
  },
})

const emit = defineEmits([
  'update:selectedSchemaName',
  'update:formData',
  'submit',
])

const selectedSchemaModel = computed({
  get: () => props.selectedSchemaName,
  set: (value) => emit('update:selectedSchemaName', value),
})

const schema = computed(() => {
  const s = props.schemas.find(
    (s) => s.name === props.selectedSchemaName,
  )
  if (!s) {
    throw new Error(`Unknown schema: ${props.selectedSchemaName}`)
  }
  return s
})
</script>