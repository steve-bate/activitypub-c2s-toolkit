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

export interface NodeInfoLink {
  rel: string
  href: string
}

export interface NodeInfoIndex {
  links: NodeInfoLink[]
}

export interface NodeInfo {
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

export interface HttpRequestResult {
  status: number
  statusText: string
  headers: Record<string, string>
  url: string
}

export interface NodeInfoIndexResult {
  status: 'success' | 'error'
  data?: NodeInfoIndex
  error?: string
  httpRequest?: HttpRequestResult
}

export interface NodeInfoDataResponse {
  status: 'success' | 'error'
  data?: NodeInfo
  error?: string
  httpRequest?: HttpRequestResult
}

export interface NodeInfoResult {
  indexResult: NodeInfoIndexResult
  dataResult?: NodeInfoDataResponse
}

// Cache for NodeInfo requests
const cache = new Map<string, { data: NodeInfoDataResponse; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Extract HTTP request details from a Response object
 */
function extractHttpRequestResult(response: Response): HttpRequestResult {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })
  
  return {
    status: response.status,
    statusText: response.statusText,
    headers,
    url: response.url
  }
}

/**
 * Get cached data if available and not expired
 */
function getCachedResult(
  key: string,
): NodeInfoDataResponse | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

/**
 * Set cache data
 */
function setCacheResult(key: string, data: NodeInfoDataResponse): void {
  cache.set(key, { data, timestamp: Date.now() })
}

/**
 * Fetch NodeInfo index from /.well-known/nodeinfo
 */
async function fetchNodeInfoIndex(baseUrl: string): Promise<NodeInfoIndexResult> {
  try {
    const url = `${baseUrl}/.well-known/nodeinfo`
    console.debug('Fetching NodeInfo index from', url)
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    })

    const httpRequest = extractHttpRequestResult(response)

    if (!response.ok) {
      console.debug(`NodeInfo index fetch failed with HTTP ${response.status}`)
      const result: NodeInfoIndexResult = {
        status: 'error',
        error: `Failed to fetch NodeInfo index: HTTP ${response.status} ${response.statusText}`,
        httpRequest
      }
      return result
    }

    const data = await response.json()
    
    if (!data.links || !Array.isArray(data.links)) {
      console.debug('Invalid NodeInfo index format')
      const result: NodeInfoIndexResult = {
        status: 'error',
        error: 'Invalid NodeInfo index format: missing or invalid links array',
        httpRequest
      }
      return result
    }

    return {
      status: "success",
      data: data,
      httpRequest,
    };

  } catch (error) {
    console.debug('NodeInfo index fetch error:', error)
    return {
      status: 'error',
      error: error.message
    }
  }
}

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
 * Fetch NodeInfo from a specific URL
 */
async function fetchNodeInfo(url: string): Promise<NodeInfoDataResponse> {
  const cacheKey = `nodeinfo-data:${url}`
  const cached = getCachedResult(cacheKey)
  if (cached) {
    console.debug('Using cached NodeInfo for', url)
    return cached
  }

  try {
    console.debug('Fetching NodeInfo from', url)
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    })

    const httpRequest = extractHttpRequestResult(response)

    if (!response.ok) {
      console.debug(`NodeInfo fetch failed with HTTP ${response.status}`)
      const result: NodeInfoDataResponse = {
        status: 'error',
        error: `Failed to fetch NodeInfo: HTTP ${response.status} ${response.statusText}`,
        httpRequest
      }
      return result
    }

    const data: NodeInfo = await response.json()
    
    // Basic validation
    if (!data.software?.name || !data.software?.version) {
      console.debug('Invalid NodeInfo format: missing software info')
      return {
        status: 'error',
        error: 'Invalid NodeInfo format: missing software name or version',
        httpRequest
      }
    }

    const result: NodeInfoDataResponse = {
      status: 'success',
      data,
      httpRequest
    }


    setCacheResult(cacheKey, result)
    return result

  } catch (error) {
    console.debug('NodeInfo fetch error:', error)
    return {
      status: 'error',
      error: error.message
    }
  }
}

/**
 * Load NodeInfo for a server
 * Returns both the index result and the data result
 */
export async function getNodeInfo(baseUrl: string): Promise<NodeInfoResult> {
  console.debug('Loading NodeInfo for', baseUrl)

  // Fetch the NodeInfo index
  const indexResult = await fetchNodeInfoIndex(baseUrl)

  // If index fetch failed, return early with only the index result
  if (indexResult.status === 'error' || !indexResult.data) {
    return {
      indexResult
    }
  }

  // Get the latest NodeInfo version URL
  const nodeinfoUrl = getLatestNodeInfoUrl(indexResult.data)
  
  if (!nodeinfoUrl) {
    return {
      indexResult,
      dataResult: {
        status: 'error',
        error: 'No valid NodeInfo version found in index'
      }
    }
  }

  // Fetch the NodeInfo document
  const dataResult = await fetchNodeInfo(nodeinfoUrl)

  return {
    indexResult,
    dataResult
  }
}

/**
 * Clear cache for a specific server or all servers
 */
export function clearNodeInfoCache(baseUrl?: string): void {
  if (baseUrl) {
    // Clear cache for specific server
    cache.delete(`nodeinfo-index:${baseUrl}`)
    // Clear all nodeinfo data URLs that start with this baseUrl
    for (const key of cache.keys()) {
      if (key.startsWith(`nodeinfo-data:${baseUrl}`)) {
        cache.delete(key)
      }
    }
  } else {
    // Clear all cache
    cache.clear()
  }
}
