<template>
    <div>
        <div class="flex flex-row gap-2">
            <button
                class="my-2 px-4 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-600 text-white hover:bg-blue-600"
                @click="$emit('add', attachmentData)">
                Add
            </button>
            <button
                class="my-2 px-4 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-600 text-white hover:bg-blue-600"
                @click="resetForm">
                Reset
            </button>
        </div>
        <SchemaSelector v-model="selectedSchemaName" :options="schemas" :select-id="'attachment-schema-select'" />
        <hr class="my-2 border-dashed border-gray-600" />
        <!-- <Debug>Schema: {{ selectedSchema ?? 'No schema selected' }}</Debug> -->
        <FormKit id="attachment-form" :key="selectedSchema?.name ?? 'noschema'" type="form" :actions="false"
            v-model="attachmentData">
            <FormKitSchema :schema="(selectedSchema?.nodes as EditorSchemaNode[]) ?? []" />
        </FormKit>

        <input type="checkbox" id="preview" v-model="showPreview" class="mr-2" />
        <label for="preview" class="text-sm text-gray-600 dark:text-gray-400">Preview attachment data</label>
        
        <pre v-if="showPreview" class="flex-1 mt-4 bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm overflow-auto dark:text-gray-200">
{{ attachmentData }}
        </pre>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import SchemaSelector from "./SchemaSelector.vue";
import type { EditorSchema, EditorSchemaNode } from "@/lib/templates/types.ts";

const emit = defineEmits<{
    (e: "add", payload: Record<string, unknown>): void;
    (e: "update", payload: Record<string, unknown>): void;
}>();

const props = defineProps<{
    preview?: boolean;
    schemas: EditorSchema[];
}>();

const showPreview = ref(false)
const selectedSchemaName = ref(props.schemas[0]?.name ?? "");

const selectedSchema = computed(() => {
    return props.schemas.find(
        (schema) => schema.name === selectedSchemaName.value,
    );
});

const attachmentData = ref({});

watch(attachmentData, (newVal: Record<string, unknown>) => {
    emit("update", newVal);
});

function extractSchemaDefaults(schema: EditorSchema): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}

  function visit(node: EditorSchemaNode) {
    if (typeof node.name === 'string' && 'value' in node) {
      defaults[node.name] = node.value
    }

    if (Array.isArray(node.children)) {
      node.children.forEach(visit)
    }
  }

  schema.nodes.forEach(visit)
  return defaults
}

watch(selectedSchema, (newSchema) => {
    if (newSchema) {
        attachmentData.value = extractSchemaDefaults(newSchema);
    }
});

function resetForm() {
    if (selectedSchema.value) {
        attachmentData.value = extractSchemaDefaults(selectedSchema.value);
    }
}

</script>

<style></style>
