import type {
  HttpExchange,
  HttpRequestData,
  HttpResponseData,
} from "@/types/http"
import type {
  SidecarDiagnostics,
  TestRequest,
} from "@/testing/core/types"

function normalizeHeaders(headers: Headers): Record<string, string> {
  const normalized: Record<string, string> = {}
  headers.forEach((value, key) => {
    normalized[key.toLowerCase()] = value
  })
  return normalized
}

function parseResponseBody(responseText: string): unknown {
  const trimmed = responseText.trim()
  if (!trimmed) {
    return undefined
  }

  const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[")
  if (!looksLikeJson) {
    return undefined
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

export function shouldAttemptSidecarDiagnostics(
  exchange: HttpExchange<HttpRequestData<unknown>, HttpResponseData<unknown>>,
): boolean {
  if (exchange.success) {
    return false
  }

  if (!exchange.response) {
    return true
  }

  const errorKind = exchange.errorKind
  return (
    errorKind === "transport" ||
    errorKind === "timeout" ||
    errorKind === "opaque"
  )
}

export async function runSidecarDiagnostics(
  sidecarBaseUrl: string | undefined,
  request: TestRequest,
  timeoutMs: number,
): Promise<SidecarDiagnostics> {
  if (!sidecarBaseUrl) {
    return {
      attempted: false,
      available: false,
      diagnosticsUnavailableReason: "Sidecar URL not configured",
      confidence: "unknown",
      summary: "Diagnostics skipped because sidecar URL is not configured",
    }
  }

  const normalizedBase = sidecarBaseUrl.replace(/\/$/, "")
  const sidecarUrl = `${normalizedBase}/proxy`

  const startedAt = new Date().toISOString()
  const controller = new AbortController()
  const timeoutHandle = window.setTimeout(() => controller.abort(), timeoutMs)

  const body = new URLSearchParams()
  body.set("id", request.url)

  const requestHeaders = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  }

  try {
    const response = await fetch(sidecarUrl, {
      method: "POST",
      headers: requestHeaders,
      body,
      signal: controller.signal,
    })

    const responseText = await response.text()
    const parsedBody = parseResponseBody(responseText)

    const exchange: HttpExchange<
      HttpRequestData<string>,
      HttpResponseData<unknown>
    > = {
      success: response.ok,
      error: response.ok
        ? undefined
        : `HTTP ${response.status} ${response.statusText}`,
      request: {
        url: sidecarUrl,
        headers: requestHeaders,
        params: body.toString(),
        timestamp: startedAt,
      },
      response: {
        status_code: response.status,
        status_text: response.statusText,
        headers: normalizeHeaders(response.headers),
        payload: parsedBody ?? responseText,
      },
    }

    const responsePayload = exchange.response?.payload
    let confidence: SidecarDiagnostics["confidence"] = "probable"
    let summary =
      "Browser transport failed; sidecar reached endpoint and fetched target URI"

    const corsState =
      responsePayload && typeof responsePayload === "object"
        ? (responsePayload as Record<string, unknown>).cors
        : undefined

    if (corsState && typeof corsState === "object") {
      const missingHeaders = (corsState as Record<string, unknown>)
        .missingHeaders
      if (Array.isArray(missingHeaders) && missingHeaders.length > 0) {
        confidence = "definite"
        summary = `Likely CORS misconfiguration: missing ${missingHeaders.join(", ")}`
      }
    }

    return {
      attempted: true,
      available: true,
      confidence,
      summary,
      sidecarExchange: exchange,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      attempted: true,
      available: false,
      diagnosticsUnavailableReason: errorMessage,
      //confidence: exchange.transportError ? "probable" : "unknown",
      summary: `Diagnostics failed: ${errorMessage}`,
    }
  } finally {
    clearTimeout(timeoutHandle)
  }
}
