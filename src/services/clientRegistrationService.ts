/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration Protocol
 * https://tools.ietf.org/html/rfc7591
 */

import { HttpExchange, HttpRequestData, HttpResponseData } from "@/types/http"

export type ClientRegistrationMethod = 'RFC7591' | 'Mastodon' | 'Pre-registered' | "CIMD" | "N/A"

/*export*/ interface ClientRegistrationData {
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

/*export*/ interface ClientRegistrationParams
{
  client_name: string
  redirect_uris: string[] | string
  scopes: string | undefined
  scope: string | undefined
};

type ClientRegistrationRequest = HttpRequestData<ClientRegistrationParams>;
type ClientRegistrationResponse = HttpResponseData<ClientRegistrationData>;
type ClientRegistrationExchange = HttpExchange<ClientRegistrationRequest, ClientRegistrationResponse>
export  interface ClientRegistrationResult {
  registrationMethod?: ClientRegistrationMethod
  exchange?: ClientRegistrationExchange
}

function deepCopy<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Register a new OAuth2 client with the authorization server
 * using RFC 7591 Dynamic Client Registration or Mastodon API
 */
export async function registerClient(
  authServerUrl: URL,
  registrationEndpoint: string | undefined,
  params: ClientRegistrationParams
): Promise<ClientRegistrationResult> {

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }

  try {
    let registrationMethod: ClientRegistrationMethod = "RFC7591";

    if (!isDefined(registrationEndpoint)) {
      console.log("No registration endpoint in metadata, trying Mastodon-style registration")
      registrationEndpoint = `${authServerUrl.origin}/api/v1/apps`
      registrationMethod = "Mastodon";
      params = deepCopy(params)
      // Patch redirect_uris for Mastodon-compatibility
      params.client_name = params.client_name || 'ActivityPub C2S Client'
      //delete params.scopes - Mitra uses it
      delete params.scope
      params.redirect_uris = Array.isArray(params.redirect_uris) ? params.redirect_uris[0] : params.redirect_uris
    }

    console.debug(`Attempting client registration: ${registrationEndpoint}`, registrationMethod, params)

    let response = await fetch(registrationEndpoint!, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(params)
    })

    // If JSON-encoded request fails, retry with form encoding
    if (!response.ok) {
      console.log("JSON registration failed, retrying with form-encoded body")
      const formParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => formParams.append(key, v))
          } else {
            formParams.set(key, String(value))
          }
        }
      }
      requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
      delete requestHeaders.Accept
      response = await fetch(registrationEndpoint!, {
        method: 'POST',
        headers: requestHeaders,
        body: formParams.toString()
      })
    }

    // Capture response headers (including CORS headers when exposed)
    const headersObj: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headersObj[key] = value
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      console.error('Client registration failed:', errorMessage)
      
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
            status_text: response.statusText,
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
          status_text: response.statusText,
          headers: headersObj,
          payload: data
        }
      },
    }
  } catch (error) {
    console.error('Client registration exception:', error)
    return {
      registrationMethod: "N/A",
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
