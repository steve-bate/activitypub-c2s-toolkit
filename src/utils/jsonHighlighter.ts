/**
 * JSON Highlighting Utility
 * Centralized service for formatting and syntax highlighting JSON
 */

/**
 * Format an object as pretty-printed JSON
 */
export function formatJson(obj: object): string {
  return JSON.stringify(obj, null, 2)
}

/**
 * Syntax highlight JSON string with HTML spans
 * Distinguishes between keys, strings, numbers, booleans, and null values
 * @param json - The JSON string to highlight
 * @param makeUrisClickable - If true, makes URI strings clickable links
 */
export function syntaxHighlightJson(json: string, makeUrisClickable = false): string {
  // Escape HTML special characters
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'number'
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'key'
        } else {
          // JSON string value - check if it's a URI and makeUrisClickable is enabled
          if (makeUrisClickable) {
            const stringValue = match.slice(1, -1) // Remove quotes
            
            // Check if value looks like a URI (http:// or https://)
            if (/^https?:\/\/.+/.test(stringValue)) {
              // Make it a clickable link
              const escapedUri = stringValue
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
              const escapedAttrUri = escapedUri
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
              return `<span class="syntax-string">"<a href="#" class="syntax-uri" data-uri="${escapedAttrUri}">${escapedUri}</a>"</span>`
            }
          }
          cls = 'string'
        }
      } else if (/true|false/.test(match)) {
        cls = 'boolean'
      } else if (/null/.test(match)) {
        cls = 'null'
      }
      return `<span class="syntax-${cls}">${match}</span>`
    }
  )
}
