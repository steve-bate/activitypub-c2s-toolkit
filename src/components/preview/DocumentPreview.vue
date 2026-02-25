<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useObjectActions } from '@/composables/useObjectActions'
import AttachmentPreview from './attachment/AttachmentPreview.vue'
import TagPreview from './TagPreview.vue'
import ObjectActionBar from './ObjectActionBar.vue'

interface Props {
  data: Record<string, unknown>
  showPreview?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showPreview: false
})
const router = useRouter()
const route = useRoute()

function getBaseUri(): string {
  if (typeof route.query.uri === 'string' && route.query.uri) {
    return route.query.uri
  }
  return documentId.value || documentUrl.value || window.location.origin
}

function resolveUri(uri: string): string {
  try {
    return new URL(uri, getBaseUri()).toString()
  } catch {
    return uri
  }
}

function isNavigableUri(uri: string): boolean {
  return uri.startsWith('http') || uri.startsWith('/')
}

function handleInternalUriClick(uri: string) {
  if (!uri || !isNavigableUri(uri)) return
  void router.push({
    name: 'json',
    query: {
      uri: resolveUri(uri)
    }
  })
}

function handleRenderedContentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const anchor = target?.closest('a') as HTMLAnchorElement | null
  const href = anchor?.getAttribute('href') || ''
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) {
    return
  }
  event.preventDefault()
  handleInternalUriClick(href)
}

const documentName = computed(() => {
  return (props.data.name as string) || (props.data.type as string) || 'Document'
})

const documentId = computed(() => {
  return (props.data.id as string) || ''
})

const documentUrl = computed(() => {
  return (props.data.url as string) || ''
})

const content = computed(() => {
  return (props.data.content as string) || ''
})

const summary = computed(() => {
  let text = (props.data.summary as string) || ''
  // Strip leading/trailing p tags
  text = text.replace(/^<p>/, '').replace(/<\/p>$/, '')
  return text
})

const attributedTo = computed(() => {
  const attr = props.data.attributedTo
  if (!attr) return ''
  if (typeof attr === 'string') return attr
  if (typeof attr === 'object' && attr !== null && typeof (attr as Record<string, unknown>).name === 'string') {
    return ((attr as Record<string, unknown>).name as string)
  }
  return ''
})

const publishedDate = computed(() => {
  if (props.data.published) {
    const date = new Date(props.data.published as string)
    return date.toLocaleString()
  }
  return ''
})

const inReplyTo = computed(() => {
  return (props.data.inReplyTo as string) || ''
})

const formatValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    // If it's an object with an id property (collection), use that
    if (typeof obj.id === 'string') {
      return obj.id
    }
    // If it's an object with a url property, use that
    if (typeof obj.url === 'string') {
      return obj.url
    }
    // If it has a totalItems property, show that as a count
    if (typeof obj.totalItems === 'number') {
      return `${obj.totalItems}`
    }
    // Otherwise skip
    return ''
  }
  return String(value)
}

const {
  showObjectActions,
  canSubmitObjectAction,
  isSubmittingLike,
  isSubmittingAnnounce,
  actionError,
  submitObjectAction
} = useObjectActions({
  data: props.data,
  fallbackObjectUri: computed(() => {
    return typeof route.query.uri === 'string' ? route.query.uri : ''
  }),
  showPreview: props.showPreview
})

const metadata = computed(() => {
  const items: Array<{ name: string; value: string }> = []
  
  if (props.data.type) {
    items.push({ name: 'Type', value: String(props.data.type) })
  }
  
  if (publishedDate.value) {
    items.push({ name: 'Published', value: publishedDate.value })
  }
  
  if (attributedTo.value) {
    items.push({ name: 'Author', value: attributedTo.value })
  }
  
  if (inReplyTo.value) {
    items.push({ name: 'In Reply To', value: inReplyTo.value })
  }
  
  if (props.data.sensitive !== undefined) {
    items.push({ name: 'Sensitive', value: String(props.data.sensitive) })
  }
  
  if (props.data.replies !== undefined) {
    const repliesValue = formatValue(props.data.replies)
    if (repliesValue) {
      items.push({ name: 'Replies', value: repliesValue })
    }
  }
  
  if (props.data.likes !== undefined) {
    const likesValue = formatValue(props.data.likes)
    if (likesValue) {
      items.push({ name: 'Likes', value: likesValue })
    }
  }
  
  if (props.data.shares !== undefined) {
    const sharesValue = formatValue(props.data.shares)
    if (sharesValue) {
      items.push({ name: 'Shares', value: sharesValue })
    }
  }
  
  return items
})

const attachments = computed(() => {
  const attachmentValue = props.data.attachment
  if (Array.isArray(attachmentValue)) {
    return attachmentValue.filter(item => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>
  }
  if (typeof attachmentValue === 'object' && attachmentValue !== null) {
    return [attachmentValue as Record<string, unknown>]
  }
  return []
})

const tags = computed(() => {
  const tagValue = props.data.tag
  if (Array.isArray(tagValue)) {
    return tagValue.filter(item => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>
  }
  if (typeof tagValue === 'object' && tagValue !== null) {
    return [tagValue as Record<string, unknown>]
  }
  return []
})
</script>

<template>
  <div class="document-preview bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
    <div class="p-6">
      <!-- Title/Name -->
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {{ documentName }}
      </h1>

      <!-- ID/URI -->
      <p v-if="documentId" class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        <strong>ID:</strong>
        <a
          href="#"
          class="ml-1 text-blue-600 dark:text-blue-400 hover:underline"
          @click.prevent="handleInternalUriClick(documentId)"
        >
          {{ documentId }}
        </a>
      </p>

      <!-- URL (if different from ID) -->
      <p v-if="documentUrl && documentUrl !== documentId" class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        <strong>View:</strong>
        <a
          target="_blank"
          :href="documentUrl"
          class="ml-1 text-blue-600 dark:text-blue-400 hover:underline"
        >
          {{ documentUrl }}
        </a>
      </p>

      <!-- Summary -->
      <div v-if="summary" class="mb-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Summary</h2>
        <div 
          class="prose dark:prose-invert max-w-none font-semibold"
          v-html="summary"
          @click="handleRenderedContentClick"
        />
      </div>

      <!-- Content -->
      <div v-if="content" class="mb-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Content</h2>
        <div class="bg-gray-50 dark:bg-gray-900/40 rounded-md px-4 py-3">
          <div 
            class="prose dark:prose-invert max-w-none"
            v-html="content"
            @click="handleRenderedContentClick"
          />
        </div>
      </div>

      <!-- Metadata Table -->
      <div v-if="metadata.length > 0" class="mt-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Metadata</h2>
        <table class="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
          <tbody>
            <tr v-for="(item, index) in metadata" :key="index" class="border border-gray-300 dark:border-gray-600">
              <td class="px-4 py-2 font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 border-r border-gray-300 dark:border-gray-600 w-1/4">
                {{ item.name }}
              </td>
              <td class="px-4 py-2 text-gray-700 dark:text-gray-300">
                <a
                  v-if="isNavigableUri(item.value)"
                  href="#"
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                  @click.prevent="handleInternalUriClick(item.value)"
                >
                  {{ item.value }}
                </a>
                <div v-else>{{ item.value }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Object Actions -->
      <ObjectActionBar
        v-if="showObjectActions"
        :can-submit-object-action="canSubmitObjectAction"
        :is-submitting-like="isSubmittingLike"
        :is-submitting-announce="isSubmittingAnnounce"
        :action-error="actionError"
        @like="submitObjectAction('Like')"
        @announce="submitObjectAction('Announce')"
      />

      <!-- Attachments -->
      <div v-if="attachments.length > 0" class="mt-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Attachments</h2>
        <AttachmentPreview :attachments="attachments" />
      </div>

      <!-- Tags -->
      <div v-if="tags.length > 0" class="mt-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tags</h2>
        <TagPreview :tags="tags" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.document-preview {
  padding: 0;
}
</style>
