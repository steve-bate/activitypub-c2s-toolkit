import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SidecarConfig } from './types.js'

interface CorsResult {
  allowed: boolean
  origin?: string
}

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.includes('*') || allowedOrigins.includes(origin)
}

export function applyCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  config: SidecarConfig
): CorsResult {
  const requestOriginHeader = req.headers.origin
  const requestOrigin = typeof requestOriginHeader === 'string' ? requestOriginHeader : undefined

  if (!requestOrigin) {
    return { allowed: true }
  }

  const allowed = isOriginAllowed(requestOrigin, config.allowedOrigins)
  if (!allowed) {
    return { allowed: false, origin: requestOrigin }
  }

  res.setHeader('Access-Control-Allow-Origin', requestOrigin)
  res.setHeader('Vary', 'Origin')

  if (config.allowCredentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }

  return { allowed: true, origin: requestOrigin }
}

export function handlePreflight(
  req: IncomingMessage,
  res: ServerResponse,
  config: SidecarConfig
): void {
  const corsResult = applyCorsHeaders(req, res, config)
  if (!corsResult.allowed) {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        ok: false,
        error: {
          code: 'ORIGIN_NOT_ALLOWED',
          message: `Origin is not allowed: ${corsResult.origin ?? 'unknown'}`
        }
      })
    )
    return
  }

  const requestHeadersRaw = req.headers['access-control-request-headers']
  const requestHeaders = typeof requestHeadersRaw === 'string'
    ? requestHeadersRaw.split(',').map((value) => value.trim().toLowerCase())
    : []

  const allowedLower = new Set(config.allowedRequestHeaders.map((header) => header.toLowerCase()))
  const allowedRequestedHeaders = requestHeaders.filter((header) => allowedLower.has(header))

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    allowedRequestedHeaders.length > 0
      ? allowedRequestedHeaders.join(', ')
      : config.allowedRequestHeaders.join(', ')
  )
  res.setHeader('Access-Control-Max-Age', '600')

  res.writeHead(204)
  res.end()
}
