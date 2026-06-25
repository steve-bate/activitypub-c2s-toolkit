import type { SidecarConfig } from './types.js'

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
const DEFAULT_ALLOWED_HEADERS = ['Content-Type', 'Accept', 'Authorization']
const DEFAULT_ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']

function parseList(rawValue: string | undefined, fallback: string[]): string[] {
  if (!rawValue) {
    return fallback
  }

  const values = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return values.length > 0 ? values : fallback
}

function parseNumber(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback
  }

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseBoolean(rawValue: string | undefined, fallback: boolean): boolean {
  if (!rawValue) {
    return fallback
  }

  return rawValue.toLowerCase() === 'true'
}

export function loadConfig(): SidecarConfig {
  return {
    host: process.env.SIDECAR_HOST ?? '127.0.0.1',
    port: parseNumber(process.env.SIDECAR_PORT, 8787),
    allowedOrigins: parseList(process.env.SIDECAR_ALLOWED_ORIGINS, DEFAULT_ALLOWED_ORIGINS),
    allowedRequestHeaders: parseList(process.env.SIDECAR_ALLOWED_REQUEST_HEADERS, DEFAULT_ALLOWED_HEADERS),
    allowCredentials: parseBoolean(process.env.SIDECAR_ALLOW_CREDENTIALS, false),
    maxRequestBodyBytes: parseNumber(process.env.SIDECAR_MAX_REQUEST_BODY_BYTES, 1024 * 256),
    maxUpstreamBodyBytes: parseNumber(process.env.SIDECAR_MAX_UPSTREAM_BODY_BYTES, 1024 * 1024),
    requestTimeoutMs: parseNumber(process.env.SIDECAR_REQUEST_TIMEOUT_MS, 10000),
    allowedProxyMethods: parseList(process.env.SIDECAR_ALLOWED_PROXY_METHODS, DEFAULT_ALLOWED_METHODS),
    allowPrivateTargets: parseBoolean(process.env.SIDECAR_ALLOW_PRIVATE_TARGETS, false)
  }
}
