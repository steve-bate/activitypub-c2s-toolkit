/**
 * JWT Utility Functions
 * Provides functions for decoding JWT tokens (without verification)
 */

/**
 * Decode base64url to string
 * Handles the base64url encoding used in JWTs (no padding, different chars)
 */
function decodeBase64Url(base64url: string): string {
  // Convert base64url to base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '='
  }
  
  return atob(base64)
}

/**
 * Decode a JWT token without verification
 * Returns the decoded payload as an object
 * @param token - The JWT token to decode
 * @returns The decoded JWT payload
 * @throws Error if the token format is invalid
 */
export function decodeJWT(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }
  
  // Decode the payload (second part)
  const payload = parts[1]
  const decoded = decodeBase64Url(payload)
  return JSON.parse(decoded)
}

/**
 * Safely decode a JWT token, returning null if decoding fails
 * @param token - The JWT token to decode
 * @returns The decoded JWT payload or null if decoding fails
 */
export function tryDecodeJWT(token: string): Record<string, unknown> | null {
  try {
    return decodeJWT(token)
  } catch {
    return null
  }
}
