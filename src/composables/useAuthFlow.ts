/**
 * OAuth 2.0 Authorization Flow Composable
 *
 * Implements the full ActivityPub C2S authorization flow as a set of
 * independently-runnable steps with reactive state:
 *
 *   1. Fetch Auth Server Metadata   (redo resets all downstream steps)
 *   2. Register Client              (skipped when client_id is a CIMD URL)
 *   3. Initiate Authorization       (redirect to authorization_endpoint)
 *   4. Exchange Code for Token      (token_endpoint)
 *   5. Discover Actor URI
 */

import { reactive, computed } from 'vue'
import { getAuthorizationServerMetadata } from '@/services/authServerDiscoveryService'
import {
  registerClient,
  defaultClientRegistrationParams,
  isDefined,
} from '@/services/clientRegistrationService'
import { initiateAuthorizationFlow, exchangeCodeForToken, refreshAccessToken, revokeToken } from '@/services/authorizationService'
import { discoverActor } from '@/services/actorDiscoveryService'
import { useServerStore } from '@/stores/serverStore'
import { useSettingsStore } from '@/stores/settingsStore'

import type { AuthorizationServerDiscoveryResult } from '@/services/authServerDiscoveryService'
import type { ClientRegistrationResult } from '@/services/clientRegistrationService'
import type { TokenResponsePayload, TokenExchangeHttpExchange, TokenRefreshHttpExchange, TokenRevocationHttpExchange } from '@/services/authorizationService'
import type { ActorDiscoveryResult } from '@/services/actorDiscoveryService'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StepStatus = 'idle' | 'running' | 'success' | 'error'

type TokenExchange = TokenExchangeHttpExchange | TokenRefreshHttpExchange | TokenRevocationHttpExchange

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/** Safely get TokenResponsePayload from a token exchange if it exists */
function getTokenPayload(exchange: TokenExchange | null | undefined): TokenResponsePayload | null {
  if (!exchange?.response) return null
  // Check if response has payload property (HttpResponseData structure)
  if ('payload' in exchange.response) {
    const payload = exchange.response.payload
    // Check if it's a TokenResponsePayload (has access_token)
    if (payload && typeof payload === 'object' && 'access_token' in payload) {
      return payload as TokenResponsePayload
    }
  }
  return null
}

interface StepState<T = unknown> {
  status: StepStatus
  data?: T
  error?: string
}

interface AuthFlowState {
  /** Step 1 – Auth server metadata discovery */
  authServerMetadata: StepState<AuthorizationServerDiscoveryResult>
  /** Step 2 – Dynamic client registration (or CIMD bypass) */
  clientRegistration: StepState<ClientRegistrationResult>
  /** Step 3 – Authorization code redirect */
  authorization: StepState<{ authorizationUrl: string }>
  /** Step 4 – Token exchange */
  tokenExchange: StepState<TokenExchange>
  /** Step 5 – Actor discovery */
  actorDiscovery: StepState<ActorDiscoveryResult>
}

interface TokenActionState {
  isRefreshing: boolean
  isRevoking: boolean
  error: string | null
  success: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function idleStep<T>(): StepState<T> {
  return { status: 'idle' }
}

/** Returns true if s is a successful (non-error, non-running) status. */
function isSuccess(s: StepStatus): boolean {
  return s === 'success'
}


// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Singleton cache – one shared instance per serverId so that all components
// calling useAuthFlow(serverId) share the same reactive state and the same
// autoAdvance execution context.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flowInstances = new Map<string, any>()

/**
 * `useAuthFlow` – manages the multi-step OAuth2 authorization flow for a
 * given server entry.  Returns a single reactive `state` object so the
 * calling component can react to every status change, plus individual
 * `run*` functions to drive each step independently.
 *
 * All callers that pass the same `serverId` receive the **same** shared
 * instance, so actions triggered in child components (e.g. panel retry
 * buttons) correctly advance the shared state and trigger autoAdvance.
 *
 * @param serverId  The `id` of the server entry from `useServerStore`.
 */
export function useAuthFlow(serverId: string) {
  if (flowInstances.has(serverId)) {
    return flowInstances.get(serverId)!
  }
  const instance = createAuthFlow(serverId)
  flowInstances.set(serverId, instance)
  return instance
}

function createAuthFlow(serverId: string) {
  const store = useServerStore()
  const settingsStore = useSettingsStore()

  const state = reactive<AuthFlowState>({
    authServerMetadata: idleStep(),
    clientRegistration: idleStep(),
    authorization: idleStep(),
    tokenExchange: idleStep(),
    actorDiscovery: idleStep(),
  })

  const tokenActionState = reactive<TokenActionState>({
    isRefreshing: false,
    isRevoking: false,
    error: null,
    success: null,
  })

  function clearTokenActionStatus(): void {
    tokenActionState.error = null
    tokenActionState.success = null
  }

  // -------------------------------------------------------------------------
  // Hydrate from persisted store so existing progress is visible on mount
  // -------------------------------------------------------------------------

  function syncFromStore(): void {
    const server = store.servers.find((s: { id: string }) => s.id === serverId)
    if (!server) return

    const oauth2 = server.auth?.oauth2

    if (oauth2?.authServerDiscovery?.success) {
      state.authServerMetadata = { status: 'success', data: oauth2.authServerDiscovery }
    }

    if (oauth2?.clientRegistration) {
      const reg = oauth2.clientRegistration
      const isSuccess =
        reg.registrationMethod === 'CIMD' ||
        reg.registrationMethod === 'Pre-registered' ||
        reg.exchange?.success === true
      if (isSuccess) {
        state.clientRegistration = { status: 'success', data: reg }
      } else if (reg.exchange?.error) {
        state.clientRegistration = { status: 'error', data: reg, error: reg.exchange.error }
      } else {
        state.clientRegistration = idleStep()
      }
    }

    if (oauth2?.authCode) {
      state.authorization = {
        status: 'success',
        data: {
          authorizationUrl:
            oauth2.authServerDiscovery?.authorizationServerMetadata?.authorization_endpoint ??
            oauth2.authServerDiscovery?.exchange?.response?.payload?.authorization_endpoint ??
            '',
        },
      }
    }

    if (oauth2?.tokenExchange?.success) {
      state.tokenExchange = { status: 'success', data: oauth2.tokenExchange }
    }

    if (server.actor?.discovery?.success) {
      state.actorDiscovery = { status: 'success', data: server.actor.discovery }
    }
  }

  syncFromStore()

  // -------------------------------------------------------------------------
  // Reactive server reference (avoids repeated .find calls in computeds)
  // -------------------------------------------------------------------------

  const serverRef = computed(() => store.servers.find((s: { id: string }) => s.id === serverId))

  // -------------------------------------------------------------------------
  // Prerequisites – which steps have all their required inputs ready.
  // These are independent of whether the step has already been run.
  // -------------------------------------------------------------------------

  const prerequisites = computed(() => {
    const server = serverRef.value
    const oauth2 = server?.auth?.oauth2
    return {
      /** Step 1 requires only an authServerOrigin to be set. */
      authServerMetadata: !!oauth2?.authServerOrigin,
      /** Step 2 requires step 1 to have completed successfully. */
      clientRegistration: isSuccess(state.authServerMetadata.status),
      /** Step 3 requires a client_id to be available (from step 2 or pre-configured). */
      authorization:
        isSuccess(state.clientRegistration.status) &&
        !!oauth2?.clientConfig?.clientId,
      /** Step 4 is handled externally (OAuthCallbackPage) – shown as met once an auth code exists. */
      tokenExchange: !!oauth2?.authCode,
      /** Step 5 requires a valid access token. */
      actorDiscovery: !!getTokenPayload(oauth2?.tokenExchange)?.access_token,
    }
  })

  // -------------------------------------------------------------------------
  // autoAdvance – runs all idle steps whose prerequisites are satisfied,
  // in order, stopping early on failure or when a browser redirect happens.
  // Only executes when settingsStore.settings.oauth2AutoRun is true.
  // -------------------------------------------------------------------------

  let isAutoAdvancing = false

  async function autoAdvance(): Promise<void> {
    if (!settingsStore.settings.oauth2AutoRun) return
    const registrationMethod = serverRef.value?.auth?.oauth2?.clientRegistration?.registrationMethod
    if (registrationMethod === 'Pre-registered') return
    if (isAutoAdvancing) return
    isAutoAdvancing = true

    try {
      // Step 1
      if (state.authServerMetadata.status === 'idle' && prerequisites.value.authServerMetadata) {
        await runFetchAuthServerMetadata()
        if (!isSuccess(state.authServerMetadata.status)) return
      }
      if (!isSuccess(state.authServerMetadata.status)) return

      // Step 2
      if (state.clientRegistration.status === 'idle' && prerequisites.value.clientRegistration) {
        await runRegisterClient()
        if (!isSuccess(state.clientRegistration.status)) return
      }
      if (!isSuccess(state.clientRegistration.status)) return

      // Step 3 – redirect; only initiate if no token has been obtained yet
      const hasToken = !!getTokenPayload(serverRef.value?.auth?.oauth2?.tokenExchange)?.access_token
      if (!hasToken && state.authorization.status === 'idle' && prerequisites.value.authorization) {
        await runInitiateAuthorization()
        return // browser is redirected; nothing will execute after this
      }

      // Step 5 – actor discovery (step 4 handled by OAuthCallbackPage)
      if (state.actorDiscovery.status === 'idle' && prerequisites.value.actorDiscovery) {
        await runDiscoverActor()
      }
    } finally {
      isAutoAdvancing = false
    }
  }

  // -------------------------------------------------------------------------
  // Internal helper – resolve current server or throw
  // -------------------------------------------------------------------------

  function requireServer() {
    const server = store.servers.find((s: { id: string }) => s.id === serverId)
    if (!server) throw new Error(`Server '${serverId}' not found in store`)
    return server
  }

  // -------------------------------------------------------------------------
  // Step 1 – Fetch Auth Server Metadata
  //   When `redo` is true, all downstream step states are cleared first.
  // -------------------------------------------------------------------------

  async function runFetchAuthServerMetadata(redo = false): Promise<void> {
    if (redo) {
      state.clientRegistration = idleStep()
      state.authorization = idleStep()
      state.tokenExchange = idleStep()
      state.actorDiscovery = idleStep()
    }

    const server = requireServer()
    const serverStore = useServerStore()
    const serverOrigin = server.auth?.oauth2?.authServerOrigin

    if (!serverOrigin) {
      state.authServerMetadata = { status: 'error', error: 'No server identifier configured' }
      return
    }

    serverStore.clearAuthorizationServerDiscoveryResult(serverId)

    state.authServerMetadata = { status: 'running' }

    try {
      const result = await getAuthorizationServerMetadata(serverOrigin)

      serverStore.saveAuthorizationServerDiscoveryResult(serverId, result)

      if (result.success) {
        state.authServerMetadata = { status: 'success', data: result }
        store.saveAuthorizationServerDiscoveryResult(serverId, result)
        void autoAdvance()
      } else {
        state.authServerMetadata = {
          status: 'error',
          data: result,
          error: result.error ?? result.exchange?.error ?? 'Auth server metadata discovery failed',
        }
      }
    } catch (e) {
      state.authServerMetadata = {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 2 – Register Client
  //   Skipped (marked success as 'CIMD') when client_id is an absolute URL,
  //   indicating Client ID Metadata Document usage.
  // -------------------------------------------------------------------------

  async function runRegisterClient(): Promise<void> {
    const server = requireServer()

    if (server.auth?.oauth2?.clientRegistration?.registrationMethod === 'Pre-registered') {
      state.clientRegistration = {
        status: 'success',
        data: server.auth.oauth2.clientRegistration,
      }
      return
    }

    const authServerMetadata =
      server.auth?.oauth2?.authServerDiscovery?.authorizationServerMetadata ??
      server.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload

    if (!authServerMetadata) {
      state.clientRegistration = {
        status: 'error',
        error: 'Auth server metadata unavailable – run step 1 first',
      }
      return
    }

    const clientConfig = server.auth?.oauth2?.clientConfig

    // CIMD: client_id is a URL → skip dynamic registration
    //if (isDefined(clientConfig?.clientId) && isAbsoluteUrl(clientConfig!.clientId)) {
    if (authServerMetadata.client_id_metadata_document_supported) {
      try {
        const cimdUrl = `${window.location.origin}/client-metadata.json`;
        const cimdResponse = await fetch(cimdUrl);
        if (!cimdResponse.ok) {
          store.saveClientRegistrationResult(serverId, {
              registrationMethod: "CIMD",
              exchange: {
                success: false,
                error: `Failed to fetch CIMD document: ${cimdResponse.status} ${cimdResponse.statusText}`,
                request: {
                  url: cimdUrl,
                  headers: {}, // No specific headers sent in CIMD fetch
                },
                response: {
                  status_code: cimdResponse.status,
                  status_text: cimdResponse.statusText,
                  headers: Object.fromEntries(cimdResponse.headers.entries()),
                },
              }
            })
        }

        const cimdData = await cimdResponse.json();

        const cimdResult: ClientRegistrationResult = {
          registrationMethod: "CIMD",
          exchange: {
            success: true,
            request: {
              url: cimdUrl,
              headers: {}, // No specific headers sent in CIMD fetch
            },
            response: {
              status_code: cimdResponse.status,
              status_text: cimdResponse.statusText,
              headers: Object.fromEntries(cimdResponse.headers.entries()),
              payload: cimdData,
            },
          },
        };

        state.clientRegistration = { status: "success", data: cimdResult };
        store.saveClientRegistrationResult(serverId, cimdResult);

        // Save CIMD data as clientConfig
        store.saveClientConfig(serverId, {
          clientId: cimdData.client_id,
          clientSecret: cimdData.client_secret,
          redirectUri: cimdData.redirect_uris.join(', '),
          scopes: cimdData.scope,
        });

        void autoAdvance();
        return;
      } catch (e) {
        state.clientRegistration = {
          status: "error",
          error:
            e instanceof Error ? e.message : "Failed to fetch CIMD document",
        };
        return;
      }
    }

    state.clientRegistration = { status: 'running' }

    try {
      const serverOrigin = server.auth?.oauth2?.authServerOrigin
      if (!serverOrigin) {
        state.clientRegistration = {
          status: 'error',
          error: 'Auth server origin unavailable',
        }
        return
      }

      const serverUrl = new URL(serverOrigin)

      const redirectUri =
        clientConfig?.redirectUri || `${window.location.origin}/callback`

      const clientName = server.name || settingsStore.settings.oauth2Defaults.clientName
      const scopes = clientConfig?.scopes || settingsStore.settings.oauth2Defaults.scopes

      const params = defaultClientRegistrationParams(
        clientName,
        [redirectUri],
        scopes,
      )

      const result = await registerClient(serverUrl, authServerMetadata.registration_endpoint, params)

      if (result.exchange?.success) {
        state.clientRegistration = { status: 'success', data: result }
        store.saveClientRegistrationResult(serverId, result)

        // Propagate registered credentials into clientConfig
        const regData = result.exchange.response?.payload
        if (regData?.client_id) {
          store.saveClientConfig(serverId, {
            clientId: regData.client_id,
            clientSecret: regData.client_secret ?? clientConfig?.clientSecret ?? '',
            redirectUri,
            scopes: scopes,
          })
        }
        void autoAdvance()
      } else {
        state.clientRegistration = {
          status: 'error',
          data: result,
          error: result.exchange?.error ?? 'Client registration failed',
        }
        // Persist the failed result so store-watching components (e.g.
        // ClientRegistrationPanel) receive the error via their watchers.
        store.saveClientRegistrationResult(serverId, result)
      }
    } catch (e) {
      state.clientRegistration = {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 3 – Initiate Authorization (redirect)
  //   Sets state to 'running' then redirects; 'success' is set optimistically
  //   before the redirect executes.  Errors (missing config etc.) surface as
  //   'error' without a redirect.
  // -------------------------------------------------------------------------

  async function runInitiateAuthorization(): Promise<void> {
    const server = requireServer()
    const metadata =
      server.auth?.oauth2?.authServerDiscovery?.authorizationServerMetadata ??
      server.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload

    if (!metadata) {
      state.authorization = {
        status: 'error',
        error: 'Auth server metadata unavailable – run step 1 first',
      }
      return
    }

    const clientConfig = server.auth?.oauth2?.clientConfig

    if (!isDefined(clientConfig?.clientId)) {
      state.authorization = {
        status: 'error',
        error: 'Client ID not configured – run step 2 first',
      }
      return
    }

    state.authorization = { status: 'running' }

    try {
      // Record where we intend to redirect (before the redirect happens)
      const authUrl = metadata.authorization_endpoint ?? ''

      // This call redirects the browser; code after it will not run normally.
      await initiateAuthorizationFlow({
        serverOrigin: serverId,
        serverMetadata: metadata,
        clientConfig: clientConfig!,
      })

      // Reached only if initiateAuthorizationFlow doesn't redirect (e.g. in tests)
      state.authorization = { status: 'success', data: { authorizationUrl: authUrl } }
    } catch (e) {
      state.authorization = {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 4 – Exchange Authorization Code for Access Token
  // -------------------------------------------------------------------------

  async function runExchangeCode(code?: string): Promise<void> {
    const server = requireServer()
    const metadata =
      server.auth?.oauth2?.authServerDiscovery?.authorizationServerMetadata ??
      server.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload

    if (!metadata) {
      state.tokenExchange = {
        status: 'error',
        error: 'Auth server metadata unavailable – run step 1 first',
      }
      return
    }

    const clientConfig = server.auth?.oauth2?.clientConfig

    if (!isDefined(clientConfig?.clientId)) {
      state.tokenExchange = { status: 'error', error: 'Client ID not configured' }
      return
    }

    const authCode = code ?? server.auth?.oauth2?.authCode

    if (!isDefined(authCode)) {
      state.tokenExchange = {
        status: 'error',
        error: 'Authorization code unavailable – complete step 3 first',
      }
      return
    }

    state.tokenExchange = { status: 'running' }

    try {
      const result = await exchangeCodeForToken({
        serverOrigin: serverId,
        authCode: authCode!,
        authServerMetadata: metadata,
        clientConfig: clientConfig!,
      })

      if (result.success) {
        state.tokenExchange = { status: 'success', data: result }
        store.saveTokenExchange(serverId, result)
        void autoAdvance()
      } else {
        state.tokenExchange = {
          status: 'error',
          data: result,
          error: result.error ?? 'Token exchange failed',
        }
      }
    } catch (e) {
      state.tokenExchange = {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 5 – Discover Actor URI
  // -------------------------------------------------------------------------

  async function runDiscoverActor(): Promise<void> {
    const server = requireServer()
    const metadata =
      server.auth?.oauth2?.authServerDiscovery?.authorizationServerMetadata ??
      server.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload

    if (!metadata) {
      state.actorDiscovery = {
        status: 'error',
        error: 'Auth server metadata unavailable – run step 1 first',
      }
      return
    }

    const tokenPayload = getTokenPayload(server.auth?.oauth2?.tokenExchange)

    if (!tokenPayload?.access_token) {
      state.actorDiscovery = {
        status: 'error',
        error: 'Access token unavailable – complete step 4 first',
      }
      return
    }

    const clientConfig = server.auth?.oauth2?.clientConfig

    state.actorDiscovery = { status: 'running' }

    try {
      const result = await discoverActor(
        tokenPayload,
        metadata,
        clientConfig?.clientId,
        clientConfig?.clientSecret,
      )

      if (result.success) {
        state.actorDiscovery = { status: 'success', data: result }
        store.saveActorDiscovery(serverId, result)
      } else {
        state.actorDiscovery = {
          status: 'error',
          data: result,
          error: 'Actor discovery failed – no actor URI found by any method',
        }
      }
    } catch (e) {
      state.actorDiscovery = {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  // -------------------------------------------------------------------------
  // Token actions – refresh and revoke (post-flow management)
  // -------------------------------------------------------------------------

  async function refreshToken(): Promise<void> {
    const server = requireServer()
    const tokenPayload = getTokenPayload(server.auth?.oauth2?.tokenExchange)
    if (!tokenPayload?.refresh_token) return

    const authServerMetadata =
      server.auth?.oauth2?.authServerDiscovery?.authorizationServerMetadata ??
      server.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload
    if (!authServerMetadata) return

    const clientConfig = server.auth?.oauth2?.clientConfig
    if (!clientConfig?.clientId || !clientConfig?.redirectUri) {
      tokenActionState.error = 'Client configuration is incomplete. Cannot refresh token.'
      return
    }

    tokenActionState.isRefreshing = true
    tokenActionState.error = null
    tokenActionState.success = null

    try {
      const result = await refreshAccessToken(
        serverId,
        tokenPayload.refresh_token,
        authServerMetadata,
        clientConfig,
      )

      if (result.success && result.response) {
        store.saveTokenExchange(serverId, result)
        tokenActionState.success = 'Token refreshed successfully'
        setTimeout(() => { tokenActionState.success = null }, 5000)
      } else {
        tokenActionState.error = result.error ?? 'Token refresh failed'
      }
    } catch (e) {
      tokenActionState.error = e instanceof Error ? e.message : 'Unexpected error during token refresh'
    } finally {
      tokenActionState.isRefreshing = false
    }
  }

  async function revokeAccessToken(): Promise<void> {
    const server = requireServer()
    const tokenPayload = getTokenPayload(server.auth?.oauth2?.tokenExchange)
    const accessToken = tokenPayload?.access_token
    if (!accessToken) {
      tokenActionState.error = 'No access token found to revoke.'
      return
    }

    const authServerMetadata =
      server.auth?.oauth2?.authServerDiscovery?.authorizationServerMetadata ??
      server.auth?.oauth2?.authServerDiscovery?.exchange?.response?.payload
    if (!authServerMetadata) return

    const clientConfig = server.auth?.oauth2?.clientConfig
    if (!clientConfig?.clientId || !clientConfig?.redirectUri) {
      tokenActionState.error = 'Client configuration is incomplete. Cannot revoke token.'
      return
    }

    tokenActionState.isRevoking = true
    tokenActionState.error = null
    tokenActionState.success = null

    try {
      const result = await revokeToken(
        serverId,
        accessToken,
        'access_token',
        authServerMetadata,
        clientConfig,
      )

      if (result.success) {
        // Save revocation as a successful exchange (also clears actor data)
        store.saveTokenRevocation(serverId, result)
      } else {
        tokenActionState.error = result.error ?? 'Token revocation failed'
      }
    } catch (e) {
      tokenActionState.error = e instanceof Error ? e.message : 'Unexpected error during token revocation'
    } finally {
      tokenActionState.isRevoking = false
    }
  }

  // -------------------------------------------------------------------------
  // Derived convenience flags
  // -------------------------------------------------------------------------

  /** True once all five steps have completed successfully. */
  const isComplete = computed(
    () =>
      state.authServerMetadata.status === 'success' &&
      state.clientRegistration.status === 'success' &&
      state.authorization.status === 'success' &&
      state.tokenExchange.status === 'success' &&
      state.actorDiscovery.status === 'success',
  )

  /** True while any step is actively running. */
  const isRunning = computed(() =>
    (Object.values(state) as StepState[]).some((s) => s.status === 'running'),
  )

  return {
    /** Reactive state for all five flow steps. */
    state,
    /** Reactive state for post-flow token actions (refresh / revoke). */
    tokenActionState,
    clearTokenActionStatus,
    /** Whether each step's prerequisites are currently satisfied. */
    prerequisites,
    isComplete,
    isRunning,
    // Step runners
    runFetchAuthServerMetadata,
    runRegisterClient,
    runInitiateAuthorization,
    runExchangeCode,
    runDiscoverActor,
    // Token actions
    refreshToken,
    revokeAccessToken,
    /** Run all idle steps whose prerequisites are satisfied (respects autoRun setting). */
    autoAdvance,
    /** Re-hydrate state from persisted store data. */
    syncFromStore,
  }
}
