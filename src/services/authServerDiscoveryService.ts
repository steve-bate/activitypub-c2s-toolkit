/**
 * Comprehensive OAuth 2.0 Authorization Server Metadata Discovery
 * 
 * Implements RFC 8414 (OAuth 2.0 Authorization Server Metadata)
 * and RFC 9728 (Protected Resource Metadata & WWW-Authenticate resource_metadata)
 * 
 * Entry points:
 * - getAuthorizationServerMetadata(userInput) - main entry point, handles all input types
 * - getASMetadataFromHandle(handle) - from Fediverse handle
 * - getASMetadataFromActorUrl(actorUrl) - from ActivityPub actor URL
 * - getASMetadataFromResourceUrl(resourceUrl) - from protected resource URL
 * - getASMetadataFromASUrl(asUrl) - from Authorization Server URL
 */

import { HttpExchange, HttpRequestData, HttpResponseData } from "@/types/http"
import { resolveHandle } from './webfingerService'

export type AuthServerDiscoveryMethod = 'RFC8414' | 'RFC9728' | 'Mastodon' | 'Inferred' | 'Manual'

/** RFC 9728 Protected Resource Metadata */
export interface ProtectedResourceMetadata {
  resource: string
  authorization_servers?: string[]
  [extensions: string]: unknown
}

/** Result from protected resource and AS discovery */
interface ResourceDiscoveryResult {
  success: boolean
  actorOrigin: string | null
  protectedResourceMetadata: ProtectedResourceMetadata | undefined
  authServerOrigin: string | null
}

/** Result from AS metadata discovery */
interface ASMetadataResult {
  success: boolean
  metadata?: AuthServerMetadata
  error?: string
  exchange?: HttpExchange<AuthServerDiscoveryRequest, AuthServerDiscoveryResponse>
}

/** Main discovery result combining all discovery steps */
export interface AuthorizationServerDiscoveryResult {
  success: boolean
  authServerOrigin?: string
  authorizationServerMetadata?: AuthServerMetadata
  protectedResourceMetadata?: ProtectedResourceMetadata
  discoveryMethod?: AuthServerDiscoveryMethod
  error?: string
  exchange?: HttpExchange<AuthServerDiscoveryRequest, AuthServerDiscoveryResponse>
}


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

type AuthServerDiscoveryRequest = HttpRequestData
type AuthServerDiscoveryResponse = HttpResponseData<AuthServerMetadata>

/**
 * Build inferred Mastodon OAuth metadata
 */
function buildMastodonInferredMetadata(asOrigin: string): AuthServerMetadata {
  return {
    issuer: asOrigin,
    authorization_endpoint: `${asOrigin}/oauth/authorize`,
    token_endpoint: `${asOrigin}/oauth/token`,
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    scopes_supported: ['read', 'write', 'follow', 'push'],
    '$comment': 'Inferred from Mastodon /api/v1/instance HEAD probe'
  }
}

/**
 * Detect Mastodon-compatible server and infer OAuth endpoints
 * Probe uses HEAD /api/v1/instance as requested
 */
async function discoverMastodonASMetadata(asOrigin: string): Promise<ASMetadataResult> {
  const instanceUrl = `${asOrigin}/api/v1/instance`
  const headers = { 'Accept': 'application/json' }

  console.debug(`[discoverMastodonASMetadata] Probing ${instanceUrl} (HEAD)`)

  try {
    const response = await fetch(instanceUrl, {
      method: 'HEAD',
      headers,
      redirect: 'follow'
    })

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        exchange: {
          success: false,
          error: `Mastodon instance probe failed with HTTP ${response.status}`,
          request: { url: instanceUrl, headers },
          response: {
            status_code: response.status,
            status_text: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
          }
        }
      }
    }

    const metadata = buildMastodonInferredMetadata(asOrigin)
    return {
      success: true,
      metadata,
      exchange: {
        success: true,
        request: { url: instanceUrl, headers },
        response: {
          status_code: response.status,
          status_text: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          payload: metadata
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      exchange: {
        success: false,
        error: error instanceof Error ? error.message : 'Mastodon probe failed',
        request: { url: instanceUrl, headers }
      }
    }
  }
}

// ============================================================================
// HELPER: Check if a string looks like a Fediverse handle
// ============================================================================
function looksLikeWebfingerHandle(input: string): boolean {
  const trimmed = input.trim()
  // Matches: user@domain, @user@domain, acct:user@domain
  return /^(@|acct:)?[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)
}

// ============================================================================
// HELPER: Check if a string looks like an HTTP(S) URL
// ============================================================================
function looksLikeHttpUrl(input: string): boolean {
  try {
    const url = new URL(input)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

// ============================================================================
// HELPER: Extract origin from a URL
// ============================================================================
function originOf(urlString: string): string {
  try {
    const url = new URL(urlString)
    return url.origin
  } catch {
    return urlString
  }
}

// ============================================================================
// HELPER: Normalize input string to resource URL
// ============================================================================
// Returns a resource URL, or null if input cannot be resolved
async function normalizeToResourceUrl(input: string): Promise<string | null> {
  const trimmed = input.trim()

  if (looksLikeWebfingerHandle(trimmed)) {
    console.debug(`[normalizeToResourceUrl] Input looks like handle: ${trimmed}`)
    try {
      const actorUrl = await resolveHandle(trimmed)
      if (actorUrl) {
        console.debug(`[normalizeToResourceUrl] Resolved handle to actor URL: ${actorUrl}`)
        return actorUrl
      } else {
        console.debug(`[normalizeToResourceUrl] Failed to resolve handle: ${trimmed}`)
        return null
      }
    } catch (error) {
      console.debug(`[normalizeToResourceUrl] Error resolving handle:`, error)
      return null
    }
  }

  if (looksLikeHttpUrl(trimmed)) {
    console.debug(`[normalizeToResourceUrl] Input looks like HTTP URL: ${trimmed}`)
    return trimmed
  }

  console.debug(`[normalizeToResourceUrl] Input is unresolvable: ${trimmed}`)
  return null
}

// ============================================================================
// HELPER: Parse WWW-Authenticate header
// RFC 7235 and RFC 6750
// ============================================================================
interface WwwAuthChallenge {
  scheme: string
  params: Record<string, string>
}

function parseWwwAuthenticate(headerValue: string | null | undefined): WwwAuthChallenge[] {
  if (!headerValue) return []

  const challenges: WwwAuthChallenge[] = []
  
  // Split by comma, but be careful about commas inside quoted values
  // Simple regex-based split that handles quoted strings
  const parts = headerValue.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)

  for (const part of parts) {
    const trimmed = part.trim()
    const spaceIndex = trimmed.indexOf(' ')
    
    if (spaceIndex === -1) {
      // Scheme only, no params
      challenges.push({
        scheme: trimmed,
        params: {}
      })
      continue
    }

    const scheme = trimmed.substring(0, spaceIndex)
    const paramString = trimmed.substring(spaceIndex + 1)
    const params: Record<string, string> = {}

    // Parse key="value" pairs
    const paramRegex = /(\w+)="([^"]*)"/g
    let match
    while ((match = paramRegex.exec(paramString)) !== null) {
      params[match[1]] = match[2]
    }

    challenges.push({ scheme, params })
  }

  return challenges
}

// ============================================================================
// HELPER: Extract resource_metadata URL from WWW-Authenticate challenge
// ============================================================================
function getResourceMetadataUrl(challenges: WwwAuthChallenge[]): string | null {
  for (const challenge of challenges) {
    if (challenge.params['resource_metadata']) {
      return challenge.params['resource_metadata']
    }
  }
  return null
}

// ============================================================================
// HELPER: Fetch and validate protected resource metadata (RFC 9728)
// ============================================================================
async function fetchProtectedResourceMetadata(
  resourceMetadataUrl: string,
  requestedResourceUrl: string
): Promise<ProtectedResourceMetadata | null> {
  try {
    console.debug(`[fetchProtectedResourceMetadata] Fetching from ${resourceMetadataUrl}`)

    const response = await fetch(resourceMetadataUrl, {
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      console.debug(`[fetchProtectedResourceMetadata] HTTP ${response.status}`)
      return null
    }

    const metadata: ProtectedResourceMetadata = await response.json()

    // RFC 9728: resource value MUST match the URL we requested
    if (metadata.resource !== requestedResourceUrl) {
      console.error(
        `[fetchProtectedResourceMetadata] Resource mismatch: expected ${requestedResourceUrl}, got ${metadata.resource}`
      )
      return null
    }

    console.debug(`[fetchProtectedResourceMetadata] Successfully fetched for ${requestedResourceUrl}`)
    return metadata
  } catch (error) {
    console.debug(`[fetchProtectedResourceMetadata] Error:`, error)
    return null
  }
}

// ============================================================================
// HELPER: Get Authorization Server origin from protected resource metadata
// ============================================================================
function getAuthServerOriginFromPRMetadata(prMeta: ProtectedResourceMetadata): string | null {
  // RFC 9728: authorization_servers is an array of AS identifiers
  const authServers = prMeta.authorization_servers
  if (!authServers || authServers.length === 0) {
    return null
  }

  // Use the first authorization server
  const origin = originOf(authServers[0])
  console.debug(`[getAuthServerOriginFromPRMetadata] Got AS origin: ${origin}`)
  return origin
}

// ============================================================================
// HELPER: Try to get protected resource metadata from WWW-Authenticate header
// ============================================================================
async function tryGetProtectedResourceMetadata(
  wwwAuthHeader: string | null,
  resourceUrl: string
): Promise<ProtectedResourceMetadata | null> {
  const wwwAuth = parseWwwAuthenticate(wwwAuthHeader)
  const metadataUrl = getResourceMetadataUrl(wwwAuth)
  
  if (!metadataUrl) {
    return null
  }
  
  return await fetchProtectedResourceMetadata(metadataUrl, resourceUrl)
}

// ============================================================================
// HELPER: Populate result from protected resource metadata
// ============================================================================
function setResultFromProtectedResourceMetadata(
  result: ResourceDiscoveryResult,
  metadata: ProtectedResourceMetadata
): void {
  result.success = true
  result.protectedResourceMetadata = metadata
  result.authServerOrigin = getAuthServerOriginFromPRMetadata(metadata)
}

// ============================================================================
// HELPER: Check if response looks like an ActivityPub actor
// ============================================================================
// Standard ActivityPub actor types per AS2 vocabulary
const ACTOR_TYPES = ['Person', 'Organization', 'Service', 'Application', 'Group']

function isActivityPubActor(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) {
    return false
  }
  const record = obj as Record<string, unknown>
  const type = record['type']

  if (typeof type === 'string') {
    return ACTOR_TYPES.includes(type)
  }

  if (Array.isArray(type)) {
    return type.some(t => typeof t === 'string' && ACTOR_TYPES.includes(t))
  }

  return false
}

// ============================================================================
// IMPL: Discover protected resource + AS from a URL
// ============================================================================
// This works for actor URLs or any resource server URL
async function discoverProtectedResourceAndAS(resourceUrl: string): Promise<ResourceDiscoveryResult> {
  const result: ResourceDiscoveryResult = {
    success: false,
    actorOrigin: null,
    protectedResourceMetadata: undefined,
    authServerOrigin: null
  }

  console.debug(`[discoverProtectedResourceAndAS] Starting for ${resourceUrl}`)

  try {
    // Fetch the resource without credentials
    const response = await fetch(resourceUrl, {
      headers: {
        'Accept': 'application/activity+json, application/ld+json, application/json, */*'
      }
    })

    if (response.status === 401) {
      console.debug(`[discoverProtectedResourceAndAS] Got 401, checking for protected resource metadata`)

      const prMetadata = await tryGetProtectedResourceMetadata(
        response.headers.get('WWW-Authenticate'),
        resourceUrl
      )
      
      if (prMetadata) {
        setResultFromProtectedResourceMetadata(result, prMetadata)
        return result
      }

      // 401 with no usable resource_metadata - no AS info discovered
      result.actorOrigin = originOf(resourceUrl)
      return result
    }

    if (response.ok) {
      console.debug(`[discoverProtectedResourceAndAS] Got 2xx response`)

      const body = await response.json().catch(() => null)

      if (isActivityPubActor(body)) {
        console.debug(`[discoverProtectedResourceAndAS] Response is an ActivityPub actor`)

        const actorOrigin = originOf(resourceUrl)
        result.actorOrigin = actorOrigin

        // Try the inbox as another protected resource
        const inboxUrl = (body as Record<string, unknown>)['inbox'] as string | undefined
        if (inboxUrl) {
          console.debug(`[discoverProtectedResourceAndAS] Found inbox URL, checking for protected resource metadata`)

          const inboxResp = await fetch(inboxUrl, {
            headers: { 'Accept': 'application/activity+json, application/json' }
          })

          if (inboxResp.status === 401) {
            const prMetadata = await tryGetProtectedResourceMetadata(
              inboxResp.headers.get('WWW-Authenticate'),
              inboxUrl
            )
            
            if (prMetadata) {
              setResultFromProtectedResourceMetadata(result, prMetadata)
              return result
            }
          }

          if (inboxResp.ok) {
            // Inferred: assume inbox origin == AS origin
            const inboxOrigin = originOf(inboxUrl)
            console.debug(`[discoverProtectedResourceAndAS] Inbox responded 2xx, using inbox origin as AS: ${inboxOrigin}`)

            result.success = true
            result.authServerOrigin = inboxOrigin
            return result
          }
        }

        // No inbox metadata found, fall back to actor origin as AS origin
        result.success = true
        return result
      } else {
        // Not an actor: treat as protected resource, check WWW-Authenticate
        console.debug(`[discoverProtectedResourceAndAS] Response is not an actor, checking for protected resource metadata`)

        const prMetadata = await tryGetProtectedResourceMetadata(
          response.headers.get('WWW-Authenticate'),
          resourceUrl
        )
        
        if (prMetadata) {
          setResultFromProtectedResourceMetadata(result, prMetadata)
          return result
        }

        result.success = true
        result.actorOrigin = originOf(resourceUrl)
        return result
      }
    } else {
      // Any other status: still usable for fallback
      result.success = true
      result.actorOrigin = originOf(resourceUrl)
      return result
    }
  } catch (error) {
    console.debug(`[discoverProtectedResourceAndAS] Error:`, error)
    result.success = true // Allow fallback even on network errors
    result.actorOrigin = originOf(resourceUrl)
    return result
  }
}

// ============================================================================
// HELPER: Validate Authorization Server metadata
// ============================================================================
function isValidASMetadata(meta: unknown, expectedOrigin: string): meta is AuthServerMetadata {
  if (typeof meta !== 'object' || meta === null) {
    return false
  }

  const record = meta as Record<string, unknown>

  // REQUIRED by RFC 8414: issuer must be present and be an absolute URL
  const issuer = record['issuer']
  if (typeof issuer !== 'string' || !isAbsoluteUrl(issuer)) {
    console.debug(`[isValidASMetadata] Invalid or missing issuer: ${String(issuer)}`)
    return false
  }

  // Optionally verify issuer origin matches expected origin
  const issuerOrigin = originOf(issuer)
  if (issuerOrigin !== expectedOrigin) {
    console.debug(
      `[isValidASMetadata] Issuer origin mismatch: expected ${expectedOrigin}, got ${issuerOrigin}`
    )
    // Note: We could be stricter here, but for now we accept it
    // (some servers may use different issuers)
  }

  return true
}

// ============================================================================
// HELPER: Check if string is an absolute URL
// ============================================================================
function isAbsoluteUrl(urlString: unknown): boolean {
  if (typeof urlString !== 'string') {
    return false
  }
  try {
    const url = new URL(urlString)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

// ============================================================================
// IMPL: Discover AS metadata for an origin (RFC 8414)
// ============================================================================
async function discoverASMetadata(asOrigin: string): Promise<ASMetadataResult> {
  console.debug(`[discoverASMetadata] Starting for origin: ${asOrigin}`)

  const wellKnownUrl = `${asOrigin}/.well-known/oauth-authorization-server`
  const headers = { 'Accept': 'application/json' }

  try {
    const response = await fetch(wellKnownUrl, {
      headers,
      redirect: 'follow'
    })

    if (response.ok) {
      const metadata = await response.json()

      if (isValidASMetadata(metadata, asOrigin)) {
        console.debug(`[discoverASMetadata] Successfully discovered metadata for ${asOrigin}`)
        return {
          success: true,
          metadata,
          exchange: {
            success: true,
            request: { url: wellKnownUrl, headers },
            response: {
              status_code: response.status,
              status_text: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              payload: metadata
            }
          }
        }
      } else {
        console.debug(`[discoverASMetadata] Invalid metadata structure for ${asOrigin}`)
        return {
          success: false,
          error: 'Invalid metadata structure',
          exchange: {
            success: false,
            error: 'Invalid metadata structure',
            request: { url: wellKnownUrl, headers },
            response: {
              status_code: response.status,
              status_text: response.statusText,
              headers: Object.fromEntries(response.headers.entries())
            }
          }
        }
      }
    } else {
      console.debug(`[discoverASMetadata] HTTP ${response.status} from ${wellKnownUrl}`)
      return {
        success: false,
        error: `HTTP ${response.status}`,
        exchange: {
          success: false,
          error: `HTTP ${response.status}`,
          request: { url: wellKnownUrl, headers },
          response: {
            status_code: response.status,
            status_text: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
          }
        }
      }
    }
  } catch (error) {
    console.debug(`[discoverASMetadata] Error:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      exchange: {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        request: { url: wellKnownUrl, headers }
      }
    }
  }
}

// ============================================================================
// MAIN: Comprehensive Authorization Server metadata discovery
// ============================================================================
export async function getAuthorizationServerMetadata(
  userInput: string
): Promise<AuthorizationServerDiscoveryResult> {
  console.debug(`[getAuthorizationServerMetadata] Starting with input: "${userInput}"`)

  // Step 1: Normalize input to resource URL
  const resourceUrl = await normalizeToResourceUrl(userInput)
  if (!resourceUrl) {
    console.error(`[getAuthorizationServerMetadata] Could not normalize input to resource URL`)
    return {
      success: false,
      error: 'Unresolvable input: must be a Fediverse handle or HTTP(S) URL'
    }
  }

  console.debug(`[getAuthorizationServerMetadata] Normalized to resource URL: ${resourceUrl}`)

  // Step 2: Try to discover protected resource + AS metadata
  const rsResult = await discoverProtectedResourceAndAS(resourceUrl)

  if (rsResult.success && rsResult.authServerOrigin) {
    console.debug(`[getAuthorizationServerMetadata] Found AS origin via protected resource: ${rsResult.authServerOrigin}`)

    const asMetadata = await discoverASMetadata(rsResult.authServerOrigin)
    if (asMetadata.success && asMetadata.metadata) {
      console.debug(`[getAuthorizationServerMetadata] Successfully discovered AS metadata via RFC 9728 path`)

      return {
        success: true,
        authServerOrigin: rsResult.authServerOrigin,
        authorizationServerMetadata: asMetadata.metadata,
        protectedResourceMetadata: rsResult.protectedResourceMetadata,
        discoveryMethod: 'RFC9728',
        exchange: asMetadata.exchange
      }
    }

    const mastodonMetadata = await discoverMastodonASMetadata(rsResult.authServerOrigin)
    if (mastodonMetadata.success && mastodonMetadata.metadata) {
      console.debug(`[getAuthorizationServerMetadata] Successfully inferred Mastodon metadata via protected resource path`)

      return {
        success: true,
        authServerOrigin: rsResult.authServerOrigin,
        authorizationServerMetadata: mastodonMetadata.metadata,
        protectedResourceMetadata: rsResult.protectedResourceMetadata,
        discoveryMethod: 'Mastodon',
        exchange: mastodonMetadata.exchange
      }
    }
  }

  // Step 3: Fallback: infer AS origin from actor origin or resource origin
  const fallbackOrigin = rsResult.actorOrigin || originOf(resourceUrl)
  console.debug(`[getAuthorizationServerMetadata] Trying fallback AS origin: ${fallbackOrigin}`)

  const asMetadata = await discoverASMetadata(fallbackOrigin)
  if (asMetadata.success && asMetadata.metadata) {
    console.debug(`[getAuthorizationServerMetadata] Successfully discovered AS metadata via fallback`)

    return {
      success: true,
      authServerOrigin: fallbackOrigin,
      authorizationServerMetadata: asMetadata.metadata,
      protectedResourceMetadata: rsResult.protectedResourceMetadata,
      discoveryMethod: rsResult.authServerOrigin ? 'RFC9728' : 'Inferred',
      exchange: asMetadata.exchange
    }
  }

  const mastodonMetadata = await discoverMastodonASMetadata(fallbackOrigin)
  if (mastodonMetadata.success && mastodonMetadata.metadata) {
    console.debug(`[getAuthorizationServerMetadata] Successfully inferred Mastodon metadata via fallback`)

    return {
      success: true,
      authServerOrigin: fallbackOrigin,
      authorizationServerMetadata: mastodonMetadata.metadata,
      protectedResourceMetadata: rsResult.protectedResourceMetadata,
      discoveryMethod: 'Mastodon',
      exchange: mastodonMetadata.exchange
    }
  }

  console.error(`[getAuthorizationServerMetadata] All discovery paths failed`)
  return {
    success: false,
    error: 'Could not discover authorization server metadata',
    exchange: mastodonMetadata.exchange ?? asMetadata.exchange
  }
}
