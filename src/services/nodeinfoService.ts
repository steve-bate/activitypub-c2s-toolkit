/**
 * NodeInfo Service
 * Fetches NodeInfo data from servers following the NodeInfo protocol
 * https://nodeinfo.diaspora.software/
 * 
 * NodeInfo provides metadata about a server including:
 * - Software name and version
 * - Usage statistics
 * - Protocol support
 * - Other server information
 */

import { HttpExchange, HttpRequestData, HttpResponseData } from "@/types/http"
import { xfetch } from "@/utils/httpExchange"

/*export*/ interface NodeInfoLink {
  rel: string
  href: string
}

/*export*/ interface NodeInfoIndex {
  links: NodeInfoLink[]
}

/*export*/ interface NodeInfo {
  version: string
  software: {
    name: string
    version: string
    repository?: string
    homepage?: string
  }
  protocols: string[]
  services?: {
    inbound?: string[]
    outbound?: string[]
  }
  openRegistrations?: boolean
  usage?: {
    users?: {
      total?: number
      activeMonth?: number
      activeHalfyear?: number
    }
    localPosts?: number
    localComments?: number
  }
  metadata?: Record<string, unknown>
}

export type NodeInfoIndexRequest = HttpRequestData;
export type NodeInfoIndexResponse = HttpResponseData<NodeInfoIndex>;
export type NodeInfoIndexExchange = HttpExchange<NodeInfoIndexRequest, NodeInfoIndexResponse>;

export type NodeInfoDataRequest = HttpRequestData;
export type NodeInfoDataResponse = HttpResponseData<NodeInfo>;
export type NodeInfoDataExchange = HttpExchange<NodeInfoDataRequest, NodeInfoDataResponse>;

type CacheData = NodeInfoDataExchange | NodeInfoIndexExchange | undefined

// Cache for NodeInfo requests
const cache = new Map<string, { data: CacheData; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get cached data if available and not expired
 */
function getCachedResult<T>(
  key: string,
): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  return null;
}

/**
 * Set cache data
 */
function setCacheResult(key: string, data: CacheData): void {
  cache.set(key, { data, timestamp: Date.now() })
}

async function fetchNodeInfoIndex(baseUrl: string): Promise<NodeInfoIndexExchange> {
  const url = `${baseUrl}/.well-known/nodeinfo`
  const exchange = await xfetch<unknown, NodeInfoIndex>(url, {
    headers: {
      'Accept': 'application/json'
    }
  })

  // TODO check that links exist?

  return exchange
}

/**
 * Fetch NodeInfo index from /.well-known/nodeinfo
 */
// async function fetchNodeInfoIndex(baseUrl: string): Promise<NodeInfoIndexExchange> {
//   try {
//     const url = `${baseUrl}/.well-known/nodeinfo`
//     console.debug('Fetching NodeInfo index from', url)

//     const response = await fetch(url, {
//       headers: {
//         'Accept': 'application/json'
//       }
//     })

//     const httpRequest = extractHttpRequestResult(response)

//     if (!response.ok) {
//       console.debug(`NodeInfo index fetch failed with HTTP ${response.status}`)
//       const result = {
//         success: false,
//         error: `Failed to fetch NodeInfo index: HTTP ${response.status} ${response.statusText}`,
//         response: {
//           status_code: response.status,
//           status_text: response.statusText,
//           headers: httpRequest.headers,
//         },
//       }
//       return result
//     }

//     const data = await response.json()
    
//     if (!data.links || !Array.isArray(data.links)) {
//       console.debug('Invalid NodeInfo index format')
//       const result = {
//         success: false,
//         error: 'Invalid NodeInfo index format: missing or invalid links array',
//         response: {
//           status_code: response.status,
//           status_text: response.statusText,
//           headers: httpRequest.headers,
//         }
//       }
//       return result
//     }

//     return {
//       success: true,
//       response: {
//         status_code: response.status,
//         status_text: response.statusText,
//         headers: httpRequest.headers,
//         payload: data,
//       }
//     };

//   } catch (error) {
//     console.debug('NodeInfo index fetch error:', error)
//     return {
//       success: false,
//       error: error instanceof Error ? error.message : 'Unknown error'
//     }
//   }
// }

/**
 * Get the latest NodeInfo version URL from the index
 * Prefers version 2.1, then 2.0, then the latest available
 */
function getLatestNodeInfoUrl(index: NodeInfoIndex): string | null {
  const links = index.links.filter(link => 
    link.rel.startsWith('http://nodeinfo.diaspora.software/ns/schema/')
  )

  if (links.length === 0) {
    return null
  }

  // Try to find version 2.1
  const v21 = links.find(link => 
    link.rel.includes('/2.1')
  )
  if (v21) return v21.href

  // Try to find version 2.0
  const v20 = links.find(link => 
    link.rel.includes('/2.0')
  )
  if (v20) return v20.href

  // Return the last link (usually the latest version)
  return links[links.length - 1].href
}

/**
 * Load NodeInfo for a server
 * Returns both the index result and the data result
 */
export async function getNodeInfo(baseUrl: string)
    : Promise<[NodeInfoIndexExchange | undefined, 
                NodeInfoDataExchange | undefined]> {
  console.debug('Loading NodeInfo for', baseUrl)

  // Fetch the NodeInfo index
  const indexExchange = await fetchNodeInfoIndex(baseUrl)

  // If index fetch failed, return early with only the index result
  if (!indexExchange.success || !indexExchange.response?.payload) {
    return [indexExchange, undefined]
  }


  // Get the latest NodeInfo version URL
  const nodeinfoUrl = getLatestNodeInfoUrl(indexExchange.response.payload)
  
  if (!nodeinfoUrl) {
    return [
      indexExchange,
      {
        success: false,
        error: 'No valid NodeInfo version found in index'
      }
    ]
  }

  const cachedInfoExchange = getCachedResult<NodeInfoDataExchange>(nodeinfoUrl)
  if (cachedInfoExchange) {
    return [indexExchange, cachedInfoExchange]
  }

  // Fetch the NodeInfo document
  const infoExchange = await xfetch<unknown, NodeInfo>(nodeinfoUrl)
  setCacheResult(nodeinfoUrl, infoExchange)

  return [
    indexExchange,
    infoExchange
  ]
}

