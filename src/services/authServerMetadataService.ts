/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata Discovery
 * https://tools.ietf.org/html/rfc8414
 */

export interface ServerInfo {
  baseUrl: string
  host: string
  hostname: string
  port: string
  scheme: string
}

export interface OAuthFeatures {
  scopesSupported: string[]
  responseTypesSupported: string[]
  grantTypesSupported: string[]
  codeChallengeMethodsSupported: string[]
  tokenEndpointAuthMethodsSupported: string[]
}

export type DiscoveryMethod = 'RFC8414' | 'Mastodon' | 'Manual'

export interface AuthorizationServerMetadata {
  links: {
    oauth_authorize: string
    oauth_token: string
    oauth_revoke: string | null
    oauth_introspect: string | null
    api_base: string
    registration_endpoint: string | null
  }
  issuer: string
  version: string
  features: OAuthFeatures
  raw: object
  discoveryMethod?: DiscoveryMethod
}

export interface DiscoveryResult {
  success: boolean
  metadata?: AuthorizationServerMetadata
  error?: string
  serverInfo: ServerInfo
  discoveryMethod?: DiscoveryMethod
}

export interface ServerConfig {
  identifier?: string
  authType?: string
  oauth2?: {
    clientId?: string
    redirectUri?: string
  }
}

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
}

/**
 * Parse server identifier into components
 * Handles formats like:
 * - example.com
 * - https://example.com
 * - https://example.com:8080
 * - example.com:8080
 */
export function parseServerIdentifier(identifier: string): ServerInfo {
  const identifier_trimmed = (identifier || '').trim()
  
  if (!identifier_trimmed) {
    return {
      baseUrl: '',
      host: '',
      hostname: '',
      port: '',
      scheme: ''
    }
  }
  
  // If it already has a scheme, use it as-is
  if (identifier_trimmed.match(/^https?:\/\//)) {
    const url = new URL(identifier_trimmed)
    return {
      baseUrl: identifier_trimmed,
      host: url.host,
      hostname: url.hostname,
      port: url.port,
      scheme: url.protocol.replace(':', '')
    }
  }
  
  // Otherwise, assume HTTPS
  const baseUrl = `https://${identifier_trimmed}`
  const url = new URL(baseUrl)
  return {
    baseUrl,
    host: url.host,
    hostname: url.hostname,
    port: url.port,
    scheme: 'https'
  }
}

/**
 * Extract OAuth features from metadata
 */
function extractOAuthFeatures(data: Record<string, unknown>): OAuthFeatures {
  return {
    scopesSupported: (data.scopes_supported as string[]) || [],
    responseTypesSupported: (data.response_types_supported as string[]) || [],
    grantTypesSupported: (data.grant_types_supported as string[]) || [],
    codeChallengeMethodsSupported: (data.code_challenge_methods_supported as string[]) || [],
    tokenEndpointAuthMethodsSupported: (data.token_endpoint_auth_methods_supported as string[]) || []
  }
}

/**
 * Discover OAuth2 endpoints using Mastodon-compatible API structure
 * Fallback to Mastodon-style /api/v1/instance
 */
async function discoverMastodonEndpoints(serverInfo: ServerInfo): Promise<DiscoveryResult> {
  console.debug(`Attempting Mastodon-compatible discovery for ${serverInfo.hostname}`)
  
  try {
    const instanceResponse = await fetch(`${serverInfo.baseUrl}/api/v1/instance`, {
      headers: { 'Accept': 'application/json' }
    })
    
    if (instanceResponse.ok) {
      const data = await instanceResponse.json()
      
      // Infer OAuth endpoints based on common Mastodon conventions
      const metadata: AuthorizationServerMetadata = {
        links: {
          oauth_authorize: `${serverInfo.baseUrl}/oauth/authorize`,
          oauth_token: `${serverInfo.baseUrl}/oauth/token`,
          oauth_revoke: `${serverInfo.baseUrl}/oauth/revoke`,
          oauth_introspect: null, // Mastodon doesn't support introspection
          api_base: serverInfo.baseUrl,
          registration_endpoint: `${serverInfo.baseUrl}/api/v1/apps`
        },
        issuer: serverInfo.baseUrl,
        version: data.version || 'unknown',
        features: {
          scopesSupported: ['read', 'write', 'follow', 'push'],
          responseTypesSupported: ['code'],
          grantTypesSupported: ['authorization_code'],
          codeChallengeMethodsSupported: ['S256'],
          tokenEndpointAuthMethodsSupported: ['client_secret_post', 'client_secret_basic']
        },
        raw: data,
        discoveryMethod: 'Mastodon'
      }
      
      console.debug(`Discovered OAuth endpoints for ${serverInfo.hostname} via Mastodon API`)
      
      // Store in sessionStorage for later use
      sessionStorage.setItem('oauth_server_metadata', JSON.stringify(metadata))
      sessionStorage.setItem('oauth_server_domain', serverInfo.hostname)
      
      return {
        success: true,
        metadata,
        serverInfo,
        discoveryMethod: 'Mastodon'
      }
    } else {
      return {
        success: false,
        error: `Mastodon API returned HTTP ${instanceResponse.status}`,
        serverInfo
      }
    }
  } catch (error) {
    console.debug(`Mastodon API discovery failed for ${serverInfo.hostname}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error?.message : 'Mastodon-compatible discovery failed',
      serverInfo
    }
  }
}

/**
 * Discover OAuth2 metadata using RFC 8414, with Mastodon fallback
 * https://tools.ietf.org/html/rfc8414
 */
export async function discoverServerMetadata(identifier: string): Promise<DiscoveryResult> {
  const serverInfo = parseServerIdentifier(identifier)
  const wellKnownUrl = `${serverInfo.baseUrl}/.well-known/oauth-authorization-server`
  
  console.debug(`Discovering endpoints for ${serverInfo.hostname}`)
  console.debug(`RFC 8414 discovery URL: ${wellKnownUrl}`)
  
  try {
    // Try RFC 8414 OAuth Authorization Server Metadata
    const response = await fetch(wellKnownUrl, {
      headers: { 'Accept': 'application/json' },
      redirect: 'follow'
    })
    
    if (response.ok) {
      const data = await response.json()
      
      // Check for required OAuth2 endpoints
      if (data.authorization_endpoint && data.token_endpoint) {
        const metadata: AuthorizationServerMetadata = {
          links: {
            oauth_authorize: data.authorization_endpoint,
            oauth_token: data.token_endpoint,
            oauth_revoke: data.revocation_endpoint || null,
            oauth_introspect: data.introspection_endpoint || null,
            api_base: data.resource_server || serverInfo.baseUrl,
            registration_endpoint: data.registration_endpoint || null
          },
          issuer: data.issuer || serverInfo.baseUrl,
          version: data.server_version || 'unknown',
          features: extractOAuthFeatures(data),
          raw: data, // Store raw response for debugging
          discoveryMethod: 'RFC8414'
        }
        
        console.debug(`Successfully discovered OAuth endpoints for ${serverInfo.hostname} via RFC 8414`)
        
        // Store in sessionStorage for later use
        sessionStorage.setItem('oauth_server_metadata', JSON.stringify(metadata))
        sessionStorage.setItem('oauth_server_domain', serverInfo.hostname)
        
        return {
          success: true,
          metadata,
          serverInfo,
          discoveryMethod: 'RFC8414'
        }
      }
    }
    
    // RFC 8414 failed, try Mastodon-compatible fallback
    console.debug(`RFC 8414 discovery not available, attempting Mastodon-compatible fallback`)
    return await discoverMastodonEndpoints(serverInfo)
    
  } catch (error) {
    console.debug(`RFC 8414 discovery failed for ${serverInfo.hostname}:`, error)
    
    // Try Mastodon-compatible fallback
    console.debug(`Attempting Mastodon-compatible fallback after RFC 8414 error`)
    return await discoverMastodonEndpoints(serverInfo)
  }
}

/**
 * Validate and normalize server configuration
 */
export function validateServerConfig(config: ServerConfig): ValidationResult {
  const errors: Record<string, string> = {}
  
  if (!config.identifier || !config.identifier.trim()) {
    errors.identifier = 'Server identifier is required'
  }
  
  if (config.authType === 'oauth2') {
    if (!config.oauth2?.clientId?.trim()) {
      errors.clientId = 'Client ID is required'
    }
    if (!config.oauth2?.redirectUri?.trim()) {
      errors.redirectUri = 'Redirect URI is required'
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}
