import type { ProxyDiagnostics, ProxyRequestPayload, UpstreamResponsePayload } from './types.js'
import { buildCorsDiagnostics, normalizeRequestHeaders } from './corsDiagnostics.js'

function toHeaderRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {}
  headers.forEach((value, key) => {
    record[key] = value
  })
  return record
}

function decodeRequestBody(payload: ProxyRequestPayload): string | undefined {
  if (payload.body === undefined || payload.body === null) {
    return undefined
  }

  if (typeof payload.body === 'string') {
    return payload.body
  }

  if (typeof payload.body === 'number' || typeof payload.body === 'boolean') {
    return String(payload.body)
  }

  return JSON.stringify(payload.body)
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lowerName = name.toLowerCase()
  return Object.keys(headers).some((headerName) => headerName.toLowerCase() === lowerName)
}

async function readUpstreamBody(response: Response, maxBytes: number): Promise<unknown> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const bodyBuffer = Buffer.from(await response.arrayBuffer())

  if (bodyBuffer.byteLength > maxBytes) {
    throw new Error('UPSTREAM_BODY_TOO_LARGE')
  }

  const bodyText = bodyBuffer.toString('utf8')

  if (contentType.includes('application/json') || contentType.includes('+json')) {
    try {
      return JSON.parse(bodyText)
    } catch {
      return bodyText
    }
  }

  if (contentType.startsWith('text/')) {
    return bodyText
  }

  return {
    base64: bodyBuffer.toString('base64'),
    encoding: 'base64',
    size: bodyBuffer.byteLength,
    contentType: contentType || null
  }
}

export async function proxyRequest(params: {
  payload: ProxyRequestPayload
  timeoutMs: number
  maxUpstreamBodyBytes: number
  requestOrigin?: string
}): Promise<{ upstream: UpstreamResponsePayload; diagnostics: ProxyDiagnostics }> {
  const method = (params.payload.method ?? 'GET').toUpperCase()
  const headers = normalizeRequestHeaders({ headers: params.payload.headers, body: params.payload.body })
  const body = decodeRequestBody(params.payload)

  if (body !== undefined && !hasHeader(headers, 'Content-Type') && typeof params.payload.body === 'object') {
    headers['Content-Type'] = 'application/json'
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs)

  try {
    const response = await fetch(params.payload.targetUrl, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : body,
      signal: controller.signal
    })

    const upstreamBody = await readUpstreamBody(response, params.maxUpstreamBodyBytes)
    const diagnostics = buildCorsDiagnostics({
      requestMethod: method,
      requestHeaders: headers,
      requestOrigin: params.requestOrigin,
      responseHeaders: response.headers
    })

    return {
      upstream: {
        status: response.status,
        statusText: response.statusText,
        headers: toHeaderRecord(response.headers),
        body: upstreamBody
      },
      diagnostics
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
