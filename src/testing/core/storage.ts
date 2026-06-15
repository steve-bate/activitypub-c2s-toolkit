import type { TestSuiteRunHistory, TestSuiteRunResult } from "@/testing/core/types"

const TEST_HISTORY_KEY = "c2s_test_run_history"
const TEST_PREFERENCES_KEY = "c2s_test_preferences"
const TEST_SCHEMA_VERSION = 1
const DEFAULT_HISTORY_LIMIT = 15

export interface TestSuitePreferences {
  selectedSuiteId?: string
  selectedTestIds?: string[]
  recentHandle?: string
}

function loadHistory(): TestSuiteRunHistory {
  try {
    const stored = localStorage.getItem(TEST_HISTORY_KEY)
    if (!stored) {
      return {
        schemaVersion: TEST_SCHEMA_VERSION,
        runs: [],
      }
    }

    const parsed = JSON.parse(stored) as TestSuiteRunHistory
    if (!Array.isArray(parsed.runs)) {
      return {
        schemaVersion: TEST_SCHEMA_VERSION,
        runs: [],
      }
    }

    return {
      schemaVersion: TEST_SCHEMA_VERSION,
      runs: parsed.runs,
    }
  } catch {
    return {
      schemaVersion: TEST_SCHEMA_VERSION,
      runs: [],
    }
  }
}

function saveHistory(history: TestSuiteRunHistory): void {
  localStorage.setItem(TEST_HISTORY_KEY, JSON.stringify(history))
}

export function appendTestSuiteRun(
  run: TestSuiteRunResult,
  maxRuns = DEFAULT_HISTORY_LIMIT,
): TestSuiteRunHistory {
  const existing = loadHistory()
  const runs = [run, ...existing.runs].slice(0, maxRuns)
  const next = {
    schemaVersion: TEST_SCHEMA_VERSION,
    runs,
  }

  saveHistory(next)
  return next
}

export function getTestSuiteRunHistory(): TestSuiteRunHistory {
  return loadHistory()
}

export function clearTestSuiteRunHistory(): TestSuiteRunHistory {
  const cleared = {
    schemaVersion: TEST_SCHEMA_VERSION,
    runs: [],
  }

  saveHistory(cleared)
  return cleared
}

export function loadTestSuitePreferences(): TestSuitePreferences {
  try {
    const stored = localStorage.getItem(TEST_PREFERENCES_KEY)
    if (!stored) {
      return {}
    }

    const parsed = JSON.parse(stored) as TestSuitePreferences
    return {
      selectedSuiteId: parsed.selectedSuiteId,
      selectedTestIds: parsed.selectedTestIds,
      recentHandle: parsed.recentHandle,
    }
  } catch {
    return {}
  }
}

export function saveTestSuitePreferences(preferences: TestSuitePreferences): void {
  localStorage.setItem(TEST_PREFERENCES_KEY, JSON.stringify(preferences))
}

export function exportRunResultAsJson(run: TestSuiteRunResult): string {
  return JSON.stringify(run, null, 2)
}
