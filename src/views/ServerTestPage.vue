<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import DisclosurePanel from '@/components/DisclosurePanel.vue'
import HttpExchangePanel from '@/components/http/HttpExchangePanel.vue'
import { useServerStore } from '@/stores/serverStore'
import { testSuites } from '@/testing/suites'
import { rerunSingleTest, runTestSuite } from '@/testing/core/runner'
import { buildDependencyPlan } from '@/testing/core/dependencyGraph'
import {
  appendTestSuiteRun,
  clearTestSuiteRunHistory,
  exportRunResultAsJson,
  loadTestSuitePreferences,
  saveTestSuitePreferences
} from '@/testing/core/storage'
import type { TestSuiteRunResult, TestCaseDefinition, TestStatus } from '@/testing/core/types'
import type { ActorProfile } from '@/services/actorDiscoveryService'

const serverStore = useServerStore()

const selectedSuiteId = ref<string>(testSuites[0]?.id ?? '')
const selectedTestIds = ref<string[]>([])
const sidecarUrl = ref('')

const isRunning = ref(false)
const rerunningTestId = ref<string | null>(null)
const runError = ref<string>('')
const liveResults = ref<TestSuiteRunResult['results']>([])
const runHistory = ref<TestSuiteRunResult[]>([])
const selectedRunId = ref<string>('')
const rerunOverrides = ref<Record<string, TestSuiteRunResult['results'][number]>>({})

const selectedSuite = computed(() => testSuites.find((suite) => suite.id === selectedSuiteId.value) ?? null)

function resolveActorProfile(actorValue: unknown): ActorProfile | undefined {
  if (!actorValue || typeof actorValue !== 'object') {
    return undefined
  }

  const actorRecord = actorValue as Record<string, unknown>
  const profileValue = actorRecord.profile

  if (profileValue && typeof profileValue === 'object') {
    return profileValue as ActorProfile
  }

  return actorRecord as unknown as ActorProfile
}

const authenticatedActor = computed(() => resolveActorProfile((serverStore.activeServer as { actor?: unknown } | null)?.actor))
const authenticatedActorUri = computed(() => authenticatedActor.value?.id || authenticatedActor.value?.uri || '')
const hasAuthenticatedActor = computed(() => Boolean(authenticatedActorUri.value))

function getCurrentBearerToken(): string | undefined {
  return serverStore.activeServer?.auth?.bearerToken?.trim() || undefined
}

const authenticatedActorOrigin = computed(() => {
  const actorUri = authenticatedActor.value?.id
  if (!actorUri) {
    return ''
  }

  try {
    return new URL(actorUri).origin
  } catch {
    return ''
  }
})

function normalizePreferredUsername(raw: string | undefined): string {
  if (!raw?.trim()) {
    return ''
  }

  const value = raw.trim().replace(/^acct:/i, '').replace(/^@/, '')
  const localPart = value.split('@')[0]
  return localPart || ''
}

function normalizeResourceServerOrigin(raw: string | undefined): string {
  if (!raw?.trim()) {
    return ''
  }

  const value = raw.trim()

  try {
    return new URL(value).host
  } catch {
    return value.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
  }
}

const autoDerivedHandle = computed(() => {
  const actor = authenticatedActor.value
  const preferredUsername = normalizePreferredUsername(actor?.preferredUsername)
  const resourceServerOrigin = normalizeResourceServerOrigin(authenticatedActorOrigin.value)
  if (preferredUsername && resourceServerOrigin) {
    return `${preferredUsername}@${resourceServerOrigin}`
  }
  return ''
})

const selectedRun = computed(() => {
  if (!selectedRunId.value) {
    return runHistory.value[0]
  }
  return runHistory.value.find((run) => run.runId === selectedRunId.value) ?? runHistory.value[0]
})

const executionOrderPreview = computed(() => {
  if (!selectedSuite.value) {
    return {
      order: [] as string[],
      error: 'No suite selected'
    }
  }

  try {
    const plan = buildDependencyPlan(selectedSuite.value.tests, selectedTestIds.value)
    return {
      order: plan.order.map((test) => test.id),
      error: ''
    }
  } catch (error) {
    return {
      order: [] as string[],
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

const executionOrderRenderKey = computed(() => {
  const suiteId = selectedSuiteId.value || 'none'
  const selectedIds = [...selectedTestIds.value].sort().join('|')
  return `${suiteId}:${selectedIds}`
})

const runHistoryRenderKey = computed(() => {
  const serverId = serverStore.activeServerId || 'none'
  const currentRunId = selectedRunId.value || 'none'
  const firstRunId = runHistory.value[0]?.runId || 'none'
  return `${serverId}:${currentRunId}:${firstRunId}`
})

const selectedSuiteTestMap = computed(() => {
  const map = new Map<string, TestCaseDefinition>()
  for (const test of selectedSuite.value?.tests ?? []) {
    map.set(test.id, test)
  }
  return map
})

const forcedDependencyIds = computed(() => {
  const forced = new Set<string>()
  const map = selectedSuiteTestMap.value

  function includeDependencies(testId: string): void {
    const test = map.get(testId)
    if (!test) {
      return
    }

    for (const dependencyId of test.dependsOn ?? []) {
      if (!forced.has(dependencyId)) {
        forced.add(dependencyId)
        includeDependencies(dependencyId)
      }
    }
  }

  for (const selectedId of selectedTestIds.value) {
    includeDependencies(selectedId)
  }

  return forced
})

function isForcedDependency(testId: string): boolean {
  return forcedDependencyIds.value.has(testId)
}

const displayedResults = computed(() => {
  const base = isRunning.value ? liveResults.value : (selectedRun.value?.results ?? [])
  const withOverrides =
    Object.keys(rerunOverrides.value).length === 0
      ? base
      : base.map((r) => rerunOverrides.value[r.id] ?? r)

  // Only augment when there is an active or completed run to display
  if (!selectedSuite.value || (!isRunning.value && !selectedRun.value)) {
    return withOverrides
  }

  const resultsById = new Map(withOverrides.map((r) => [r.id, r]))
  return selectedSuite.value.tests.map(
    (test): TestSuiteRunResult['results'][number] =>
      resultsById.get(test.id) ?? {
        id: test.id,
        name: test.name,
        status: 'skip' as TestStatus,
        reason: 'Not selected',
        startedAt: '',
        finishedAt: '',
        durationMs: 0,
        dependsOn: test.dependsOn ?? [],
        assertions: [],
      },
  )
})

const displayedContext = computed(() => {
  if (isRunning.value) {
    return {}
  }
  return selectedRun.value?.context ?? {}
})

function syncRunHistoryForActiveServer(): void {
  const activeServerId = serverStore.activeServer?.id

  // Reset ephemeral run state before applying the active server snapshot.
  rerunOverrides.value = {}
  liveResults.value = []
  isRunning.value = false

  if (!activeServerId) {
    runHistory.value = []
    selectedRunId.value = ''
    return
  }

  const savedRun = serverStore.getTestResults(activeServerId)
  if (!savedRun) {
    runHistory.value = []
    selectedRunId.value = ''
    return
  }

  runHistory.value = [savedRun]
  selectedRunId.value = savedRun.runId
}

function canRerun(testId: string): boolean {
  if (isRunning.value || rerunningTestId.value !== null) return false
  if (!selectedRun.value) return false
  const test = selectedSuite.value?.tests.find((t) => t.id === testId)
  if (!test) return false
  return (test.dependsOn ?? []).every(
    (depId) => (rerunOverrides.value[depId] ?? displayedResults.value.find((r) => r.id === depId))?.status === 'pass'
  )
}

async function rerunTest(testId: string): Promise<void> {
  if (!selectedSuite.value || !selectedRun.value) return
  rerunningTestId.value = testId
  try {
    const newResult = await rerunSingleTest(
      testId,
      selectedSuite.value.tests,
      {
        timeoutMs: 15000,
        sidecarUrl: sidecarUrl.value.trim() || undefined,
        bearerTokenResolver: getCurrentBearerToken,
        runParameters: {
          handle: autoDerivedHandle.value,
          sidecarUrl: sidecarUrl.value.trim() || undefined,
          serverOrigin: serverStore.activeServer?.origin,
          authenticatedActorUri: authenticatedActorUri.value
        }
      },
      displayedResults.value,
      selectedRun.value.context
    )
    rerunOverrides.value = { ...rerunOverrides.value, [testId]: newResult }
  } finally {
    rerunningTestId.value = null
  }
}

function statusClass(status: TestStatus): string {
  if (status === 'pass') return 'bg-emerald-100 text-emerald-800 border-emerald-300'
  if (status === 'fail') return 'bg-rose-100 text-rose-800 border-rose-300'
  if (status === 'error') return 'bg-red-100 text-red-800 border-red-300'
  if (status === 'skip') return 'bg-slate-100 text-slate-700 border-slate-300'
  return 'bg-amber-100 text-amber-800 border-amber-300'
}

function statusLabel(status: TestStatus): string {
  if (status === 'inconclusive') return 'Inconclusive'
  return status
}

function allTestsForSuite(suiteTests: TestCaseDefinition[]): string[] {
  return suiteTests.map((test) => test.id)
}

function resolveSelectionForActiveServer(suiteTests: TestCaseDefinition[]): string[] {
  const suiteTestIds = new Set(allTestsForSuite(suiteTests))
  const serverId = serverStore.activeServer?.id
  if (!serverId) {
    return allTestsForSuite(suiteTests)
  }

  const serverSelection = serverStore.getTestSelection(serverId).filter((id) => suiteTestIds.has(id))
  return serverSelection.length > 0 ? serverSelection : allTestsForSuite(suiteTests)
}

function toggleTest(testId: string): void {
  if (isForcedDependency(testId) && selectedTestIds.value.includes(testId)) {
    return
  }

  if (selectedTestIds.value.includes(testId)) {
    selectedTestIds.value = selectedTestIds.value.filter((id) => id !== testId)
  } else {
    selectedTestIds.value = [...selectedTestIds.value, testId]
  }
}

function exportSelectedRun(): void {
  if (!selectedRun.value) {
    return
  }

  const content = exportRunResultAsJson(selectedRun.value)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `harness-${selectedRun.value.runId}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function clearHistory(): void {
  const history = clearTestSuiteRunHistory()
  runHistory.value = history.runs
  selectedRunId.value = ''
}

async function runHarness(): Promise<void> {
  runError.value = ''

  if (!selectedSuite.value) {
    runError.value = 'Select a test suite before running'
    return
  }

  if (!hasAuthenticatedActor.value) {
    runError.value = 'No authenticated actor available. Log in to a server first.'
    return
  }

  if (selectedTestIds.value.length === 0) {
    runError.value = 'Select at least one test'
    return
  }

  isRunning.value = true
  rerunOverrides.value = {}
  liveResults.value = []

  const activeServerId = serverStore.activeServer?.id
  if (activeServerId) {
    serverStore.saveTestConfig(activeServerId, {
      sidecarUrl: sidecarUrl.value.trim() || undefined
    })
  }

  try {
    const run = await runTestSuite(
      selectedSuite.value.id,
      selectedSuite.value.name,
      selectedSuite.value.tests,
      {
        selectedTestIds: selectedTestIds.value,
        timeoutMs: 15000,
        blockedDependencyPolicy: 'inconclusive',
        sidecarUrl: sidecarUrl.value.trim() || undefined,
        bearerTokenResolver: getCurrentBearerToken,
        runParameters: {
          handle: autoDerivedHandle.value,
          sidecarUrl: sidecarUrl.value.trim() || undefined,
          serverOrigin: serverStore.activeServer?.origin,
          authenticatedActorUri: authenticatedActorUri.value
        }
      },
      (result) => {
        liveResults.value = [...liveResults.value, result]
      }
    )

    const history = appendTestSuiteRun(run)
    runHistory.value = history.runs
    selectedRunId.value = run.runId

    if (activeServerId) {
      serverStore.saveTestResults(activeServerId, run)
    }

    saveTestSuitePreferences({
      selectedSuiteId: selectedSuiteId.value,
      selectedTestIds: selectedTestIds.value
    })
  } catch (error) {
    runError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isRunning.value = false
  }
}

watch(selectedRunId, () => {
  rerunOverrides.value = {}
})

watch(selectedSuiteId, () => {
  if (!selectedSuite.value) {
    selectedTestIds.value = []
    return
  }

  selectedTestIds.value = resolveSelectionForActiveServer(selectedSuite.value.tests)
})

watch(selectedTestIds, (testIds) => {
  const serverId = serverStore.activeServer?.id
  if (!serverId) {
    return
  }

  serverStore.saveTestSelection(serverId, testIds)
})

watch(forcedDependencyIds, (forced) => {
  if (forced.size === 0) {
    return
  }

  const missing = Array.from(forced).filter((id) => !selectedTestIds.value.includes(id))
  if (missing.length > 0) {
    selectedTestIds.value = [...selectedTestIds.value, ...missing]
  }
})

onMounted(() => {
  syncRunHistoryForActiveServer()

  const preferences = loadTestSuitePreferences()
  if (preferences.selectedSuiteId && testSuites.some((suite) => suite.id === preferences.selectedSuiteId)) {
    selectedSuiteId.value = preferences.selectedSuiteId
  }

  if (selectedSuite.value) {
    selectedTestIds.value = resolveSelectionForActiveServer(selectedSuite.value.tests)
  }

  sidecarUrl.value = serverStore.activeServer?.testing?.sidecarUrl ?? ''
})

watch(() => serverStore.activeServerId, () => {
  syncRunHistoryForActiveServer()
  sidecarUrl.value = serverStore.activeServer?.testing?.sidecarUrl ?? ''

  if (selectedSuite.value) {
    selectedTestIds.value = resolveSelectionForActiveServer(selectedSuite.value.tests)
  } else {
    selectedTestIds.value = []
  }
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
    <div>
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Server Test</h2>
      <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
        Browser-first ActivityPub C2S tests with dependency-aware execution and optional sidecar diagnostics.
      </p>

      <div v-if="hasAuthenticatedActor" class="mt-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3">
        <p class="text-sm text-blue-900 dark:text-blue-200">
          Testing as: <span class="font-semibold">{{ authenticatedActor?.preferredUsername || authenticatedActor?.name || 'Unknown' }}</span>
          <span v-if="autoDerivedHandle" class="text-xs text-blue-700 dark:text-blue-300 ml-2">({{ autoDerivedHandle }})</span>
          <span v-else class="text-xs text-blue-700 dark:text-blue-300 ml-2">({{ authenticatedActorUri }})</span>
        </p>
      </div>

      <div v-else class="mt-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
        <p class="text-sm text-amber-900 dark:text-amber-200">
          ℹ️ Log in to a server first to run tests.
        </p>
      </div>
    </div>

    <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
      <div class="grid md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">Suite</label>
          <select
            v-model="selectedSuiteId"
            :disabled="!hasAuthenticatedActor"
            class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          >
            <option v-for="suite in testSuites" :key="suite.id" :value="suite.id">
              {{ suite.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">Sidecar URL (optional)</label>
          <input
            v-model="sidecarUrl"
            type="url"
            placeholder="http://localhost:8788"
            class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div v-if="selectedSuite" class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Tests</h3>
          <button
            type="button"
            class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-200"
            @click="selectedTestIds = allTestsForSuite(selectedSuite.tests)"
          >
            Select all
          </button>
        </div>

        <div class="grid md:grid-cols-2 gap-2">
          <label
            v-for="test in selectedSuite.tests"
            :key="test.id"
            class="flex items-start gap-2 rounded border border-gray-200 dark:border-gray-700 p-2 text-sm"
          >
            <input
              type="checkbox"
              class="mt-0.5"
              :checked="selectedTestIds.includes(test.id)"
              :disabled="isForcedDependency(test.id)"
              @change="toggleTest(test.id)"
            />
            <div>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ test.id }} - {{ test.name }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ test.description }}</p>
            </div>
          </label>
        </div>
      </div>

      <div :key="executionOrderRenderKey" class="rounded border border-dashed border-gray-300 dark:border-gray-600 p-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Execution order preview</h3>
        <p v-if="executionOrderPreview.error" class="text-sm text-red-700 dark:text-red-300 mt-1">
          {{ executionOrderPreview.error }}
        </p>
        <p v-else class="text-sm text-gray-700 dark:text-gray-200 mt-1">
          {{ executionOrderPreview.order.join(' -> ') }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
          :disabled="isRunning || !hasAuthenticatedActor"
          @click="runHarness"
        >
          {{ isRunning ? 'Running...' : 'Run Harness' }}
        </button>

        <button
          type="button"
          class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
          :disabled="runHistory.length === 0"
          @click="exportSelectedRun"
        >
          Export JSON
        </button>

        <button
          type="button"
          class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
          :disabled="runHistory.length === 0"
          @click="clearHistory"
        >
          Clear History
        </button>
      </div>

      <p v-if="runError" class="text-sm text-red-700 dark:text-red-300">{{ runError }}</p>
    </div>

    <div :key="runHistoryRenderKey" v-if="runHistory.length > 0" class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Run History</h3>
        <select
          v-model="selectedRunId"
          class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        >
          <option v-for="run in runHistory" :key="run.runId" :value="run.runId">
            {{ new Date(run.startedAt).toLocaleString() }} - {{ run.summary.pass }}/{{ run.summary.total }} pass
          </option>
        </select>
      </div>

      <div v-if="selectedRun" class="mt-3 grid md:grid-cols-6 gap-2 text-sm">
        <div class="rounded border border-emerald-200 bg-emerald-50 px-3 py-2">Pass: {{ selectedRun.summary.pass }}</div>
        <div class="rounded border border-rose-200 bg-rose-50 px-3 py-2">Fail: {{ selectedRun.summary.fail }}</div>
        <div class="rounded border border-red-200 bg-red-50 px-3 py-2">Error: {{ selectedRun.summary.error }}</div>
        <div class="rounded border border-slate-200 bg-slate-50 px-3 py-2">Skip: {{ selectedRun.summary.skip }}</div>
        <div class="rounded border border-amber-200 bg-amber-50 px-3 py-2">Inconclusive: {{ selectedRun.summary.inconclusive }}</div>
        <div class="rounded border border-gray-200 bg-gray-50 px-3 py-2">Duration: {{ selectedRun.durationMs }}ms</div>
      </div>
    </div>

    <div class="space-y-3">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Results</h3>

      <div v-for="result in displayedResults" :key="result.id" class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold tracking-wide text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200">{{ result.id }}</span>
          <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ result.name }}</span>
          <span class="text-xs px-2 py-1 rounded border" :class="statusClass(result.status)">{{ statusLabel(result.status) }}</span>
          <span v-if="result.startedAt" class="text-xs text-gray-500 dark:text-gray-400">{{ result.durationMs }}ms</span>
          <button
            v-if="canRerun(result.id)"
            type="button"
            class="text-xs px-2 py-0.5 rounded border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
            :disabled="rerunningTestId !== null"
            @click="rerunTest(result.id)"
          >
            {{ rerunningTestId === result.id ? 'Running…' : 'Rerun' }}
          </button>
        </div>

        <p v-if="result.reason" class="text-sm text-gray-700 dark:text-gray-200">{{ result.reason }}</p>

        <ul v-if="result.assertions.length > 0" class="space-y-1 text-sm">
          <li v-for="assertion in result.assertions" :key="assertion.assertion.label" class="flex items-start gap-2">
            <span :class="assertion.passed ? 'text-emerald-700' : 'text-rose-700'">{{ assertion.passed ? 'PASS' : 'FAIL' }}</span>
            <span class="text-gray-700 dark:text-gray-200">{{ assertion.message }}</span>
          </li>
        </ul>

        <div v-if="result.diagnostics" class="rounded border border-gray-200 dark:border-gray-600 p-3 text-sm">
          <p class="font-medium text-gray-900 dark:text-gray-100">Sidecar diagnostics (diagnostic-only)</p>
          <p class="text-gray-700 dark:text-gray-200">
            {{ result.diagnostics.summary }}
            <span class="text-xs text-gray-500 dark:text-gray-400">({{ result.diagnostics.confidence }})</span>
          </p>
          <HttpExchangePanel
            v-if="result.diagnostics.sidecarExchange"
            title="Sidecar Exchange"
            :exchange="result.diagnostics.sidecarExchange"
          />
        </div>

        <HttpExchangePanel
          v-if="result.attempt"
          title="Browser Exchange"
          :exchange="result.attempt.exchange"
        />
      </div>
    </div>

    <DisclosurePanel label="Test Context">
      <pre class="text-xs bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-3 rounded overflow-auto">{{ JSON.stringify(displayedContext, null, 2) }}</pre>
    </DisclosurePanel>
  </div>
</template>
