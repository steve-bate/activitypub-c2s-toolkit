<script setup lang="ts">
import CopyIcon from '@/components/icons/CopyIcon.vue'
import { ref } from 'vue'

interface Props {
  text: string
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  disabled: false
})

const copyState = ref<'idle' | 'copied' | 'error'>('idle')

const copy = async (text: string) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copyState.value = 'copied'
  } catch {
    copyState.value = 'error'
  }
  window.setTimeout(() => {
    copyState.value = 'idle'
  }, 1200)
}
</script>

<template>
  <button
    type="button"
    class="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
    :disabled="disabled"
    @click="copy(text)"
  >
    <CopyIcon class="w-3.5 h-3.5" />
    {{ copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy JSON' }}
  </button>
</template>
