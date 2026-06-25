import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { loadConfig } from './config.js'
import { applyCorsHeaders, handlePreflight } from './cors.js'
import { buildCorsIssueCodes, buildCorsDiagnostics, collectRequestedHeaders, needsPreflight, normalizeRequestHeaders } from './corsDiagnostics.js'
import { proxyRequest } from './proxy.js'
import { validateRequestMethod, validateTargetUrl } from './security.js'
import type { CorsDiagnosticsErrorResponse, CorsDiagnosticsRequestPayload, CorsDiagnosticsSuccessResponse, ErrorPayload, ProxyDiagnostics, UpstreamResponsePayload } from './types.js'

const config = loadConfig()

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key'
])

function shouldIncludeBody(requestUrl: URL): boolean {
  return requestUrl.searchParams.get('body') === 'true'
}

function omitBody(upstream: UpstreamResponsePayload): Omit<UpstreamResponsePayload, 'body'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { body, ...rest } = upstream
  return rest
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let totalBytes = 0

  for await (const chunk of req) {
    const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += chunkBuffer.byteLength

    if (totalBytes > maxBytes) {
      throw new Error('BODY_TOO_LARGE')
    }

    chunks.push(chunkBuffer)
  }

  if (chunks.length === 0) {
    throw new Error('INVALID_JSON')
  }

  const bodyText = Buffer.concat(chunks).toString('utf8')

  try {
    return JSON.parse(bodyText)
  } catch {
    throw new Error('INVALID_JSON')
  }
}

function sanitizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  if (!headers) {
    return {}
  }

  const sanitized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]'
      continue
    }
    sanitized[key] = value
  }
  return sanitized
}

function toErrorPayload(code: string, details?: unknown): ErrorPayload {
  switch (code) {
    case 'BODY_TOO_LARGE':
      return { code, message: 'Request body is too large.', details }
    case 'INVALID_JSON':
      return { code, message: 'Request body must be valid JSON.', details }
    case 'INVALID_PAYLOAD':
      return { code, message: 'Request payload is invalid.', details }
    case 'METHOD_NOT_ALLOWED':
      return { code, message: 'Method is not allowed by proxy policy.', details }
    case 'INVALID_URL':
      return { code, message: 'targetUrl must be a valid absolute URL.', details }
    case 'UNSUPPORTED_PROTOCOL':
      return { code, message: 'Only http and https targets are supported.', details }
    case 'TARGET_BLOCKED':
      return { code, message: 'Target is blocked by sidecar network policy.', details }
    case 'UPSTREAM_TIMEOUT':
      return { code, message: 'Upstream request timed out.', details }
    case 'UPSTREAM_BODY_TOO_LARGE':
      return { code, message: 'Upstream response exceeded allowed body size.', details }
    case 'ORIGIN_NOT_ALLOWED':
      return { code, message: 'Browser origin is not allowed by sidecar CORS policy.', details }
    default:
      return { code: 'UPSTREAM_FETCH_FAILED', message: 'Failed to fetch upstream resource.', details }
  }
}

function normalizeProxyPayload(value: unknown): CorsDiagnosticsRequestPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_PAYLOAD')
  }

  const payload = value as Record<string, unknown>
  const targetUrl = payload.targetUrl
  if (typeof targetUrl !== 'string' || !targetUrl.trim()) {
    throw new Error('INVALID_PAYLOAD')
  }

  const method = payload.method
  const headers = payload.headers
  const body = payload.body
  const origin = payload.origin

  if (method !== undefined && typeof method !== 'string') {
    throw new Error('INVALID_PAYLOAD')
  }

  if (origin !== undefined && typeof origin !== 'string') {
    throw new Error('INVALID_PAYLOAD')
  }

  if (headers !== undefined && (typeof headers !== 'object' || headers === null || Array.isArray(headers))) {
    throw new Error('INVALID_PAYLOAD')
  }

  const normalizedHeaders: Record<string, string> = {}
  if (headers && typeof headers === 'object') {
    for (const [key, valueOfHeader] of Object.entries(headers as Record<string, unknown>)) {
      if (typeof valueOfHeader !== 'string') {
        throw new Error('INVALID_PAYLOAD')
      }
      normalizedHeaders[key] = valueOfHeader
    }
  }

  return {
    targetUrl: targetUrl.trim(),
    method,
    headers: normalizedHeaders,
    body,
    origin
  }
}

async function performCorsPreflight(params: {
  targetUrl: string
  method: string
  headers: Record<string, string>
  origin?: string
  timeoutMs: number
  maxUpstreamBodyBytes: number
}): Promise<{ upstream: UpstreamResponsePayload; diagnostics: ProxyDiagnostics }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs)

  try {
    const requestHeaders: Record<string, string> = {
      'Access-Control-Request-Method': params.method
    }

    if (params.origin) {
      requestHeaders.Origin = params.origin
    }

    const requestedHeaders = collectRequestedHeaders(params.headers)
    if (requestedHeaders.length > 0) {
      requestHeaders['Access-Control-Request-Headers'] = requestedHeaders.join(', ')
    }

    const response = await fetch(params.targetUrl, {
      method: 'OPTIONS',
      headers: requestHeaders,
      signal: controller.signal
    })

    const responseBodyBuffer = Buffer.from(await response.arrayBuffer())
    if (responseBodyBuffer.byteLength > params.maxUpstreamBodyBytes) {
      throw new Error('UPSTREAM_BODY_TOO_LARGE')
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    const bodyText = responseBodyBuffer.toString('utf8')
    const body = contentType.includes('application/json') || contentType.includes('+json')
      ? (() => {
          try {
            return JSON.parse(bodyText)
          } catch {
            return bodyText
          }
        })()
      : (contentType.startsWith('text/') ? bodyText : {
          base64: responseBodyBuffer.toString('base64'),
          encoding: 'base64',
          size: responseBodyBuffer.byteLength,
          contentType: contentType || null
        })

    return {
      upstream: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body
      },
      diagnostics: buildCorsDiagnostics({
        requestMethod: params.method,
        requestHeaders: params.headers,
        requestOrigin: params.origin,
        responseHeaders: response.headers
      })
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('UPSTREAM_TIMEOUT')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}


async function handleCorsDiagnostics(req: IncomingMessage, res: ServerResponse, requestUrl: URL): Promise<void> {
  const corsResult = applyCorsHeaders(req, res, config)
  if (!corsResult.allowed) {
    writeJson(res, 403, { ok: false, error: toErrorPayload('ORIGIN_NOT_ALLOWED') })
    return
  }

  try {
    const parsedBody = await readJsonBody(req, config.maxRequestBodyBytes)
    const payload = normalizeProxyPayload(parsedBody)
    const normalizedMethod = validateRequestMethod(payload.method ?? 'GET', config.allowedProxyMethods)

    if (!normalizedMethod) {
      throw new Error('METHOD_NOT_ALLOWED')
    }

    const validatedTarget = await validateTargetUrl(payload.targetUrl, config.allowPrivateTargets)
    const requestOrigin = payload.origin ?? corsResult.origin
    const effectiveHeaders = normalizeRequestHeaders({ headers: payload.headers, body: payload.body })
    const preflightRequired = needsPreflight(normalizedMethod, effectiveHeaders)
    const includeBody = shouldIncludeBody(requestUrl)

    let preflightResponse
    let preflightDiagnostics
    if (preflightRequired) {
      const preflightResult = await performCorsPreflight({
        targetUrl: validatedTarget.toString(),
        method: normalizedMethod,
        headers: effectiveHeaders,
        origin: requestOrigin,
        timeoutMs: config.requestTimeoutMs,
        maxUpstreamBodyBytes: config.maxUpstreamBodyBytes
      })
      preflightResponse = includeBody ? preflightResult.upstream : omitBody(preflightResult.upstream)
      preflightDiagnostics = preflightResult.diagnostics
    }

    const proxyResult = await proxyRequest({
      payload: {
        targetUrl: validatedTarget.toString(),
        method: normalizedMethod,
        headers: effectiveHeaders,
        body: payload.body
      },
      timeoutMs: config.requestTimeoutMs,
      maxUpstreamBodyBytes: config.maxUpstreamBodyBytes,
      requestOrigin
    })

    const issues = new Set<string>(buildCorsIssueCodes(proxyResult.diagnostics.cors))
    if (preflightDiagnostics) {
      for (const issue of buildCorsIssueCodes(preflightDiagnostics.cors)) {
        issues.add(issue)
      }
    }

    const response: CorsDiagnosticsSuccessResponse = {
      ok: true,
      targetUrl: validatedTarget.toString(),
      request: {
        targetUrl: validatedTarget.toString(),
        method: normalizedMethod,
        headers: sanitizeHeaders(effectiveHeaders),
        ...(requestOrigin ? { origin: requestOrigin } : {})
      },
      proxyResponse: includeBody ? proxyResult.upstream : omitBody(proxyResult.upstream),
      ...(preflightResponse ? { preflightResponse } : {}),
      issues: Array.from(issues),
      details: {
        preflightRequired,
        proxy: proxyResult.diagnostics.cors,
        ...(preflightDiagnostics ? { preflight: preflightDiagnostics.cors } : {})
      }
    }

    console.info(
      JSON.stringify({
        event: 'diagnostics.request',
        targetUrl: response.targetUrl,
        method: response.request.method,
        requestHeaders: response.request.headers,
        preflightRequired,
        issues: response.issues
      })
    )

    writeJson(res, 200, response)
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : 'UPSTREAM_FETCH_FAILED'
    const response: CorsDiagnosticsErrorResponse = {
      ok: false,
      error: toErrorPayload(errorCode)
    }
    writeJson(res, 400, response)
  }
}

const server = createServer((req, res) => {
  void (async () => {
    const requestUrl = new URL(req.url ?? '/', 'http://localhost')

    console.log('Incoming request:', req.method, requestUrl.pathname)
    if (requestUrl.pathname === '/diagnostics' && req.method === 'OPTIONS') {
      handlePreflight(req, res, config)
      return
    }

    if (requestUrl.pathname === '/health' && req.method === 'GET') {
      const corsResult = applyCorsHeaders(req, res, config)
      if (!corsResult.allowed) {
        writeJson(res, 403, { ok: false, error: toErrorPayload('ORIGIN_NOT_ALLOWED') })
        return
      }

      writeJson(res, 200, { ok: true })
      return
    }

    if (requestUrl.pathname === '/diagnostics' && req.method === 'POST') {
      await handleCorsDiagnostics(req, res, requestUrl)
      return
    }

    const corsResult = applyCorsHeaders(req, res, config)
    if (!corsResult.allowed) {
      writeJson(res, 403, { ok: false, error: toErrorPayload('ORIGIN_NOT_ALLOWED') })
      return
    }

    writeJson(res, 404, {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.'
      }
    })
  })().catch((error: unknown) => {
    if (!res.headersSent) {
      writeJson(res, 500, {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error.'
        }
      })
    } else {
      res.destroy(error instanceof Error ? error : undefined)
    }
  })
})

server.listen(config.port, config.host, () => {
  console.info(
    JSON.stringify({
      event: 'sidecar.started',
      host: config.host,
      port: config.port,
      allowedOrigins: config.allowedOrigins,
      allowPrivateTargets: config.allowPrivateTargets
    })
  )
})
