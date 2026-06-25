import { describe, expect, it } from "vitest"
import { runTestSuite } from "@/testing/core/runner"
import type { TestCaseDefinition } from "@/testing/core/types"

describe("runner dependency behavior", () => {
  it("propagates context updates to dependent tests", async () => {
    const tests: TestCaseDefinition[] = [
      {
        id: "A",
        name: "A",
        description: "sets context",
        run: async (_context, tools) => Promise.resolve({
          ...tools.pass(),
          contextUpdates: { actorUri: "https://example.com/users/alice" },
        }),
      },
      {
        id: "B",
        name: "B",
        description: "reads context",
        dependsOn: ["A"],
        run: async (context, tools) => {
          const actorUri = context.getShared<string>("actorUri")
          if (!actorUri) {
            return Promise.resolve(tools.fail("actorUri missing"))
          }
          return Promise.resolve(tools.pass())
        },
      },
    ]

    const result = await runTestSuite("suite", "Suite", tests, {
      runParameters: {
        handle: "@alice@example.com",
      },
    })

    expect(result.summary.pass).toBe(2)
    expect(result.context.actorUri).toBe("https://example.com/users/alice")
    expect(result.browserInfo.name.length).toBeGreaterThan(0)
    expect(result.browserInfo.version.length).toBeGreaterThan(0)
    expect(result.browserInfo.userAgent.length).toBeGreaterThan(0)
  })

  it("blocks dependent tests when dependency fails", async () => {
    const tests: TestCaseDefinition[] = [
      {
        id: "A",
        name: "A",
        description: "fails",
        run: async (_context, tools) => Promise.resolve(tools.fail("forced failure")),
      },
      {
        id: "B",
        name: "B",
        description: "blocked",
        dependsOn: ["A"],
        run: async (_context, tools) => Promise.resolve(tools.pass("should not run")),
      },
    ]

    const result = await runTestSuite("suite", "Suite", tests, {
      blockedDependencyPolicy: "skip",
      runParameters: {
        handle: "@alice@example.com",
      },
    })

    const blocked = result.results.find((item) => item.id === "B")
    expect(blocked?.status).toBe("skip")
    expect(blocked?.reason).toMatch(/blocked by dependency/i)
  })

  it("supports inconclusive blocked policy", async () => {
    const tests: TestCaseDefinition[] = [
      {
        id: "A",
        name: "A",
        description: "fails",
        run: async (_context, tools) => Promise.resolve(tools.fail("forced failure")),
      },
      {
        id: "B",
        name: "B",
        description: "blocked",
        dependsOn: ["A"],
        run: async (_context, tools) => Promise.resolve(tools.pass("should not run")),
      },
    ]

    const result = await runTestSuite("suite", "Suite", tests, {
      blockedDependencyPolicy: "inconclusive",
      runParameters: {
        handle: "@alice@example.com",
      },
    })

    const blocked = result.results.find((item) => item.id === "B")
    expect(blocked?.status).toBe("inconclusive")
  })
})
