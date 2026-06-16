<template>
    <div class="max-w-7xl mx-auto px-4 py-6">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Resource Templates</h2>

      <div class="mt-4">
        <TemplateTable
        :items="[...resourceTemplateStore.items]"
        @add="addTemplate"
        @edit="editTemplate"
        @duplicate="duplicateTemplate"
        @delete="deleteTemplate"
        @post="postTemplate">
        </TemplateTable>
      </div>    
    </div>

</template>
    
<script setup lang='ts'>
import TemplateTable from '@/components/templates/TemplateTable.vue'
import { useResourceTemplatesStore } from '@/stores/templateStore'
import { ResourceTemplate } from '@/lib/templates/types'
import router from '@/router'

const resourceTemplateStore = useResourceTemplatesStore()


//
// Table event handlers
//

function addTemplate(selectedEditorType: "form" | "json") {
    router.push({
      name: 'resourceTemplateNew',
      query: { editorType: selectedEditorType },
    })
}

function editTemplate(row: any) {
  router.push({
    name: 'resourceTemplateEdit',
    params: { id: String(row.id) },
  })
}

function duplicateTemplate(row: any) {
  console.log('Duplicating resource template:', row)
  let newName = row.name
  const match = newName.match(/\((\d+)\)$/)
  if (match) {
    const num = parseInt(match[1], 10) + 1
    newName = newName.replace(/\(\d+\)$/, `(${num})`)
  } else {
    newName = `${newName} (1)`
  }
  const newTemplate = { ...row, id: Date.now().toString(), name: newName }
  resourceTemplateStore.add(newTemplate)
}

function deleteTemplate(row: any) {
  console.log('Deleting resource template:', row)
  resourceTemplateStore.remove(row.id)
}

function postTemplate(resourceTemplate: ResourceTemplate) {
  console.log("POST", resourceTemplate.document)
  // Implement the logic to post the resource template to a server or API
  // For now, just log it to the console
}
</script>
    
<style>
    
</style>