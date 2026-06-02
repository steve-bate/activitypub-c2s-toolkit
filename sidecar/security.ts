import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

const BLOCKED_PROTOCOLS = new Set(['http:', 'https:'])
const BLOCKED_HOSTNAMES = new Set(['localhost'])

function isPrivateIpv4(ipAddress: string): boolean {
  if (!isIP(ipAddress)) {
    return false
  }

  const segments = ipAddress.split('.').map(Number)
  if (segments.length !== 4) {
    return false
  }

  const [first, second] = segments
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second >= 168)
  )
}

function isPrivateIpv6(ipAddress: string): boolean {
  const normalized = ipAddress.toLowerCase()
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  )
}

function isPrivateIp(ipAddress: string): boolean {
  return isPrivateIpv4(ipAddress) || isPrivateIpv6(ipAddress)
}

export function validateRequestMethod(method: string, allowedMethods: string[]): string | null {
  const normalized = method.toUpperCase()
  return allowedMethods.includes(normalized) ? normalized : null
}

export async function validateTargetUrl(
  targetUrl: string,
  allowPrivateTargets: boolean
): Promise<URL> {
  let url: URL

  try {
    url = new URL(targetUrl)
  } catch {
    throw new Error('INVALID_URL')
  }

  if (!BLOCKED_PROTOCOLS.has(url.protocol)) {
    throw new Error('UNSUPPORTED_PROTOCOL')
  }

  if (allowPrivateTargets) {
    return url
  }

  const hostname = url.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
    throw new Error('TARGET_BLOCKED')
  }

  if (isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error('TARGET_BLOCKED')
  }

  const resolved = await lookup(hostname, { all: true })
  if (resolved.some((entry) => isPrivateIp(entry.address))) {
    throw new Error('TARGET_BLOCKED')
  }

  return url
}
