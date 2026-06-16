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

<script setup>
import { computed } from 'vue'
import SchemaSelector from './SchemaSelector.vue'

const props = defineProps({
  selectedSchemaName: {
    type: String,
    default: '',
  },
  schemas: {
    type: Array,
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
  return props.schemas.find(
    (schema) => schema.name === props.selectedSchemaName,
  )
})
</script>