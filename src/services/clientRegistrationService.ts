/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration Protocol
 * https://tools.ietf.org/html/rfc7591
 */

import { ServerInfo } from "./authServerMetadataService"

export type RegistrationMethod = 'RFC7591' | 'Mastodon' | 'Manual'

export interface ClientMetadata {
  client_name?: string
  client_uri?: string
  logo_uri?: string
  redirect_uris: string[]
  grant_types?: string[]
  response_types?: string[]
  scope?: string
  contacts?: string[]
  tos_uri?: string
  policy_uri?: string
  software_id?: string
  software_version?: string
}

export interface ClientRegistrationData {
  client_id: string
  client_secret?: string
  client_id_issued_at?: number
  client_secret_expires_at?: number
  redirect_uris?: string[]
  grant_types?: string[]
  response_types?: string[]
  client_name?: string
  client_uri?: string
  logo_uri?: string
  scope?: string
  contacts?: string[]
  tos_uri?: string
  policy_uri?: string
  registration_client_uri?: string
  registration_access_token?: string
}

export interface HttpMeta {
  status: number
  statusText: string
  duration: number
  headers?: Record<string, string>
}

export interface ClientRegistrationRequest
{
  client_name: string
  redirect_uris: string[] | string
  scopes: string | undefined
  scope: string | undefined
};

export interface ClientRegistrationResult {
  success: boolean
  data?: ClientRegistrationData
  error?: string
  registrationMethod?: RegistrationMethod
  requestData?: ClientMetadata
  requestHeaders?: Record<string, string>
  requestUrl?: string
  httpMeta?: HttpMeta
  responseRaw?: string
}

/**
 * Register a new OAuth2 client with the authorization server
 * using RFC 7591 Dynamic Client Registration or Mastodon API
 */
export async function registerClient(
  serverInfo: ServerInfo,
  registrationEndpoint: string,
  metadata: ClientMetadata
): Promise<ClientRegistrationResult> {
  try {
    let registrationMethod: RegistrationMethod = "RFC7591";

    if (!isDefined(registrationEndpoint) || registrationEndpoint.includes('/api/v1/apps')) {
      // No endpoint in metadata, try Mastodon-style registration
      registrationEndpoint = `${serverInfo.baseUrl}/api/v1/apps`
      registrationMethod = "Mastodon";
    }

    console.debug(`Registering client at: ${registrationEndpoint}`)
    console.debug('Client metadata:', metadata)
  
    const registrationRequest: ClientRegistrationRequest = {
      client_name: 'activitypub-c2s-client',
      redirect_uris: registrationMethod === "Mastodon" ? metadata.redirect_uris[0] : metadata.redirect_uris,
      scopes: registrationMethod === "Mastodon" ? metadata.scope : undefined,
      scope: registrationMethod === "Mastodon" ? undefined : metadata.scope,
    };

    console.debug('Registration request:', registrationRequest)

    const startTime = Date.now()
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    const response = await fetch(registrationEndpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(registrationRequest)
    })
    const duration = Date.now() - startTime

    // Capture response headers (including CORS headers when exposed)
    const headersObj: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headersObj[key] = value
    })

    const corsHeaderNames = [
      'access-control-allow-origin',
      'access-control-allow-credentials',
      'access-control-allow-headers',
      'access-control-allow-methods',
      'access-control-expose-headers',
      'access-control-max-age'
    ]

    corsHeaderNames.forEach((name) => {
      if (headersObj[name]) return
      const value = response.headers.get(name)
      if (value) {
        headersObj[name] = value
      }
    })

    const httpMeta: HttpMeta = {
      status: response.status,
      statusText: response.statusText,
      duration,
      headers: headersObj
    }

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error) {
          errorMessage = `${errorJson.error}${errorJson.error_description ? ': ' + errorJson.error_description : ''}`
        }
      } catch {
        // If not JSON, use the error text if available
        if (errorText) {
          errorMessage += ` - ${errorText}`
        }
      }

      console.error('Client registration failed:', errorMessage)
      return {
        success: false,
        error: errorMessage,
        registrationMethod,
        requestData: metadata,
        requestHeaders,
        requestUrl: registrationEndpoint,
        httpMeta,
        responseRaw: errorText
      }
    }

    const responseText = await response.text()
    let data: ClientRegistrationData = undefined;
    try {
      data = JSON.parse(responseText)
    } catch {
      // If response is not JSON, still capture it
      console.warn('Registration response is not valid JSON')
    }
    
    console.debug('Client registration successful:', data)

    return {
      success: true,
      data,
      registrationMethod,
      requestData: metadata,
      requestHeaders,
      requestUrl: registrationEndpoint,
      httpMeta,
      responseRaw: responseText
    }
  } catch (error) {
    console.error('Client registration error:', error)
    return {
      success: false,
      error: error?.message || 'Network error during client registration',
      requestHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      requestUrl: registrationEndpoint,
      httpMeta: {
        status: 0,
        statusText: 'Network Error',
        duration: 0
      }
    }
  }
}

/**
 * Create default client metadata for registration
 */
export function createDefaultClientMetadata(
  clientName: string,
  redirectUri: string,
  scopes?: string
): ClientMetadata {
  return {
    client_name: clientName || 'ActivityPub C2S Client',
    redirect_uris: [redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: scopes || 'read write follow',
    client_uri: typeof window !== 'undefined' ? window.location.origin : undefined,
    software_id: 'activitypub-c2s-client',
    software_version: '1.0.0'
  }
}

export function isDefined(value: string | null | undefined): boolean {
  return !!value && value.trim().length > 0
}
