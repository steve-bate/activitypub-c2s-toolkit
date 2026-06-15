import type { TestSuiteDefinition } from "@/testing/core/types"
import { coreClientTests } from "@/testing/suites/coreClientTests"

export const testSuites: TestSuiteDefinition[] = [
  coreClientTests,
]
