# CORS Diagnostics Server

The repository includes a TypeScript sidecar server that proxies outbound HTTP requests and reports CORS-related diagnostics.

Run in development mode:

```bash
npm run sidecar:dev
```

Build and run compiled output:

```bash
npm run sidecar:build
npm run sidecar:start
```

Default runtime settings:

- Host: `127.0.0.1`
- Port: `8787`
- Browser origins allowed by default: `http://localhost:5173`, `http://127.0.0.1:5173`

Environment variables:

- `SIDECAR_HOST`
- `SIDECAR_PORT`
- `SIDECAR_ALLOWED_ORIGINS` (comma-separated)
- `SIDECAR_ALLOWED_REQUEST_HEADERS` (comma-separated)
- `SIDECAR_ALLOW_CREDENTIALS` (`true` or `false`)
- `SIDECAR_ALLOWED_PROXY_METHODS` (comma-separated)
- `SIDECAR_REQUEST_TIMEOUT_MS`
- `SIDECAR_MAX_REQUEST_BODY_BYTES`
- `SIDECAR_MAX_UPSTREAM_BODY_BYTES`
- `SIDECAR_ALLOW_PRIVATE_TARGETS` (`true` or `false`)

Endpoints:

- `GET /health` — Health check endpoint
- `POST /cors-diagnostics` — CORS diagnostics endpoint (simulates preflight when needed)
- `OPTIONS /cors-diagnostics` — CORS preflight for diagnostics endpoint

`POST /cors-diagnostics` JSON payload shape:

```json
{
	"targetUrl": "https://example.com/resource",
	"method": "GET",
	"headers": {
		"Accept": "application/activity+json"
	},
	"body": null,
	"origin": "http://localhost:5173"
}
```

Query parameters:

- `body=true` — Include response body in output (default: false, omitted)
