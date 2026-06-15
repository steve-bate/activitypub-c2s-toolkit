import type {
  TestCaseContext,
  TestCaseResult,
  TestRunOptions,
} from "@/testing/core/types"

export function createTestContext(
  runId: string,
  runParameters: TestRunOptions["runParameters"],
): TestCaseContext {
  const shared: Record<string, unknown> = {}
  const testResults: Record<string, TestCaseResult> = {}

  function setShared(key: string, value: unknown): void {
    shared[key] = value
  }

  function getShared<T>(key: string): T | undefined {
    return shared[key] as T | undefined
  }

  function requireShared<T>(key: string): T {
    if (!(key in shared)) {
      throw new Error(`Missing required context value: ${key}`)
    }
    return shared[key] as T
  }

  function getDependencyResult(testId: string): TestCaseResult | undefined {
    return testResults[testId]
  }

  return {
    runId,
    parameters: runParameters,
    shared,
    testResults,
    setShared,
    getShared,
    requireShared,
    getDependencyResult,
  }
}
