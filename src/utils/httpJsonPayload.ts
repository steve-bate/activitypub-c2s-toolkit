import { formatJson, syntaxHighlightJson } from '@/utils/jsonHighlighter'

const getHeaderContentType = (headers: Record<string, string> | null | undefined): string => {
  if (!headers) return ''
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === 'content-type')
  return entry ? entry[1] : ''
}

export const getNormalizedContentType = (
  contentType: string | null | undefined,
  headers: Record<string, string> | null | undefined
): string => {
  return (contentType || getHeaderContentType(headers) || '').toLowerCase()
}

export const hasPayload = (payload: unknown, payloadRaw?: string | null): boolean => {
  if (payload === null || payload === undefined) {
    return !!(payloadRaw && payloadRaw.length > 0)
  }
  if (typeof payload === 'string') return payload.length > 0
  return true
}

export const isJsonPayload = (
  payload: unknown,
  contentType: string | null | undefined,
  headers: Record<string, string> | null | undefined
): boolean => {
  if (payload === null || payload === undefined) return false
  const normalized = getNormalizedContentType(contentType, headers)
  if (normalized.includes('json')) {
    return true
  } 
  return typeof payload === 'object'
}

export const getJsonCopyText = (
  payload: unknown,
  contentType: string | null | undefined,
  headers: Record<string, string> | null | undefined,
  payloadRaw?: string | null
): string => {
  if (!isJsonPayload(payload, contentType, headers)) return ''
  if (typeof payload === 'string') return payload
  if ((payload === null || payload === undefined) && payloadRaw) return payloadRaw
  if (payload === null || payload === undefined) return ''
  return formatJson(payload)
}

export const getHighlightedJson = (
  payload: unknown,
  contentType: string | null | undefined,
  headers: Record<string, string> | null | undefined
): string => {
  if (!isJsonPayload(payload, contentType, headers) || !payload) return ''
  if (typeof payload === 'string') return syntaxHighlightJson(formatJson(JSON.parse(payload)))
  return syntaxHighlightJson(formatJson(payload))
}
