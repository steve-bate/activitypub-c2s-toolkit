<script setup lang="ts">
interface Props {
  canSubmitObjectAction: boolean
  isSubmittingLike: boolean
  isSubmittingAnnounce: boolean
  actionError: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  like: []
  announce: []
}>()
</script>

<template>
  <div class="mt-6">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h2>
    <div class="flex items-center gap-3">
      <button
        class="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        :disabled="!canSubmitObjectAction || isSubmittingLike || isSubmittingAnnounce"
        @click="emit('like')"
      >
        {{ isSubmittingLike ? 'Liking...' : 'Like' }}
      </button>
      <button
        class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:disabled:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
        :disabled="!canSubmitObjectAction || isSubmittingLike || isSubmittingAnnounce"
        @click="emit('announce')"
      >
        {{ isSubmittingAnnounce ? 'Announcing...' : 'Announce' }}
      </button>
    </div>
    <p v-if="actionError" class="mt-3 text-sm text-red-600 dark:text-red-400">{{ actionError }}</p>
  </div>
</template>
