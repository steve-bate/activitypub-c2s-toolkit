<script setup lang="ts">
import CopyIcon from '@/components/icons/CopyIcon.vue'
import { useClipboard } from '@/composables/useClipboard'

interface Props {
  label: string
  value?: string | null
  placeholder?: string
  isLink?: boolean
  copyable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  value: null,
  placeholder: 'Not provided',
  isLink: false,
  copyable: false,
})

const { clipboardCopy, clipboardCopyState } = useClipboard()

function handleCopy() {
  if (!props.value) return
  void clipboardCopy(props.value)
}
</script>

<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {{ label }}
    </label>
    <div class="flex items-center gap-2">
      <div class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-900 dark:text-gray-100">
        <a
          v-if="isLink && value"
          :href="value"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:underline"
        >
          {{ value }}
        </a>
        <span v-else :class="value ? '' : 'text-gray-500 dark:text-gray-400'">
          {{ value || placeholder }}
        </span>
      </div>
      <button
        v-if="copyable && value"
        @click="handleCopy"
        class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        :class="clipboardCopyState === 'copied' ? 'text-green-600 dark:text-green-400' : ''"
        :title="clipboardCopyState === 'copied' ? 'Copied' : 'Copy to clipboard'"
      >
        <CopyIcon class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>