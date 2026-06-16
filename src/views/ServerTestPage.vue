<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import DisclosurePanel from '@/components/DisclosurePanel.vue'
import HttpExchangePanel from '@/components/http/HttpExchangePanel.vue'
import { useServerStore } from '@/stores/serverStore'
import { testSuites } from '@/testing/suites'
import { rerunSingleTest, runTestSuite } from '@/testing/core/runner'
import { buildDependencyPlan } from '@/testing/core/dependencyGraph'
import {
  loadTestSuitePreferences,
  saveTestSuitePreferences
} from '@/testing/core/storage'
import type { TestSuiteRunResult, TestCaseDefinition, TestStatus } from '@/testing/core/types'
import type { ActorProfile } from '@/services/actorDiscoveryService'
import StatusBadge from '@/testing/components/StatusBadge.vue'

const serverStore = useServerStore()

const selectedSuiteId = ref<string>(testSuites[0]?.id ?? '')
const selectedTestIds = ref<string[]>([])

// TODO Use global setting for sidecarUrl (and remove this)
const sidecarUrl = ref('')

const isRunning = ref(false)
const rerunningTestId = ref<string | null>(null)
const runError = ref<string>('')
const liveResults = ref<TestSuiteRunResult['results']>([])
const runResults = ref<TestSuiteRunResult | null>(null)
const rerunOverrides = ref<Record<string, TestSuiteRunResult['results'][number]>>({})

const statusCounts = computed(() => {
  const counts: Record<TestStatus, number> = {
    pass: 0,
    fail: 0,
    error: 0,
    skip: 0,
    inconclusive: 0
  }

  for (const result of displayedResults.value) {
    counts[result.status] += 1
  }

  return Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0)) as Record<TestStatus, number>
})

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

const fediverseHandle = computed(() => {
  const actor = authenticatedActor.value
  const preferredUsername = normalizePreferredUsername(actor?.preferredUsername)
  const resourceServerOrigin = normalizeResourceServerOrigin(authenticatedActorOrigin.value)
  if (preferredUsername && resourceServerOrigin) {
    return `acct:${preferredUsername}@${resourceServerOrigin}`
  }
  return ''
})


const executionOrder = computed(() => {
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
  const base = isRunning.value ? liveResults.value : runResults.value?.results ?? []
  const withOverrides =
    Object.keys(rerunOverrides.value).length === 0
      ? base
      : base.map((r) => rerunOverrides.value[r.id] ?? r)

  // Only augment when there is an active or completed run to display
  if (!selectedSuite.value || (!isRunning.value && !runResults.value)) {
    return withOverrides
  }

  const resultsById = new Map(withOverrides.map((r) => [r.id, r]))
  return selectedSuite.value.tests.map(
    (test): TestSuiteRunResult['results'][number] =>
      resultsById.get(test.id) ?? {
        id: test.id,
        name: test.name,
        status: 'skip',
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
  return runResults.value?.context ?? {}
})

function syncRunHistoryForActiveServer(): void {
  const activeServerId = serverStore.activeServer?.id

  // Reset ephemeral run state before applying the active server snapshot.
  rerunOverrides.value = {}
  liveResults.value = []
  isRunning.value = false

  if (!activeServerId) {
    runResults.value = null
    return
  }

  const savedRun = serverStore.getTestResults(activeServerId)
  if (!savedRun) {
    runResults.value = null
    return
  }

  runResults.value = savedRun
}

function canRerun(testId: string): boolean {
  if (isRunning.value || rerunningTestId.value !== null) return false
  if (!runResults.value) return false
  const test = selectedSuite.value?.tests.find((t) => t.id === testId)
  if (!test) return false
  return (test.dependsOn ?? []).every(
    (depId) => (rerunOverrides.value[depId] ?? displayedResults.value.find((r) => r.id === depId))?.status === 'pass'
  )
}

async function rerunTest(testId: string): Promise<void> {
  if (!selectedSuite.value || !runResults.value) return
  rerunningTestId.value = testId
  try {
    const newResult = await rerunSingleTest(
      testId,
      selectedSuite.value.tests,
      {
        timeoutMs: 15000,
        sidecarUrl: sidecarUrl.value.trim() || undefined,
        runParameters: {
          handle: fediverseHandle.value,
          sidecarUrl: sidecarUrl.value.trim() || undefined,
          serverOrigin: serverStore.activeServer?.origin,
          authenticatedActorUri: authenticatedActorUri.value,
          bearerToken: getCurrentBearerToken()
        }
      },
      displayedResults.value,
      runResults.value.context
    )
    rerunOverrides.value = { ...rerunOverrides.value, [testId]: newResult }
  } finally {
    rerunningTestId.value = null
  }
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

async function runTests(): Promise<void> {
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
        runParameters: {
          handle: fediverseHandle.value,
          sidecarUrl: sidecarUrl.value.trim() || undefined,
          serverOrigin: serverStore.activeServer?.origin,
          authenticatedActorUri: authenticatedActorUri.value,
          bearerToken: getCurrentBearerToken()
        }
      },
      (result) => {
        liveResults.value = [...liveResults.value, result]
      }
    )

    runResults.value = run

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
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">C2S Server Tests</h2>

      <div v-if="hasAuthenticatedActor"
        class="mt-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3">
        <p class="text-sm text-blue-900 dark:text-blue-200">
          Testing as: <span class="font-semibold">{{ authenticatedActor?.preferredUsername || authenticatedActor?.name
            || 'Unknown' }}</span>
          <span v-if="fediverseHandle" class="text-xs text-blue-700 dark:text-blue-300 ml-2">({{ fediverseHandle
          }})</span>
          <span v-else class="text-xs text-blue-700 dark:text-blue-300 ml-2">({{ authenticatedActorUri }})</span>
        </p>
      </div>

      <div v-else
        class="mt-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
        <p class="text-sm text-amber-900 dark:text-amber-200">
          ℹ️ Log in to a server first to run tests.
        </p>
      </div>
    </div>

    <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">

      <div class="w-fit">
        <label class="block text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">Suite</label>
        <select v-model="selectedSuiteId" :disabled="!hasAuthenticatedActor"
          class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50">
          <option v-for="suite in testSuites" :key="suite.id" :value="suite.id">
            {{ suite.name }}
          </option>
        </select>
      </div>


      <div v-if="selectedSuite" class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Tests</h3>
          <button type="button"
            class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-200"
            @click="selectedTestIds = allTestsForSuite(selectedSuite.tests)">
            Select all
          </button>
        </div>

        <div class="grid md:grid-cols-2 gap-2">
          <label v-for="test in selectedSuite.tests" :key="test.id"
            class="flex items-start gap-2 rounded border border-gray-200 dark:border-gray-700 p-2 text-sm">
            <input type="checkbox" class="mt-0.5" :checked="selectedTestIds.includes(test.id)"
              :disabled="isForcedDependency(test.id)" @change="toggleTest(test.id)" />
            <div>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ test.id }} - {{ test.name }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ test.description }}</p>
            </div>
          </label>
        </div>
      </div>

      <div :key="executionOrderRenderKey" class="rounded border border-dashed border-gray-300 dark:border-gray-600 p-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Test execution order</h3>
        <p v-if="executionOrder.error" class="text-sm text-red-700 dark:text-red-300 mt-1">
          {{ executionOrder.error }}
        </p>
        <p v-else class="text-sm text-gray-700 dark:text-gray-200 mt-1">
          {{ executionOrder.order.join(' -> ') }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button type="button"
          class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
          :disabled="isRunning || !hasAuthenticatedActor" @click="runTests">
          {{ isRunning ? 'Running...' : 'Run Tests' }}
        </button>

      </div>

      <p v-if="runError" class="text-sm text-red-700 dark:text-red-300">{{ runError }}</p>
    </div>

    <div class="space-y-3">
      <!-- TODO Put test results in summary line -->
      <div class="flex gap-2">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Results:</h3>
        <StatusBadge v-for="(count, status) in statusCounts" :key="status" :status="status as TestStatus"
          :count="count" />
      </div>

      <div v-for="result in displayedResults" :key="result.id"
        class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold tracking-wide text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200">{{
              result.id }}</span>
          <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ result.name }}</span>
          <StatusBadge :status="result.status" />
          <span v-if="result.startedAt" class="text-xs text-gray-500 dark:text-gray-400">{{ result.durationMs
          }}ms</span>
          <button v-if="canRerun(result.id)" type="button"
            class="text-xs px-2 py-0.5 rounded border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
            :disabled="rerunningTestId !== null" @click="rerunTest(result.id)">
            {{ rerunningTestId === result.id ? 'Running…' : '↺ Rerun' }}
          </button>
        </div>

        <p v-if="result.reason" class="text-sm text-gray-700 dark:text-gray-200">{{ result.reason }}</p>

        <ul v-if="result.assertions.length > 0" class="space-y-1 text-sm">
          <li v-for="assertion in result.assertions" :key="assertion.assertion.label" class="flex items-start gap-2">
            <span :class="assertion.passed ? 'text-emerald-700' : 'text-rose-700'">{{ assertion.passed ? 'PASS' : 'FAIL'
            }}</span>
            <span class="text-gray-700 dark:text-gray-200">{{ assertion.message }}</span>
          </li>
        </ul>

        <div v-if="result.diagnostics" class="rounded border border-gray-200 dark:border-gray-600 p-3 text-sm">
          <p class="font-medium text-gray-900 dark:text-gray-100">Sidecar diagnostics (diagnostic-only)</p>
          <p class="text-gray-700 dark:text-gray-200">
            {{ result.diagnostics.summary }}
            <span class="text-xs text-gray-500 dark:text-gray-400">({{ result.diagnostics.confidence }})</span>
          </p>
          <HttpExchangePanel v-if="result.diagnostics.sidecarExchange" title="Sidecar Exchange"
            :exchange="result.diagnostics.sidecarExchange" />
        </div>

        <HttpExchangePanel v-if="result.attempt" title="Browser Exchange" :exchange="result.attempt.exchange" />
      </div>
    </div>

    <DisclosurePanel label="Test Context">
      <pre
        class="text-xs bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-3 rounded overflow-auto">{{ JSON.stringify(displayedContext, null, 2) }}</pre>
    </DisclosurePanel>
  </div>
</template>
