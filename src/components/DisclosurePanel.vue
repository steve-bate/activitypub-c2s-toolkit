<script setup lang="ts">
import DisclosureIcon from '@/components/icons/DisclosureIcon.vue'
import { ref } from 'vue'

interface Props {
  label: string
  initiallyOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  initiallyOpen: false
})

const isOpen = ref(props.initiallyOpen)
</script>

<template>
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <button
      type="button"
      class="w-full px-4 py-3 flex items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-gray-50 dark:bg-gray-800"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <div class="flex items-center gap-2">
        <DisclosureIcon class="w-4 h-4 transition-transform" :class="{ 'rotate-90': isOpen }" />
        <span class="font-medium text-gray-900 dark:text-white">{{ label }}</span>
        <slot name="label-extra" />
      </div>
    </button>
    <div v-if="isOpen" class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 space-y-4">
      <slot />
    </div>
  </div>
</template>
