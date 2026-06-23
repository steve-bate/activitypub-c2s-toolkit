import { HttpExchange, HttpRequestData, HttpResponseData } from "@/types/http";
import { getCorsDiagnostics, isPossibleCorsFailure } from "./corsDiagnostics";

type XFetchOptions = {
  method?: string; // ByteString
  headers?: Record<string, string>; 
  body?: BodyInit | null; // e.g. string | Blob | FormData | URLSearchParams | ...
  referrer?: string; // USVString
  referrerPolicy?: ReferrerPolicy; // e.g. "no-referrer", "origin", ...
  mode?: RequestMode; // "navigate" | "same-origin" | "no-cors" | "cors"
  credentials?: RequestCredentials; // "omit" | "same-origin" | "include"
  cache?: RequestCache; // "default" | "no-store" | "reload" | ...
  redirect?: RequestRedirect; // "follow" | "error" | "manual"
  integrity?: string; // DOMString
  keepalive?: boolean;
  signal?: AbortSignal | null;
  //duplex?: RequestDuplex;             // e.g. "half" (streaming request bodies)
  priority?: RequestPriority; // "high" | "low" | "auto"
  //window?: any;                       // can only be set to null per spec
  timeout?: number; // in milliseconds
  // Newer / privacy-related members that are in the spec but may not be in all TS lib versions:
  // attributionReporting?: AttributionReportingRequestOptions;
  // targetAddressSpace?: IPAddressSpace;   // "public" | "private" | "local"
  // sharedStorageWritable?: boolean;
  // privateToken?: PrivateToken;
  // adAuctionHeaders?: boolean;
};

function normalizeHeaders(headers: Headers): Record<string, string> {
  const normalized: Record<string, string> = {};
  headers.forEach((value, key) => {
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}

function parseResponseBody(responseText: string): unknown {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return undefined;
  }

  const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!looksLikeJson) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

export async function xfetch<
  TParams = unknown,
  TResponsePayload = unknown,
>(
  url: string,
  options: XFetchOptions = {},
): Promise<HttpExchange<HttpRequestData<TParams>, HttpResponseData<TResponsePayload>>> {
  const startedAt = new Date().toISOString();
  const startTime = performance.now();

  const controller = new AbortController();

  const timeoutMs = options.timeout ?? 10000; // TODO make this configurable
  const timeoutHandle = window.setTimeout(() => controller.abort(), timeoutMs);

  const method = options.method ?? "GET";
  const requestHeaders: HeadersInit = {
    ...(options.headers ?? {}),
  };

  if (!("Accept" in requestHeaders)) {
    requestHeaders["Accept"] = "application/activity+json"
  }

  if (options.body && !("Content-Type" in requestHeaders)) {
    requestHeaders["Content-Type"] = "application/json";
  }
  
  const requestExchange = {
    url,
    headers: requestHeaders,
    params: options.body as TParams,
    timestamp: startedAt,
  };

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: options.body as BodyInit,
      signal: controller.signal,
    });

    const responseText = await response.text();
    const responseJson = parseResponseBody(responseText);

    const finishedAt = new Date().toISOString();
    const durationMs = Math.round(performance.now() - startTime);

    const responseExchange = {
      status_code: response.status,
      status_text: response.statusText,
      headers: normalizeHeaders(response.headers),
      payload: (responseJson ?? responseText) as TResponsePayload,
    };

    let diagnostics = undefined;
    if (!response.ok && isPossibleCorsFailure(response.status)) {
      diagnostics = await getCorsDiagnostics(
        { url, headers: requestHeaders }
      );
    }

    return {
      success: response.ok,
      error: response.ok
        ? undefined
        : `HTTP ${response.status} ${response.statusText}`,
      request: requestExchange,
      response: responseExchange,
      metrics: {
        startedAt,
        finishedAt,
        durationMs,
      },
      cors: diagnostics,
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const durationMs = Math.round(performance.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: errorMessage,
      request: requestExchange,
      metrics: {
        startedAt,
        finishedAt,
        durationMs,
      },
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
