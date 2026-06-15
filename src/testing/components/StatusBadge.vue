<script setup lang="ts">
import { computed } from 'vue'
import { TestStatus } from '../core'

interface Props {
  status: TestStatus
  count?: number
}

function statusClass(status: TestStatus): string {
  if (status === 'pass') return 'bg-emerald-100 text-emerald-800 border-emerald-300'
  if (status === 'fail') return 'bg-rose-100 text-rose-800 border-rose-300'
  if (status === 'error') return 'bg-red-100 text-red-800 border-red-300'
  if (status === 'skip') return 'bg-slate-100 text-slate-700 border-slate-300'
  return 'bg-amber-100 text-amber-800 border-amber-300'
}

const props = defineProps<Props>()

const displayName = computed(() =>
  props.count !== undefined ? `${props.status}: ${props.count}` : props.status
)
</script>

<template>
  <span class="text-xs px-2 py-1 rounded border":class="statusClass(props.status)">
    {{ displayName }}
  </span>
</template>