<template>
  <div class="mb-4">
    <label
      :for="selectId"
      class="block text-neutral-700 text-sm font-bold mb-1 dark:text-neutral-300 formkit-label"
    >
      <slot name="label">Schema</slot>
    </label>

    <select
      :id="selectId"
      :value="modelValue"
      class="schema-select w-full sm:w-64 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
      @change="onChange"
    >
      <option
        v-for="schemaOption in options"
        :key="schemaOption.name"
        :value="schemaOption.name"
      >
        {{ schemaOption.name }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  options: {
    type: Array as () => { name: string }[],
    default: () => [],
  },
  selectId: {
    type: String,
    default: 'schema-select',
  },
})

const emit = defineEmits(['update:modelValue'])

function onChange(event: Event) {
  emit('update:modelValue', (event.target as HTMLSelectElement).value)
}
</script>