/**
 * Actor Discovery Service
 * Discovers actor information using multiple methods:
 * 1. Token response "me" property
 * 2. RFC 7662 Token Introspection
 * 3. Mastodon /api/v1/verify_credentials
 */

import { TokenResponsePayload } from './authorizationService'
import type { AuthorizationServerMetadata } from './authServerMetadataService'
import { tryDecodeJWT } from '@/utils/jwt'

export interface ActorProfile {
  name?: string
  preferredUsername?: string
  outbox: string
  inbox: string
  followers?: string
  following?: string
  // url?: string
  // icon?: {
  //   url: string
  // }
}

export type ActorDiscoveryMethod = 'token_response' | 'introspection' | 'verify_credentials' | 'jwt'
export interface Actor {
  uri: string
  displayName?: string
  name?: string
  preferredUsername?: string
  url?: string
  icon?: {
    url: string
  }
  discoveryMethod: ActorDiscoveryMethod
  profile?: ActorProfile
}

export interface ActorDiscoveryResult {
  success: boolean
  actor?: Actor
  error?: string
}

/**
 * Method 1: Extract actor URI from token response "me" property
 */
function getActorFromTokenResponse(tokenResponse: TokenResponsePayload): Actor | null {
  if (tokenResponse.me) {
    return {
      uri: tokenResponse.me,
      discoveryMethod: 'token_response'
    }
  }
  return null
}

/**
 * Method 2: RFC 7662 Token Introspection
 * https://tools.ietf.org/html/rfc7662
 */
async function introspectToken(
  introspectionEndpoint: string,
  accessToken: string,
  clientId: string,
  clientSecret: string
): Promise<Actor | null> {
  try {
    console.debug('Attempting RFC 7662 token introspection')
    
    const response = await fetch(introspectionEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        token: accessToken,
        token_type_hint: 'access_token'
      })
    })

    if (!response.ok) {
      console.debug(`Introspection failed with HTTP ${response.status}`)
      return null
    }

    const data = await response.json()
    
    // Check if token is active and has "me" property
    if (data.active && data.me) {
      console.debug('Actor URI found via introspection:', data.me)
      return {
        uri: data.me,
        discoveryMethod: 'introspection',
        profile: data
      }
    }

    console.debug('Introspection response did not contain "me" property')
    return null
  } catch (error) {
    console.debug('Token introspection error:', error)
    return null
  }
}

/**
 * Method 3: Mastodon /api/v1/verify_credentials
 * Fetch actor information from Mastodon-compatible API
 */
async function getActorFromMastodon(
  baseUrl: string,
  accessToken: string
): Promise<Actor | null> {
  try {
    console.debug('Attempting Mastodon verify_credentials')
    
    const response = await fetch(`${baseUrl}/api/v1/accounts/verify_credentials`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.debug(`verify_credentials failed with HTTP ${response.status}`)
      return null
    }

    const account = await response.json()
    
    // Mastodon account object has: id, username, acct, display_name, url, avatar, etc.
    if (account.url || account.uri) {
      const actor: Actor = {
        uri: account.url || account.uri,
        displayName: account.display_name,
        name: account.display_name,
        preferredUsername: account.username || account.acct,
        url: account.url,
        discoveryMethod: 'verify_credentials',
        profile: account
      }
      
      if (account.avatar) {
        actor.icon = { url: account.avatar }
      }
      
      console.debug('Actor found via verify_credentials:', actor.uri)
      return actor
    }

    console.debug('verify_credentials response did not contain actor URI')
    return null
  } catch (error) {
    console.debug('verify_credentials error:', error)
    return null
  }
}

/**
 * Fetch full actor information from ActivityPub actor endpoint
 */
async function fetchActorInfo(actorUri: string, accessToken?: string): Promise<{ success: boolean; data?: Partial<Actor>; error?: string }> {
  try {
    console.debug(`Fetching actor document from ${actorUri}`)
    
    const headers: HeadersInit = {
      'Accept': "application/json"
    }
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(actorUri, { headers })

    if (!response.ok) {
      const errorMessage = `Failed to fetch actor profile: HTTP ${response.status}`
      console.debug(`${errorMessage} from ${actorUri}`)
      return { success: false, error: errorMessage }
    }

    const actorData = await response.json()
    console.debug('Fetched actor document:', actorData)
    
    // ActivityPub actor object mapping
    // 'name' in ActivityPub is the display name
    // 'preferredUsername' is the username/handle
    return {
      success: true,
      data: {
        displayName: actorData.name,
        name: actorData.name,
        preferredUsername: actorData.preferredUsername,
        url: actorData.url,
        icon: actorData.icon,
        profile: actorData
      }
    }
  } catch (error) {
    const errorMessage = `Error fetching actor profile: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.debug(`${errorMessage} from ${actorUri}:`, error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Discover actor information using multiple methods
 */
export async function discoverActor(
  tokenResponse: TokenResponsePayload,
  metadata: AuthorizationServerMetadata,
  accessToken: string,
  clientId: string,
  clientSecret: string
): Promise<ActorDiscoveryResult> {
  console.debug('Starting actor discovery')

  // Method 1: Check token response for "me" property
  let actor = getActorFromTokenResponse(tokenResponse)
  
  if (!actor && metadata.links.oauth_introspect) {
    // Method 2: Try RFC 7662 introspection
    actor = await introspectToken(
      metadata.links.oauth_introspect,
      accessToken,
      clientId,
      clientSecret
    )
  }
  
  if (!actor) {
    // Method 3: Try Mastodon verify_credentials
    actor = await getActorFromMastodon(metadata.links.api_base, accessToken)
  }

  // Method 4: Attempt to decode token as JWT
  try {
    const jwtData = tryDecodeJWT(accessToken);
    if (jwtData) {
      console.debug("OAuthService: Decoded JWT:", jwtData);
      try {
          const actorUri = (jwtData.sub || jwtData.subject) as string;
          const actorProfile = await fetch(actorUri, {
          headers: { Authorization: `Bearer ${accessToken}` },
          }).then((res) => res.json());
          actor = {
              uri: actorUri,
              profile: actorProfile,
              discoveryMethod: 'jwt'
          }
      }
      catch (error) {
          console.debug("OAuthService: Failed to fetch actor profile from JWT subject URI:", error);
      }
    }
  } catch (error) {
    console.debug("OAuthService: Failed to decode token as JWT", error);
  }

  if (!actor) {
    return {
      success: false,
      error: 'Could not discover actor URI using any available method'
    }
  }

  // Always fetch full actor details from the actor URI to get complete information
  console.debug('Fetching complete actor document for URI:', actor.uri)
  const actorInfoResult = await fetchActorInfo(actor.uri, accessToken)
  
  if (!actorInfoResult.success) {
    // Actor URI was discovered but profile fetch failed
    return {
      success: false,
      error: actorInfoResult.error || 'Failed to fetch actor profile',
      actor: actor // Include the partial actor info with URI
    }
  }
  
  // Merge the fetched actor info with the discovered info
  // Prioritize fetched data over discovery data
  actor = { 
    ...actor, 
    ...(actorInfoResult.data || {}),
    // Preserve the discovery method and URI
    uri: actor.uri,
    discoveryMethod: actor.discoveryMethod
  }

  console.debug('Actor discovery successful:', actor)
  
  return {
    success: true,
    actor
  }
}

/**
 * Get display name for actor (priority: displayName > name > preferredUsername > URI)
 * Uses the full actor profile from actor.profile if available for best results
 */
export function getActorDisplayName(actor: Actor | null | undefined): string {
  if (!actor) return 'Actor'
  
  // If we have the full actor profile, extract display name from it
  if (actor.profile) {
    return actor.profile.name || 
           actor.profile.preferredUsername || 
           actor.displayName || 
           actor.name || 
           actor.preferredUsername || 
           actor.uri
  }
  
  return actor.uri
}
