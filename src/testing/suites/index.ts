import type { TestSuiteDefinition } from "@/testing/core/types"
import { actorResolutionAndCollectionsSuite } from "@/testing/suites/actorResolutionAndCollections"

export const testSuites: TestSuiteDefinition[] = [
  actorResolutionAndCollectionsSuite,
]
