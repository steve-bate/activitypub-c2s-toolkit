import { CorsDiagnosticResult } from "@/utils/corsDiagnostics"

export interface HttpRequestData<TParams = unknown> {
  url: string
  headers: Record<string, string>
  params?: TParams
  timestamp?: string
}

export interface HttpResponseData<TParams = unknown> {
  status_code: number
  status_text?: string,
  headers: Record<string, string>
  payload?: TParams
}

export interface HttpExchangeMetrics {
  startedAt: string
  finishedAt: string
  durationMs: number
}

export type ExchangeErrorKind = "transport" | "timeout" | "opaque" | "unknown"

export interface HttpExchange<TRequest = unknown, TResponse = unknown> {
  success: boolean
  error?: string
  errorKind?: ExchangeErrorKind
  request?: TRequest
  response?: TResponse
  metrics?: HttpExchangeMetrics
  cors?: CorsDiagnosticResult
}
