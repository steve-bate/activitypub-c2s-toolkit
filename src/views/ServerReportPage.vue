<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'
import type { TestStatus } from '@/testing/core/types'

const route = useRoute()
const serverStore = useServerStore()

const serverId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? id[0] : id
})

const server = computed(() => serverStore.activeServer)

onMounted(() => {
  if (serverId.value) {
    serverStore.setActiveServer(serverId.value)
  }
})

const reportDate = new Date().toLocaleString(undefined, {
  year: 'numeric', month: 'long', day: 'numeric',
  hour: '2-digit', minute: '2-digit',
})

// ── NodeInfo ──────────────────────────────────────────────────────────────────

const nodeinfoData = computed(() => server.value?.nodeinfo?.data?.response?.payload)

const nodeName = computed(() => {
  const v = nodeinfoData.value?.metadata?.nodeName
  return typeof v === 'string' && v.trim() ? v : null
})

const nodeDescription = computed(() => {
  const v = nodeinfoData.value?.metadata?.nodeDescription
  return typeof v === 'string' && v.trim() ? v : null
})

// ── Auth section ──────────────────────────────────────────────────────────────

const oauth2 = computed(() => server.value?.auth?.oauth2)

const authServerMeta = computed(
  () => oauth2.value?.authServerDiscovery?.authorizationServerMetadata
)

const clientReg = computed(
  () => oauth2.value?.clientRegistration?.exchange?.response?.payload
)

const tokenPayload = computed(() => {
  const ex = oauth2.value?.tokenExchange
  if (!ex) return null
  return (ex as { response?: { payload?: unknown } }).response?.payload as
    | { token_type?: string; scope?: string; expires_in?: number }
    | null
    | undefined
})

// ── Test results ──────────────────────────────────────────────────────────────

const testResults = computed(() => server.value?.testing?.results ?? null)

const STATUS_SYMBOL: Record<TestStatus, string> = {
  pass: '✓',
  fail: '✗',
  error: '!',
  skip: '–',
  inconclusive: '?',
}

const STATUS_CLASS: Record<TestStatus, string> = {
  pass: 'text-green-700 dark:text-green-400',
  fail: 'text-red-700 dark:text-red-400',
  error: 'text-orange-700 dark:text-orange-400',
  skip: 'text-gray-500 dark:text-gray-400',
  inconclusive: 'text-yellow-700 dark:text-yellow-400',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function printReport() {
  window.print()
}
</script>

<template>
  <!-- Screen chrome: page background + print button -->
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900 print:bg-white py-8 print:py-0">

    <!-- Not found -->
    <div v-if="!server" class="max-w-2xl mx-auto px-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
        <p class="text-gray-600 dark:text-gray-400">Server not found.</p>
      </div>
    </div>

    <template v-else>
      <!-- Print button (screen only) -->
      <div class="max-w-3xl mx-auto px-6 mb-4 flex justify-end print:hidden">
        <button
          @click="printReport"
          class="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Save as PDF
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- Report document                                                    -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <article
        class="max-w-3xl mx-auto bg-white dark:bg-gray-800 shadow-sm print:shadow-none rounded-lg overflow-hidden
               text-gray-900 dark:text-gray-100 print:text-black"
      >

        <!-- ── Cover / Header ──────────────────────────────────────────────── -->
        <header class="px-10 pt-10 pb-6 border-b border-gray-200 dark:border-gray-700 print:border-gray-300">
          <p class="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 print:text-gray-500 mb-2">
            ActivityPub C2S Toolkit
          </p>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white print:text-black">
            C2S Server Report
          </h1>
          <p class="mt-2 text-lg text-gray-600 dark:text-gray-300 print:text-gray-700 text-sm">
            {{ server.origin ?? server.auth?.oauth2?.authServerOrigin }}
          </p>
          <p v-if="server.notes" class="mt-2 text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
            {{ server.notes }} 
          </p>
          <p class="mt-4 text-sm text-gray-400 dark:text-gray-500 print:text-gray-500">
            Generated {{ reportDate }}
          </p>
        </header>

        <!-- ── Body ───────────────────────────────────────────────────────── -->
        <div class="px-10 py-8 space-y-10">

          <!-- ── 1. Server Software ────────────────────────────────────────── -->
          <section>
            <h2 class="text-xl font-semibold text-gray-800 dark:text-white print:text-black mb-1">
              1. Server Software (NodeInfo)
            </h2>
            <hr class="border-gray-200 dark:border-gray-700 print:border-gray-300 mb-4" />

            <div v-if="nodeinfoData" class="space-y-4">

              <!-- Node identity -->
              <div v-if="nodeName || nodeDescription" class="mb-2">
                <p v-if="nodeName" class="text-base font-medium">{{ nodeName }}</p>
                <p v-if="nodeDescription" class="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600 mt-0.5">{{ nodeDescription }}</p>
              </div>

              <!-- Key/value grid -->
              <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
                <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Software</dt>
                <dd>
                  {{ nodeinfoData.software?.name ?? '—' }}
                  <span v-if="nodeinfoData.software?.version" class="text-gray-500 dark:text-gray-400"> v{{ nodeinfoData.software.version }}</span>
                </dd>

                <template v-if="nodeinfoData.software?.repository">
                  <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Repository</dt>
                  <dd>
                    <a :href="nodeinfoData.software.repository" target="_blank" rel="noopener noreferrer"
                       class="text-blue-600 dark:text-blue-400 print:text-blue-700 hover:underline break-all">
                      {{ nodeinfoData.software.repository }}
                    </a>
                  </dd>
                </template>

                <template v-if="nodeinfoData.software?.homepage">
                  <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Homepage</dt>
                  <dd>
                    <a :href="nodeinfoData.software.homepage" target="_blank" rel="noopener noreferrer"
                       class="text-blue-600 dark:text-blue-400 print:text-blue-700 hover:underline break-all">
                      {{ nodeinfoData.software.homepage }}
                    </a>
                  </dd>
                </template>

                <template v-if="nodeinfoData.protocols?.length">
                  <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Protocols</dt>
                  <dd>{{ nodeinfoData.protocols.join(', ') }}</dd>
                </template>

                <template v-if="nodeinfoData.openRegistrations != null">
                  <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Open Registrations</dt>
                  <dd>{{ nodeinfoData.openRegistrations ? 'Yes' : 'No' }}</dd>
                </template>
              </dl>

              <!-- Services -->
              <div
                v-if="nodeinfoData.services?.inbound?.length || nodeinfoData.services?.outbound?.length"
                class="mt-2"
              >
                <p class="text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 mb-1">Services</p>
                <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
                  <template v-if="nodeinfoData.services?.inbound?.length">
                    <dt class="text-gray-500 dark:text-gray-400 print:text-gray-500">Inbound</dt>
                    <dd>{{ nodeinfoData.services.inbound.join(', ') }}</dd>
                  </template>
                  <template v-if="nodeinfoData.services?.outbound?.length">
                    <dt class="text-gray-500 dark:text-gray-400 print:text-gray-500">Outbound</dt>
                    <dd>{{ nodeinfoData.services.outbound.join(', ') }}</dd>
                  </template>
                </dl>
              </div>

              <!-- Usage stats -->
              <div v-if="nodeinfoData.usage" class="mt-2">
                <p class="text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 mb-1">Usage</p>
                <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
                  <template v-if="nodeinfoData.usage.users?.total != null">
                    <dt class="text-gray-500 dark:text-gray-400 print:text-gray-500">Total Users</dt>
                    <dd>{{ nodeinfoData.usage.users.total.toLocaleString() }}</dd>
                  </template>
                  <template v-if="nodeinfoData.usage.users?.activeMonth != null">
                    <dt class="text-gray-500 dark:text-gray-400 print:text-gray-500">Active (Monthly)</dt>
                    <dd>{{ nodeinfoData.usage.users.activeMonth.toLocaleString() }}</dd>
                  </template>
                  <template v-if="nodeinfoData.usage.users?.activeHalfyear != null">
                    <dt class="text-gray-500 dark:text-gray-400 print:text-gray-500">Active (6 Months)</dt>
                    <dd>{{ nodeinfoData.usage.users.activeHalfyear.toLocaleString() }}</dd>
                  </template>
                  <template v-if="nodeinfoData.usage.localPosts != null">
                    <dt class="text-gray-500 dark:text-gray-400 print:text-gray-500">Local Posts</dt>
                    <dd>{{ nodeinfoData.usage.localPosts.toLocaleString() }}</dd>
                  </template>
                </dl>
              </div>
            </div>

            <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">
              NodeInfo has not been fetched for this server. Visit the server overview page to load it.
            </p>
          </section>

          <!-- ── 2. Authorization ──────────────────────────────────────────── -->
          <section>
            <h2 class="text-xl font-semibold text-gray-800 dark:text-white print:text-black mb-1">
              2. Authorization
            </h2>
            <hr class="border-gray-200 dark:border-gray-700 print:border-gray-300 mb-4" />

            <!-- Summary line -->
            <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm mb-6">
              <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Method</dt>
              <dd>
                <span v-if="server.auth?.authType === 'oauth2'" class="font-medium">OAuth 2.0</span>
                <span v-else-if="server.auth?.authType === 'bearer'" class="font-medium">Bearer Token</span>
                <span v-else class="text-gray-400">Not configured</span>
              </dd>
              <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Status</dt>
              <dd>
                <span
                  v-if="server.auth?.authStatus === 'authorized'"
                  class="font-medium text-green-700 dark:text-green-400 print:text-green-700"
                >Authorized</span>
                <span v-else class="text-gray-500">{{ server.auth?.authStatus ?? 'Unknown' }}</span>
              </dd>
            </dl>

            <!-- Bearer note -->
            <p v-if="server.auth?.authType === 'bearer'" class="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600 italic">
              A Bearer token is configured. The token value is omitted from this report.
            </p>

            <!-- OAuth2 subsections -->
            <template v-else-if="server.auth?.authType === 'oauth2' && oauth2">

              <!-- 2.1 Authorization Server -->
              <h3 class="text-base font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700 mt-4 mb-2">
                2.1 Authorization Server
              </h3>
              <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
                <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Origin</dt>
                <dd class="break-all">{{ oauth2.authServerOrigin }}</dd>

                <template v-if="authServerMeta">
                  <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Issuer</dt>
                  <dd class="break-all">{{ authServerMeta.issuer }}</dd>

                  <template v-if="authServerMeta.authorization_endpoint">
                    <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Authorization Endpoint</dt>
                    <dd class="break-all">{{ authServerMeta.authorization_endpoint }}</dd>
                  </template>

                  <template v-if="authServerMeta.token_endpoint">
                    <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Token Endpoint</dt>
                    <dd class="break-all">{{ authServerMeta.token_endpoint }}</dd>
                  </template>

                  <template v-if="authServerMeta.scopes_supported?.length">
                    <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Scopes Supported</dt>
                    <dd>{{ authServerMeta.scopes_supported.join(', ') }}</dd>
                  </template>

                  <template v-if="authServerMeta.grant_types_supported?.length">
                    <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Grant Types</dt>
                    <dd>{{ authServerMeta.grant_types_supported.join(', ') }}</dd>
                  </template>

                  <template v-if="authServerMeta.response_types_supported?.length">
                    <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Response Types</dt>
                    <dd>{{ authServerMeta.response_types_supported.join(', ') }}</dd>
                  </template>

                  <template v-if="authServerMeta.token_endpoint_auth_methods_supported?.length">
                    <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Token Auth Methods</dt>
                    <dd>{{ authServerMeta.token_endpoint_auth_methods_supported.join(', ') }}</dd>
                  </template>
                </template>
                <template v-else>
                  <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Metadata</dt>
                  <dd class="italic text-gray-400">Not yet discovered</dd>
                </template>
              </dl>

              <!-- 2.2 Client Registration -->
              <h3 class="text-base font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700 mt-6 mb-2">
                2.2 Client Registration
              </h3>
              <dl v-if="clientReg" class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
                <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Client ID</dt>
                <dd class="font-mono text-xs break-all">{{ clientReg.client_id }}</dd>

                <template v-if="clientReg.client_name ?? clientReg.name">
                  <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Client Name</dt>
                  <dd>{{ clientReg.client_name ?? clientReg.name }}</dd>
                </template>

                <template v-if="clientReg.redirect_uris?.length">
                  <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Redirect URIs</dt>
                  <dd class="break-all">{{ clientReg.redirect_uris.join(', ') }}</dd>
                </template>

                <template v-if="clientReg.scope">
                  <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Scope</dt>
                  <dd>{{ clientReg.scope }}</dd>
                </template>

                <template v-if="oauth2.clientRegistration?.registrationMethod">
                  <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Registration Method</dt>
                  <dd>{{ oauth2.clientRegistration.registrationMethod }}</dd>
                </template>
              </dl>
              <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">Client not yet registered.</p>

              <!-- 2.3 Access Token -->
              <h3 class="text-base font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700 mt-6 mb-2">
                2.3 Access Token
              </h3>
              <dl v-if="tokenPayload" class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
                <template v-if="tokenPayload.token_type">
                  <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Token Type</dt>
                  <dd>{{ tokenPayload.token_type }}</dd>
                </template>
                <template v-if="tokenPayload.scope">
                  <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Scope</dt>
                  <dd>{{ tokenPayload.scope }}</dd>
                </template>
                <template v-if="tokenPayload.expires_in != null">
                  <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Expires In</dt>
                  <dd>{{ tokenPayload.expires_in }} s</dd>
                </template>
              </dl>
              <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">No access token acquired yet.</p>

            </template>
          </section>

          <!-- ── 3. Test Results ───────────────────────────────────────────── -->
          <section>
            <h2 class="text-xl font-semibold text-gray-800 dark:text-white print:text-black mb-1">
              3. Test Results
            </h2>
            <hr class="border-gray-200 dark:border-gray-700 print:border-gray-300 mb-4" />

            <p v-if="!testResults" class="text-sm text-gray-400 dark:text-gray-500 italic">
              No test results have been recorded for this server yet.
              Run the test suite from the Tests page first.
            </p>

            <template v-else>
              <!-- Run metadata -->
              <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm mb-5">
                <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Suite</dt>
                <dd>{{ testResults.suiteName }}</dd>
                <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Run ID</dt>
                <dd class="font-mono text-xs">{{ testResults.runId }}</dd>
                <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Started</dt>
                <dd>{{ formatDate(testResults.startedAt) }}</dd>
                <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">Duration</dt>
                <dd>{{ formatDuration(testResults.durationMs) }}</dd>
              </dl>

              <!-- Summary row -->
              <div class="flex flex-wrap gap-4 text-sm font-medium mb-5 py-3 border-y border-gray-200 dark:border-gray-700 print:border-gray-300">
                <span class="text-green-700 dark:text-green-400 print:text-green-700">
                  ✓ {{ testResults.summary.pass }} passed
                </span>
                <span v-if="testResults.summary.fail > 0" class="text-red-700 dark:text-red-400 print:text-red-700">
                  ✗ {{ testResults.summary.fail }} failed
                </span>
                <span v-if="testResults.summary.error > 0" class="text-orange-700 dark:text-orange-400 print:text-orange-700">
                  ! {{ testResults.summary.error }} error{{ testResults.summary.error !== 1 ? 's' : '' }}
                </span>
                <span v-if="testResults.summary.skip > 0" class="text-gray-500 dark:text-gray-400">
                  – {{ testResults.summary.skip }} skipped
                </span>
                <span v-if="testResults.summary.inconclusive > 0" class="text-yellow-700 dark:text-yellow-400 print:text-yellow-700">
                  ? {{ testResults.summary.inconclusive }} inconclusive
                </span>
                <span class="text-gray-400 dark:text-gray-500 ml-auto">
                  {{ testResults.summary.total }} total
                </span>
              </div>

              <!-- Per-test table -->
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 print:text-gray-500">
                    <th class="pb-2 pr-2 font-semibold" style="width:2ch"></th>
                    <th class="pb-2 pr-4 font-semibold">Test Case</th>
                    <th class="pb-2 text-right font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="result in testResults.results"
                    :key="result.id"
                    class="border-t border-gray-100 dark:border-gray-700 print:border-gray-200"
                  >
                    <td class="py-1.5 pr-2 text-center font-mono font-bold" :class="STATUS_CLASS[result.status]">
                      {{ STATUS_SYMBOL[result.status] }}
                    </td>
                    <td class="py-1.5 pr-4">{{ result.name }}</td>
                    <td class="py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400 print:text-gray-500">
                      {{ formatDuration(result.durationMs) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </section>

        </div>

        <!-- ── Footer ──────────────────────────────────────────────────────── -->
        <footer class="px-10 py-5 border-t border-gray-200 dark:border-gray-700 print:border-gray-300 text-xs text-gray-400 dark:text-gray-500 print:text-gray-400 flex justify-between">
          <span>ActivityPub C2S Toolkit</span>
          <span>{{ reportDate }}</span>
        </footer>

      </article>
    </template>
  </div>
</template>

<style>
@media print {
  /* Hide the app header when printing */
  header.sticky {
    display: none !important;
  }
  body {
    background: white !important;
  }
  section {
    break-inside: avoid;
  }
}
</style>
