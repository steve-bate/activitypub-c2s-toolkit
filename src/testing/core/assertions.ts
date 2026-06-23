import type {
  AssertionOutcome,
  TestAssertion,
} from "@/testing/core/types"
import { HttpExchange, HttpRequestData, HttpResponseData } from "@/types/http"

interface PathPart {
  kind: "property" | "index"
  value: string | number
}

function parseJsonPath(path: string): PathPart[] {
  const segments = path.split(".").filter(Boolean)
  const parts: PathPart[] = []

  for (const segment of segments) {
    const match = /^([a-zA-Z0-9_@-]+)(\[(\d+)\])?$/.exec(segment)
    if (!match) {
      throw new Error(`Unsupported JSON path segment: ${segment}`)
    }

    parts.push({ kind: "property", value: match[1] })

    if (match[3] !== undefined) {
      parts.push({ kind: "index", value: Number(match[3]) })
    }
  }

  return parts
}

function getPathValue(payload: unknown, path: string): unknown {
  const parts = parseJsonPath(path)
  let current: unknown = payload

  for (const part of parts) {
    if (part.kind === "property") {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return undefined
      }
      current = (current as Record<string, unknown>)[part.value as string]
    } else {
      if (!Array.isArray(current)) {
        return undefined
      }
      current = current[part.value as number]
    }
  }

  return current
}

function hasActivityPubContext(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false
  }

  const context = (payload as Record<string, unknown>)["@context"]
  const expected = "https://www.w3.org/ns/activitystreams"

  if (typeof context === "string") {
    return context.includes(expected)
  }

  if (Array.isArray(context)) {
    return context.some(
      (item) => typeof item === "string" && item.includes(expected),
    )
  }

  return false
}

function evaluateAssertion(
  assertion: TestAssertion,
  exchange: HttpExchange<HttpRequestData<unknown>, HttpResponseData<unknown>>,
): AssertionOutcome {
  const response = exchange.response
  const responseHeaders = response?.headers ?? {}
  const payload = exchange.response?.payload

  switch (assertion.kind) {
    case "status": {
      const expectedStatus = assertion.expectedStatus
      const actualStatus = response?.status_code
      const passed =
        typeof expectedStatus === "number" && actualStatus === expectedStatus
      return {
        assertion,
        passed,
        message: passed
          ? `Status matched expected ${expectedStatus}`
          : `Expected status ${expectedStatus ?? "(missing expected status)"}, got ${String(actualStatus)}`,
      }
    }

    case "headerMatch": {
      const headerName = assertion.headerName?.toLowerCase()
      if (!headerName || !assertion.headerPattern) {
        return {
          assertion,
          passed: false,
          message: "Assertion configuration missing header name or pattern",
        }
      }

      const headerValue = responseHeaders[headerName] ?? ""
      const pattern = new RegExp(assertion.headerPattern, "i")
      const passed = pattern.test(String(headerValue))

      return {
        assertion,
        passed,
        message: passed
          ? `Header ${assertion.headerName} matched ${assertion.headerPattern}`
          : `Header ${assertion.headerName} did not match ${assertion.headerPattern}`,
      }
    }

    case "jsonPathExists": {
      if (!assertion.jsonPath) {
        return {
          assertion,
          passed: false,
          message: "Assertion configuration missing jsonPath",
        }
      }

      const pathValue = getPathValue(payload, assertion.jsonPath)
      const passed = pathValue !== undefined && pathValue !== null

      return {
        assertion,
        passed,
        message: passed
          ? `Path '${assertion.jsonPath}' exists`
          : `Path '${assertion.jsonPath}' does not exist`,
      }
    }

    case "jsonPathEquals": {
      if (!assertion.jsonPath) {
        return {
          assertion,
          passed: false,
          message: "Assertion configuration missing jsonPath",
        }
      }

      const pathValue = getPathValue(payload, assertion.jsonPath)
      const passed =
        JSON.stringify(pathValue) === JSON.stringify(assertion.expectedValue)

      return {
        assertion,
        passed,
        message: passed
          ? `Path ${assertion.jsonPath} equals expected value`
          : `Path ${assertion.jsonPath} mismatch (expected ${JSON.stringify(assertion.expectedValue)}, got ${JSON.stringify(pathValue)})`,
      }
    }

    case "activityPubObjectShape": {
      const objectPayload = payload as Record<string, unknown> | undefined
      const hasType =
        typeof objectPayload?.type === "string" && objectPayload.type.length > 0
      const hasId =
        typeof objectPayload?.id === "string" && objectPayload.id.length > 0
      const hasContext = hasActivityPubContext(payload)
      const passed =
        hasType &&
        hasContext &&
        (hasId || assertion.expectedType === "collection")

      return {
        assertion,
        passed,
        message: passed
          ? "Payload looks like an ActivityPub object"
          : "Payload does not match expected ActivityPub shape",
      }
    }

    default:
      return {
        assertion,
        passed: false,
        message: "Unsupported assertion kind",
      }
  }
}

export function evaluateAssertions(
  assertions: TestAssertion[],
  exchange: HttpExchange<HttpRequestData<unknown>, HttpResponseData<unknown>>,
): AssertionOutcome[] {
  return assertions.map((assertion) => evaluateAssertion(assertion, exchange))
}

export function allAssertionsPassed(assertions: AssertionOutcome[]): boolean {
  return assertions.every((assertion) => assertion.passed)
}

function extractItemUrisFromPayload(payload: unknown, n: number): string[] {
  if (!payload || typeof payload !== "object") {
    return []
  }

  const obj = payload as Record<string, unknown>
  const uris: string[] = []

  for (const key of ["orderedItems", "items"] as const) {
    const list = obj[key]
    if (!Array.isArray(list)) continue

    for (const entry of list) {
      if (uris.length >= n) break
      if (typeof entry === "string" && /^https?:\/\//.test(entry)) {
        uris.push(entry)
      } else if (entry && typeof entry === "object") {
        const id = (entry as Record<string, unknown>).id
        if (typeof id === "string" && /^https?:\/\//.test(id)) {
          uris.push(id)
        }
      }
    }

    if (uris.length >= n) break
  }

  return uris
}

export function extractCollectionItemUri(payload: unknown): string | undefined {
  return extractItemUrisFromPayload(payload, 1)[0]
}

/**
 * Returns the first `n` item URIs from an ActivityPub collection.
 * Handles both unpaged collections (orderedItems/items directly present)
 * and paged collections (items on the page referenced by `first`).
 * If an item is a JSON object rather than a URI string, its `id` property is used.
 */
export async function getCollectionItemUris(
  collection: unknown,
  fetcher: (url: string) => Promise<unknown>,
  n: number = 1,
): Promise<string[]> {
  const direct = extractItemUrisFromPayload(collection, n)
  if (direct.length >= n || !collection || typeof collection !== "object") {
    return direct
  }

  const firstRef = (collection as Record<string, unknown>).first
  const pageUri =
    firstRef && typeof firstRef === "object"
      ? (firstRef as Record<string, unknown>).id
      : firstRef

  let pagePayload: unknown
  if (typeof pageUri === "string") {
    pagePayload = await fetcher(pageUri)
  }

  if (!pagePayload) {
    return direct
  }

  const fromPage = extractItemUrisFromPayload(pagePayload, n - direct.length)
  return [...direct, ...fromPage]
}

export function collectionIsEmpty(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return true
  }

  const objectPayload = payload as Record<string, unknown>
  const totalItems = objectPayload.totalItems
  if (typeof totalItems === "number") {
    return totalItems === 0
  }

  const orderedItems = objectPayload.orderedItems
  const items = objectPayload.items

  if (Array.isArray(orderedItems)) {
    return orderedItems.length === 0
  }

  if (Array.isArray(items)) {
    return items.length === 0
  }

  return true
}
