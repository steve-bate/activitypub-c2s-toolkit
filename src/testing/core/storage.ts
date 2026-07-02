import type { TestSuiteRunResult } from "@/testing/core/types"

const TEST_PREFERENCES_KEY = "c2s_test_preferences"

export interface TestSuitePreferences {
  selectedSuiteId?: string
  selectedTestIds?: string[]
  recentHandle?: string
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
