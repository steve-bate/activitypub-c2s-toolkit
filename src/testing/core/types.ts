import type { HttpExchange, HttpRequestData, HttpResponseData } from '@/types/http'

export type TestStatus = 'pass' | 'fail' | 'error' | 'skip' | 'inconclusive'

export type BlockedDependencyPolicy = 'skip' | 'inconclusive'

export interface TestRunOptions {
  selectedTestIds?: string[]
  timeoutMs?: number
  blockedDependencyPolicy?: BlockedDependencyPolicy
  sidecarUrl?: string
  bearerTokenResolver?: () => string | undefined
  runParameters: {
    handle: string
    sidecarUrl?: string
    serverOrigin?: string
    authenticatedActorUri?: string
  }
}

export interface TestRequest {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: string
}

export type AssertionKind =
  | 'status'
  | 'headerMatch'
  | 'jsonPathExists'
  | 'jsonPathEquals'
  | 'activityPubObjectShape'

export interface TestAssertion {
  kind: AssertionKind
  label: string
  expectedStatus?: number
  headerName?: string
  headerPattern?: string
  jsonPath?: string
  expectedValue?: unknown
  expectedType?: string
}

export interface AssertionOutcome {
  assertion: TestAssertion
  passed: boolean
  message: string
}

export type BrowserErrorKind = 'transport' | 'timeout' | 'opaque' | 'unknown'

export interface BrowserTransportError {
  kind: BrowserErrorKind
  message: string
}

export interface BrowserAttemptResult {
  startedAt: string
  finishedAt: string
  durationMs: number
  exchange: HttpExchange<HttpRequestData<string>, HttpResponseData<unknown>>
  responseText?: string
  responseJson?: unknown
  transportError?: BrowserTransportError
}

export type CorsDiagnosticConfidence = 'definite' | 'probable' | 'unknown'

export interface SidecarDiagnostics {
  attempted: boolean
  available: boolean
  diagnosticsUnavailableReason?: string
  confidence: CorsDiagnosticConfidence
  summary: string
  sidecarExchange?: HttpExchange<HttpRequestData<string>, HttpResponseData<unknown>>
}

export interface TestCaseResult {
  id: string
  name: string
  status: TestStatus
  reason?: string
  startedAt: string
  finishedAt: string
  durationMs: number
  dependsOn: string[]
  assertions: AssertionOutcome[]
  attempt?: BrowserAttemptResult
  diagnostics?: SidecarDiagnostics
  contextUpdates?: Record<string, unknown>
}

export interface HarnessSummary {
  pass: number
  fail: number
  error: number
  skip: number
  inconclusive: number
  total: number
  blocked: number
}

export interface BrowserInfo {
  name: string
  version: string
  userAgent: string
  platform?: string
  language?: string
  vendor?: string
  brands?: Array<{
    brand: string
    version: string
  }>
}

export interface HarnessRunResult {
  schemaVersion: number
  runId: string
  suiteId: string
  suiteName: string
  startedAt: string
  finishedAt: string
  durationMs: number
  selectedTestIds: string[]
  executionOrder: string[]
  browserInfo: BrowserInfo
  parameters: TestRunOptions['runParameters']
  context: Record<string, unknown>
  results: TestCaseResult[]
  summary: HarnessSummary
}

export interface HarnessRunHistory {
  schemaVersion: number
  runs: HarnessRunResult[]
}

export interface TestCaseContext {
  runId: string
  parameters: TestRunOptions['runParameters']
  shared: Record<string, unknown>
  testResults: Record<string, TestCaseResult>
  setShared: (key: string, value: unknown) => void
  getShared: <T>(key: string) => T | undefined
  requireShared: <T>(key: string) => T
  getDependencyResult: (testId: string) => TestCaseResult | undefined
}

export interface InconclusivePreparation {
  inconclusiveReason: string
}

export interface PreparedRequest {
  request: TestRequest
}

export type RequestPreparation = PreparedRequest | InconclusivePreparation

export interface TestCaseDefinition {
  id: string
  name: string
  description: string
  dependsOn?: string[]
  request?: TestRequest | ((context: TestCaseContext) => RequestPreparation)
  assertions?: TestAssertion[]
  run?: (
    context: TestCaseContext,
    tools: {
      executeRequest: (request: TestRequest, assertions?: TestAssertion[]) => Promise<TestCaseExecutionOutcome>
      inconclusive: (reason: string) => TestCaseExecutionOutcome
      fail: (reason: string) => TestCaseExecutionOutcome
      pass: (reason?: string) => TestCaseExecutionOutcome
    }
  ) => Promise<TestCaseExecutionOutcome>
}

export interface TestCaseExecutionOutcome {
  status: TestStatus
  reason?: string
  assertions: AssertionOutcome[]
  attempt?: BrowserAttemptResult
  diagnostics?: SidecarDiagnostics
  contextUpdates?: Record<string, unknown>
}

export interface TestSuiteDefinition {
  id: string
  name: string
  description: string
  tests: TestCaseDefinition[]
}
