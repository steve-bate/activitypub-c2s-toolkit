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

export interface HttpExchange<TRequest = unknown, TResponse = unknown> {
  success: boolean
  error?: string
  request?: TRequest
  response?: TResponse
}