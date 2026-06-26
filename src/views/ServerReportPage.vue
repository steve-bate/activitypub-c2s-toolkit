<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useServerStore } from '@/stores/serverStore'
import type { TestStatus } from '@/testing/core/types'
import PrinterIcon from '@/components/icons/PrinterIcon.vue'
import { createReusableTemplate } from '@vueuse/core'

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

// ── Actor Information ─────────────────────────────────────────────────────────

const actor = computed(() => server.value?.actor)

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

const [DefineSectionHeading, SectionHeading] = createReusableTemplate()
const [DefineDataItemList, DataItemList] = createReusableTemplate()
const [DefineDataItem, DataItem] = createReusableTemplate()
</script>

<template>
  <DefineSectionHeading v-slot="{ $slots }">
    <h2 class="text-xl font-semibold text-gray-800 dark:text-white print:text-black mb-1">
      <component :is="$slots.default" v-if="$slots.default" />
    </h2>
    <hr class="border-gray-200 dark:border-gray-700 print:border-gray-300 mb-4" />
  </DefineSectionHeading>

  <DefineDataItemList v-slot="{ $slots }">
    <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
      <component :is="$slots.default" v-if="$slots.default" />
    </dl>
  </DefineDataItemList>

  <DefineDataItem v-slot="{ label, $slots }">
    <dt class="font-medium text-gray-500 dark:text-gray-400 print:text-gray-500">
      {{ label }}
    </dt>
    <dd>
      <component :is="$slots.default" v-if="$slots.default" />
      <span v-else>—</span>
    </dd>
  </DefineDataItem>

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
        <button @click="printReport"
          class="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
          <PrinterIcon />
          Print / Save as PDF
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- Report document                                                    -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <article class="max-w-3xl mx-auto bg-white dark:bg-gray-800 shadow-sm print:shadow-none rounded-lg overflow-hidden
               text-gray-900 dark:text-gray-100 print:text-black">

        <!-- ── Cover / Header ──────────────────────────────────────────────── -->
        <header class="px-10 pt-10 pb-6 border-b border-gray-200 dark:border-gray-700 print:border-gray-300">
          <p
            class="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 print:text-gray-500 mb-2">
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
            <SectionHeading>1. Server Software (NodeInfo)</SectionHeading>

            <div v-if="nodeinfoData" class="space-y-4">

              <!-- Node identity -->
              <div v-if="nodeName || nodeDescription" class="mb-2">
                <p v-if="nodeName" class="text-base font-medium">{{ nodeName }}</p>
                <p v-if="nodeDescription" class="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600 mt-0.5">{{
                  nodeDescription }}</p>
              </div>

              <!-- Key/value grid -->
              <DataItemList>
                <DataItem label="Software">
                  {{ nodeinfoData.software?.name ?? '—' }}
                  <span v-if="nodeinfoData.software?.version" class="text-gray-500 dark:text-gray-400"> v{{
                    nodeinfoData.software.version }}</span>
                </DataItem>
                <DataItem label="Repository" v-if="nodeinfoData.software?.repository">
                  <a :href="nodeinfoData.software.repository" target="_blank" rel="noopener noreferrer"
                    class="text-blue-600 dark:text-blue-400 print:text-blue-700 hover:underline break-all">
                    {{ nodeinfoData.software.repository }}
                  </a>
                </DataItem>
                <DataItem label="Homepage" v-if="nodeinfoData.software?.homepage">
                  <a :href="nodeinfoData.software.homepage" target="_blank" rel="noopener noreferrer"
                    class="text-blue-600 dark:text-blue-400 print:text-blue-700 hover:underline break-all">
                    {{ nodeinfoData.software.homepage }}
                  </a>
                </DataItem>
                <DataItem label="Protocols" v-if="nodeinfoData.protocols?.length">
                  {{ nodeinfoData.protocols.join(', ') }}
                </DataItem>
                <DataItem label="Open Registrations" v-if="nodeinfoData.openRegistrations != null">
                  {{ nodeinfoData.openRegistrations ? 'Yes' : 'No' }}
                </DataItem>
              </DataItemList>

              <!-- Services -->
              <div v-if="nodeinfoData.services?.inbound?.length || nodeinfoData.services?.outbound?.length"
                class="mt-2">
                <p class="text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 mb-1">Services</p>
                <DataItemList>
                  <DataItem label="Inbound" v-if="nodeinfoData.services?.inbound?.length">
                    {{ nodeinfoData.services.inbound.join(', ') }}
                  </DataItem>
                  <DataItem label="Outbound" v-if="nodeinfoData.services?.outbound?.length">
                    {{ nodeinfoData.services.outbound.join(', ') }}
                  </DataItem>
                </DataItemList>
              </div>

              <!-- Usage stats -->
              <div v-if="nodeinfoData.usage" class="mt-2">
                <p class="text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 mb-1">Usage</p>
                <DataItemList>
                  <DataItem label="Total Users" v-if="nodeinfoData.usage.users?.total != null">
                    {{ nodeinfoData.usage.users.total.toLocaleString() }}
                  </DataItem>
                  <DataItem label="Active (Monthly)" v-if="nodeinfoData.usage.users?.activeMonth != null">
                    {{ nodeinfoData.usage.users.activeMonth.toLocaleString() }}
                  </DataItem>
                  <DataItem label="Active (6 Months)" v-if="nodeinfoData.usage.users?.activeHalfyear != null">
                    {{ nodeinfoData.usage.users.activeHalfyear.toLocaleString() }}
                  </DataItem>
                  <DataItem label="Local Posts" v-if="nodeinfoData.usage.localPosts != null">
                    {{ nodeinfoData.usage.localPosts.toLocaleString() }}
                  </DataItem>
                </DataItemList>
              </div>
            </div>

            <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">
              NodeInfo has not been fetched for this server. Visit the server overview page to load it.
            </p>
          </section>

          <!-- ── 2. Authorization ──────────────────────────────────────────── -->
          <section>
            <SectionHeading>2. Authorization</SectionHeading>

            <!-- Summary line -->
            <DataItemList>
              <DataItem label="Method">
                <span v-if="server.auth?.authType === 'oauth2'" class="font-medium">OAuth 2.0</span>
                <span v-else-if="server.auth?.authType === 'bearer'" class="font-medium">Bearer Token</span>
                <span v-else class="text-gray-400">Not configured</span>
              </DataItem>
              <DataItem label="Discovery Method">
                {{ server.auth?.oauth2?.authServerDiscovery?.discoveryMethod ?? 'N/A' }}
              </DataItem>
            </DataItemList>

            <!-- Bearer note -->
            <p v-if="server.auth?.authType === 'bearer'"
              class="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600 italic">
              A Bearer token is configured. The token value is omitted from this report.
            </p>

            <!-- OAuth2 subsections -->
            <template v-else-if="server.auth?.authType === 'oauth2' && oauth2">
              <!-- 2.1 Authorization Server -->
              <h3 class="text-base font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700 mt-4 mb-2">
                2.1 Authorization Server
              </h3>
              <DataItemList>
                <DataItem label="Origin">{{ oauth2.authServerOrigin }}</DataItem>

                <template v-if="authServerMeta">
                  <DataItem label="Issuer">{{ authServerMeta.issuer }}</DataItem>
                  <DataItem label="Authorization Endpoint" v-if="authServerMeta.authorization_endpoint">
                    {{ authServerMeta.authorization_endpoint }}
                  </DataItem>
                  <DataItem label="Token Endpoint" v-if="authServerMeta.token_endpoint">
                    {{ authServerMeta.token_endpoint }}
                  </DataItem>
                  <DataItem label="Scopes Supported" v-if="authServerMeta.scopes_supported?.length">
                    {{ authServerMeta.scopes_supported.join(', ') }}
                  </DataItem>
                  <DataItem label="Grant Types" v-if="authServerMeta.grant_types_supported?.length">
                    {{ authServerMeta.grant_types_supported.join(', ') }}
                  </DataItem>
                  <DataItem label="Response Types" v-if="authServerMeta.response_types_supported?.length">
                    {{ authServerMeta.response_types_supported.join(', ') }}
                  </DataItem>
                  <DataItem label="Token Auth Methods"
                    v-if="authServerMeta.token_endpoint_auth_methods_supported?.length">
                    {{ authServerMeta.token_endpoint_auth_methods_supported.join(', ') }}
                  </DataItem>
                </template>
                <DataItem label="Metadata" italic v-else>Not yet discovered</DataItem>
              </DataItemList>

              <!-- 2.2 Client Registration -->
              <h3 class="text-base font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700 mt-6 mb-2">
                2.2 Client Registration
              </h3>
              <DataItemList v-if="clientReg">
                <DataItem label="Client ID">
                  {{ clientReg.client_id }}
                </DataItem>
                <DataItem label="Client Name" v-if="clientReg.client_name ?? clientReg.name">
                  {{ clientReg.client_name ?? clientReg.name }}
                </DataItem>
                <DataItem label="Redirect URIs" v-if="clientReg.redirect_uris?.length">
                  {{ clientReg.redirect_uris.join(', ') }}
                </DataItem>
                <DataItem label="Scope" v-if="clientReg.scope">
                  {{ clientReg.scope }}
                </DataItem>
                <DataItem label="Registration Method" v-if="oauth2.clientRegistration?.registrationMethod">
                  {{ oauth2.clientRegistration.registrationMethod }}
                </DataItem>
              </DataItemList>
              <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">Client not yet registered.</p>

              <!-- 2.3 Access Token -->
              <h3 class="text-base font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700 mt-6 mb-2">
                2.3 Access Token
              </h3>
              <DataItemList v-if="tokenPayload">
                <DataItem label="Token Type" v-if="tokenPayload.token_type">
                  {{ tokenPayload.token_type }}
                </DataItem>
                <DataItem label="Scope" v-if="tokenPayload.scope">
                  {{ tokenPayload.scope }}
                </DataItem>
                <DataItem label="Expires In" v-if="tokenPayload.expires_in != null">
                  {{ tokenPayload.expires_in }} s
                </DataItem>
              </DataItemList>
              <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">No access token acquired yet.</p>
            </template>
          </section>

          <!-- ── Actor Information ───────────────────────────────────────────── -->
          <section>
            <SectionHeading>3. ActivityPub Actor</SectionHeading>

            <p v-if="!actor" class="text-sm text-gray-400 dark:text-gray-500 italic">
              No ActivityPub actor information has been recorded for this server.
            </p>

            <template v-else>
              <DataItemList>
                <DataItem label="URI">
                  {{ actor.profile.id }}
                </DataItem>
                <DataItem label="Discovery Method">
                  {{ actor.discovery.method ?? "N/A" }}
                </DataItem>
                <DataItem label="Endpoints">
                  {{ actor.profile.endpoints ? Object.keys(actor.profile.endpoints).join(" ") : "N/A" }}
                </DataItem>
                <DataItem label="Streams" v-if="actor.profile.streams">
                  {{ Object.keys(actor.profile.streams).join(" ") }}
                </DataItem>
              </DataItemList>
            </template>
          </section>


          <!-- ── 4. Test Results ───────────────────────────────────────────── -->
          <section>
            <SectionHeading>4. Test Results</SectionHeading>

            <p v-if="!testResults" class="text-sm text-gray-400 dark:text-gray-500 italic">
              No test results have been recorded for this server yet.
              Run the test suite from the Tests page first.
            </p>

            <template v-else>
              <!-- Run metadata -->
              <DataItemList>
                <DataItem label="Suite">
                  {{ testResults.suiteName }}
                </DataItem>
                <DataItem label="Run ID">
                  {{ testResults.runId }}
                </DataItem>
                <DataItem label="Started">
                  {{ formatDate(testResults.startedAt) }}
                </DataItem>
                <DataItem label="Duration">
                  {{ formatDuration(testResults.durationMs) }}
                </DataItem>
              </DataItemList>

              <!-- Summary row -->
              <div
                class="flex flex-wrap gap-4 text-sm font-medium mb-5 py-3 border-y border-gray-200 dark:border-gray-700 print:border-gray-300">
                <span class="text-green-700 dark:text-green-400 print:text-green-700">
                  ✓ {{ testResults.summary.pass }} passed
                </span>
                <span v-if="testResults.summary.fail > 0" class="text-red-700 dark:text-red-400 print:text-red-700">
                  ✗ {{ testResults.summary.fail }} failed
                </span>
                <span v-if="testResults.summary.error > 0"
                  class="text-orange-700 dark:text-orange-400 print:text-orange-700">
                  ! {{ testResults.summary.error }} error{{ testResults.summary.error !== 1 ? 's' : '' }}
                </span>
                <span v-if="testResults.summary.skip > 0" class="text-gray-500 dark:text-gray-400">
                  – {{ testResults.summary.skip }} skipped
                </span>
                <span v-if="testResults.summary.inconclusive > 0"
                  class="text-yellow-700 dark:text-yellow-400 print:text-yellow-700">
                  ? {{ testResults.summary.inconclusive }} inconclusive
                </span>
                <span class="text-gray-400 dark:text-gray-500 ml-auto">
                  {{ testResults.summary.total }} total
                </span>
              </div>

              <!-- Per-test table -->
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr
                    class="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 print:text-gray-500">
                    <th class="pb-2 pr-2 font-semibold" style="width:2ch"></th>
                    <th class="pb-2 pr-4 font-semibold">Test Case</th>
                    <th class="pb-2 text-right font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="result in testResults.results" :key="result.id"
                    class="border-t border-gray-100 dark:border-gray-700 print:border-gray-200">
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
        <footer
          class="px-10 py-5 border-t border-gray-200 dark:border-gray-700 print:border-gray-300 text-xs text-gray-400 dark:text-gray-500 print:text-gray-400 flex justify-between">
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
