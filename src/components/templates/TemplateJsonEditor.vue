<template>
    <div>
        <DataPanel class="mt-4" contentClass="p-2">
            <div>
                <label for="templateName"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                <input id="templateName" required v-model="resourceTemplate.name" type="text"
                    class="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 truncate" />
            </div>

            <div>
                <label for="templateDescription"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea id="templateDescription" v-model="resourceTemplate.description" rows="2" cols="60"
                    class="px-3 py-2 bg-gray-50 dark:bg-gray-900 text-xs font-mono text-gray-900 dark:text-gray-100 truncate"></textarea>
            </div>

            <div>
                <label for="text-editor"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resource
                    Template</label>
                <div class="bg-gray-50 dark:bg-gray-900 p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
                    <!-- equivalent to formkit inner -->

                    <textarea id="text-editor" rows="15"
                        class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 font-mono text-sm text-gray-900 dark:text-gray-100 truncate focus:outline-none"
                        v-model="props.resourceTemplate.template"></textarea>
                </div>
            </div>
        </DataPanel>

        <DisclosurePanel label="ActivityPub Document" class="mt-2">
            <pre id="preview"
                class="flex-1 bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm overflow-auto dark:text-gray-200">
{{ document !== undefined ? JSON.stringify(document, null, 2) : '[Invalid JSON]' }}
        </pre>
        </DisclosurePanel>

        <!-- Buttons -->
        <div class="flex flex-row gap-4 mt-4">
            <button class="px-4 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400
        bg-blue-600 text-white hover:bg-blue-600
        disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed"
                @click="emit('save', saveTemplate)">Save</button>

            <button class="px-4 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400
        bg-blue-600 text-white hover:bg-blue-600
        disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed"
                @click="emit('apply', applyTemplate)">Apply</button>

            <button class="px-4 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400
        bg-gray-600 text-white hover:bg-gray-600
        disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed"
                @click="emit('cancel')">Cancel</button>

            <div class="ml-2">
                <span v-if="validationResult" :class="validationResult.valid ? 'text-green-600' : 'text-red-600'"
                    class="ml-2 text-lg">
                    {{ validationResult.valid ? 'Valid ✅' : 'Invalid ❌' }}
                </span>
            </div>

        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref, toRaw, watch } from 'vue';
import { ResourceTemplate, ValidationResult } from '@/lib/templates/types';
import { validateBySchemaId } from '@/lib/validation/utils';
import { useServerStore } from '@/stores/serverStore';
import Handlebars from 'handlebars';
import DisclosurePanel from '@/components/DisclosurePanel.vue'
import DataPanel from '@/components/DataPanel.vue'

const serverStore = useServerStore()

const props = defineProps<{
    resourceTemplate: ResourceTemplate
}>()

const emit = defineEmits(['save', 'apply', 'cancel'])

Handlebars.registerHelper('uuid', function () {
    return crypto.randomUUID();
});

async function fetchRandomPost() {
    const listRes = await fetch('https://dummyjson.com/posts?limit=1');
    if (!listRes.ok) throw new Error('Failed to fetch post count');

    const listData = await listRes.json();
    const total = listData.total;

    const randomId = Math.floor(Math.random() * total) + 1;

    const postRes = await fetch(`https://dummyjson.com/posts/${randomId}`);
    if (!postRes.ok) throw new Error(`Failed to fetch post ${randomId}`);

    return await postRes.json();
}

Handlebars.registerHelper("baseurl", function (url) {
    return new URL(url, serverStore.activeServer?.actor?.profile.id).origin;
})

const templateContext = ref<Record<string, any>>({
    actor: serverStore.activeServer?.actor?.profile,
    "timestamp": new Date().toISOString(),
});

watch(() => props.resourceTemplate.template, async (templateText) => {
    if (templateText.includes("randomPost") && !templateContext.value.randomPost) {
        console.log("Fetching random post for template context...");
        templateContext.value.randomPost = await fetchRandomPost();
        console.log("Random post fetched:", templateContext.value.randomPost);
    }
}, { immediate: true });


function createActivityPubDocument()
{
    try {
        let templateText = toRaw(props.resourceTemplate.template);
        templateText = Handlebars.compile(templateText)(templateContext.value)
        return JSON.parse(templateText);
    } catch (error) {
        console.error("Error parsing JSON:", error);
        return undefined;
    }
}

const document = computed(createActivityPubDocument);

const validationResult = ref<ValidationResult | null>(null)

function runValidation() {
    try {
        const parsed = document.value
        const schemaId = 'schema:as2/activitystreams2'
        validationResult.value = validateBySchemaId(schemaId, parsed)
        if (!validationResult.value.valid) {
            console.debug(
                'Validation errors:',
                validationResult.value.errors?.map((x: any) => x.message).join('; ')
            )
        }
    } catch (err: any) {
        validationResult.value = {
            valid: false,
            errors: [{ message: err.message }]
        }
        console.log('Validation error', validationResult.value.errors[0]?.message)
    }
}

watch(document, () => {
    runValidation()
}, { deep: true })

function applyTemplate() {
    props.resourceTemplate.document = document.value
    console.log("Applying template:", props.resourceTemplate)
    emit('apply', props.resourceTemplate)
}

function saveTemplate() {
    props.resourceTemplate.document = document.value
    console.log("Saving template:", props.resourceTemplate)
    emit('save', props.resourceTemplate)
}

</script>

<style></style>