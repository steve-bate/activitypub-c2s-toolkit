import { defineStore } from 'pinia'
import { ref, computed, Ref } from 'vue'
import type { AuthorizationServerDiscoveryResult } from '@/services/authServerDiscoveryService'
import type { NodeInfoDataExchange, NodeInfoIndexExchange } from '@/services/nodeinfoService'
import { ClientConfig, TokenExchangeHttpExchange, TokenRefreshHttpExchange, TokenRevocationHttpExchange } from '@/services/authorizationService'
import { ActorDiscoveryResult, ActorProfile } from '@/services/actorDiscoveryService'
import { ClientRegistrationResult } from '@/services/clientRegistrationService'
import type { TestSuiteRunResult } from '@/testing/core/types'


const STORAGE_KEY = 'c2s_servers'
const AUTO_AUTH_KEY = 'c2s_auto_auth_server_id'

// Recursively make all properties optional for deep partial updates
type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}

// TODO Review these statuses
/*export*/ type AuthStatus = 'not-configured' | 'discovering-authserver' | 'authserver-configured' | 'authorized' | 'token-expired' | 'configured'
/*export*/ type AuthType = 'oauth2' | 'bearer'

export interface NodeInfoData {
  index: NodeInfoIndexExchange | null
  data: NodeInfoDataExchange | null
}

/*export*/ interface OAuth2Data {
  authServerOrigin: string
  userInput?: string
  authServerDiscovery?: AuthorizationServerDiscoveryResult
  clientConfig?: ClientConfig
  clientRegistration?: ClientRegistrationResult
  authCode?: string
  tokenExchange?: TokenExchangeHttpExchange | TokenRefreshHttpExchange | TokenRevocationHttpExchange
}

export interface AuthData {
  authType: AuthType
  authStatus?: AuthStatus
  bearerToken?: string
  oauth2?: OAuth2Data
}

export interface ServerTestingConfig {
  sidecarUrl?: string
  selectedTests?: string[]
  results?: TestSuiteRunResult
}

export interface ServerTestingConfigInput {
  sidecarUrl?: string
}

export interface ResourceServerMetadata {
  id: string // generated unique ID for this server configuration
 
  origin?: string // The origin of the resource server (e.g. https://example.com)

  // User input for OAuth2 flow
  // TODO Remove
  name?: string
  identifier?: string

  auth?: AuthData

  actor?: {
    profile: ActorProfile,
    discovery: ActorDiscoveryResult
  }

  nodeinfo?: NodeInfoData

  testing?: ServerTestingConfig

  // Timestamps
  createdAt: string
  lastUsed?: string
}

/*export*/ interface ServerInput {
  authServerOrigin?: string
  authType: AuthType
  userInput?: string
  // name?: string
  // identifier?: string
  // clientConfig?: Partial<ClientConfig>
  origin?: string // Resource server origin
  bearerToken?: string
  actor?: {
    profile: ActorProfile,
    discovery: ActorDiscoveryResult
  }
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
        return JSON.parse(stored) as ResourceServerMetadata[]
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
    let name: string
    if (serverData.authType === 'bearer') {
      try {
        name = serverData.actor?.profile.id ? new URL(serverData.actor.profile.id).hostname : 'Unknown Server'
      } catch {
        // TODO maybe this should be an error
        name = 'Unknown Server'
      }
    } else {
      // TODO clean up the OAuth2 name -- although most servers will not have separate auth server
      try {
        name = serverData.authServerOrigin ? new URL(serverData.authServerOrigin).hostname : 'Unknown Server'
      } catch {
        name = serverData.authServerOrigin || 'Unknown Server'
      }
    }

    const newServer: ResourceServerMetadata = {
      id: crypto.randomUUID(),
      name,
      origin: serverData.origin,
      auth: {
        authType: serverData.authType,
        ...(serverData.authType === "bearer"
          ? {
              bearerToken: serverData.bearerToken,
              userInput: serverData.userInput,
            }
          : {
              oauth2: {
                authServerOrigin: serverData.authServerOrigin || "",
                userInput: serverData.userInput,
              },
            }),
      },
      ...(serverData.actor ? { actor: serverData.actor } : {}),
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };
    
    servers.value.push(newServer)
    persistServers()
    return newServer
  }

  /**
   * Deep merge updates into target object
   */
  function deepMerge<T extends object>(target: T, updates: DeepPartial<T>): T {
    const result = { ...target }
    for (const key in updates) {
      const updateValue = updates[key]
      if (updateValue !== undefined) {
        if (updateValue !== null && typeof updateValue === 'object' && !Array.isArray(updateValue)) {
          const targetValue = target[key as keyof T]
          result[key as keyof T] = deepMerge(targetValue as object, updateValue as object) as T[keyof T]
        } else {
          result[key as keyof T] = updateValue as T[keyof T]
        }
      }
      else {
        delete result[key as keyof T]
      }
    }
    return result
  }

  /**
   * Update server configuration
   */
  function updateServerProperties(id: string, updates: DeepPartial<ResourceServerMetadata>): ResourceServerMetadata | null {
    const index = servers.value.findIndex(s => s.id === id)
    if (index !== -1) {
      servers.value[index] = deepMerge(servers.value[index], updates)
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
  function saveAuthorizationServerDiscoveryResult(
    serverId: string,
    discoveryResult: AuthorizationServerDiscoveryResult,
  ): ResourceServerMetadata | null {
    return updateServerProperty(serverId, 'auth.oauth2.authServerDiscovery', discoveryResult)
  }

  function clearAuthorizationServerDiscoveryResult(serverId: string): void {
    updateServerProperty(serverId, 'auth.oauth2.authServerDiscovery', undefined)
  }

  function saveClientRegistrationResult(serverId: string, registrationResult: ClientRegistrationResult): ResourceServerMetadata | null {
    return updateServerProperty(serverId, 'auth.oauth2.clientRegistration', registrationResult)
  }

  function saveClientConfig(serverId: string, clientConfig: ClientConfig): ResourceServerMetadata | null {
    return updateServerProperty(serverId, 'auth.oauth2.clientConfig', clientConfig)
  }

  /**
   * Save authorization code from OAuth2 flow
   */
  function saveAuthCode(serverId: string, code: string): ResourceServerMetadata | null {
    return updateServerProperty(serverId, 'auth.oauth2.authCode', code)
  }

  /**
   * Save token exchange response
   */
  function saveTokenExchange(
    serverId: string,
    tokenExchange: TokenExchangeHttpExchange | TokenRefreshHttpExchange | TokenRevocationHttpExchange,
  ): ResourceServerMetadata | null {
    updateServerProperty(serverId, "auth.oauth2.tokenExchange", tokenExchange);
    return updateServerProperties(serverId, {
      auth: {
        authStatus: "authorized",
      },
      lastUsed: new Date().toISOString(),
    });
  }

  /**
   * Save bearer token
   */
  function saveBearerToken(serverId: string, token: string): ResourceServerMetadata | null {
    return updateServerProperties(serverId, {
      auth: {
        bearerToken: token,
        authStatus: 'authorized',
      },
      lastUsed: new Date().toISOString()
    })
  }

  function saveActorDiscovery(serverId: string, actorDiscovery: ActorDiscoveryResult): ResourceServerMetadata | null {
    if (actorDiscovery.success && actorDiscovery.actor?.id) {
      const origin = new URL(actorDiscovery.actor.id).origin
      updateServerProperty(serverId, 'origin', origin)
    }
    updateServerProperty(serverId, 'actor.discovery', actorDiscovery)
    return updateServerProperty(serverId, 'actor.profile', actorDiscovery.actor)
  }

  /**
   * Clear OAuth2 token exchange data
   */
  function clearOAuthToken(serverId: string): ResourceServerMetadata | null {
    return updateServerProperties(serverId, {
      auth: {
        authStatus: 'not-configured',
        oauth2: {
          tokenExchange: undefined,
        },
      },
      actor: undefined,
    })
  }

  /**
   * Save token revocation as a successful exchange
   * Also clears actor data and resets auth status
   */
  function saveTokenRevocation(
    serverId: string,
    revocationExchange: TokenRevocationHttpExchange
  ): ResourceServerMetadata | null {
    updateServerProperty(serverId, 'auth.oauth2.tokenExchange', revocationExchange)
    return updateServerProperties(serverId, {
      auth: {
        authStatus: 'not-configured',
      },
      actor: undefined,
    })
  }

  /**
   * Update server authStatus
   */
  function setAuthStatus(serverId: string, status: AuthStatus): ResourceServerMetadata | null {
    return updateServerProperties(serverId, { auth: { authStatus: status } })
  }

  /**
   * Save NodeInfo information
   */
  function saveNodeInfo(
    serverId: string,
    dataExchange?: NodeInfoDataExchange,
    indexExchange?: NodeInfoIndexExchange,
  ): ResourceServerMetadata | null {
    return updateServerProperty(serverId, 'nodeinfo', {
      index: indexExchange || null,
      data: dataExchange || null,
    })
  }

  function saveTestConfig(serverId: string, config: ServerTestingConfigInput): ResourceServerMetadata | null {
    return updateServerProperty(serverId, 'testing.sidecarUrl', config.sidecarUrl)
  }

  function saveTestSelection(serverId: string, selectedTestIds: string[]): ResourceServerMetadata | null {
    return updateServerProperty(serverId, 'testing.selectedTests', selectedTestIds)
  }

  function getTestSelection(serverId: string): string[] {
    const server = servers.value.find((entry) => entry.id === serverId)
    return Array.isArray(server?.testing?.selectedTests)
      ? server.testing.selectedTests
      : []
  }

  function saveTestResults(serverId: string, run: TestSuiteRunResult): ResourceServerMetadata | null {
    return updateServerProperty(serverId, 'testing.results', run)
  }

  function getTestResults(serverId: string): TestSuiteRunResult | null {
    const server = servers.value.find((entry) => entry.id === serverId)
    return server?.testing?.results ?? null
  }

  function getActiveTestResults(): TestSuiteRunResult | null {
    return activeServer.value?.testing?.results ?? null
  }


  return {
    servers,
    activeServerId,
    activeServer,
    addServer,
    deleteServer,
    setActiveServer,
    markServerForAutoAuth,
    consumeAutoAuthForServer,
    saveDiscoveryMetadata: saveAuthorizationServerDiscoveryResult,
    saveClientRegistrationResult,
    saveClientConfig,
    saveAuthCode,
    saveAuthorizationServerDiscoveryResult,
    clearAuthorizationServerDiscoveryResult,
    saveTokenExchange,
    saveBearerToken,
    saveActorDiscovery,
    clearOAuthToken,
    saveTokenRevocation,
    setAuthStatus,
    saveNodeInfo,
    saveTestConfig,
    saveTestSelection,
    saveTestResults,
    getTestSelection,
    getTestResults,
    getActiveTestResults
  }
})
