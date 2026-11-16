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
- Owner-only capability approval inbox and approve/deny API under development on a feature branch (not deployed; no capability execution is enabled)

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

See [docs/FORGE_INTELLIGENCE.md](docs/FORGE_INTELLIGENCE.md).

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

The first durable runtime slice is now implemented in source under `workers/runtime/` and `migrations/runtime/`, with a single allowlisted health-check task. It is not yet deployed: D1/Queue resources and an encrypted Worker secret must be configured first. See [docs/AEGIS_RUNTIME.md](docs/AEGIS_RUNTIME.md). The full autonomous task runner, model/provider router, durable engineering knowledge store, general MCP/API connector manager, voice engine and production Forge sandbox remain on the roadmap.

## Project blueprint and AI handover

The canonical architecture, operating principles, verified baseline, roadmap and fresh-session handover are maintained in [docs/AEGIS_MASTER_BLUEPRINT.md](docs/AEGIS_MASTER_BLUEPRINT.md). AI and engineering agents must read [AGENTS.md](AGENTS.md) before making changes. These documents are living records; always verify live repository and deployment state before relying on status notes.


## Cross-platform roadmap

AEGIS is being designed around one portable core and replaceable client/platform adapters. The first target is a responsive web/PWA experience across Chromebook, iPhone and iPad browsers, with Android, Windows, macOS and Linux extensions added when validated. See [docs/PLATFORM_COMPATIBILITY.md](docs/PLATFORM_COMPATIBILITY.md). This roadmap does not claim those later clients are already implemented.


## Project Spaces

AEGIS includes owner-scoped Project Spaces and an append-only activity timeline as the durable project-context layer. The implementation is documented in [docs/AEGIS_PROJECT_SPACES.md](docs/AEGIS_PROJECT_SPACES.md). The API and migration are source-level foundations; production D1 provisioning and deployment remain separate gated steps.


## Governed capability foundation

The repository includes source-level capability grants, provider connection metadata, an AES-GCM secret vault, append-only invocation audit and provider/model token planning. Production D1 migrations, vault keyring provisioning, live provider connections and adapter execution remain separately gated; see the capability architecture documents.


## Durable agent orchestration

AEGIS has a plan-only durable specialist-run workflow on the existing runtime Worker and Queue. It stores objectives, idempotency and plans in D1; it does not run LLM agents or tools. See [docs/AEGIS_AGENT_ORCHESTRATION.md](docs/AEGIS_AGENT_ORCHESTRATION.md). Production activation requires the D1 migration and explicit `AGENT_RUNS_ENABLED=true` configuration.


## Forge repository inspection

AEGIS Forge now has owner-authenticated, read-only endpoints to inspect public GitHub repository trees and read selected text blobs by immutable SHA. Requests and responses are bounded; outbound requests use only the fixed GitHub API origin, reject redirects and have a timeout. Source is never installed or executed and remains untrusted reference data. See [AEGIS Forge](AEGIS_FORGE.md).


## Owner-controlled capability grants

The owner-only `/api/grants` route provides bounded grant history, exact-resource grant creation and revocation. The server derives principal, actor, capability version and scopes from the approved registry; browser-supplied principals/scopes are rejected. A grant is not an approval and cannot bypass Sentinel's human approval gate. See [AEGIS capability grant management](AEGIS_CAPABILITY_GRANT_MANAGEMENT.md).


## Project Space handover briefs

The owner-only `GET /api/workspaces/:id/brief` endpoint creates a bounded, read-only handover brief from one active Project Space. It includes recent event summaries and accepted, non-restricted, unexpired project memories only; source URLs and raw event bodies are excluded. Content is marked untrusted reference data and never grants permissions. See [AEGIS Project Space briefs](AEGIS_PROJECT_BRIEFS.md).
