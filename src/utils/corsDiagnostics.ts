import { useSettingsStore } from "@/stores/settingsStore";

export interface CorsDiagnosticRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  mode?: RequestMode;
  credentials?: RequestCredentials;
  failedStatus?: number;
  failedStatusText?: string;
  failedResponseHeaders?: Record<string, string>;
}

export interface CorsDiagnosticIssueDetails {
  missingAllowOrigin: boolean;
  allowOrigin: string | null;
  originMismatch: boolean;
  missingAllowHeaders: string[];
  missingAllowMethods: string[];
  notes: string[];
}

export interface CorsDiagnosticResponseSummary {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface CorsDiagnosticResult {
  ok: true;
  targetUrl: string;
  request: {
    targetUrl: string;
    method: string;
    headers: Record<string, string>;
    origin?: string;
  };
  proxyResponse: CorsDiagnosticResponseSummary;
  preflightResponse?: CorsDiagnosticResponseSummary;
  issues: string[];
  details: {
    preflightRequired: boolean;
    proxy: CorsDiagnosticIssueDetails;
    preflight?: CorsDiagnosticIssueDetails;
  };
}

const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "x-api-key"]);

function redactHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [
      k,
      SENSITIVE_HEADERS.has(k.toLowerCase()) ? "[redacted]" : v,
    ]),
  );
}

function normalizeHeaders(
  headers?: Record<string, string>,
): Record<string, string> {
  headers = redactHeaders(headers ?? {});
  return Object.fromEntries(
    Object.entries(headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
}

const POSSIBLE_CORS_STATUS_CODES = [401, 403, 405, 415, 500];

export function isPossibleCorsFailure(status: number): boolean {
  return POSSIBLE_CORS_STATUS_CODES.includes(status);
}

export async function getCorsDiagnostics(
  request: CorsDiagnosticRequest,
  signal?: AbortSignal,
  corsDiagnosticUrl?: string,
): Promise<CorsDiagnosticResult | undefined> {
  if (!corsDiagnosticUrl) {
    const settingsStore = useSettingsStore();
    corsDiagnosticUrl = settingsStore.settings.corsDiagnosticsUrl;
  }

  if (!corsDiagnosticUrl) return undefined;

  corsDiagnosticUrl = corsDiagnosticUrl.replace(/\/+$/, "") + "/diagnostics";

  const payload = {
    targetUrl: request.url,
    method: request.method ?? "GET",
    headers: normalizeHeaders(request.headers),
    body: request.body,
  };

  const response = await fetch(corsDiagnosticUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  let serverResult: CorsDiagnosticResult;
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    serverResult = (await response.json()) as CorsDiagnosticResult;
  } else {
    throw new Error("CORS diagnostics server returned a non-JSON response.");
  }

  return serverResult;
}
