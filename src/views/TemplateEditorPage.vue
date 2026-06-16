<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Resource Template Editor</h2>

    <!-- <DataPanel class="mt-4" contentClass="p-2">
      <div>
        <label for="templateName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
        <input id="templateName" required v-model="resourceTemplate.name" type="text"
          class="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 truncate" />
      </div>

      <div>
        <label for="templateDescription" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
        <textarea id="templateDescription" v-model="resourceTemplate.description" rows="2" cols="60"
          class="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 truncate"></textarea>
      </div>
    </DataPanel> -->

    <TemplateFormEditor v-if="resourceTemplate.editorType === 'form'" 
      :resourceTemplate="resourceTemplate"
      @save="saveTemplate"
      @apply="applyTemplate"
      @cancel="cancelEdit" 
    />

    <TemplateJsonEditor v-else-if="resourceTemplate.editorType === 'json'"
      :resourceTemplate="resourceTemplate"
      @save="saveTemplate"
      @apply="applyTemplate"
      @cancel="cancelEdit" 
    />
  </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, watch, toRaw, computed } from 'vue';
import { useRoute } from 'vue-router'
import DataPanel from '@/components/DataPanel.vue'
import TemplateJsonEditor from '@/components/templates/TemplateJsonEditor.vue'
import TemplateFormEditor from '@/components/templates/TemplateFormEditor.vue'
import { ResourceTemplate } from '@/lib/templates/types';
import { useResourceTemplatesStore } from '@/stores/templateStore'
import router from '@/router';

const route = useRoute()
const templateStore = useResourceTemplatesStore()

const resourceTemplate = ref<ResourceTemplate>({} as ResourceTemplate)

const editorType = computed<"form" | "json">(() => {
  return route.query.editorType === 'json' ? 'json' : 'form'
})

async function loadTemplate(id: string) {
  console.log("Loading resource template with ID:", id)
  resourceTemplate.value = await templateStore.getById(id) as ResourceTemplate
}

onMounted(() => {
  if (route.params.id) {
  console.log("MOUNT: Loading resource template with ID:", route.params.id)
    loadTemplate(String(route.params.id))
  }
  else {
    console.log("MOUNT: Creating new resource template with editor type:", editorType.value)
    resourceTemplate.value = {
      editorType: editorType.value,
      template: '{}'
    } as ResourceTemplate
  }
})

watch(
  [() => route.params.id, () => route.query.editorType],
  ([id, editorType]) => {
    if (id) {
      console.log("WATCH: Loading resource template with ID:", id)
      loadTemplate(String(id))
    }
    else {
      console.log("WATCH: Creating new resource template with editor type:", editorType)
      resourceTemplate.value = {
        editorType: editorType,
        template: '{}'
      } as ResourceTemplate
    }
  }
)


function _persistTemplate(template: ResourceTemplate) {
  console.log('Applying template from editor:', template)
  const rawTemplate = toRaw(template)
  if (!rawTemplate.id) {
    rawTemplate.id = Date.now().toString() // Assign a new ID if it doesn't exist
    console.log('Adding new template to store:', rawTemplate)
    templateStore.add(rawTemplate)
  }
  else {
    console.log('Updating existing template in store:', rawTemplate)
    templateStore.update(rawTemplate.id, rawTemplate)
  }
}

function saveTemplate() {
  _persistTemplate(resourceTemplate.value)
  router.push({ name: 'post-resource' })
}

function applyTemplate() {
  _persistTemplate(resourceTemplate.value)
}

function cancelEdit() {
  router.push({ name: 'post-resource' })
}
</script>

<style></style>