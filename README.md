# ActivityPub Client-to-Server (C2S) Toolkit

A web-based development toolkit for testing and debugging ActivityPub servers that implement the Client-to-Server (C2S) protocol. 

> [!NOTE]
> This tool is designed for developers and server administrators to validate C2S implementations, not as an end-user client for social media activities (image sharing, microblogging, etc.). *It is still in early development.*


## Features

- 🌐 Fully browser-based
- 🔐 OAuth 2.0 authorization support with diagnostic features
- 🔑 Support for OAuth2 CIMD
- 🛡️ Support for OAuth2 Protected Resource Metadata 
- 🐘 Support for Mastodon legacy OAuth2 implementation
- 🔍 Authorized actor discovery using multiple methods
- 📡 Direct interaction with ActivityPub servers via C2S API
- 👁️ ActivityPub object preview and actions
- 🔌 Supports NodeInfo and WebFinger APIs
- 📊 JSON browser for inspecting ActivityPub objects
- 🌙 Dark mode
- 🎨 Modern UI built with Vue 3 and Tailwind CSS
- 🚀 Fast development with Vite

## Screenshots

[![Add Server](docs/add-server-tn.png)](docs/add-server.png)&nbsp;&nbsp;&nbsp;&nbsp;[![OAuth Diagnostics](docs/oauth2-diagnostics-tn.png)](docs/oauth2-diagnostics.png)

[![JSON Browser](docs/json-browser-tn.png)](docs/json-browser.png)&nbsp;&nbsp;&nbsp;&nbsp;[![Server Tables](docs/server-tables-tn2.png)](docs/server-tables.png)


## Roadmap

- Advanced resource editors
- Pluggable AP object previews and actions
- Support for more activity and object types
- Built-in C2S server tests with a runner and report generator.

## Installation

1. Clone the repository:
```bash
git clone https://github.com/steve-bate/activitypub-c2s-toolkit.git
cd activitypub-c2s-toolkit
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server

```bash
npm run dev
```

## Development

### Technologies

- **Frontend Framework**: Vue 3 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: Vue Router
- **State Management**: Pinia (stores)
- **Code Quality**: ESLint

### Prerequisites

- Node.js (version 16 or higher recommended)
- npm or yarn package manager


The application will be available at `http://localhost:5173` (or another port if 5173 is in use).

### Building

Create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

### Sidecar CORS Diagnostics Server

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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**[Steve Bate](https://github.com/steve-bate)**

## References

### ActivityPub and Activity Streams

- [ActivityPub](https://www.w3.org/TR/activitypub/) - W3C Recommendation
- [Activity Streams 2.0](https://www.w3.org/TR/activitystreams-core/) - W3C Recommendation
- [Activity Vocabulary](https://www.w3.org/TR/activitystreams-vocabulary/) - W3C Recommendation
- [ActivityPub HTTP API Task Force](https://github.com/swicg/activitypub-http-api) - SWICG Repository

### OAuth 2.0 Specifications

- [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html) - The OAuth 2.0 Authorization Framework
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html) - OAuth 2.0 Bearer Token Usage
- [RFC 7591](https://www.rfc-editor.org/rfc/rfc7591.html) - OAuth 2.0 Dynamic Client Registration Protocol
- [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html) - Proof Key for Code Exchange (PKCE)
- [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414.html) - OAuth 2.0 Authorization Server Metadata
- [OAuth 2.0 Client-Initiated Metadata Document (CIMD)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document) - IETF Draft
- [OAuth 2.0 Protected Resource Metadata](https://www.ietf.org/archive/id/draft-ietf-oauth-resource-metadata-09.html) - IETF Draft
- [IndieAuth](https://indieauth.spec.indieweb.org/) - IndieWeb OAuth 2.0 extension (defines `me` parameter)


