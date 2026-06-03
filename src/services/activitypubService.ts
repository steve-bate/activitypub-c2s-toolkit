/**
 * ActivityPub Service
 * Handles posting ActivityStreams activities to an actor's outbox
 */

import { HttpExchange, HttpRequestData, HttpResponseData } from '@/types/http'

interface ActivityStreamsObject {
  '@context'?: string | string[] | Record<string, unknown>
  type: string
  actor?: string
  object?: string | Record<string, unknown>
  to?: string | string[]
  cc?: string | string[]
  [key: string]: unknown
}

interface PostActivityParams {
  outboxUrl: string
  activity: ActivityStreamsObject
  accessToken: string
}

interface PostMediaUploadParams {
  uploadMediaUrl: string
  object: ActivityStreamsObject
  file: File
  accessToken: string
}

type ActivityRequest = HttpRequestData<ActivityStreamsObject>
type ActivityResponse = HttpResponseData<ActivityStreamsObject | string>
type ActivityExchange = HttpExchange<ActivityRequest, ActivityResponse>

type MediaUploadRequestPayload = {
  object: ActivityStreamsObject
  file: {
    name: string
    type: string
    size: number
  }
}

type MediaUploadRequest = HttpRequestData<MediaUploadRequestPayload>
type MediaUploadResponse = HttpResponseData<ActivityStreamsObject | string>
type MediaUploadExchange = HttpExchange<MediaUploadRequest, MediaUploadResponse>

/**
 * Post an activity to an actor's outbox
 * 
 * @param params - Parameters including outbox URL, activity object, and access token
 * @returns HttpExchange with request and response details
 */
export async function postActivityToOutbox(params: PostActivityParams): Promise<ActivityExchange> {
  const { outboxUrl, activity, accessToken } = params

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/activity+json',
    'Accept': 'application/activity+json, application/json'
  }

  const requestData: ActivityRequest = {
    url: outboxUrl,
    headers: {
      ...headers,
      'Authorization': `Bearer ${accessToken.substring(0, 20)}...` // Redact token in logged request
    },
    params: activity,
    timestamp: new Date().toISOString()
  }

  try {
    const response = await fetch(outboxUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(activity)
    })

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    const responseText = await response.text()
    let responsePayload: ActivityStreamsObject | string

    // Try to parse as JSON
    try {
      responsePayload = JSON.parse(responseText)
    } catch {
      responsePayload = responseText
    }

    const responseData: ActivityResponse = {
      status_code: response.status,
      status_text: response.statusText,
      headers: responseHeaders,
      payload: responsePayload
    }

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status} ${response.statusText}${responseText ? `: ${responseText}` : ''}`,
        request: requestData,
        response: responseData
      }
    }

    return {
      success: true,
      request: requestData,
      response: responseData
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      request: requestData
    }
  }
}

/**
 * Upload media to an actor's uploadMedia endpoint using multipart/form-data.
 *
 * Follows the SocialCG ActivityPub MediaUpload technique where the form includes:
 * - file: uploaded media
 * - object: shell ActivityStreams object
 */
export async function postMediaToUploadEndpoint(params: PostMediaUploadParams): Promise<MediaUploadExchange> {
  const { uploadMediaUrl, object, file, accessToken } = params

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/activity+json, application/json'
  }

  const requestData: MediaUploadRequest = {
    url: uploadMediaUrl,
    headers: {
      ...headers,
      'Authorization': `Bearer ${accessToken.substring(0, 20)}...`
    },
    params: {
      object,
      file: {
        name: file.name,
        type: file.type,
        size: file.size
      }
    },
    timestamp: new Date().toISOString()
  }

  const formData = new FormData()
  formData.append(
    'object',
    new Blob([JSON.stringify(object)], {
      type: 'application/ld+json'
    })
  )
  formData.append('file', file, file.name)

  try {
    const response = await fetch(uploadMediaUrl, {
      method: 'POST',
      headers,
      body: formData
    })

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    const responseText = await response.text()
    let responsePayload: ActivityStreamsObject | string

    try {
      responsePayload = JSON.parse(responseText)
    } catch {
      responsePayload = responseText
    }

    const responseData: MediaUploadResponse = {
      status_code: response.status,
      status_text: response.statusText,
      headers: responseHeaders,
      payload: responsePayload
    }

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status} ${response.statusText}${responseText ? `: ${responseText}` : ''}`,
        request: requestData,
        response: responseData
      }
    }

    return {
      success: true,
      request: requestData,
      response: responseData
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      request: requestData
    }
  }
}

/**
 * Create a Follow activity
 * 
 * @param actorUri - The URI of the actor doing the following
 * @param objectUri - The URI of the actor to follow
 * @returns ActivityStreams Follow activity
 */
export function createFollowActivity(actorUri: string, objectUri: string): ActivityStreamsObject {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Follow',
    actor: actorUri,
    object: objectUri,
    to: objectUri
  }
}

/**
 * Create a Like activity
 *
 * @param actorUri - The URI of the actor doing the like
 * @param objectUri - The URI of the object being liked
 * @returns ActivityStreams Like activity
 */
export function createLikeActivity(actorUri: string, objectUri: string): ActivityStreamsObject {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Like',
    actor: actorUri,
    object: objectUri,
    to: objectUri
  }
}

/**
 * Create an Announce activity
 *
 * @param actorUri - The URI of the actor doing the announce
 * @param objectUri - The URI of the object being announced
 * @returns ActivityStreams Announce activity
 */
export function createAnnounceActivity(actorUri: string, objectUri: string): ActivityStreamsObject {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Announce',
    actor: actorUri,
    object: objectUri,
    to: 'https://www.w3.org/ns/activitystreams#Public'
  }
}

