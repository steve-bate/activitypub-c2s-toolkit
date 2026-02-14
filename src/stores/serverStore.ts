import { defineStore } from 'pinia'
import { ref, computed, Ref } from 'vue'
import type { AuthorizationServerMetadata } from '@/services/authServerMetadataService'
import type { Actor } from '@/services/actorDiscoveryService'
import type { NodeInfo, NodeInfoIndex } from '@/services/nodeinfoService'
import type { WebFingerData } from '@/services/webfingerService'

export type { AuthorizationServerMetadata as ServerMetadata, Actor, NodeInfo, NodeInfoIndex, WebFingerData as WebFingerResponse }

const STORAGE_KEY = 'c2s_servers'
const AUTO_AUTH_KEY = 'c2s_auto_auth_server_id'

export type AuthStatus = 'not-configured' | 'discovering' | 'configured' | 'authorized' | 'token-expired'
export type AuthType = 'oauth2' | 'bearer'
export type RegistrationMethod = 'RFC7591' | 'Mastodon' | 'Manual'

export interface HttpMeta {
  status: number
  statusText: string
  duration: number
  headers?: Record<string, string>
}

interface TokenEndpointMetadata {
  token_endpoint_auth_method: string
}
export interface RegistrationExchange {
  request: object
  response: TokenEndpointMetadata
  timestamp: string
  requestHeaders?: Record<string, string>
  requestUrl?: string
  httpMeta?: HttpMeta
  responseRaw?: string
}

export interface TokenExchange {
  request: object
  response: object
  timestamp: string
}

export interface OAuth2Config {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string
  registrationMethod?: RegistrationMethod
  registrationExchange?: RegistrationExchange
  registrationError?: string
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  me?: string 
}

export interface AuthorizationServerInfo {
  metadata: AuthorizationServerMetadata | null
  method?: 'RFC8414' | 'Mastodon' | 'Manual'
  status_code?: number
  error?: string
}

export interface ResourceServerMetadata {
  id: string // generated unique ID for this server configuration
  name: string
  baseUrl: string

  authType: AuthType
  authStatus: AuthStatus
  bearerToken: string | null


  // Timestamps
  createdAt: string
  lastUsed: string | null

  // User input for OAuth2 flow
  identifier: string

  oauth2: OAuth2Config
  authorizationServer: AuthorizationServerInfo
  authCode: string | null
  tokenResponse: TokenResponse | null
  tokenExchange?: TokenExchange
  actor?: Actor
  actorError?: string
  nodeinfo?: NodeInfo
  nodeinfoIndex?: NodeInfoIndex
  nodeinfoError?: string
  webfinger?: WebFingerData
  webfingerActorUri?: string
  webfingerError?: string
}

export interface ServerInput {
  name?: string
  identifier?: string
  baseUrl?: string
  authType?: AuthType
  oauth2?: Partial<OAuth2Config>
  bearerToken?: string
}

export const useServerStore = defineStore('server', () => {
  // Initialize from localStorage or use defaults
  const servers: Ref<ResourceServerMetadata[]> = ref(loadServersFromStorage())

  const activeServerId: Ref<string | null> = ref(localStorage.getItem('c2s_active_server') || servers.value[0]?.id || null)
  const autoAuthServerId: Ref<string | null> = ref(
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(AUTO_AUTH_KEY) : null
  )

  const activeServer = computed(() => {
    return servers.value.find(s => s.id === activeServerId.value) || null
  })

  /**
   * Load servers from localStorage
   */
  function loadServersFromStorage(): ResourceServerMetadata[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load servers from localStorage:', e)
    }
    
    // Return empty array - no default mock data
    // Users must use the "Add Server" button to create servers
    return []
  }

  /**
   * Persist servers to localStorage
   */
  function persistServers(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(servers.value))
    } catch (e) {
      console.error('Failed to persist servers to localStorage:', e)
    }
  }

  /**
   * Create a new server with initial configuration
   */
  function addServer(serverData: ServerInput): ResourceServerMetadata {
    const newServer: ResourceServerMetadata = {
      id: String(Date.now()),
      name: serverData.name || '',
      identifier: serverData.identifier || '', // scheme://domain[:port]
      baseUrl: serverData.baseUrl || '',
      authType: serverData.authType || 'oauth2',
      authStatus: 'not-configured', // not-configured | discovering | configured | authorized
      createdAt: new Date().toISOString(),
      lastUsed: null,
      
      // OAuth2 configuration
      oauth2: {
        clientId: serverData.oauth2?.clientId || '',
        clientSecret: serverData.oauth2?.clientSecret || '',
        redirectUri: serverData.oauth2?.redirectUri || '',
        scopes: serverData.oauth2?.scopes || 'read write follow'
      },
      
      // Bearer token configuration
      bearerToken: serverData.bearerToken || null,
      
      // Authorization server discovery
      authorizationServer: {
        metadata: null,
        method: undefined,
        status_code: undefined,
        error: undefined
      },
      
      // OAuth2 authorization endpoint response
      authCode: null,
      
      // Token exchange response
      tokenResponse: null
    }
    
    servers.value.push(newServer)
    persistServers()
    return newServer
  }

  /**
   * Update server configuration
   */
  function updateServer(id: string, updates: Partial<ResourceServerMetadata>): ResourceServerMetadata | null {
    const index = servers.value.findIndex(s => s.id === id)
    if (index !== -1) {
      servers.value[index] = { ...servers.value[index], ...updates }
      persistServers()
      return servers.value[index]
    }
    return null
  }

  /**
   * Update nested server properties
   */
  function updateServerProperty(id: string, property: keyof ResourceServerMetadata, value: unknown): ResourceServerMetadata | null {
    const index = servers.value.findIndex(s => s.id === id)
    if (index !== -1) {
      const server = servers.value[index]
      const currentValue = server[property]
      if (typeof currentValue === 'object' && currentValue !== null) {
        // Update object properties by merging
        ;(server as object)[property] = { ...currentValue, ...(value as object) }
      } else {
        // Direct assignment for primitive values
        ;(server as object)[property] = value
      }
      persistServers()
      return servers.value[index]
    }
    return null
  }

  /**
   * Delete server
   */
  function deleteServer(id: string): void {
    const index = servers.value.findIndex(s => s.id === id)
    if (index !== -1) {
      servers.value.splice(index, 1)
      persistServers()
      if (activeServerId.value === id) {
        activeServerId.value = servers.value[0]?.id || null
        localStorage.setItem('c2s_active_server', activeServerId.value || '')
      }
    }
  }

  /**
   * Set active server
   */
  function setActiveServer(id: string): void {
    if (servers.value.find(s => s.id === id)) {
      activeServerId.value = id
      localStorage.setItem('c2s_active_server', id)
    }
  }

  /**
   * Mark a server to run the automatic OAuth flow once on next view.
   */
  function markServerForAutoAuth(id: string): void {
    autoAuthServerId.value = id
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(AUTO_AUTH_KEY, id)
    }
  }

  /**
   * Consume the auto-auth marker for a server if present.
   */
  function consumeAutoAuthForServer(id: string): boolean {
    if (autoAuthServerId.value !== id) {
      return false
    }

    autoAuthServerId.value = null
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(AUTO_AUTH_KEY)
    }
    return true
  }

  /**
   * Save RFC 8414 discovery metadata with method and response details
   */
  function saveDiscoveryMetadata(serverId: string, metadata: AuthorizationServerMetadata, options?: { method?: 'RFC8414' | 'Mastodon' | 'Manual', statusCode?: number }): ResourceServerMetadata | null {
    const server = servers.value.find(s => s.id === serverId)
    if (server) {
      server.authorizationServer.metadata = metadata
      if (options?.method) {
        server.authorizationServer.method = options.method
      }
      if (options?.statusCode) {
        server.authorizationServer.status_code = options.statusCode
      }
      server.authorizationServer.error = undefined
      persistServers()
      return server
    }
    return null
  }

  /**
   * Save discovery error with HTTP status code
   */
  function saveDiscoveryError(serverId: string, error: string, statusCode?: number): ResourceServerMetadata | null {
    const server = servers.value.find(s => s.id === serverId)
    if (server) {
      server.authorizationServer.error = error
      if (statusCode) {
        server.authorizationServer.status_code = statusCode
      }
      server.authorizationServer.metadata = null
      persistServers()
      return server
    }
    return null
  }

  /**
   * Save authorization code from OAuth2 flow
   */
  function saveAuthCode(serverId: string, code: string): ResourceServerMetadata | null {
    return updateServerProperty(serverId, 'authCode', code)
  }

  /**
   * Save token exchange response
   */
  function saveTokenResponse(serverId: string, tokenResponse: TokenResponse, tokenRequest?: object): ResourceServerMetadata | null {
    updateServerProperty(serverId, 'tokenResponse', tokenResponse)
    if (tokenRequest) {
      updateServerProperty(serverId, 'tokenExchange', {
        request: tokenRequest,
        response: tokenResponse,
        timestamp: new Date().toISOString()
      })
    }
    return updateServer(serverId, { 
      authStatus: 'authorized',
      lastUsed: new Date().toISOString()
    })
  }

  /**
   * Save actor information
   */
  function saveActorInfo(serverId: string, actor: Actor): ResourceServerMetadata | null {
    const server = servers.value.find(s => s.id === serverId)
    if (server) {
      server.actor = actor
      server.actorError = undefined
      persistServers()
      return server
    }
    return null
  }

  /**
   * Save actor error
   */
  function saveActorError(serverId: string, error: string): ResourceServerMetadata | null {
    const server = servers.value.find(s => s.id === serverId)
    if (server) {
      server.actorError = error
      persistServers()
      return server
    }
    return null
  }

  /**
   * Save bearer token
   */
  function saveBearerToken(serverId: string, token: string): ResourceServerMetadata | null {
    return updateServer(serverId, { 
      bearerToken: token,
      authStatus: 'authorized',
      lastUsed: new Date().toISOString()
    })
  }

  /**
   * Clear token and auth data
   */
  function clearToken(serverId: string): ResourceServerMetadata | null {
    return updateServer(serverId, { 
      bearerToken: null,
      tokenResponse: null,
      authCode: null,
      actor: undefined,
      actorError: undefined,
      authStatus: 'not-configured'
    })
  }

  /**
   * Update server authStatus
   */
  function setAuthStatus(serverId: string, status: AuthStatus): ResourceServerMetadata | null {
    return updateServer(serverId, { authStatus: status })
  }

  /**
   * Save NodeInfo information
   */
  function saveNodeInfo(serverId: string, nodeinfo: NodeInfo, index: NodeInfoIndex): ResourceServerMetadata | null {
    const server = servers.value.find(s => s.id === serverId)
    if (server) {
      server.nodeinfo = nodeinfo
      server.nodeinfoIndex = index
      server.nodeinfoError = undefined
      persistServers()
      return server
    }
    return null
  }

  /**
   * Save NodeInfo error
   */
  function saveNodeInfoError(serverId: string, error: string): ResourceServerMetadata | null {
    const server = servers.value.find(s => s.id === serverId)
    if (server) {
      server.nodeinfoError = error
      persistServers()
      return server
    }
    return null
  }

  /**
   * Clear NodeInfo data
   */
  function clearNodeInfo(serverId: string): ResourceServerMetadata | null {
    const server = servers.value.find(s => s.id === serverId)
    if (server) {
      server.nodeinfo = undefined
      server.nodeinfoIndex = undefined
      server.nodeinfoError = undefined
      persistServers()
      return server
    }
    return null
  }

  /**
   * Save WebFinger information
   */
  function saveWebFinger(serverId: string, webfinger: WebFingerData, actorUri: string): ResourceServerMetadata | null {
    const server = servers.value.find(s => s.id === serverId)
    if (server) {
      server.webfinger = webfinger
      server.webfingerActorUri = actorUri
      server.webfingerError = undefined
      persistServers()
      return server
    }
    return null
  }

  /**
   * Save WebFinger error
   */
  function saveWebFingerError(serverId: string, error: string): ResourceServerMetadata | null {
    const server = servers.value.find(s => s.id === serverId)
    if (server) {
      server.webfingerError = error
      persistServers()
      return server
    }
    return null
  }

  /**
   * Clear WebFinger data
   */
  function clearWebFinger(serverId: string): ResourceServerMetadata | null {
    const server = servers.value.find(s => s.id === serverId)
    if (server) {
      server.webfinger = undefined
      server.webfingerActorUri = undefined
      server.webfingerError = undefined
      persistServers()
      return server
    }
    return null
  }

  return {
    servers,
    activeServerId,
    activeServer,
    addServer,
    updateServer,
    updateServerProperty,
    deleteServer,
    setActiveServer,
    markServerForAutoAuth,
    consumeAutoAuthForServer,
    saveDiscoveryMetadata,
    saveDiscoveryError,
    saveAuthCode,
    saveTokenResponse,
    saveActorInfo,
    saveActorError,
    saveBearerToken,
    clearToken,
    setAuthStatus,
    saveNodeInfo,
    saveNodeInfoError,
    clearNodeInfo,
    saveWebFinger,
    saveWebFingerError,
    clearWebFinger
  }
})
