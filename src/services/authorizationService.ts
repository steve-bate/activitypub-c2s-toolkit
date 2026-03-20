/**
 * OAuth 2.0 Authorization Code Flow with PKCE
 * RFC 6749 - The OAuth 2.0 Authorization Framework
 * RFC 7636 - Proof Key for Code Exchange (PKCE)
 */

import { HttpExchange, HttpRequestData, HttpResponseData } from '@/types/http'
import type { AuthServerMetadata } from './authServerDiscoveryService'
import { useServerStore } from '@/stores/serverStore'

export interface ClientConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string
}
/*export*/  interface AuthConfig {
  serverOrigin: string
  serverMetadata: AuthServerMetadata
  state?: string
  clientConfig: ClientConfig
}

/*export*/ interface TokenExchangeConfig {
  serverOrigin: string
  authCode: string
  authServerMetadata: AuthServerMetadata
  clientConfig?: ClientConfig
}

/*export*/ interface TokenExchangeParams {
  grant_type: string;
  redirect_uri: string;
  client_id: string;
  code: string;
  code_verifier?: string;
}

export interface TokenResponsePayload {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  me?: string 
}

export type TokenExchangeRequest = HttpRequestData<TokenExchangeParams>
export type TokenExchangeResponse = HttpResponseData<TokenResponsePayload>
export type TokenExchangeHttpExchange = HttpExchange<TokenExchangeRequest, TokenExchangeResponse>

/*export*/ interface TokenRefreshParams {
  grant_type: string;
  refresh_token: string;
  client_id: string;
}

export type TokenRefreshRequest = HttpRequestData<TokenRefreshParams>
export type TokenRefreshResponse = HttpResponseData<TokenResponsePayload>
export type TokenRefreshHttpExchange = HttpExchange<TokenRefreshRequest, TokenRefreshResponse>

/*export*/ interface TokenRevocationParams {
  token: string;
  token_type_hint: string;
  client_id: string;
}

interface TokenRevocationResponsePayload {
  revoked: true;
  revoked_at: string;
  access_token?: string; // Should be undefined
}

export type TokenRevocationRequest = HttpRequestData<TokenRevocationParams>
export type TokenRevocationResponse = HttpResponseData<TokenRevocationResponsePayload>
export type TokenRevocationHttpExchange = HttpExchange<TokenRevocationRequest, TokenRevocationResponse>

/**
 * Generate a cryptographically secure random string for PKCE code verifier
 * Must be 43-128 characters long
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  window.crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Generate a code challenge from a code verifier for PKCE
 * Uses SHA-256 hash algorithm
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await window.crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

/**
 * Base64-URL encode (without padding)
 */
function base64UrlEncode(array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...array))
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Generate a random state parameter for CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(16)
  window.crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Store PKCE and state parameters in sessionStorage
 */
function storePKCEParameters(serverId: string, codeVerifier: string, state: string): void {
  sessionStorage.setItem(`pkce_verifier_${serverId}`, codeVerifier)
  sessionStorage.setItem(`oauth_state_${serverId}`, state)
}

/**
 * Retrieve and validate PKCE and state parameters from sessionStorage
 */
function retrievePKCEParameters(serverId: string): { codeVerifier: string; state: string } | null {
  const codeVerifier = sessionStorage.getItem(`pkce_verifier_${serverId}`)
  const state = sessionStorage.getItem(`oauth_state_${serverId}`)
  
  if (!codeVerifier || !state) {
    return null
  }
  
  return { codeVerifier, state }
}

/**
 * Clear PKCE and state parameters from sessionStorage
 */
function clearPKCEParameters(serverId: string): void {
  sessionStorage.removeItem(`pkce_verifier_${serverId}`)
  sessionStorage.removeItem(`oauth_state_${serverId}`)
}

/**
 * Check if the server supports PKCE based on metadata
 */
function supportsPKCE(metadata: AuthServerMetadata): boolean {
  return metadata.code_challenge_methods_supported?.includes('S256') ||
         metadata.code_challenge_methods_supported?.includes('plain')
}

/**
 * Initiate the OAuth 2.0 authorization code flow
 * Redirects the user to the authorization server for consent
 * 
 * @param options Authorization options including server metadata and OAuth2 config
 */
export async function initiateAuthorizationFlow(options: AuthConfig): Promise<void> {
  const {
    serverOrigin: serverId,
    serverMetadata: authServerMetadata,
    clientConfig,
    state: providedState,
  } = options;
  
  console.debug(`Initiating OAuth authorization flow for server ${serverId}`)
  
  if (!authServerMetadata.authorization_endpoint) {
    throw new Error('Authorization endpoint not found in server metadata')
  }
  
  if (!clientConfig.clientId) {
    throw new Error('Client ID not configured')
  }
  
  if (!clientConfig.redirectUri) {
    throw new Error('Redirect URI not configured')
  }
  
  // Generate or use provided state parameter
  const state = providedState || generateState()
  
  // Build authorization URL
  const authUrl = new URL(authServerMetadata.authorization_endpoint)
  authUrl.searchParams.append('client_id', clientConfig.clientId)
  authUrl.searchParams.append('redirect_uri', clientConfig.redirectUri)
  authUrl.searchParams.append('response_type', 'code')
  authUrl.searchParams.append('state', state)
  
  if (clientConfig.scopes) {
    authUrl.searchParams.append('scope', clientConfig.scopes)
    // Check for Mastodon case
    if (authServerMetadata['app_registration_endpoint']) {
      console.log("Using Mastodon scopes parameter instead of scope")
      authUrl.searchParams.delete('scope')
      authUrl.searchParams.set('scopes', clientConfig.scopes)
    }
  }
  
  // Add PKCE parameters if supported
  if (supportsPKCE(authServerMetadata)) {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    
    authUrl.searchParams.append('code_challenge', codeChallenge)
    authUrl.searchParams.append('code_challenge_method', 'S256')
    
    // Store verifier and state for later use
    storePKCEParameters(serverId, codeVerifier, state)
    
    console.debug('Using PKCE for authorization flow')
  } else {
    // Store state even without PKCE
    sessionStorage.setItem(`oauth_state_${serverId}`, state)
    console.debug('PKCE not supported by server, proceeding without it')
  }
  
  console.debug(`Redirecting to authorization URL: ${authUrl.toString()}`)
  
  // Store serverId for callback processing
  sessionStorage.setItem('oauth_current_server_id', serverId)
  
  // Redirect to authorization server
  window.location.href = authUrl.toString()
}

/**
 * Parse the authorization callback URL and extract code and state
 * 
 * @param callbackUrl The full callback URL (defaults to current window location)
 * @returns Object containing code and state, or error information
 */
export function parseAuthorizationCallback(
  callbackUrl: string = window.location.href
): { code?: string; state?: string; error?: string; errorDescription?: string } {
  const url = new URL(callbackUrl)
  const params = new URLSearchParams(url.search)
  
  return {
    code: params.get('code') || undefined,
    state: params.get('state') || undefined,
    error: params.get('error') || undefined,
    errorDescription: params.get('error_description') || undefined
  }
}

/**
 * Validate the state parameter from the callback
 * 
 * @param serverId Server identifier
 * @param receivedState State parameter from callback
 * @returns true if state is valid, false otherwise
 */
export function validateState(serverId: string, receivedState: string): boolean {
  const storedState = sessionStorage.getItem(`oauth_state_${serverId}`)
  
  if (!storedState) {
    console.error('No stored state found for validation')
    return false
  }
  
  if (storedState !== receivedState) {
    console.error('State mismatch: possible CSRF attack')
    return false
  }
  
  return true
}

/**
 * Exchange authorization code for access token
 * 
 * @param options Token exchange options
 * @returns Token exchange result with token response or error
 */
export async function exchangeCodeForToken(
  options: TokenExchangeConfig
): Promise<TokenExchangeHttpExchange> {
  const { serverOrigin: serverId, authCode, authServerMetadata, clientConfig } = options
  
  console.debug(`Exchanging authorization code for access token (server ${serverId})`)
  
  if (!authServerMetadata.token_endpoint) {
    return {
      success: false,
      error: 'Token endpoint not found in server metadata'
    }
  }

  if (!clientConfig?.clientId) {
    return {
      success: false,
      error: 'Client ID not configured'
    }
  }
  
  // Retrieve PKCE parameters if available
  const pkceParams = retrievePKCEParameters(serverId)
  
  // Build token request parameters
  const tokenRequestParams: TokenExchangeParams = {
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: clientConfig.redirectUri,
    client_id: clientConfig.clientId,
    code_verifier: undefined
  }
  
  // Add PKCE code verifier if available
  if (pkceParams?.codeVerifier) {
    tokenRequestParams.code_verifier = pkceParams.codeVerifier
    console.debug('Including PKCE code_verifier in token request')
  }
  
  // Convert to URLSearchParams for form encoding
  const tokenParams = new URLSearchParams()
  Object.keys(tokenRequestParams).forEach(key => {
    tokenParams.append(key, tokenRequestParams[key as keyof TokenExchangeParams] as string)
  })
  
  // Prepare request headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json'
  }
  
  // Add client authentication
  // Use Basic Authentication if client_secret is available
  if (clientConfig.clientSecret) {
    const credentials = btoa(`${clientConfig.clientId}:${clientConfig.clientSecret}`)
    headers['Authorization'] = `Basic ${credentials}`
    console.debug('Using client_secret_basic authentication')
  } else {
    // For public clients without secret, send client_id in body (already added above)
    console.debug('Using public client authentication (no client_secret)')
  }
  
  const timestamp = new Date().toISOString()

  try {
    const response = await fetch(authServerMetadata.token_endpoint, {
      method: 'POST',
      headers,
      body: tokenParams.toString()
    })
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      let errorMessage = `Token exchange failed (HTTP ${response.status})`
      
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error) {
          errorMessage = `${errorJson.error}${errorJson.error_description ? ': ' + errorJson.error_description : ''}`
        }
      } catch {
        if (errorText) {
          errorMessage += `: ${errorText}`
        }
      }
      
      console.error('Token exchange failed:', errorMessage)
      return {
        success: false,
        error: errorMessage
      }
    }
    
    const tokenResponse: TokenResponsePayload = await response.json()
    
    console.debug('Token exchange successful')
    
    const store = useServerStore()
    store.saveBearerToken(serverId, tokenResponse.access_token)

    // Clear PKCE parameters after successful exchange
    clearPKCEParameters(serverId)
    
    return {
      success: true,
      response: {
        status_code: response.status,
        status_text: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        payload: tokenResponse,
      },
      request: {
        params: tokenRequestParams,
        url: authServerMetadata.token_endpoint,
        headers,
        timestamp
      }
    }
  } catch (error) {
    console.error('Token exchange error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error during token exchange'
    }
  }
}

/**
 * Refresh an expired access token using the refresh token
 * 
 * @param serverId Server identifier
 * @param refreshToken Refresh token from previous token response
 * @param serverMetadata Server metadata with token endpoint
 * @param oauth2Config OAuth2 configuration with client credentials
 * @returns Token exchange result with new token response or error
 */
export async function refreshAccessToken(
  serverId: string,
  refreshToken: string,
  serverMetadata: AuthServerMetadata,
  clientConfig: ClientConfig
): Promise<TokenRefreshHttpExchange> {
  console.debug(`Refreshing access token for server ${serverId}`)
  
  if (!serverMetadata.token_endpoint) {
    return {
      success: false,
      error: 'Token endpoint not found in server metadata'
    }
  }
  
  if (!clientConfig.clientId) {
    return {
      success: false,
      error: 'Client ID not configured'
    }
  }
  
  // Build token request parameters
  const tokenRefreshParams: TokenRefreshParams = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientConfig.clientId
  }
  
  // Convert to URLSearchParams for form encoding
  const tokenParams = new URLSearchParams()
  Object.keys(tokenRefreshParams).forEach(key => {
    tokenParams.append(key, tokenRefreshParams[key as keyof TokenRefreshParams])
  })
  
  // Prepare request headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json'
  }
  
  // Add client authentication
  if (clientConfig.clientSecret) {
    const credentials = btoa(`${clientConfig.clientId}:${clientConfig.clientSecret}`)
    headers['Authorization'] = `Basic ${credentials}`
  }
  
  const timestamp = new Date().toISOString()
  
  try {
    const response = await fetch(serverMetadata.token_endpoint, {
      method: 'POST',
      headers,
      body: tokenParams.toString()
    })
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      let errorMessage = `Token refresh failed (HTTP ${response.status})`
      
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error) {
          errorMessage = `${errorJson.error}${errorJson.error_description ? ': ' + errorJson.error_description : ''}`
        }
      } catch {
        if (errorText) {
          errorMessage += `: ${errorText}`
        }
      }
      
      console.error('Token refresh failed:', errorMessage)
      return {
        success: false,
        error: errorMessage
      }
    }
    
    const tokenResponse: TokenResponsePayload = await response.json()
    
    console.debug('Token refresh successful')
    
    return {
      success: true,
      response: {
        status_code: response.status,
        status_text: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        payload: tokenResponse,
      },
      request: {
        url: serverMetadata.token_endpoint,
        headers,
        params: tokenRefreshParams,
        timestamp
      }
    }
  } catch (error) {
    console.error('Token refresh error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error during token refresh'
    }
  }
}

/**
 * Revoke an access or refresh token
 * RFC 7009 - OAuth 2.0 Token Revocation
 * 
 * @param serverId Server identifier
 * @param token Token to revoke (access or refresh token)
 * @param tokenTypeHint Hint about token type ('access_token' or 'refresh_token')
 * @param serverMetadata Server metadata with revocation endpoint
 * @param oauth2Config OAuth2 configuration with client credentials
 * @returns true if revocation succeeded, false otherwise
 */
export async function revokeToken(
  serverId: string,
  token: string,
  tokenTypeHint: 'access_token' | 'refresh_token',
  serverMetadata: AuthServerMetadata,
  clientConfig: ClientConfig
): Promise<TokenRevocationHttpExchange> {
  console.debug(`Revoking ${tokenTypeHint} for server ${serverId}`)
  
  if (!serverMetadata.revocation_endpoint) {
    console.warn('Revocation endpoint not available')
    return {
      success: false,
      error: 'Revocation endpoint not available'
    }
  }
  
  // Build revocation request parameters
  const revocationParams: TokenRevocationParams = {
    token,
    token_type_hint: tokenTypeHint,
    client_id: clientConfig.clientId
  }
  
  const revokeParams = new URLSearchParams({
    token: revocationParams.token,
    token_type_hint: revocationParams.token_type_hint,
    client_id: revocationParams.client_id
  })
  
  // Prepare request headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json'
  }
  
  // Add client authentication
  if (clientConfig.clientSecret) {
    const credentials = btoa(`${clientConfig.clientId}:${clientConfig.clientSecret}`)
    headers['Authorization'] = `Basic ${credentials}`
  }
  
  try {
    const response = await fetch(serverMetadata.revocation_endpoint, {
      method: 'POST',
      headers,
      body: revokeParams.toString()
    })
    
    // RFC 7009: The authorization server responds with HTTP 200 if the token
    // has been revoked successfully or if the client submitted an invalid token
    if (response.ok) {
      console.debug('Token revocation successful')
      return {
        success: true,
        request: {
          url: serverMetadata.revocation_endpoint,
          headers,
          params: revocationParams,
          timestamp: new Date().toISOString()
        },
        response: {
          status_code: response.status,
          status_text: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          payload: {
            revoked: true,
            revoked_at: new Date().toISOString()
          }
        }
      }
    }
    
    const errorText = await response.text().catch(() => 'Unknown error')
    console.error('Token revocation failed:', errorText)
    
    return {
      success: false,
      error: `Revocation failed (HTTP ${response.status}): ${errorText}`
    }
  } catch (error) {
    console.error('Token revocation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error during token revocation'
    }
  }
}
