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

## Skills library

The first skills library is based on [obra/superpowers](https://github.com/obra/superpowers) (MIT). AEGIS adapts ten high-value engineering skills into its own registry and selects up to four relevant guidance entries per chat request. It does not install upstream plugins, scripts, hooks or telemetry, and imported skills receive no tool permissions. See [docs/SUPERPOWERS.md](docs/SUPERPOWERS.md).

## Data and provider notes

The source code is open for inspection and modification. Hosting, storage, and model inference may have separate provider limits or costs. Requests sent to an external AI provider are processed under that provider's terms; open-source application code does not by itself make model inference private or free.

## Development

Run the full test suite with Node.js 22:

```sh
node --test tests/*.test.mjs
```

The current prototype does not yet contain the full autonomous task runner, model/provider router, durable engineering knowledge store, general MCP/API connector manager, voice engine or production Forge sandbox. These remain separate, testable capabilities on the roadmap.
