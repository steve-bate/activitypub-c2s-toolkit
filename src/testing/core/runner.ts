import { createTestContext } from "@/testing/core/context"
import {
  allAssertionsPassed,
  evaluateAssertions,
} from "@/testing/core/assertions"
import { buildDependencyPlan } from "@/testing/core/dependencyGraph"
import {
  runSidecarDiagnostics,
  shouldAttemptSidecarDiagnostics,
} from "@/testing/core/executor"
import type {
  BrowserInfo,
  TestSuiteRunResult,
  TestAssertion,
  TestCaseContext,
  TestCaseDefinition,
  TestCaseExecutionOutcome,
  TestRequest,
  TestRunOptions,
  TestStatus,
  TestCaseResult,
} from "@/testing/core/types"
import { xfetch } from "@/utils/httpExchange"

const TEST_SCHEMA_VERSION = 1

function nowIso(): string {
  return new Date().toISOString()
}

function buildBlockedOutcome(
  status: TestStatus,
  reason: string,
): TestCaseExecutionOutcome {
  return {
    status,
    reason,
    assertions: [],
  }
}

function asRequestPreparation(
  test: TestCaseDefinition,
  context: TestCaseContext,
) {
  if (!test.request) {
    return undefined
  }

  if (typeof test.request === "function") {
    return test.request(context)
  }

  return { request: test.request }
}

function calculateSummary(
  results: TestSuiteRunResult["results"],
): TestSuiteRunResult["summary"] {
  const summary = {
    pass: 0,
    fail: 0,
    error: 0,
    skip: 0,
    inconclusive: 0,
    blocked: 0,
    total: results.length,
  }

  for (const result of results) {
    summary[result.status] += 1
    if (
      (result.status === "skip" || result.status === "inconclusive") &&
      result.reason?.includes("Blocked by dependency")
    ) {
      summary.blocked += 1
    }
  }

  return summary
}

function hasAuthorizationHeader(headers?: Record<string, string>): boolean {
  if (!headers) {
    return false
  }

  return Object.keys(headers).some(
    (key) => key.toLowerCase() === "authorization",
  )
}

function withBearerTokenIfAvailable(
  request: TestRequest,
  options: TestRunOptions,
): TestRequest {
  const token = options.runParameters.bearerToken
  if (!token || hasAuthorizationHeader(request.headers)) {
    return request
  }

  return {
    ...request,
    headers: {
      ...(request.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  }
}

function parseBrowserNameAndVersion(
  userAgent: string,
): Pick<BrowserInfo, "name" | "version"> {
  const ua = userAgent || ""
  const rules: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /Edg\/(\d+(?:\.\d+)*)/i, name: "Edge" },
    { pattern: /OPR\/(\d+(?:\.\d+)*)/i, name: "Opera" },
    { pattern: /Chrome\/(\d+(?:\.\d+)*)/i, name: "Chrome" },
    { pattern: /Firefox\/(\d+(?:\.\d+)*)/i, name: "Firefox" },
    { pattern: /Version\/(\d+(?:\.\d+)*)[\s\S]*Safari\//i, name: "Safari" },
  ]

  for (const rule of rules) {
    const match = ua.match(rule.pattern)
    if (match?.[1]) {
      return {
        name: rule.name,
        version: match[1],
      }
    }
  }

  return {
    name: "Unknown",
    version: "Unknown",
  }
}

function getBrowserInfo(): BrowserInfo {
  if (typeof navigator === "undefined") {
    return {
      name: "Unknown",
      version: "Unknown",
      userAgent: "Unavailable",
    }
  }

  const userAgent = navigator.userAgent || "Unavailable"
  const parsed = parseBrowserNameAndVersion(userAgent)
  const navigatorWithUaData = navigator as Navigator & {
    userAgentData?: {
      brands?: Array<{ brand: string; version: string }>
    }
  }

  return {
    name: parsed.name,
    version: parsed.version,
    userAgent,
    platform: navigator.platform || undefined,
    language: navigator.language || undefined,
    vendor: navigator.vendor || undefined,
    brands: navigatorWithUaData.userAgentData?.brands,
  }
}

export async function runTestSuite(
  suiteId: string,
  suiteName: string,
  tests: TestCaseDefinition[],
  options: TestRunOptions,
  onResult?: (result: TestSuiteRunResult["results"][number]) => void,
): Promise<TestSuiteRunResult> {
  const runId = crypto.randomUUID()
  const startedAt = nowIso()
  const startTime = performance.now()

  const blockedDependencyPolicy = options.blockedDependencyPolicy ?? "skip"
  const timeoutMs = options.timeoutMs ?? 12000

  const planningResult = buildDependencyPlan(tests, options.selectedTestIds)
  const context = createTestContext(runId, options.runParameters)

  const results: TestSuiteRunResult["results"] = []

  for (const test of planningResult.order) {
    const executionStartTime = performance.now()
    const executionStartedAt = nowIso()

    const dependencies = test.dependsOn ?? []
    const failedDependencies = dependencies.filter((dependencyId) => {
      const dependencyResult = context.testResults[dependencyId]
      return !dependencyResult || dependencyResult.status !== "pass"
    })

    let outcome: TestCaseExecutionOutcome

    if (failedDependencies.length > 0) {
      const blockedStatus: TestStatus =
        blockedDependencyPolicy === "inconclusive" ? "inconclusive" : "skip"
      outcome = buildBlockedOutcome(
        blockedStatus,
        `Blocked by dependency: ${failedDependencies.join(", ")}`,
      )
    } else if (test.run) {
      outcome = await test.run(context, {
        executeRequest: async (request, assertions = []) => {
          const authedRequest = withBearerTokenIfAvailable(request, options)
          const exchange = await xfetch(authedRequest.url, {
            method: authedRequest.method,
            headers: authedRequest.headers,
            body: authedRequest.body,
            timeout: timeoutMs,
          })
          const assertionOutcomes = evaluateAssertions(assertions, exchange)

          let diagnostics = undefined
          if (shouldAttemptSidecarDiagnostics(exchange)) {
            diagnostics = await runSidecarDiagnostics(
              options.sidecarUrl,
              authedRequest,
              timeoutMs,
            )
          }

          if (
            !exchange.success &&
            assertions.length === 0 &&
            exchange.errorKind
          ) {
            return {
              status: "fail",
              reason: `Browser request failed: ${exchange.error}`,
              attempt: {
                startedAt: nowIso(),
                finishedAt: nowIso(),
                durationMs: 0,
                exchange,
                transportError: exchange.errorKind === "transport" ? { kind: "transport", message: exchange.error ?? "" } : undefined,
              },
              assertions: assertionOutcomes,
              diagnostics,
            }
          }

          const status: TestStatus = allAssertionsPassed(assertionOutcomes)
            ? "pass"
            : exchange.errorKind
              ? "error"
              : "fail"

          return {
            status,
            reason:
              status === "pass" ? undefined : "One or more assertions failed",
            exchange,
            assertions: assertionOutcomes,
            diagnostics,
          }
        },
        inconclusive: (reason) => ({
          status: "inconclusive",
          reason,
          assertions: [],
        }),
        fail: (reason) => ({
          status: "fail",
          reason,
          assertions: [],
        }),
        pass: (reason) => ({
          status: "pass",
          reason,
          assertions: [],
        }),
      })
    } else {
      const preparation = asRequestPreparation(test, context)
      if (!preparation) {
        outcome = {
          status: "error",
          reason: "Test has no run function or request definition",
          assertions: [],
        }
      } else if ("inconclusiveReason" in preparation) {
        outcome = {
          status: "inconclusive",
          reason: preparation.inconclusiveReason,
          assertions: [],
        }
      } else {
        const authedRequest = withBearerTokenIfAvailable(
          preparation.request,
          options,
        )
        const exchange = await xfetch(
          authedRequest.url,
          authedRequest,
        )
        const assertionOutcomes = evaluateAssertions(
          test.assertions ?? [],
          exchange,
        )

        let diagnostics = undefined
        if (shouldAttemptSidecarDiagnostics(exchange)) {
          diagnostics = await runSidecarDiagnostics(
            options.sidecarUrl,
            authedRequest,
            timeoutMs,
          )
        }

        const status: TestStatus =
          assertionOutcomes.length > 0
            ? allAssertionsPassed(assertionOutcomes)
              ? "pass"
              : exchange.errorKind
                ? "error"
                : "fail"
            : exchange.success
              ? "pass"
              : "fail"

        outcome = {
          status,
          reason:
            status === "pass"
              ? undefined
              : (exchange.error ?? "Request failed"),
          assertions: assertionOutcomes,
          exchange,
          diagnostics,
        }
      }
    }

    const executionFinishedAt = nowIso()
    const durationMs = Math.round(performance.now() - executionStartTime)

    const result: TestCaseResult = {
      id: test.id,
      name: test.name,
      status: outcome.status,
      reason: outcome.reason,
      startedAt: executionStartedAt,
      finishedAt: executionFinishedAt,
      durationMs,
      dependsOn: [...(test.dependsOn ?? [])],
      assertions: outcome.assertions,
      exchange: outcome.exchange,
      diagnostics: outcome.diagnostics,
      contextUpdates: outcome.contextUpdates,
    }

    if (outcome.contextUpdates) {
      for (const [key, value] of Object.entries(outcome.contextUpdates)) {
        context.setShared(key, value)
      }
    }

    context.testResults[test.id] = result
    results.push(result)
    onResult?.(result)
  }

  const finishedAt = nowIso()

  return {
    schemaVersion: TEST_SCHEMA_VERSION,
    runId,
    suiteId,
    suiteName,
    startedAt,
    finishedAt,
    durationMs: Math.round(performance.now() - startTime),
    selectedTestIds:
      options.selectedTestIds && options.selectedTestIds.length > 0
        ? options.selectedTestIds
        : tests.map((test) => test.id),
    executionOrder: planningResult.order.map((test) => test.id),
    browserInfo: getBrowserInfo(),
    parameters: options.runParameters,
    context: { ...context.shared },
    results,
    summary: calculateSummary(results),
  }
}

function buildTools(options: TestRunOptions, timeoutMs: number) {
  return {
    executeRequest: async (
      request: TestRequest,
      assertions: TestAssertion[] = [],
    ) => {
      const authedRequest = withBearerTokenIfAvailable(request, options)
      const exchange = await xfetch(authedRequest.url, authedRequest)
      const assertionOutcomes = evaluateAssertions(assertions, exchange)

      let diagnostics = undefined
      if (shouldAttemptSidecarDiagnostics(exchange)) {
        diagnostics = await runSidecarDiagnostics(
          options.sidecarUrl,
          authedRequest,
          timeoutMs,
        )
      }

      if (
        !exchange.success &&
        assertions.length === 0 &&
        exchange.errorKind
      ) {
        return {
          status: "fail" as TestStatus,
          reason: `Browser request failed: ${exchange.error}`,
          attempt: exchange,
          assertions: assertionOutcomes,
          diagnostics,
        }
      }

      const status: TestStatus = allAssertionsPassed(assertionOutcomes)
        ? "pass"
        : exchange.errorKind
          ? "error"
          : "fail"

      return {
        status,
        reason: status === "pass" ? undefined : "One or more assertions failed",
        attempt: exchange,
        assertions: assertionOutcomes,
        exchange,
        diagnostics,
      }
    },
    inconclusive: (reason: string): TestCaseExecutionOutcome => ({
      status: "inconclusive",
      reason,
      assertions: [],
    }),
    fail: (reason: string): TestCaseExecutionOutcome => ({
      status: "fail",
      reason,
      assertions: [],
    }),
    pass: (reason?: string): TestCaseExecutionOutcome => ({
      status: "pass",
      reason,
      assertions: [],
    }),
  }
}

/**
 * Re-runs a single test, seeding the context from a prior run's results and
 * context snapshot. Throws if the test ID is not found. Returns a blocked
 * result if any dependency did not pass in `priorResults`.
 */
export async function rerunSingleTest(
  testId: string,
  tests: TestCaseDefinition[],
  options: TestRunOptions,
  priorResults: TestSuiteRunResult["results"],
  priorContext: Record<string, unknown>,
): Promise<TestSuiteRunResult["results"][number]> {
  const test = tests.find((t) => t.id === testId)
  if (!test) {
    throw new Error(`Test not found: ${testId}`)
  }

  const timeoutMs = options.timeoutMs ?? 12000
  const context = createTestContext(crypto.randomUUID(), options.runParameters)
  Object.assign(context.shared, priorContext)
  for (const r of priorResults) {
    context.testResults[r.id] = r
  }

  const dependencies = test.dependsOn ?? []
  const failedDependencies = dependencies.filter((depId) => {
    const dep = context.testResults[depId]
    return !dep || dep.status !== "pass"
  })

  const startedAt = nowIso()
  const startTime = performance.now()

  let outcome: TestCaseExecutionOutcome

  if (failedDependencies.length > 0) {
    outcome = buildBlockedOutcome(
      "skip",
      `Blocked by dependency: ${failedDependencies.join(", ")}`,
    )
  } else if (test.run) {
    outcome = await test.run(
      context,
      buildTools(options, timeoutMs),
    )
  } else {
    const preparation = asRequestPreparation(test, context)
    if (!preparation) {
      outcome = {
        status: "error",
        reason: "Test has no run function or request definition",
        assertions: [],
      }
    } else if ("inconclusiveReason" in preparation) {
      outcome = {
        status: "inconclusive",
        reason: preparation.inconclusiveReason,
        assertions: [],
      }
    } else {
      const authedRequest = withBearerTokenIfAvailable(
        preparation.request,
        options,
      )
      const exchange = await xfetch(authedRequest.url, authedRequest)
      const assertionOutcomes = evaluateAssertions(
        test.assertions ?? [],
        exchange,
      )

      let diagnostics = undefined
      if (shouldAttemptSidecarDiagnostics(exchange)) {
        diagnostics = await runSidecarDiagnostics(
          options.sidecarUrl,
          authedRequest,
          timeoutMs,
        )
      }

      const status: TestStatus =
        assertionOutcomes.length > 0
          ? allAssertionsPassed(assertionOutcomes)
            ? "pass"
            : exchange.errorKind
              ? "error"
              : "fail"
          : exchange.success
            ? "pass"
            : "fail"

      outcome = {
        status,
        reason:
          status === "pass"
            ? undefined
            : (exchange.error ?? "Request failed"),
        assertions: assertionOutcomes,
        diagnostics,
      }
    }
  }

  return {
    id: test.id,
    name: test.name,
    status: outcome.status,
    reason: outcome.reason,
    startedAt,
    finishedAt: nowIso(),
    durationMs: Math.round(performance.now() - startTime),
    dependsOn: [...(test.dependsOn ?? [])],
    assertions: outcome.assertions,
    exchange: outcome.exchange,
    diagnostics: outcome.diagnostics,
    contextUpdates: outcome.contextUpdates,
  }
}
