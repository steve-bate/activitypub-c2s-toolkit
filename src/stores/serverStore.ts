import { defineStore } from 'pinia'
import { ref, computed, Ref } from 'vue'
import type { AuthServerDiscoveryResult, AuthServerMetadata } from '@/services/authServerDiscoveryService'
import type { NodeInfo, NodeInfoDataExchange, NodeInfoIndex, NodeInfoIndexExchange } from '@/services/nodeinfoService'
import type { WebFingerData, WebFingerExchange } from '@/services/webfingerService'
import { TokenExchangeHttpExchange, TokenResponsePayload } from '@/services/authorizationService'
import { Actor } from '@/services/actorDiscoveryService'
import { ClientRegistrationMethod, ClientRegistrationResult } from '@/services/clientRegistrationService'

export type { AuthServerMetadata as ServerMetadata, NodeInfo, NodeInfoIndex, WebFingerData as WebFingerResponse }

const STORAGE_KEY = 'c2s_servers'
const AUTO_AUTH_KEY = 'c2s_auto_auth_server_id'

// TODO Review these statuses
export type AuthStatus = 'not-configured' | 'discovering-authserver' | 'authserver-configured' | 'authorized' | 'token-expired' | 'configured'
export type AuthType = 'oauth2' | 'bearer'

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
  // FIXME
  response?: TokenEndpointMetadata
  timestamp: string
  requestHeaders?: Record<string, string>
  requestUrl?: string
  httpMeta?: HttpMeta
  responseRaw?: string
}

export interface OAuth2Config {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string
  registrationMethod?: ClientRegistrationMethod
  registrationExchange?: RegistrationExchange
  registrationError?: string
}

export interface AuthorizationServerInfo {
  metadata: AuthServerMetadata | null
  method?: 'RFC8414' | 'Mastodon' | 'Manual'
  status_code?: number
  error?: string
}

// ...
// auth
// nodeinfo
// webfinger
// actor


export interface NodeInfoData {
  index: NodeInfoIndexExchange | null
  data: NodeInfoDataExchange | null
}

export interface OAuth2Data {
  authServerDiscovery?: AuthServerDiscoveryResult
  clientRegistration?: ClientRegistrationResult
}

export interface AuthData {
  oauth2?: OAuth2Data
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

  auth?: AuthData

  // TODO Remove
  oauth2: OAuth2Config

  authCode: string | null
  tokenResponse: TokenResponsePayload | null
  tokenExchange?: TokenExchangeHttpExchange
  actor?: Actor
  actorError?: string
  nodeinfo?: NodeInfoData
  // TODO Not sure if this is used`
  webfinger?: WebFingerExchange
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
   * Update nested server properties using dot-separated path
   */
  function updateServerProperty<K extends keyof ResourceServerMetadata>(
    id: string, 
    propertyPath: K | string, 
    value: unknown
  ): ResourceServerMetadata | null {
    const index = servers.value.findIndex(s => s.id === id)
    if (index === -1) {
      return null
    }

    const server = servers.value[index]
    const pathParts = String(propertyPath).split('.')
    
    if (pathParts.length === 1) {
      // Simple property update
      server[propertyPath as K] = value as ResourceServerMetadata[K]
    } else {
      // Nested property update using dot-separated path
      let current = server as unknown as Record<string, unknown>
      
      // Navigate to the parent of the target property
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i]
        if (current[part] === undefined || current[part] === null) {
          // Create intermediate object if it doesn't exist
          current[part] = {}
        }
        current = current[part] as Record<string, unknown>
      }
      
      // Set the final property
      const lastPart = pathParts[pathParts.length - 1]
      current[lastPart] = value
    }
    
    persistServers()
    return servers.value[index]
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
  function saveAuthServerDiscoveryResult(
    serverId: string,
    discoveryResult: AuthServerDiscoveryResult,
  ): ResourceServerMetadata | null {
    const server = servers.value.find((s) => s.id === serverId);
    if (server) {
      updateServerProperty(serverId, 'auth.oauth2.authServerDiscovery', discoveryResult)
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
  function saveTokenExchange(serverId: string, tokenExchange: TokenExchangeHttpExchange): ResourceServerMetadata | null {
    updateServerProperty(serverId, 'tokenResponse', tokenExchange.response?.payload ?? null)
    if (tokenExchange.request) {
      updateServerProperty(serverId, 'tokenExchange', tokenExchange)
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
  function saveNodeInfo(
    serverId: string,
    dataExchange?: NodeInfoDataExchange,
    indexExchange?: NodeInfoIndexExchange,
  ): ResourceServerMetadata | null {
    const server = servers.value.find((s) => s.id === serverId);
    if (server) {
      server.nodeinfo = {
        index: indexExchange || null,
        data: dataExchange || null
      };
      persistServers();
      return server;
    }
    return null;
  }

  /**
   * Clear NodeInfo data
   */
  function clearNodeInfo(serverId: string): ResourceServerMetadata | null {
    const server = servers.value.find(s => s.id === serverId)
    if (server) {
      server.nodeinfo = undefined
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
    saveDiscoveryMetadata: saveAuthServerDiscoveryResult,
    saveAuthCode,
    saveAuthServerDiscoveryResult,
    saveTokenResponse: saveTokenExchange,
    saveActorInfo,
    saveActorError,
    saveBearerToken,
    clearToken,
    setAuthStatus,
    saveNodeInfo,
    clearNodeInfo,
    clearWebFinger
  }
})
