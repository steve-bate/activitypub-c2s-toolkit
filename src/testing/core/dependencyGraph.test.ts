import { describe, expect, it } from "vitest"
import { buildDependencyPlan } from "@/testing/core/dependencyGraph"
import type { TestCaseDefinition } from "@/testing/core/types"

function makeTest(id: string, dependsOn: string[] = []): TestCaseDefinition {
  return {
    id,
    name: id,
    description: id,
    dependsOn,
    run: async (_context, tools) => {
      const outcome = tools.pass()
      return Promise.resolve(outcome)
    }
  }
}

describe("dependency graph planning", () => {
  it("returns deterministic topological order", () => {
    const tests: TestCaseDefinition[] = [
      makeTest("B", ["A"]),
      makeTest("C", ["A"]),
      makeTest("A"),
    ]

    const result = buildDependencyPlan(tests)
    expect(result.order.map((test) => test.id)).toEqual(["A", "B", "C"])
  })

  it("fails when a dependency is missing", () => {
    const tests: TestCaseDefinition[] = [makeTest("A", ["missing"])]

    expect(() => buildDependencyPlan(tests)).toThrow(/unknown test/i)
  })

  it("reports cycle members when cycle exists", () => {
    const tests: TestCaseDefinition[] = [
      makeTest("A", ["C"]),
      makeTest("B", ["A"]),
      makeTest("C", ["B"]),
    ]

    expect(() => buildDependencyPlan(tests)).toThrow(/cycle/i)
  })
})
