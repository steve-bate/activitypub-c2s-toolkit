import { resolveHandle } from '@/services/webfingerService'

/**
 * Detect if a string is a fedi handle
 */
// export function isFediHandle(value: string): boolean {
//   // Match @user@domain or user@domain
//   const handleRegex = /^@?[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
//   return handleRegex.test(value.trim())
// }

/**
 * Parse audience field and resolve fedi handles to URIs
 */
// export async function parseAudience(input: string): Promise<string[]> {
//   const values = input
//     .split(/[\n,]/)
//     .map(value => value.trim())
//     .filter(value => value.length > 0)
  
//   const resolved: string[] = []
  
//   for (const value of values) {
//     if (isFediHandle(value)) {
//       //resolveStatus.value = `Resolving ${value}...`
//       try {
//         const actorUri = await resolveHandle(value)
//         if (actorUri) {
//           resolved.push(actorUri)
//           console.log(`Resolved ${value} to ${actorUri}`)
//         } else {
//           console.warn(`Failed to resolve ${value}`)
//           // Keep the original value if resolution fails
//           resolved.push(value)
//         }
//       } catch (error) {
//         console.error(`Error resolving ${value}:`, error)
//         resolved.push(value)
//       }
//     } else {
//       // Already a URI or other value
//       resolved.push(value)
//     }
//   }
  
//   return resolved
// }

/**
 * Extract fedi handles from content
 */
function extractMentions(text: string): Array<{ handle: string; name: string }> {
  // Match @user@domain.com patterns
  const mentionRegex = /@([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
  const mentions: Array<{ handle: string; name: string }> = []
  
  let match
  while ((match = mentionRegex.exec(text)) !== null) {
    const handle = match[1] // Without leading @
    const name = match[0] // With leading @
    mentions.push({ handle, name })
  }
  
  return mentions
}

/**
 * Resolve mentions to actor URIs and create Mention objects
 */
export async function resolveMentions(text: string): Promise<Array<{ type: string; href: string; name: string }>> {
  const mentions = extractMentions(text)
  const resolved: Array<{ type: string; href: string; name: string }> = []
  
  for (const mention of mentions) {
    //resolveStatus.value = `Resolving mention ${mention.name}...`
    try {
      const actorUri = await resolveHandle(mention.handle)
      if (actorUri) {
        resolved.push({
          type: 'Mention',
          href: actorUri,
          name: mention.name
        })
        console.log(`Resolved mention ${mention.name} to ${actorUri}`)
      } else {
        console.warn(`Failed to resolve mention ${mention.name}`)
      }
    } catch (error) {
      console.error(`Error resolving mention ${mention.name}:`, error)
    }
  }
  
  return resolved
}
