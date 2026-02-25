import { ref } from "vue"

export function useClipboard() {
  const clipboardCopyState = ref<'idle' | 'copied' | 'error'>('idle')

  const clipboardCopy = async (text: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      clipboardCopyState.value = 'copied'
    } catch (error) {
      console.error('Clipboard error:', error)
      clipboardCopyState.value = 'error'
    }
    setTimeout(() => { clipboardCopyState.value = 'idle' }, 1200)
  }

  return { clipboardCopyState, clipboardCopy }
}