<script setup>
import { ref } from 'vue'
import { truncateString } from '@/utils'

const props = defineProps({
    items: {
        type: Array,
        required: true
    },
})

const editorType = ref('form') // Default editor type

const emit = defineEmits(['add', 'edit', 'duplicate', 'delete', "post"])

function addRow() {
    emit('add', editorType.value)
}

const css = {
    table: 'min-w-full divide-y divide-gray-200 dark:divide-gray-700',
    thead: 'bg-gray-50 dark:bg-gray-800/50',
    th: 'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
    tr: 'hover:bg-gray-50 dark:hover:bg-gray-700/50',
    td: 'px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300',
}

</script>

<template>
    <div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <table :class="css.table">
                <thead :class="css.thead">
                    <tr>
                        <th :class="css.th">Name</th>
                        <th :class="css.th">Description</th>
                        <th :class="css.th">Editor</th>
                        <th :class="css.th">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in props.items" :key="item.id" :class="css.tr">
                        <td :class="css.td">{{ item.name }}</td>
                        <td :class="css.td">{{ item.description ? truncateString(item.description.toString(), 40) : '' }}</td>
                        <td :class="css.td">{{ item.editorType }}</td>
                        <td :class="css.td + ' flex justify-center gap-4'">      
                            <button
                                type="button"
                                class="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 transition-colors"
                                aria-label="Edit"
                                title="Edit"
                                @click="emit('edit', item)"
                            >
                                <i class="pi pi-pencil"></i>
                            </button>

                            <button
                                type="button"
                                class="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
                                aria-label="Duplicate"
                                title="Duplicate"
                                @click="emit('duplicate', item)"
                            >
                                <i class="pi pi-copy"></i>
                            </button>

                            <button
                                type="button"
                                class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                                aria-label="Delete"
                                title="Delete"
                                @click="emit('delete', item)"
                            >
                                <i class="pi pi-trash"></i>
                            </button>

                            <button
                                type="button"
                                class="text-green-600"
                                aria-label="Post"
                                title="Post to Outbox"
                                @click="emit('post', item)"
                            >
                                <i class="pi pi-send"></i>
                            </button>
                        </td>
                    </tr>            
                </tbody>
            </table>
        </div>

        <!-- Add button and editor type selector -->
        <div class="flex items-center gap-2 mt-4">
            <button
                type="button"
                @click="addRow"
                class="px-4 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-600 
                    text-white hover:bg-blue-600 inline-flex items-center"
            >
                <i class="pi pi-plus mr-2" aria-hidden="true"></i>
                <span>Add</span>
            </button>

            <label for="editorType" class="block text-gray-200 pt-2">Editor Type:</label>
            <select id="editorType" class="px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-800 text-white" v-model="editorType">
                <option value="form">Form</option>
                <option value="json">JSON</option>
            </select>
        </div>
 
    </div>
</template>