/**
 * WebFinger Service
 * Resolves fediverse handles (e.g., @user@server.com) to actor URIs
 * Following RFC 7033: https://tools.ietf.org/html/rfc7033
 *
 * WebFinger is used to discover:
 * - Actor/profile URIs
 * - ActivityPub endpoints
 * - Other metadata about a user or resource
 */

import { HttpExchange, HttpRequestData, HttpResponseData } from "@/types/http";
import { xfetch } from "@/utils/httpExchange";

/*export*/ interface WebFingerLink {
  rel: string;
  type?: string;
  href?: string;
  template?: string;
  properties?: Record<string, string | null>;
  titles?: Record<string, string>;
}

/*export*/ interface WebFingerData {
  subject: string;
  aliases?: string[];
  properties?: Record<string, string | null>;
  links?: WebFingerLink[];
}

interface WebFingerParams {
  resource: string;
}

type WebFingerRequest = HttpRequestData<WebFingerParams>;
type WebFingerResponse = HttpResponseData<WebFingerData>;
/*export*/ type WebFingerExchange = HttpExchange<
  WebFingerRequest,
  WebFingerResponse
>;

// Cache for WebFinger requests
const cache = new Map<string, { data: WebFingerExchange; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached data if available and not expired
 */
function getCached(key: string): WebFingerExchange | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

/**
 * Set cache data
 */
function setCache(key: string, data: WebFingerExchange): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Parse a fediverse handle into username and domain
 * Handles formats like:
 * - @user@server.com
 * - user@server.com
 * - acct:user@server.com
 */
function parseHandle(
  handle: string,
): { username: string; domain: string } | null {
  // Remove leading @ if present
  let normalized = handle.trim();
  if (normalized.startsWith("@")) {
    normalized = normalized.substring(1);
  }

  // Remove acct: prefix if present
  if (normalized.startsWith("acct:")) {
    normalized = normalized.substring(5);
  }

  // Split on @
  const parts = normalized.split("@");
  if (parts.length !== 2) {
    return null;
  }

  const [username, domain] = parts;
  if (!username || !domain) {
    return null;
  }

  return { username, domain };
}

/**
 * Build WebFinger resource URI from username and domain
 */
function buildResourceUri(username: string, domain: string): string {
  return `acct:${username}@${domain}`;
}

/**
 * Fetch WebFinger information for a handle
 */
async function fetchWebFinger(
  domain: string,
  resource: string,
): Promise<WebFingerExchange> {
  const cacheKey = `webfinger:${resource}`;
  const cached = getCached(cacheKey);

  if (cached) {
    console.debug("Using cached WebFinger for", resource);
    return cached;
  }

  try {
    // WebFinger endpoint is always at /.well-known/webfinger
    const url = new URL(`https://${domain}/.well-known/webfinger`);
    url.searchParams.set("resource", resource);

    console.debug("Fetching WebFinger from", url.toString());

    const exchange = await xfetch<WebFingerParams, WebFingerData>(
      url.toString(),
      {
        method: "GET",
        headers: {
          Accept: "application/jrd+json, application/json",
        },
      },
    );

    const data = exchange.response?.payload;

    // Basic validation
    if (!data?.subject) {
      console.debug("Invalid WebFinger format: missing subject");
      return {
        success: false,
        error: "Invalid WebFinger response: missing subject field",
        request: exchange.request,
        response: exchange.response,
      };
    }

    // Extract actor URI
    const actorUri = extractActorUri(data);

    if (!actorUri) {
      return {
        success: false,
        error: "No ActivityPub actor URI found in WebFinger links",
        request: exchange.request,
        response: exchange.response,
      };
    }

    setCache(cacheKey, exchange);

    return exchange;
  } catch (error) {
    console.debug("WebFinger fetch error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Network error during WebFinger lookup",
    };
  }
}

/**
 * Extract ActivityPub actor URI from WebFinger links
 * Looks for link with rel="self" and type="application/activity+json"
 */
function extractActorUri(webfinger: WebFingerData): string | undefined {
  if (!webfinger.links || webfinger.links.length === 0) {
    return undefined;
  }

  // Look for ActivityPub profile link
  const actorLink = webfinger.links.find(
    (link) =>
      link.rel === "self" &&
      link.type === "application/activity+json" &&
      link.href,
  );

  if (actorLink?.href) {
    return actorLink.href;
  }

  // Fallback: look for any link with activity+json type
  const fallbackLink = webfinger.links.find(
    (link) => link.type === "application/activity+json" && link.href,
  );

  return fallbackLink?.href || undefined;
}

/**
 * Resolve a fediverse handle to an actor URI
 *
 * @param handle - The fediverse handle (e.g., "@user@server.com" or "user@server.com")
 * @returns WebFingerResult containing the actor URI, full WebFinger data, and response
 */
export async function resolveHandle(
  handle: string,
): Promise<string | undefined> {
  const [actorUri] = (await resolveHandleEx(handle)) || [undefined];
  return actorUri;
}

export async function resolveHandleEx(
  handle: string,
): Promise<[string | undefined, WebFingerExchange]> {
  console.debug("Resolving handle:", handle);

  // Parse the handle
  const parsed = parseHandle(handle);
  if (!parsed) {
    throw Error(`Invalid Webfinger handle format: ${handle}`);
  }

  const { username, domain } = parsed;
  const resource = buildResourceUri(username, domain);

  // Fetch WebFinger information
  const exchange = await fetchWebFinger(domain, resource);
  if (exchange.success && exchange.response?.payload) {
    return [extractActorUri(exchange.response.payload), exchange];
  }

  throw Error("Webfinger error")
}
