import type { ProxyDiagnostics } from './types.js'

const SIMPLE_METHODS = new Set(['GET', 'HEAD', 'POST'])
const SIMPLE_HEADERS = new Set(['accept', 'accept-language', 'content-language'])
const SIMPLE_CONTENT_TYPES = new Set([
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain'
])

function splitHeaderValues(value: string | null): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

export function needsPreflight(method: string, requestHeaders: Record<string, string>): boolean {
  if (!SIMPLE_METHODS.has(method.toUpperCase())) {
    return true
  }

  for (const [headerName, headerValue] of Object.entries(requestHeaders)) {
    const lowerName = headerName.toLowerCase()
    if (lowerName === 'content-type') {
      const normalized = headerValue.split(';')[0].trim().toLowerCase()
      if (!SIMPLE_CONTENT_TYPES.has(normalized)) {
        return true
      }
      continue
    }

    if (!SIMPLE_HEADERS.has(lowerName)) {
      return true
    }
  }

  return false
}

export function collectRequestedHeaders(requestHeaders: Record<string, string>): string[] {
  const requestedHeaders: string[] = []

  for (const [headerName, headerValue] of Object.entries(requestHeaders)) {
    const lowerName = headerName.toLowerCase()
    if (lowerName === 'origin') {
      continue
    }

    if (lowerName === 'content-type') {
      const normalized = headerValue.split(';')[0].trim().toLowerCase()
      if (!SIMPLE_CONTENT_TYPES.has(normalized)) {
        requestedHeaders.push(lowerName)
      }
      continue
    }

    if (!SIMPLE_HEADERS.has(lowerName)) {
      requestedHeaders.push(lowerName)
    }
  }

  return requestedHeaders
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lowerName = name.toLowerCase()
  return Object.keys(headers).some((headerName) => headerName.toLowerCase() === lowerName)
}

export function normalizeRequestHeaders(params: {
  headers?: Record<string, string>
  body?: unknown
}): Record<string, string> {
  const headers = { ...(params.headers ?? {}) }

  if (
    params.body !== undefined &&
    params.body !== null &&
    typeof params.body === 'object' &&
    !Array.isArray(params.body) &&
    !hasHeader(headers, 'Content-Type')
  ) {
    headers['Content-Type'] = 'application/json'
  }

  return headers
}

export function buildCorsDiagnostics(params: {
  requestMethod: string
  requestHeaders: Record<string, string>
  requestOrigin: string | undefined
  responseHeaders: Headers
}): ProxyDiagnostics {
  const allowOrigin = params.responseHeaders.get('access-control-allow-origin')
  const allowHeaders = splitHeaderValues(params.responseHeaders.get('access-control-allow-headers'))
  const allowMethods = splitHeaderValues(params.responseHeaders.get('access-control-allow-methods'))

  const requestedHeaderNames = Object.keys(params.requestHeaders)
    .map((name) => name.toLowerCase())
    .filter((name) => name !== 'origin')

  const missingAllowHeaders = requestedHeaderNames.filter((headerName) => {
    if (SIMPLE_HEADERS.has(headerName)) {
      return false
    }

    if (headerName === 'content-type') {
      const rawValue = params.requestHeaders['Content-Type'] ?? params.requestHeaders['content-type']
      if (!rawValue) {
        return false
      }
      const normalized = rawValue.split(';')[0].trim().toLowerCase()
      if (SIMPLE_CONTENT_TYPES.has(normalized)) {
        return false
      }
    }

    if (allowHeaders.includes('*')) {
      return false
    }

    return !allowHeaders.includes(headerName)
  })

  const methodUpper = params.requestMethod.toUpperCase()
  const missingAllowMethods: string[] = []
  if (!SIMPLE_METHODS.has(methodUpper) && allowMethods.length > 0 && !allowMethods.includes('*')) {
    if (!allowMethods.includes(methodUpper.toLowerCase())) {
      missingAllowMethods.push(methodUpper)
    }
  }

  const originMismatch = Boolean(
    params.requestOrigin &&
    allowOrigin &&
    allowOrigin !== '*' &&
    allowOrigin !== params.requestOrigin
  )

  const notes: string[] = []
  if (!allowOrigin) {
    notes.push('Upstream response is missing Access-Control-Allow-Origin.')
  }

  if (originMismatch) {
    notes.push('Upstream Access-Control-Allow-Origin does not match the requesting origin.')
  }

  const preflightRequired = needsPreflight(methodUpper, params.requestHeaders)
  if (preflightRequired && missingAllowHeaders.length > 0) {
    notes.push('Request likely needs preflight, but Access-Control-Allow-Headers is missing required headers.')
  }

  if (preflightRequired && missingAllowMethods.length > 0) {
    notes.push('Request likely needs preflight, but Access-Control-Allow-Methods does not include the request method.')
  }

  return {
    cors: {
      missingAllowOrigin: !allowOrigin,
      allowOrigin,
      originMismatch,
      missingAllowHeaders,
      missingAllowMethods,
      notes
    }
  }
}

export function buildCorsIssueCodes(diagnostics: ProxyDiagnostics['cors']): string[] {
  const issues = new Set<string>()

  if (diagnostics.missingAllowOrigin) {
    issues.add('missing_access_control_allow_origin')
  }

  if (diagnostics.originMismatch) {
    issues.add('access_control_allow_origin_mismatch')
  }

  for (const headerName of diagnostics.missingAllowHeaders) {
    issues.add(`missing_access_control_allow_headers:${headerName}`)
  }

  for (const method of diagnostics.missingAllowMethods) {
    issues.add(`missing_access_control_allow_methods:${method.toLowerCase()}`)
  }

  return Array.from(issues)
}
