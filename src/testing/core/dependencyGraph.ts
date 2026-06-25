import type { TestCaseDefinition } from "@/testing/core/types"

interface DependencyValidationResult {
  ok: boolean
  errors: string[]
}

export interface DependencyPlanResult {
  order: TestCaseDefinition[]
  diagnostics: string[]
}

function createTestMap(
  tests: TestCaseDefinition[],
): Map<string, TestCaseDefinition> {
  const map = new Map<string, TestCaseDefinition>()

  for (const test of tests) {
    if (map.has(test.id)) {
      throw new Error(`Duplicate test id detected: ${test.id}`)
    }
    map.set(test.id, test)
  }

  return map
}

function selectWithDependencies(
  testMap: Map<string, TestCaseDefinition>,
  selectedIds?: string[],
): TestCaseDefinition[] {
  if (!selectedIds || selectedIds.length === 0) {
    return Array.from(testMap.values())
  }

  const included = new Set<string>()

  function includeWithDependencies(testId: string): void {
    const test = testMap.get(testId)
    if (!test) {
      throw new Error(`Selected test id not found: ${testId}`)
    }

    if (included.has(testId)) {
      return
    }

    included.add(testId)

    for (const dependencyId of test.dependsOn ?? []) {
      includeWithDependencies(dependencyId)
    }
  }

  for (const selectedId of selectedIds) {
    includeWithDependencies(selectedId)
  }

  return Array.from(included)
    .map((id) => testMap.get(id))
    .filter((value): value is TestCaseDefinition => Boolean(value))
}

function validateDependencies(
  tests: TestCaseDefinition[],
): DependencyValidationResult {
  const testIds = new Set(tests.map((test) => test.id))
  const errors: string[] = []

  for (const test of tests) {
    for (const dependencyId of test.dependsOn ?? []) {
      if (!testIds.has(dependencyId)) {
        errors.push(`Test ${test.id} depends on unknown test ${dependencyId}`)
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}

function findCycleMembers(tests: TestCaseDefinition[]): string[] {
  const adjacency = new Map<string, string[]>()
  for (const test of tests) {
    adjacency.set(test.id, [...(test.dependsOn ?? [])])
  }

  const visited = new Set<string>()
  const stack = new Set<string>()
  const parent = new Map<string, string>()

  function visit(node: string): string[] | null {
    visited.add(node)
    stack.add(node)

    for (const next of adjacency.get(node) ?? []) {
      if (!visited.has(next)) {
        parent.set(next, node)
        const cycle = visit(next)
        if (cycle) {
          return cycle
        }
      } else if (stack.has(next)) {
        const cyclePath: string[] = [next]
        let cursor = node
        while (cursor !== next) {
          cyclePath.push(cursor)
          const prior = parent.get(cursor)
          if (!prior) {
            break
          }
          cursor = prior
        }
        cyclePath.reverse()
        cyclePath.push(next)
        return cyclePath
      }
    }

    stack.delete(node)
    return null
  }

  const sortedIds = Array.from(adjacency.keys()).sort((a, b) =>
    a.localeCompare(b),
  )

  for (const node of sortedIds) {
    if (!visited.has(node)) {
      const cycle = visit(node)
      if (cycle) {
        return cycle
      }
    }
  }

  return []
}

export function buildDependencyPlan(
  tests: TestCaseDefinition[],
  selectedIds?: string[],
): DependencyPlanResult {
  const testMap = createTestMap(tests)
  const selectedTests = selectWithDependencies(testMap, selectedIds)
  const validation = validateDependencies(selectedTests)

  if (!validation.ok) {
    throw new Error(
      `Dependency validation failed: ${validation.errors.join("; ")}`,
    )
  }

  const indegree = new Map<string, number>()
  const children = new Map<string, string[]>()

  for (const test of selectedTests) {
    indegree.set(test.id, 0)
    children.set(test.id, [])
  }

  for (const test of selectedTests) {
    for (const dependencyId of test.dependsOn ?? []) {
      indegree.set(test.id, (indegree.get(test.id) ?? 0) + 1)
      children.get(dependencyId)?.push(test.id)
    }
  }

  for (const [, list] of children.entries()) {
    list.sort((a, b) => a.localeCompare(b))
  }

  const queue = Array.from(indegree.entries())
    .filter(([, count]) => count === 0)
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b))

  const orderedIds: string[] = []

  while (queue.length > 0) {
    const node = queue.shift()
    if (!node) {
      break
    }

    orderedIds.push(node)

    for (const child of children.get(node) ?? []) {
      const nextInDegree = (indegree.get(child) ?? 0) - 1
      indegree.set(child, nextInDegree)
      if (nextInDegree === 0) {
        queue.push(child)
        queue.sort((a, b) => a.localeCompare(b))
      }
    }
  }

  if (orderedIds.length !== selectedTests.length) {
    const cycle = findCycleMembers(selectedTests)
    const cycleMessage =
      cycle.length > 0
        ? `Dependency cycle detected: ${cycle.join(" -> ")}`
        : "Dependency cycle detected in selected tests"
    throw new Error(cycleMessage)
  }

  const order = orderedIds
    .map((id) => testMap.get(id))
    .filter((value): value is TestCaseDefinition => Boolean(value))

  return {
    order,
    diagnostics: [],
  }
}
