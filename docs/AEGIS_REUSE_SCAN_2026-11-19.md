# AEGIS open-source reuse scan — 2026-11-19

## Purpose

Record useful external and owner-controlled repositories discovered during the AEGIS build. The aim is to extract design patterns and independently implement compatible ideas, not to import whole projects or silently change AEGIS architecture.

## Newly reviewed external candidates

### highstreeto/AISandbox

- Repository: https://github.com/highstreeto/AISandbox
- Licence reported by GitHub: MIT.
- Reviewed: README, AGENTS.md, Cargo.toml and repository tree.
- Relevant patterns:
  - Per-project isolation with separate container groups and persistent project homes.
  - Network egress denied by default and routed through an explicit host allowlist proxy.
  - Localhost-only browser UI; read-only sandbox configuration and protected Git metadata.
  - Separate local-LLM gateway that exposes inference/read-only paths and does not let the model service bypass download policy.
  - Config validation rejects unknown keys and reserved environment variables.
- AEGIS decision: **adapt the security principles, do not import the implementation**. AEGIS already has a browser-first Cloudflare architecture and an allowlisted sandbox/gateway; a Rust + Docker/Podman desktop stack would add a separate host runtime and is not a suitable direct dependency. Use this repo as a threat-model and design-review reference for workspace isolation, outbound network policy, read-only config and local-model gateway boundaries.
- Limitation: repository is actively changing and this scan is not a formal security audit or proof that its isolation is vulnerability-free.

### catfish-1234/sessionmem

- Repository: https://github.com/catfish-1234/sessionmem
- Licence reported by GitHub and package metadata: MIT.
- Reviewed: README, package.json, SECURITY.md and docs/architecture.md.
- Relevant patterns:
  - Separate host adapters from a shared memory engine.
  - Local-first storage with explicit project scope.
  - Hybrid retrieval using SQLite FTS5/BM25, entity overlap, recency and importance.
  - Explicit supersession/contradiction history rather than silently overwriting earlier decisions.
  - Redaction during capture/indexing, token-budgeted memory injection, health/doctor checks and export/forget controls.
  - Optional local semantic retrieval can fail back to the default no-model retrieval path.
- AEGIS decision: **adapt the architecture, not the package**. The current AEGIS deployment is browser/Cloudflare-oriented; sessionmem is a Node.js local MCP service using better-sqlite3 and optional native/model packages. Importing it would add a separate runtime and native dependency surface. The most useful ideas are project-scoped memory, explicit supersession provenance, source-linked entity relations, token-budget-aware retrieval, secret redaction and diagnostics.
- Limitation: its README and architecture describe intended behaviour; this scan did not run its package or independently verify its security claims.

### valentineRutto/OrbMotionKMPLibrary

- Repository: https://github.com/valentineRutto/OrbMotionKMPLibrary
- Licence reported by GitHub: MIT.
- Reviewed: repository metadata and description.
- Relevant pattern: expressive activity indicators for AI/agent states across Kotlin Multiplatform Android and iOS.
- AEGIS decision: **reference only**. AEGIS's current companion is a browser WebGL2 renderer, so a Compose Multiplatform dependency is not a fit. The concept of state-driven activity motion may inform a future native companion shell, but it should not affect the web renderer or introduce a mobile bundle dependency.
- Limitation: no source-level review was performed in this scan.

## Owner-controlled repository inventory

Composio/GitHub returned nine repositories accessible to the connected owner account:

- LAURENCE1977/Aegis- — MIT; current build repository.
- LAURENCE1977/storied-gecko-09ca7c — no licence surfaced.
- LAURENCE1977/storie-audio-lab-3 — repository currently empty; no source or licence to reuse.
- LAURENCE1977/openclaw — fork; GitHub metadata reports NOASSERTION, so inspect the actual licence file and upstream provenance before any code reuse.
- LAURENCE1977/auto-browser — fork; MIT; useful human-in-the-loop browser patterns already under review.
- LAURENCE1977/storie-audio-lab-store-checker — no licence surfaced.
- LAURENCE1977/G0DM0D3 — AGPL-3.0; architecture research only unless distribution obligations are explicitly assessed.
- LAURENCE1977/charlieautomatesskills — no licence surfaced.
- LAURENCE1977/3D-Website-Builder — fork of HVbajoria/3D-Website-Builder; neither fork nor parent surfaced a licence. Its package manifest uses React 18, React Three Fiber 8, Drei 9 and Three.js 0.158. It is a stale 2025 snapshot and adds a separate, comparatively heavy rendering stack; architecture can be studied, but no code copying until licence permission is established.

## Other candidates surfaced, not yet promoted

- https://github.com/pax-project/pax-ai — Apache-2.0; shared AI substrate/RAG/MCP concept. Needs source and dependency review before any recommendation.
- https://github.com/rafaself/nekosearch — MIT; version-aware documentation MCP concept. Needs code review.
- https://github.com/nergizal/Deterministic-edge-agents — no licence surfaced in search metadata; do not copy until licence and source are reviewed.
- https://github.com/lucca3447/OpenAmadeus — GPL-3.0; companion runtime concept only; compatibility review required before any reuse.
- https://github.com/khoacat12345/waker-ai — MIT; agent watchdog/supervisor concept; assess against AEGIS's existing repair and health-monitoring work before adopting.


### Additional owner-repository inspection

- `LAURENCE1977/3D-Website-Builder` was traced to its upstream parent `HVbajoria/3D-Website-Builder`; both GitHub repository metadata responses report no licence. Its dependency manifest confirms a React/React Three Fiber/Drei/Three.js application. It may inform a future isolated website-authoring surface, but it is not a suitable dependency for the current lightweight WebGL2 companion and cannot be copied without a licence.
- `LAURENCE1977/storied-gecko-09ca7c` contains a single approximately 3.9 MB `index.html` and a deeply nested `.github/workflows/.github/workflows/...` directory structure. No licence surfaced. Treat it as an opaque/legacy artifact pending a focused audit; do not import it or use it as an AEGIS baseline.
- `LAURENCE1977/storie-audio-lab-3` currently returns an empty-repository response, so there is no implementation to reuse at this time.

## Reuse rules

1. No whole-repository installs or wholesale architecture replacement.
2. Verify the actual licence file and relevant dependency licences before copying code; GitHub metadata alone is not enough where it reports NOASSERTION or no licence.
3. Treat README claims as leads, not security proof.
4. Prefer small, independently implemented patterns with regression tests and provenance notes.
5. Preserve AEGIS's provider-agnostic gateway, deterministic fallback, project workspace, mobile-first browser UI, and human approval state machine.
6. No imported model parser, browser automation authority, network permission or agent self-approval is enabled by this research.
