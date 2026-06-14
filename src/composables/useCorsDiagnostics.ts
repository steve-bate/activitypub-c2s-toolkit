import { ref } from "vue";

import {
  getCorsDiagnostics as runCorsDiagnostics,
  isPossibleCorsFailure,
} from "@/utils/corsDiagnostics";

import type {
  CorsDiagnosticRequest,
  CorsDiagnosticResult,
} from "@/utils/corsDiagnostics";
import { useSettingsStore } from "@/stores/settingsStore";

export function useCorsDiagnostics() {
  const requestInProgress = ref(false);
  const error = ref<Error | null>(null);
  const diagnosticsResult = ref<CorsDiagnosticResult | null>(null);
  let controller: AbortController | null = null;

  async function getCorsDiagnostics(
    input: CorsDiagnosticRequest,
  ): Promise<CorsDiagnosticResult | null> {
    controller?.abort();
    controller = new AbortController();

    requestInProgress.value = true;
    error.value = null;

    try {
      const result = await runCorsDiagnostics(input, controller.signal);
      diagnosticsResult.value = result;
      return result;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return null;
      }
      error.value = err as Error;
      throw err;
    } finally {
      requestInProgress.value = false;
    }
  }

  function abortCorsDiagnostics() {
    controller?.abort();
  }

  async function isHealthy(): Promise<boolean> {
      const settingsStore = useSettingsStore();
      const corsDiagnosticUrl = settingsStore.settings.corsDiagnosticsUrl;
      if (!corsDiagnosticUrl) {
          return false;
      }
      const response = await fetch(corsDiagnosticUrl + "/health", { method: "GET" });
      return response.ok;
  }

  return {
    requestInProgress,
    error,
    diagnosticsResult,
    isPossibleCorsFailure,
    isHealthy,
    getCorsDiagnostics,
    abortCorsDiagnostics,
  };
}
