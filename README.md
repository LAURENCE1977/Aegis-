# AEGIS

Your personal AI workspace — open-source, mobile-first, and designed to run on your own hosting.

AEGIS is an evolving project. The current repository is an early Cloudflare Pages prototype. Its larger autonomous assistant, voice, model router, durable knowledge store, managed integrations and full AEGIS Forge workshop are still being developed.

## Current foundation

- Mobile-friendly chat interface for iPhone, iPad and Chromebook browsers
- Cloudflare Pages Functions API
- Cloudflare Workers AI binding for the current chat model
- Optional Cloudflare KV binding for simple notes
- Password sign-in with signed, expiring, HttpOnly browser sessions
- AEGIS-native skills registry seeded with ten adapted Superpowers engineering skills
- Contextual skill guidance injected into chat for relevant engineering and planning requests
- Authenticated, no-store module and skills registry endpoints
- AEGIS Forge capability declarations for universal source discovery, inspection, comparison, evaluation, planning and benchmarking
- AEGIS Engineering Intelligence capability boundary for attributed, evidence-rated knowledge
- Pure validators for Forge source-candidate and engineering-knowledge records
- Read-only public GitHub repository discovery behind session authentication and same-origin protection
- Initial authenticated, stateless MCP Bridge endpoint (`POST /mcp`) with read-only status, modules and skills tools
- First standalone AEGIS Runtime Worker source: authenticated job API, D1 job/event schema, Queue consumer, Cron outbox/lease recovery and attempt-fenced state transitions (not yet deployed)
- Owner-only capability approval inbox and approve/deny API, with a mobile Control Centre review panel (feature branch only; no capability execution is enabled)


- Owner-scoped Project Spaces API, append-only activity timeline and mobile Projects panel under development on a feature branch (D1 binding not provisioned; no agent execution is enabled; see [Project Spaces](docs/AEGIS_PROJECT_SPACES.md))
- AEGIS-native typed memory with owner/project-scoped D1 repository, candidate review, append-only lifecycle history, correction/supersession links, bounded owner JSON export, project-scoped Memory panel and approved-memory chat retrieval (feature branch only; shared migrations not applied; D1 not provisioned/bound; see [Memory Substrate](docs/AEGIS_MEMORY_SUBSTRATE.md))
- Native AG-UI 1.0 text-chat compatibility endpoint (`POST /api/ag-ui`) with authenticated incremental SSE streaming, bounded text-only input and PWA client; frontend tools, ambient context, resume and multimodal content remain disabled pending Sentinel/durable-run integration (see [CopilotKit and AG-UI boundary](docs/AEGIS_COPILOTKIT_AGUI.md))
- Installable mobile-first PWA shell with a static-only service-worker cache; authenticated API and MCP traffic are never cached offline

## Security setup

**Do not expose a deployment until both secrets are configured.**

In the Cloudflare dashboard, open the AEGIS Pages project and add these as encrypted secrets for the production environment (and separately for Preview if you use it):

1. `AEGIS_PASSWORD` — a unique password of at least 12 characters.
2. `AEGIS_SESSION_SECRET` — a cryptographically random secret of at least 32 characters. Do not reuse your AEGIS password.

Redeploy after adding or changing secrets. The browser session lasts 12 hours and is stored in a Secure, HttpOnly, SameSite=Strict, host-only cookie. The chat and memory APIs reject requests without a valid session. Never put either secret in `index.html`, browser storage, GitHub, or a public environment variable.

If the login screen says security setup is unfinished, configure both secrets before using AEGIS.

## Forge and engineering intelligence

Forge is being developed as a universal, safe transformation engine for repositories, MCP servers, APIs, SDKs, packages, frameworks and authorised application interfaces. Its first live adapter performs read-only public GitHub repository metadata discovery at authenticated `POST /api/forge/discover`.

Candidate and knowledge records preserve source versions, licence review, attribution, evidence and limitations. Unknown licences are a hold, not permission to reuse. Retrieved source material is untrusted data: discovery does not execute repository code or grant tool permissions.

See [docs/FORGE_INTELLIGENCE.md](docs/FORGE_INTELLIGENCE.md) and the [Research Source Register](docs/RESEARCH_SOURCE_REGISTER.md).

## MCP Bridge (initial read-only phase)

The first AEGIS Bridge slice exposes the current stateless MCP Streamable HTTP protocol at `POST /mcp`. It supports `server/discover`, `tools/list` and `tools/call`, with read-only status, module and skills tools. It does not yet provide OAuth 2.1/PKCE, per-client scopes, write operations or a general outbound connector manager. See [docs/AEGIS_BRIDGE.md](docs/AEGIS_BRIDGE.md) for the protocol, authentication boundary and current limitations. The endpoint fails closed until an authorised bearer secret or valid AEGIS session is configured.

## Skills library

The first skills library is based on [obra/superpowers](https://github.com/obra/superpowers) (MIT). AEGIS adapts ten high-value engineering skills into its own registry and selects up to four relevant guidance entries per chat request. It does not install upstream plugins, scripts, hooks or telemetry, and imported skills receive no tool permissions. See [docs/SUPERPOWERS.md](docs/SUPERPOWERS.md).

## Data and provider notes

The source code is open for inspection and modification. Hosting, storage, and model inference may have separate provider limits or costs. Requests sent to an external AI provider are processed under that provider's terms; open-source application code does not by itself make model inference private or free.

## Development

Run the full test suite with Node.js 22:

```sh
node --test tests/*.test.mjs
```

The first durable runtime slice is implemented in source under `workers/runtime/` and `migrations/runtime/`, with a single allowlisted health-check task. It is not yet deployed: D1/Queue resources and an encrypted Worker secret must be configured first. The Project Spaces and Memory shared D1 migrations are in `migrations/shared/`; do not apply the nested feature-source migration directories as well. See [docs/AEGIS_RUNTIME.md](docs/AEGIS_RUNTIME.md). The full autonomous task runner, model/provider router, durable engineering knowledge store, general MCP/API connector manager, voice engine and production Forge sandbox remain on the roadmap.

## Project blueprint and AI handover

The canonical architecture, operating principles, verified baseline, roadmap and fresh-session handover are maintained in [docs/AEGIS_MASTER_BLUEPRINT.md](docs/AEGIS_MASTER_BLUEPRINT.md). AI and engineering agents must read [AGENTS.md](AGENTS.md) before making changes. These documents are living records; always verify live repository and deployment state before relying on status notes.


## Cross-platform roadmap

AEGIS is being designed around one portable core and replaceable client/platform adapters. The first target is a responsive web/PWA experience across Chromebook, iPhone and iPad browsers, with Android, Windows, macOS and Linux extensions added when validated. See [docs/PLATFORM_COMPATIBILITY.md](docs/PLATFORM_COMPATIBILITY.md). This roadmap does not claim those later clients are already implemented.
