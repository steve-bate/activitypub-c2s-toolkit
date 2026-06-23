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
  ): Promise<CorsDiagnosticResult | undefined> {
    controller?.abort();
    controller = new AbortController();

    requestInProgress.value = true;
    error.value = null;

    try {
      const result = await runCorsDiagnostics(input, controller.signal);
      diagnosticsResult.value = result ?? null;
      return result;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return undefined;
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
      try {
        const response = await fetch(corsDiagnosticUrl + "/health", { method: "GET" });
        return response.ok;
      } catch (err) {
        console.log("Error checking CORS diagnostics health:", err);
        return false;
      }
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
