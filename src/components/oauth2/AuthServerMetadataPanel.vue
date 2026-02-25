<script setup lang="ts">
import { computed } from 'vue'
import type { ResourceServerMetadata } from '@/stores/serverStore'
import { useAuthFlow } from '@/composables/useAuthFlow'
import CopyIcon from '@/components/icons/CopyIcon.vue'
import HttpExchangePanel from '@/components/http/HttpExchangePanel.vue'
import MethodBadge from '@/components/oauth2/MethodBadge.vue'
import DataField from '@/components/DataField.vue'
import DataPanel from '@/components/DataPanel.vue'
import RefreshIcon from '../icons/RefreshIcon.vue'
import RunningIcon from '../icons/RunningIcon.vue'

interface Props {
  server: ResourceServerMetadata
}

const props = defineProps<Props>()

const authServerResult = computed(() => props.server.auth?.oauth2?.authServerDiscovery)
const authServerMetadata = computed(() =>
  authServerResult.value?.authorizationServerMetadata ??
  authServerResult.value?.exchange?.response?.payload ??
  null
)
const pkceSupportLabel = computed(() =>
  authServerMetadata.value?.code_challenge_methods_supported?.includes('S256')
    ? 'Supported (S256)'
    : 'Not supported'
)

const { state, runFetchAuthServerMetadata } = useAuthFlow(props.server.id)

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text)
}

async function handleRefreshMetadata() {
  await runFetchAuthServerMetadata(true)
}
</script>

<template>
  <DataPanel>

    <template #header>
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Authorization Server Metadata</h3>
      <MethodBadge v-if="authServerResult?.discoveryMethod"
        :method="authServerResult?.discoveryMethod" />
    </template>

    <template #header-action>
      <button
        @click="handleRefreshMetadata"
        :disabled="state.authServerMetadata.status === 'running'"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
      >
        <RunningIcon v-if="state.authServerMetadata.status === 'running'"/>
        <RefreshIcon v-else/>
        {{ state.authServerMetadata.status === 'running' ? 'Discovering...' : 'Refresh' }}
      </button>
    </template>

      <!-- Metadata -->
      <div v-if="authServerMetadata" class="space-y-6">

        <!-- Key Endpoints -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Authorization Endpoint -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Authorization Endpoint
            </label>
            <div class="flex items-center gap-2">
              <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 truncate" :title="authServerMetadata.authorization_endpoint">
                {{ authServerMetadata.authorization_endpoint }}
              </code>
              <button @click="copyToClipboard(authServerMetadata.authorization_endpoint ?? '')" class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100" title="Copy to clipboard">
                <CopyIcon class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Token Endpoint -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Token Endpoint
            </label>
            <div class="flex items-center gap-2">
              <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 truncate" :title="authServerMetadata.token_endpoint">
                {{ authServerMetadata.token_endpoint }}
              </code>
              <button @click="copyToClipboard(authServerMetadata.token_endpoint ?? '')" class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100" title="Copy to clipboard">
                <CopyIcon class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Introspection Endpoint -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Introspection Endpoint
            </label>
            <div v-if="authServerMetadata.introspection_endpoint" class="flex items-center gap-2">
              <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 truncate" :title="authServerMetadata.introspection_endpoint">
                {{ authServerMetadata.introspection_endpoint }}
              </code>
              <button @click="copyToClipboard(authServerMetadata.introspection_endpoint ?? '')" class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100" title="Copy to clipboard">
                <CopyIcon class="w-4 h-4" />
              </button>
            </div>
            <div v-else class="text-sm text-gray-500 dark:text-gray-400 italic">Not provided</div>
          </div>

          <!-- Registration Endpoint -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Registration Endpoint
            </label>
            <div v-if="authServerMetadata.registration_endpoint" class="flex items-center gap-2">
              <code class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-gray-100 truncate" :title="authServerMetadata.registration_endpoint">
                {{ authServerMetadata.registration_endpoint }}
              </code>
              <button @click="copyToClipboard(authServerMetadata.registration_endpoint ?? '')" class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100" title="Copy to clipboard">
                <CopyIcon class="w-4 h-4" />
              </button>
            </div>
            <div v-else class="text-sm text-gray-500 dark:text-gray-400 italic">Not provided</div>
          </div>
        </div>

        <!-- PKCE Support -->
        <DataField
          label="PKCE (Proof Key for Code Exchange)"
          :value="pkceSupportLabel"
        />

      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-8">
      
        <p class="text-gray-500 dark:text-gray-400 text-sm">
        {{ server.auth?.oauth2?.authServerDiscovery?.exchange?.error || 'No authorization server metadata discovered' }}
        </p>
        <p class="text-gray-400 dark:text-gray-500 text-xs mt-2">Run discovery from the server details to fetch metadata</p>
      </div>


    <template v-if="authServerResult?.exchange" #footer>
      <HttpExchangePanel :exchange="authServerResult.exchange" title="Discovery Details" />
    </template>

  </DataPanel>
</template>

