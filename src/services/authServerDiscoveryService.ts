/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata Discovery
 * https://tools.ietf.org/html/rfc8414
 */

import { HttpExchange, HttpRequestData, HttpResponseData } from "@/types/http"

export interface UrlComponents {
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

export type AuthServerDiscoveryMethod = 'RFC8414' | 'Mastodon' | 'Manual'


// RFC 8414 OAuth 2.0 Authorization Server Metadata
export interface AuthServerMetadata {
  // REQUIRED
  issuer: string // URL, https, no query/fragment

  // RECOMMENDED / common
  authorization_endpoint?: string          // URL
  token_endpoint?: string                  // URL
  jwks_uri?: string                        // URL for JWK Set
  registration_endpoint?: string           // URL

  // Supported capabilities (arrays of strings unless otherwise specified)
  scopes_supported?: string[]              // OAuth 2.0 scope values
  response_types_supported?: string[]      // e.g. ["code","token","code token"]
  response_modes_supported?: string[]      // e.g. ["query","fragment","form_post"]
  grant_types_supported?: string[]         // e.g. ["authorization_code","refresh_token"]

  // Token endpoint auth
  token_endpoint_auth_methods_supported?: string[] // e.g. ["client_secret_basic","private_key_jwt"]
  token_endpoint_auth_signing_alg_values_supported?: string[] // JWS algs for client auth JWT

  // JWS/JWE algorithm support for ID/Access tokens etc.
  id_token_signing_alg_values_supported?: string[]            //
  id_token_encryption_alg_values_supported?: string[]         //
  id_token_encryption_enc_values_supported?: string[]         //

  introspection_endpoint?: string                             // URL
  introspection_endpoint_auth_methods_supported?: string[]    //
  introspection_endpoint_auth_signing_alg_values_supported?: string[] //

  revocation_endpoint?: string                                // URL
  revocation_endpoint_auth_methods_supported?: string[]       //
  revocation_endpoint_auth_signing_alg_values_supported?: string[] //

  // General metadata
  service_documentation?: string          // URL to human‑readable docs
  ui_locales_supported?: string[]         // e.g. ["en-US","fr-FR"]
  op_policy_uri?: string                  // URL to policy page
  op_tos_uri?: string                     // URL to terms of service

  // Signed metadata bundle
  signed_metadata?: string                // JWT as compact string

  code_challenge_methods_supported: string[]

  features?: string[]

  // Extensibility: allow additional metadata parameters
  [extensions: string]: unknown
}

export interface AuthServerConfig {
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

type AuthServerDiscoveryRequest = HttpRequestData
type AuthServerDiscoveryResponse = HttpResponseData<AuthServerMetadata>

export interface AuthServerDiscoveryResult {
  discoveryMethod?: AuthServerDiscoveryMethod
  exchange: HttpExchange<AuthServerDiscoveryRequest, AuthServerDiscoveryResponse>
  // success: boolean
  // metadata?: AuthServerData
  // error?: string
  // serverInfo: ServerInfo
}

/**
 * Parse server identifier into components
 * Handles formats like:
 * - example.com
 * - https://example.com
 * - https://example.com:8080
 * - example.com:8080
 */
export function parseUrl(urlString: string): UrlComponents {
  const identifier_trimmed = urlString.trim()

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
 * Discover OAuth2 endpoints using Mastodon-compatible API structure
 * Fallback to Mastodon-style /api/v1/instance
 */
async function discoverMastodonEndpoints(serverInfo: UrlComponents): Promise<AuthServerDiscoveryResult> {
  console.debug(`Attempting Mastodon-compatible discovery for ${serverInfo.hostname}`)

  const instanceUrl = `${serverInfo.baseUrl}/api/v1/instance`
  const headers = { 'Accept': 'application/json' }

  try {
   const instanceResponse = await fetch(instanceUrl, {
      headers: headers
    })
    
    if (instanceResponse.ok) {
      // /api/v1/instance probe succeeded
      
      // Infer OAuth endpoints based on common Mastodon conventions
      const metadata: AuthServerMetadata = {
        issuer: serverInfo.baseUrl,
        authorization_endpoint: `${serverInfo.baseUrl}/oauth/authorize`,
        token_endpoint: `${serverInfo.baseUrl}/oauth/token`,
        // Not sure if Mastodon supports auth revocation
        //revocation_endpoint: `${serverInfo.baseUrl}/oauth/revoke`,
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
        scopes_supported: ['read', 'write', 'follow', 'push'],
        comment: "INFERRED FOR MASTODON"
      }
      
      console.debug(`Mastodon detecdted, OAuth endpoints for ${serverInfo.hostname} via Mastodon API`)
      
      // Store in sessionStorage for later use
      sessionStorage.setItem('oauth_server_metadata', JSON.stringify(metadata))
      sessionStorage.setItem('oauth_server_domain', serverInfo.hostname)
      
      return {
        discoveryMethod: 'Mastodon',
        exchange: {
          success: true,
          request: {
            url: instanceUrl,
            headers: headers,
            params: {}
          },
          response: {
            status_code: instanceResponse.status,
            headers: Object.fromEntries(instanceResponse.headers.entries()),
            payload: metadata
          }
        }
      }
    } else {
      return {
        discoveryMethod: 'Mastodon',
        exchange: {
          success: false,
          error: `Mastodon API returned HTTP ${instanceResponse.status}`,
          request: {
            url: instanceUrl,
            headers: headers,
          },
          response: {
            status_code: instanceResponse.status,
            headers: Object.fromEntries(instanceResponse.headers.entries()),
          }
        },
      }
    }
  } catch (error) {
    console.debug(`Mastodon API discovery failed for ${serverInfo.hostname}:`, error)
    return {
      discoveryMethod: 'Mastodon',
      exchange: {
        success: false,
        error: error instanceof Error ? error?.message : 'Mastodon-compatible discovery failed',
        request: {
          url: instanceUrl,
          headers: headers,
        }
      }
    }
  }
}

/**
 * Discover OAuth2 metadata using RFC 8414, with Mastodon fallback
 * https://tools.ietf.org/html/rfc8414
 */
export async function discoverServerMetadata(serverUrl: UrlComponents): Promise<AuthServerDiscoveryResult> {
  const wellKnownUrl = `${serverUrl.baseUrl}/.well-known/oauth-authorization-server`
  
  console.debug(`Discovering endpoints for ${serverUrl.hostname}`)
  console.debug(`RFC 8414 discovery URL: ${wellKnownUrl}`)
  
  try {
    const headers = { 'Accept': 'application/json' }

    // Try RFC 8414 OAuth Authorization Server Metadata
    const response = await fetch(wellKnownUrl, {
      headers: headers,
      redirect: 'follow'
    })
    
    if (response.ok) {
      const metadata: AuthServerMetadata = await response.json()
      
      // Check for required OAuth2 endpoints
      if (metadata.authorization_endpoint && metadata.token_endpoint) {
        
        console.debug(`Successfully discovered OAuth endpoints for ${serverUrl.hostname} via RFC 8414`)
        
        // Store in sessionStorage for later use
        sessionStorage.setItem('oauth_server_metadata', JSON.stringify(metadata))
        sessionStorage.setItem('oauth_server_domain', serverUrl.hostname)
        
        return {
          discoveryMethod: "RFC8414",
          //metadata: metadata,
          exchange: {
            success: true,
            request: {
              url: wellKnownUrl,
              headers: { Accept: "application/json" },
            },
            response: {
              status_code: response.status,
              headers: Object.fromEntries(response.headers.entries()),
              payload: metadata,
            },
          },
        }
      }
    }


    
  } catch (error) {
    console.debug(`RFC 8414 discovery failed for ${serverUrl.hostname}:`, error)
  }

  console.debug(`RFC 8414 discovery failed, attempting Mastodon-compatible fallback`)
  return await discoverMastodonEndpoints(serverUrl)
}

/**
 * Validate and normalize server configuration
 */
export function validateServerConfig(config: AuthServerConfig): ValidationResult {
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
