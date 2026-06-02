export type JsonRecord = Record<string, unknown>

export interface ProxyRequestPayload {
  targetUrl: string
  method?: string
  headers?: Record<string, string>
  body?: unknown
}

export interface CorsDiagnosticsRequestPayload extends ProxyRequestPayload {
  origin?: string
}

export interface ErrorPayload {
  code: string
  message: string
  details?: unknown
}

export interface UpstreamResponsePayload {
  status: number
  statusText: string
  headers: Record<string, string>
  body?: unknown
}

export interface ProxyDiagnostics {
  cors: {
    missingAllowOrigin: boolean
    allowOrigin: string | null
    originMismatch: boolean
    missingAllowHeaders: string[]
    missingAllowMethods: string[]
    notes: string[]
  }
}

export interface ProxySuccessResponse {
  ok: true
  upstream: UpstreamResponsePayload
  diagnostics: ProxyDiagnostics
}

export interface ProxyErrorResponse {
  ok: false
  error: ErrorPayload
}

export type ProxyResponse = ProxySuccessResponse | ProxyErrorResponse

export interface CorsDiagnosticsSuccessResponse {
  ok: true
  targetUrl: string
  request: {
    targetUrl: string
    method: string
    headers: Record<string, string>
    origin?: string
  }
  proxyResponse: UpstreamResponsePayload
  preflightResponse?: UpstreamResponsePayload
  issues: string[]
  details: {
    preflightRequired: boolean
    proxy: ProxyDiagnostics['cors']
    preflight?: ProxyDiagnostics['cors']
  }
}

export interface CorsDiagnosticsErrorResponse {
  ok: false
  error: ErrorPayload
}

export type CorsDiagnosticsResponse =
  | CorsDiagnosticsSuccessResponse
  | CorsDiagnosticsErrorResponse

export interface SidecarConfig {
  host: string
  port: number
  allowedOrigins: string[]
  allowedRequestHeaders: string[]
  allowCredentials: boolean
  maxRequestBodyBytes: number
  maxUpstreamBodyBytes: number
  requestTimeoutMs: number
  allowedProxyMethods: string[]
  allowPrivateTargets: boolean
}
