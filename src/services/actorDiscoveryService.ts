/**
 * Actor Discovery Service
 * Discovers actor information using multiple methods:
 * 1. Token response "me" property
 * 2. RFC 7662 Token Introspection
 * 3. Mastodon /api/v1/verify_credentials
 */

import { HttpExchange, HttpRequestData, HttpResponseData } from '@/types/http'
import { TokenResponsePayload } from './authorizationService'
import type { AuthServerMetadata } from './authServerDiscoveryService'
import { tryDecodeJWT } from '@/utils/jwt'

export interface ActorProfile {
  id?: string;
  uri?: string;
  name?: string;
  preferredUsername?: string;
  outbox: string;
  inbox: string;
  followers?: string;
  following?: string;
  icon?: {
    url: string;
  };
  image?: {
    url: string;
  };
  endpoints?: {
    proxyUrl?: string; // Custom property for proxying requests through the server
    uploadMedia?: string;
  };
  streams: Record<string, string>;
}

export type ActorDiscoveryMethod = 'token_response' | 'introspection' | 'verify_credentials' | 'jwt' | "user";

/*export*/ interface IntrospectionData {
  me?: string; // Custom property to indicate actor URI  
}

type IntrospectionRequest = HttpRequestData<URLSearchParams>;
type IntrospectionResponse = HttpResponseData<IntrospectionData>;
type IntrospectionExchange = HttpExchange<IntrospectionRequest, IntrospectionResponse>

/*export*/ interface MastodonAccount {
  uri?: string
  acct?: string
  actor_id?: string // Mitra
}

type MastodonAccountResponse = HttpResponseData<MastodonAccount>;
type MastodonAccountExchange = HttpExchange<HttpRequestData, MastodonAccountResponse>

type ActorFetchExchange = HttpExchange<HttpRequestData, HttpResponseData<ActorProfile>>

export type ActorDiscoveryResult = {
  success: boolean
  method?: ActorDiscoveryMethod
  actor?: ActorProfile
  actorFetchExchange?: ActorFetchExchange
  introspectionExchange?: IntrospectionExchange
  mastodonExchange?: MastodonAccountExchange
}

/**
 * Method 2: RFC 7662 Token Introspection
 * https://tools.ietf.org/html/rfc7662
 */
async function getActorUriFromTokenIntrospection(
  introspectionEndpoint: string,
  accessToken: string,
  clientId?: string,
  clientSecret?: string,
): Promise<IntrospectionExchange> {
  const requestHeaders: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientId && clientSecret) {
    requestHeaders["Authorization"] =
      `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  }
  else if (!clientSecret) {
    requestHeaders["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    console.debug("Attempting RFC 7662 token introspection");

    const response = await fetch(introspectionEndpoint, {
      method: "POST",
      headers: requestHeaders,
      body: new URLSearchParams({
        token: accessToken,
        token_type_hint: "access_token",
      }),
    });

    if (response.ok) {
      const data = await response.json();

      // Check if token is active and has "me" property
      if (data.active && data.me) {
        console.debug("Actor URI found via introspection:", data.me);
        return {
          success: true,
          request: {
            url: introspectionEndpoint,
            headers: requestHeaders,
            params: new URLSearchParams({
              token: accessToken,
              token_type_hint: "access_token",
            }),
          },
          response: {
            status_code: response.status,
            status_text: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            payload: data,
          },
        };
      }
    }

    console.debug('Introspection response did not contain "me" property');
    return {
      success: false,
      error: await response.text(),
      request: {
        url: introspectionEndpoint,
        headers: requestHeaders,
        params: new URLSearchParams({
          token: accessToken,
          token_type_hint: "access_token",
        }),
      },
      response: {
        status_code: response.status,
        status_text: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      },
    };
  } catch (error) {
    console.debug("Token introspection error:", error);
    return {
      success: false,
      request: {
        url: introspectionEndpoint,
        headers: requestHeaders,
        params: new URLSearchParams({
          token: accessToken,
          token_type_hint: "access_token",
        }),
      },
    };
  }
}

/**
 * Method 3: Mastodon /api/v1/verify_credentials
 * Fetch actor information from Mastodon-compatible API
 */
async function getActorUriFromMastodon(
  baseUrl: string,
  accessToken: string
): Promise<MastodonAccountExchange> {

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const requestUrl = `${normalizedBaseUrl}/api/v1/accounts/verify_credentials`

  const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }

  try {
    console.debug('Attempting Mastodon verify_credentials')
    
    const response = await fetch(requestUrl, {
      headers
    })

    if (response.ok) {
      const account: MastodonAccount = await response.json()
      
      // Mastodon account object has: id, username, acct, display_name, url, avatar, etc.
      let actorUri = account.uri || account.actor_id /*Mitra*/
      // Hack alert - Apparently Mastodon 4.6 provides a non-dereferenceable uri value
      console.debug("Actor URI in verify_credentials response:", actorUri)
      if (actorUri && /\/users\/\d+$/.test(actorUri)) {
        actorUri = `${normalizedBaseUrl}/users/${account.acct}`
        console.debug('Actor URI inferred from Mastodon account:', actorUri)
      }
      if (actorUri) {
        account.uri = actorUri // Ensure uri is set for later use
        return {
          success: true,
          request: { url: actorUri, headers },
          response: {
            status_code: response.status,
            status_text: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            payload: account
          }
        }
      }
    }

    console.debug('verify_credentials response did not contain actor URI')
    return {
      success: false,
      error: await response.text(),
      request: { url: requestUrl, headers },
      response: {
        status_code: response.status,
        status_text: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      }
    }
  } catch (error) {
    console.debug('verify_credentials error:', error)
    return {
      success: false,
      request: { url: requestUrl, headers },
    }
  }
}

/**
 * Fetch full actor information from ActivityPub actor endpoint
 */
export async function fetchActorInfo(actorUri: string, accessToken?: string): 
    Promise<ActorFetchExchange> 
{
  const headers: HeadersInit = {
    'Accept': "application/activity+json"
  }
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  try {
    console.debug(`Fetching actor document from ${actorUri}`)

    const response = await fetch(actorUri, { headers })

    if (!response.ok) {
      console.debug(`Failed to fetch actor profile: HTTP ${response.status} from ${actorUri}`)
      return {
        success: false,
        error: await response.text(),
        request: { url: actorUri, headers },
        response: {
          status_code: response.status,
          status_text: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        }
      }
    }

    const actorData = await response.json()
    console.debug('Fetched actor document:', actorData)
    
    // ActivityPub actor object mapping
    // 'name' in ActivityPub is the display name
    // 'preferredUsername' is the username/handle
    return {
      success: true,
      request: { url: actorUri, headers },
      response: {
        status_code: response.status,
        status_text: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        payload: actorData
      }
    }
  } catch (error) {
    const errorMessage = `Error fetching actor profile: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.debug(`${errorMessage} from ${actorUri}:`, error)
    return {
      success: false,
      error: errorMessage,
      request: { url: actorUri, headers },
    }
  }
}

/**
 * Discover actor information using multiple methods
 */
export async function discoverActor(
  tokenResponse: TokenResponsePayload,
  metadata: AuthServerMetadata,
  clientId?: string,
  clientSecret?: string
): Promise<ActorDiscoveryResult> {
  console.debug('Starting actor discovery')

  let discoveryMethod: ActorDiscoveryMethod | undefined = undefined;

  // Method 1: Check token response for "me" property
  let actorUri = tokenResponse.me 
  if (actorUri) {
    discoveryMethod = "token_response"
    console.debug('Actor URI found in token response "me" property:', actorUri)
  }

  let introspectionExchange: IntrospectionExchange | undefined = undefined

  if (!actorUri && clientId && metadata.introspection_endpoint) {
    // Method 2: Try RFC 7662 introspection\
    introspectionExchange = await getActorUriFromTokenIntrospection(
      metadata.introspection_endpoint,
      tokenResponse.access_token,
      clientId,
      clientSecret
    )

    if (introspectionExchange.success) {
      discoveryMethod = "introspection"
      actorUri = introspectionExchange.response?.payload?.me
    }
  }
  
  let mastodonExchange: MastodonAccountExchange | undefined = undefined

  if (!actorUri) {
    // Method 3: Try Mastodon verify_credentials
    mastodonExchange = await getActorUriFromMastodon(metadata.issuer, tokenResponse.access_token)
    if (mastodonExchange.success) {
      discoveryMethod = "verify_credentials"
      actorUri = mastodonExchange.response?.payload?.uri
    }
  }

  // Method 4: Attempt to decode token as JWT
  if (!actorUri) {
    try {
      const jwtData = tryDecodeJWT(tokenResponse.access_token);
      if (jwtData) {
        console.debug("OAuthService: Decoded JWT:", jwtData);
        try {
          // TODO onepage uses nonstandard 'subject'
          discoveryMethod = "jwt"
          actorUri = (jwtData.sub || jwtData.subject) as string;
        }
        catch (error) {
          console.debug("OAuthService: Failed to fetch actor profile from JWT subject URI:", error);
        }
      }
    } catch (error) {
      console.debug("OAuthService: Failed to decode token as JWT", error);
    }
  }

  if (!actorUri) {
    return {
      success: false,
      introspectionExchange,
      mastodonExchange
    }
  }

  // Always fetch full actor details from the actor URI to get complete information
  const actorFetchExchange = await fetchActorInfo(actorUri, tokenResponse.access_token)
  
  if (!actorFetchExchange.success) {
    // Actor URI was discovered but profile fetch failed
    return {
      success: false,
      actorFetchExchange,
      introspectionExchange,
      mastodonExchange
    }
  }
  
  const actorData: ActorDiscoveryResult = {
    success: true,
    method: discoveryMethod,
    actor: actorFetchExchange.response?.payload,
    actorFetchExchange,
    introspectionExchange,
    mastodonExchange
  }

  console.debug('Actor discovery successful:', actorData)

  return actorData
}

/**
 * Get display name for actor (priority: displayName > name > preferredUsername > URI)
 * Uses the full actor profile from actor.profile if available for best results
 */
export function getActorDisplayName(actor: ActorProfile): string {
  return actor.name || 
           actor.preferredUsername ||
           actor.name ||
           actor.uri ||
           "Unknown";
}
