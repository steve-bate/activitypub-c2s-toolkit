import type { HarnessRunHistory, HarnessRunResult } from '@/testing/core/types'

const HARNESS_HISTORY_KEY = 'c2s_harness_run_history'
const HARNESS_PREFERENCES_KEY = 'c2s_harness_preferences'
const HARNESS_SCHEMA_VERSION = 1
const DEFAULT_HISTORY_LIMIT = 15

export interface HarnessPreferences {
  selectedSuiteId?: string
  selectedTestIds?: string[]
  recentHandle?: string
}

function loadHistory(): HarnessRunHistory {
  try {
    const stored = localStorage.getItem(HARNESS_HISTORY_KEY)
    if (!stored) {
      return {
        schemaVersion: HARNESS_SCHEMA_VERSION,
        runs: []
      }
    }

    const parsed = JSON.parse(stored) as HarnessRunHistory
    if (!Array.isArray(parsed.runs)) {
      return {
        schemaVersion: HARNESS_SCHEMA_VERSION,
        runs: []
      }
    }

    return {
      schemaVersion: HARNESS_SCHEMA_VERSION,
      runs: parsed.runs
    }
  } catch {
    return {
      schemaVersion: HARNESS_SCHEMA_VERSION,
      runs: []
    }
  }
}

function saveHistory(history: HarnessRunHistory): void {
  localStorage.setItem(HARNESS_HISTORY_KEY, JSON.stringify(history))
}

export function appendHarnessRun(run: HarnessRunResult, maxRuns = DEFAULT_HISTORY_LIMIT): HarnessRunHistory {
  const existing = loadHistory()
  const runs = [run, ...existing.runs].slice(0, maxRuns)
  const next = {
    schemaVersion: HARNESS_SCHEMA_VERSION,
    runs
  }

  saveHistory(next)
  return next
}

export function getHarnessRunHistory(): HarnessRunHistory {
  return loadHistory()
}

export function clearHarnessRunHistory(): HarnessRunHistory {
  const cleared = {
    schemaVersion: HARNESS_SCHEMA_VERSION,
    runs: []
  }

  saveHistory(cleared)
  return cleared
}

export function loadHarnessPreferences(): HarnessPreferences {
  try {
    const stored = localStorage.getItem(HARNESS_PREFERENCES_KEY)
    if (!stored) {
      return {}
    }

    const parsed = JSON.parse(stored) as HarnessPreferences
    return {
      selectedSuiteId: parsed.selectedSuiteId,
      selectedTestIds: parsed.selectedTestIds,
      recentHandle: parsed.recentHandle
    }
  } catch {
    return {}
  }
}

export function saveHarnessPreferences(preferences: HarnessPreferences): void {
  localStorage.setItem(HARNESS_PREFERENCES_KEY, JSON.stringify(preferences))
}

export function exportRunResultAsJson(run: HarnessRunResult): string {
  return JSON.stringify(run, null, 2)
}
