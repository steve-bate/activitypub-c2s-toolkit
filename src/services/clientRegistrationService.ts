/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration Protocol
 * https://tools.ietf.org/html/rfc7591
 */

import { HttpExchange, HttpRequestData, HttpResponseData } from "@/types/http"
import { UrlComponents } from "./authServerDiscoveryService"

export type ClientRegistrationMethod = 'RFC7591' | 'Mastodon' | 'Manual' | "N/A"

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
  name?: string // Mastodon uses "name" instead of "client_name"?
  client_uri?: string
  logo_uri?: string
  scope?: string
  contacts?: string[]
  tos_uri?: string
  policy_uri?: string
  registration_client_uri?: string
  registration_access_token?: string
}

export interface ClientRegistrationParams
{
  client_name: string
  redirect_uris: string[] | string
  scopes: string | undefined
  scope: string | undefined
};

type ClientRegistrationRequest = HttpRequestData<ClientRegistrationParams>;
type ClientRegistrationResponse = HttpResponseData<ClientRegistrationData>;
type ClientRegistrationExchange = HttpExchange<ClientRegistrationRequest, ClientRegistrationResponse>
export interface ClientRegistrationResult {
  registrationMethod?: ClientRegistrationMethod
  exchange: ClientRegistrationExchange
}

/**
 * Register a new OAuth2 client with the authorization server
 * using RFC 7591 Dynamic Client Registration or Mastodon API
 */
export async function registerClient(
  serverInfo: UrlComponents,
  registrationEndpoint: string | undefined,
  params: ClientRegistrationParams
): Promise<ClientRegistrationResult> {

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }

  try {
    let registrationMethod: ClientRegistrationMethod = "RFC7591";

    if (!isDefined(registrationEndpoint) || registrationEndpoint?.includes('/api/v1/apps')) {
      // No endpoint in metadata, try Mastodon-style registration
      registrationEndpoint = `${serverInfo.baseUrl}/api/v1/apps`
      registrationMethod = "Mastodon";
    }

    console.debug(`Registering client at: ${registrationEndpoint}`)
    console.debug('Registration request:', params)

    const response = await fetch(registrationEndpoint!, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(params)
    })

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
        registrationMethod,
        exchange: {
          success: false,
          error: errorMessage,
          request: {
            url: registrationEndpoint!,
            headers: requestHeaders,
            params
          },
          response: {
            status_code: response.status,
            headers: headersObj,
          }
        }
      }
    }

    const responseText = await response.text()
    let data: ClientRegistrationData | undefined = undefined;
    try {
      data = JSON.parse(responseText)
    } catch {
      // If response is not JSON, still capture it
      console.warn('Registration response is not valid JSON')
    }
    
    console.debug('Client registration successful:', data)

    return {
      registrationMethod,
      exchange: {
        success: true,
        request: {
          url: registrationEndpoint!,
          headers: requestHeaders,
          params
        },
        response: {
          status_code: response.status,
          headers: headersObj,
          payload: data
        }
      },
    }
  } catch (error) {
    console.error('Client registration error:', error)
    return {
      registrationMethod: 'RFC7591',
      exchange: {
        success: false,
        error: error instanceof Error ? error?.message : 'Network error during client registration',
        request: {
          url: registrationEndpoint!,
          headers: requestHeaders,
          params: params
      }
    }
  }
  }
}

/**
 * Create default client metadata for registration
 */
export function defaultClientRegistrationParams(
  clientName: string,
  redirectUris: string[],
  scopes: string = 'read write follow',// Mastodon
): ClientRegistrationParams {
  return {
    client_name: clientName || 'ActivityPub C2S Client',
    redirect_uris: redirectUris,
    //grant_types: ['authorization_code', 'refresh_token'],
    //response_types: ['code'],
    scopes: scopes,
    scope: scopes // Mastodon
    // client_uri: typeof window !== 'undefined' ? window.location.origin : undefined,
    // software_id: 'activitypub-c2s-client',
    // software_version: '1.0.0'
  }
}

export function isDefined(value: string | null | undefined): boolean {
  return !!value && value.trim().length > 0
}
