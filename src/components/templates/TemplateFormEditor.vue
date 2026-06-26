<template>
    <div>
        <DataPanel class="mt-4" contentClass="p-2">
            <div>
                <label for="templateName"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                <input id="templateName" required v-model="resourceTemplateName" type="text"
                    class="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 truncate" />
            </div>

            <div>
                <label for="templateDescription"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea id="templateDescription" v-model="resourceTemplateDescription" rows="2" cols="60"
                    class="px-3 py-2 bg-gray-50 dark:bg-gray-900 text-xs font-mono text-gray-900 dark:text-gray-100 truncate"></textarea>
            </div>
        </DataPanel>        

        <!-- Disclosure panels for Activity, Object and preview -->
        <div class="flex flex-1 md:flex-col gap-2 mt-4">
            <DisclosurePanel label="Activity">
                <div class="flex items-center gap-1">
                    <input type="checkbox" id="object-post" v-model="objectOnly" class="ml-1">
                    <label for="object-post" class="text-sm text-gray-700 dark:text-gray-200">Post object only</label>
                </div>
                <SchemaBasedEditor v-if="!objectOnly" v-model:selectedSchemaName="selectedActivitySchemaName"
                    :schemas="activitySchemas" v-model:formData="activityData" />            
            </DisclosurePanel>

            <DisclosurePanel label="Object">
                <SchemaBasedEditor v-model:selectedSchemaName="selectedObjectSchemaName"
                    :schemas="objectSchemas" :context="{ objectOnly }" v-model:formData="objectData" />
            </DisclosurePanel>

            <!-- <AttachmentsEditor v-if="selectedTab === 'attachments'" class="flex-1" :schemas="ATTACHMENT_SCHEMAS"
                @add="addAttachment" @update="attachmentUpdated" /> -->

            <DisclosurePanel label="ActivityPub Document Review">
                <pre
                    class="flex-1 bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm overflow-auto dark:text-gray-200">
{{ document !== undefined ? JSON.stringify(document, null, 2) : '[Invalid JSON]' }}
        </pre>
            </DisclosurePanel>
            
            <!-- Buttons -->
            <div class="flex flex-row gap-4 mt-4">
                <button class="px-4 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400
        bg-blue-600 text-white hover:bg-blue-600
        disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed"
                    @click="saveTemplate">Save</button>

                <button class="px-4 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400
        bg-blue-600 text-white hover:bg-blue-600
        disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed"
                    @click="applyTemplate">Apply</button>

                <button class="px-4 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400
        bg-gray-600 text-white hover:bg-gray-600
        disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed"
                    @click="emit('cancel')">Templates</button>

                <div class="ml-4">
                    <span v-if="validationResult" :class="validationResult.valid ? 'text-green-600' : 'text-red-600'"
                        class="ml-2 text-lg">
                        {{ validationResult.valid ? 'Valid ✅' : 'Invalid ❌' }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import SchemaBasedEditor from '@/components/templates/SchemaBasedEditor.vue'
import DisclosurePanel from '@/components/DisclosurePanel.vue'
import DataPanel from '@/components/DataPanel.vue'
import { ACTIVITY_SCHEMAS, OBJECT_SCHEMAS } from '@/lib/templates/schemas'
import { EditorGroupNode, EditorSchema, EditorSchemaNode, JsonObject, JsonValue, ResourceTemplate, SplitTransformer, ValueTransformer } from '@/lib/templates/types'
import { validateBySchemaId, ValidationResult } from "@/lib/validation/utils"
import { computed, isReactive, isRef, onMounted, ref, toRaw, unref, watch } from 'vue'
import Handlebars from 'handlebars';
import { useServerStore } from '@/stores/serverStore';

const serverStore = useServerStore()

const props = defineProps<{
    modelValue: ResourceTemplate,
}>()

const resourceTemplateName = computed({
  get: () => props.modelValue.name,
  set: (name: string) => {
    emit('update:modelValue', {
      ...props.modelValue,
      name,
    })
  },
})

const resourceTemplateDescription = computed({
  get: () => props.modelValue.description,
  set: (description: string) => {
    emit('update:modelValue', {
      ...props.modelValue,
      description,
    })
  },
})

const selectedTab = ref('activity')

const resourceTemplateData = computed(() => {
    return props.modelValue.template ? JSON.parse(props.modelValue.template) : {}
})

const objectOnly = ref(resourceTemplateData.value.objectOnly ?? false)

onMounted(() => {
    if (objectOnly.value) {
        selectedTab.value = 'object'
    }
})

watch(objectOnly, () => {
    if (objectOnly.value) {
        selectedTab.value = 'object'
    }
})

const selectedActivitySchemaName = ref(resourceTemplateData.value.activitySchema || ACTIVITY_SCHEMAS[0].name)
const activitySchemas = ref(ACTIVITY_SCHEMAS)

const activityData = ref<JsonObject>(resourceTemplateData.value.activityData ?? {})

const selectedObjectSchemaName = ref(resourceTemplateData.value.objectSchema || OBJECT_SCHEMAS[0].name)
const objectSchemas = ref(OBJECT_SCHEMAS)

const activeActivitySchema = computed(() => {
    const schema = ACTIVITY_SCHEMAS.find((entry) => entry.name === selectedActivitySchemaName.value)
    if (!schema) {
        return undefined
    }
    if (allowsExtraProperties(schema)) {
        if (!hasExtraPropertiesNode(schema)) {
            schema?.nodes.push({
                $formkit: 'textarea',
                name: '_extra',
                label: 'Extra properties',
                rows: 10,
                help: 'Enter any additional properties in JSON object format. These will be merged into the object.',
            })
        }
    }
    return schema
})

const objectData = ref<JsonObject>(resourceTemplateData.value.objectData ?? {})

function allowsExtraProperties(schema: EditorSchema): boolean {
    return schema.extra === undefined || schema.extra
}

function hasExtraPropertiesNode(schema: EditorSchema): boolean {
    return schema.nodes.some(node => node.name === '_extra')
}

const activeObjectSchema = computed(() => {
    const schema = OBJECT_SCHEMAS.find((entry) => entry.name === selectedObjectSchemaName.value)
    // TODO Remove duplication
    if (!schema) {
        return undefined
    }
    if (allowsExtraProperties(schema)) {
        if (!hasExtraPropertiesNode(schema)) {
            schema?.nodes.push({
                $formkit: 'textarea',
                name: '_extra',
                label: 'Extra properties',
                rows: 5,
                help: 'Enter any additional properties in JSON object format. These will be merged into the object.',
            })
        }
    }
    return schema
})

function deepToRaw<T>(input: T): T {
    const value = isRef(input) ? unref(input) : input

    if (value === null || typeof value !== 'object') {
        return value as T
    }

    const raw = isReactive(value) ? toRaw(value) : value

    if (Array.isArray(raw)) {
        return raw.map(item => deepToRaw(item)) as T
    }

    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(raw)) {
        out[key] = deepToRaw(val)
    }
    return out as T
}

function deepClone<T>(value: T): T {
    if (typeof structuredClone === 'function') {
        return structuredClone(deepToRaw(value))
    }
    return JSON.parse(JSON.stringify(value)) as T
}

function isGroupNode(node: EditorSchemaNode): node is EditorGroupNode {
    return '$formkit' in node && node.$formkit === 'group' && typeof node.name === 'string'
}

function getAtPath(obj: JsonObject, path: string[]): JsonValue | undefined {
    let current: JsonValue = obj

    for (const key of path) {
        if (!isJsonObject(current)) return undefined
        current = current[key]
        if (current === undefined) return undefined
    }

    return current
}

function setAtPath(obj: JsonObject, path: string[], value: JsonValue): void {
    if (path.length === 0) return

    let current: JsonObject = obj

    for (const key of path.slice(0, -1)) {
        const existing = current[key]
        if (!isJsonObject(existing)) {
            current[key] = {}
        }
        current = current[key] as JsonObject
    }

    current[path[path.length - 1]] = value
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function applySplit(
    value: JsonValue | undefined,
    instruction: SplitTransformer
): JsonValue | undefined {
    //console.debug('Applying split instruction', { value, instruction })
    if (typeof value !== 'string') return value ?? undefined

    const delimiter = instruction.delimiter ?? 'comma'
    const trim = instruction.trim !== false
    const removeEmpty = instruction.removeEmpty !== false
    const dedupe = instruction.dedupe === true
    const single = instruction.single ?? 'scalar'
    //const empty = instruction.empty ?? 'array'

    let parts: string[]

    switch (delimiter) {
        case 'comma':
            parts = value.split(',')
            break
        case 'newline':
            parts = value.split(/\r?\n/)
            break
        case 'comma-or-newline':
            parts = value.split(/[,\r\n]+/)
            break
        default:
            parts = delimiter instanceof RegExp
                ? value.split(delimiter)
                : value.split(String(delimiter))
            break
    }

    if (trim) {
        parts = parts.map(part => part.trim())
    }

    if (removeEmpty) {
        parts = parts.filter((part): part is string => part.length > 0)
    }

    if (dedupe) {
        parts = [...new Set(parts)]
    }

    if (parts.length === 0) {
        return undefined //empty === 'scalar' ? '' : []
    }

    if (parts.length === 1 && single === 'scalar') {
        return parts[0]
    }

    return parts
}

function applyValueInstructions(value: JsonValue | undefined, instructions: ValueTransformer[]): JsonValue | undefined {
    return instructions.reduce<JsonValue | undefined>((value, instruction) => {
        switch (instruction.type) {
            case 'split':
                return applySplit(value, instruction)
            case 'datetime-utc':
                return value ? new Date(value as string).toISOString() : undefined
            case 'template':
                if (value) {
                    console.debug('Applying template instruction', { current: value, template: instruction.template })
                    return typeof value === 'object' && value !== null
                        ? JSON.parse(Handlebars.compile(instruction.template)({
                            value: value,
                            serverPrefix: "https://server.example"
                        }))
                        : value
                }
                else {
                    return value;
                }
            default:
                return value
        }
    }, value) ?? undefined
}

function walkSchema(nodes: EditorSchemaNode[], rootData: JsonObject, path: string[]): void {
    for (const node of nodes) {
        if (!node || typeof node !== 'object') continue

        if (isGroupNode(node)) {
            const groupPath = [...path, node.name]
            if (Array.isArray(node.children)) {
                walkSchema(node.children, rootData, groupPath)
            }
            continue
        }

        if (node.name && Array.isArray(node.postprocess) && node.postprocess.length > 0) {
            const valuePath = [...path, node.name]
            const currentValue = getAtPath(rootData, valuePath)
            const nextValue = applyValueInstructions(currentValue, node.postprocess)
            setAtPath(rootData, valuePath, nextValue as JsonValue)
        }

        if (Array.isArray(node.children)) {
            walkSchema(node.children, rootData, path)
        }
    }
}

function postProcessFormData<T extends JsonObject>(schema: EditorSchema, data: T): T {
    //console.debug('Post-processing form data with schema', schema, data)
    let processedData = deepClone({ ...data })
    walkSchema(schema.nodes, processedData, [])
    const node = schema.nodes.find(node => node.name === '_extra')
    if (node && data._extra && typeof data._extra === 'string') {
        const extraData = JSON.parse(data._extra)
        if (typeof extraData !== 'object' || extraData === null) {
            throw new Error('Extra data must be a JSON object')
        }
        processedData = { ...processedData, ...extraData }
        delete processedData._extra
    }
    return processedData
}

function withActivityStreamsContext(data: JsonObject): JsonObject {
    return {
        "@context": "https://www.w3.org/ns/activitystreams",
        ...data,
    }
}

const templateObject = computed(() => {
    return {
        activityData: activityData.value,
        activitySchema: activeActivitySchema?.value?.name,
        objectData: objectData.value,
        objectSchema: activeObjectSchema?.value?.name,
        objectOnly: objectOnly.value,
    }
})

watch(templateObject, () => {
    emit('update:modelValue', {
        ...props.modelValue,
        template: JSON.stringify(templateObject.value, null, 2),
    })
}, { deep: true }
)

const validationResult = ref<ValidationResult<JsonObject> | null>(null)

function runValidation() {
    try {
        const parsed = document.value
        const schemaId = 'schema:as2/activitystreams2'
        validationResult.value = validateBySchemaId(schemaId, parsed)
        if (!validationResult.value?.valid) {
            console.debug(
                'Validation errors:',
                validationResult.value?.errors?.map((x) => x.message).join('; ')
            )
        }
    } catch (err: unknown) {
        validationResult.value = {
            valid: false,
            errors: [err instanceof Error ? err : new Error(String(err))]
        }
    }
}

const emit = defineEmits(['save', "apply", "cancel", "update:modelValue"])

//
// Preview
//

function createActivityPubDocument(
    activityData: JsonObject,
    activitySchema: EditorSchema,
    objectData: JsonObject,
    objectSchema: EditorSchema,
    objectOnly: boolean): JsonObject | undefined {
    if (!objectSchema) {
        return undefined
    }

    const actorUri = serverStore.activeServer?.actor?.profile.id

    const processedObjectData = postProcessFormData(objectSchema, objectData)
    if (actorUri && !processedObjectData.attributedTo) {
        processedObjectData.attributedTo = actorUri
    }

    if (objectOnly) {
        return withActivityStreamsContext(processedObjectData)
    } else {
        if (!activeActivitySchema.value) {
            return undefined
        }
        const processedActivityData = postProcessFormData(activitySchema, activityData)
        if (actorUri && !processedActivityData.actor) {
            processedActivityData.actor = actorUri
        }
        processedActivityData.object = processedObjectData
        return withActivityStreamsContext(processedActivityData)
    }
}

const document = computed(() => {
    return createActivityPubDocument(
        activityData.value,
        activeActivitySchema.value as EditorSchema,
        objectData.value,
        activeObjectSchema.value as EditorSchema,
        objectOnly.value
    )
})


watch(document, () => {
    runValidation()
}, { deep: true })

function applyTemplate() {
    console.log("Applying template:", props.modelValue)
    emit('apply', props.modelValue)
}

function saveTemplate() {
    console.log("Saving template:", props.modelValue)
    emit('save', props.modelValue)
}
</script>


<style></style>