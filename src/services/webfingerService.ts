/**
 * WebFinger Service
 * Resolves fediverse handles (e.g., @user@server.com) to actor URIs
 * Following RFC 7033: https://tools.ietf.org/html/rfc7033
 * 
 * WebFinger is used to discover:
 * - Actor/profile URIs
 * - ActivityPub endpoints
 * - Other metadata about a user or resource
 */

export interface WebFingerLink {
  rel: string
  type?: string
  href?: string
  template?: string
  properties?: Record<string, string | null>
  titles?: Record<string, string>
}

export interface WebFingerData {
  subject: string
  aliases?: string[]
  properties?: Record<string, string | null>
  links?: WebFingerLink[]
}

export interface WebFingerResult {
  success: boolean
  actorUri?: string
  webfinger?: WebFingerData
  response?: Response
  error?: string
}

// Cache for WebFinger requests
const cache = new Map<string, { data: WebFingerData; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get cached data if available and not expired
 */
function getCached(key: string): WebFingerData | null {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  return null
}

/**
 * Set cache data
 */
function setCache(key: string, data: WebFingerData): void {
  cache.set(key, { data, timestamp: Date.now() })
}

/**
 * Parse a fediverse handle into username and domain
 * Handles formats like:
 * - @user@server.com
 * - user@server.com
 * - acct:user@server.com
 */
function parseHandle(handle: string): { username: string; domain: string } | null {
  // Remove leading @ if present
  let normalized = handle.trim()
  if (normalized.startsWith('@')) {
    normalized = normalized.substring(1)
  }
  
  // Remove acct: prefix if present
  if (normalized.startsWith('acct:')) {
    normalized = normalized.substring(5)
  }
  
  // Split on @
  const parts = normalized.split('@')
  if (parts.length !== 2) {
    return null
  }
  
  const [username, domain] = parts
  if (!username || !domain) {
    return null
  }
  
  return { username, domain }
}

/**
 * Build WebFinger resource URI from username and domain
 */
function buildResourceUri(username: string, domain: string): string {
  return `acct:${username}@${domain}`
}

/**
 * Fetch WebFinger information for a handle
 */
async function fetchWebFinger(domain: string, resource: string): Promise<WebFingerResult> {
  const cacheKey = `webfinger:${resource}`
  const cached = getCached(cacheKey)
  
  if (cached) {
    console.debug('Using cached WebFinger for', resource)
    const actorUri = extractActorUri(cached)
    return {
      success: true,
      actorUri,
      webfinger: cached
    }
  }
  
  try {
    // WebFinger endpoint is always at /.well-known/webfinger
    const url = new URL(`https://${domain}/.well-known/webfinger`)
    url.searchParams.set('resource', resource)
    
    console.debug('Fetching WebFinger from', url.toString())
    
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/jrd+json, application/json'
      }
    })
    
    if (!response.ok) {
      console.debug(`WebFinger fetch failed with HTTP ${response.status}`)
      return {
        success: false,
        error: `Failed to fetch WebFinger: HTTP ${response.status}`,
        response
      }
    }
    
    const data: WebFingerData = await response.json()
    
    // Basic validation
    if (!data.subject) {
      console.debug('Invalid WebFinger format: missing subject')
      return {
        success: false,
        error: 'Invalid WebFinger response: missing subject field',
        webfinger: data,
        response
      }
    }
    
    // Extract actor URI
    const actorUri = extractActorUri(data)
    
    if (!actorUri) {
      return {
        success: false,
        error: 'No ActivityPub actor URI found in WebFinger links',
        webfinger: data,
        response
      }
    }
    
    setCache(cacheKey, data)
    
    return {
      success: true,
      actorUri,
      webfinger: data,
      response
    }
  } catch (error) {
    console.debug('WebFinger fetch error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error during WebFinger lookup'
    }
  }
}

/**
 * Extract ActivityPub actor URI from WebFinger links
 * Looks for link with rel="self" and type="application/activity+json"
 */
function extractActorUri(webfinger: WebFingerData): string | undefined {
  if (!webfinger.links || webfinger.links.length === 0) {
    return undefined
  }
  
  // Look for ActivityPub profile link
  const actorLink = webfinger.links.find(link => 
    link.rel === 'self' && 
    link.type === 'application/activity+json' &&
    link.href
  )
  
  if (actorLink?.href) {
    return actorLink.href
  }
  
  // Fallback: look for any link with activity+json type
  const fallbackLink = webfinger.links.find(link =>
    link.type === 'application/activity+json' &&
    link.href
  )
  
  return fallbackLink?.href || undefined
}

/**
 * Resolve a fediverse handle to an actor URI
 * 
 * @param handle - The fediverse handle (e.g., "@user@server.com" or "user@server.com")
 * @returns WebFingerResult containing the actor URI, full WebFinger data, and response
 * 
 * @example
 * const result = await resolveHandle('@alice@mastodon.social')
 * if (result.success) {
 *   console.log('Actor URI:', result.actorUri)
 *   console.log('WebFinger:', result.webfinger)
 * }
 */
export async function resolveHandle(handle: string): Promise<WebFingerResult> {
  console.debug('Resolving handle:', handle)
  
  // Parse the handle
  const parsed = parseHandle(handle)
  if (!parsed) {
    return {
      success: false,
      error: 'Invalid handle format. Expected format: @user@domain.com or user@domain.com'
    }
  }
  
  const { username, domain } = parsed
  const resource = buildResourceUri(username, domain)
  
  // Fetch WebFinger information
  return await fetchWebFinger(domain, resource)
}

/**
 * Clear cache for a specific handle or all handles
 */
export function clearWebFingerCache(handle?: string): void {
  if (handle) {
    const parsed = parseHandle(handle)
    if (parsed) {
      const resource = buildResourceUri(parsed.username, parsed.domain)
      cache.delete(`webfinger:${resource}`)
    }
  } else {
    // Clear all cache
    cache.clear()
  }
}
