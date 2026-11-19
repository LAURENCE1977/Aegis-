# AEGIS open-source reuse audit — 2026-11-19

This note records repository candidates reviewed while improving the AEGIS companion and agent architecture. It distinguishes reusable engineering ideas from code that is not yet approved for integration.

## Decision summary

| Candidate | Licence evidence | Relevant ideas | AEGIS decision |
| --- | --- | --- | --- |
| [pixiv/three-vrm](https://github.com/pixiv/three-vrm) | MIT; stable package metadata reports v3.5.5. The package declares Three.js as a peer dependency (>=0.137) and has multiple VRM feature packages. | VRM/VRMA loading, humanoid rig, expressions, spring bones and constraints. | Keep as the leading optional VRM adapter candidate. Do not add it to the lightweight procedural renderer yet; first measure production bundle delta, parse-time memory, draw calls and mobile frame rate. Avoid the 3.6.0 beta for a production baseline until stable. |
| [moeru-ai/airi](https://github.com/moeru-ai/airi) | MIT in repository metadata and root package manifest. | Browser/mobile companion structure, VRM and Live2D support, voice input/output, modular audio and agent packages. | Study specific lifecycle and cross-platform patterns. Do not transplant the large monorepo or replace AEGIS architecture. |
| [LvcidPsyche/auto-browser](https://github.com/LvcidPsyche/auto-browser) and the user's fork [LAURENCE1977/auto-browser](https://github.com/LAURENCE1977/auto-browser) | MIT badge and repository licence metadata. | MCP-native browser control, operator approvals, human takeover, PII scrubbing, audit trails and signed Witness receipts. | Reuse as a design reference for verifiable browser actions and human hand-off. Compare each pattern against AEGIS Sentinel and existing MCP controls before implementation; no wholesale import. |
| [OpenClaw](https://github.com/openclaw/openclaw) and the user's fork [LAURENCE1977/openclaw](https://github.com/LAURENCE1977/openclaw) | The user's fork contains an MIT LICENSE file. | Local-first state and credentials, provider/harness plugins, trusted gateway, untrusted execution and deterministic policy. | Strong architecture reference for provider portability and the trust boundary. Adapt principles only after checking the current AEGIS gateway and sandbox; do not copy large subsystems wholesale. |
| [LAURENCE1977/G0DM0D3](https://github.com/LAURENCE1977/G0DM0D3) | GitHub repository metadata reports AGPL-3.0. | Multi-provider model selection, local OpenAI-compatible endpoints, local-only mode and explicit telemetry controls. | Useful for product/architecture research. No code import until AGPL compatibility and distribution obligations are deliberately assessed. |
| [LAURENCE1977/3D-Website-Builder](https://github.com/LAURENCE1977/3D-Website-Builder) | No licence was surfaced in repository metadata or the inspected root listing. Treat as no-permission-to-copy until a licence is added or confirmed. | React Three Fiber, Drei and Three.js-based 3D web composition. | Do not copy code. Its React/Three.js stack is heavier than AEGIS's current minimal WebGL2 renderer; reconsider only for a separate opt-in 3D site-authoring surface. |

## Engineering patterns adopted

### Transactional companion lifecycle

A model switch should follow:

1. **Prepare** — load and validate a candidate off-scene; do not disturb the current model.
2. **Commit** — switch the active model only after preparation succeeds.
3. **Destroy** — release the replaced model and all remaining resources exactly once.

The implementation in companion/model-lifecycle.mjs is format-agnostic and deliberately accepts an injected loader/disposer. It does not parse files, fetch remote assets, execute model content or enable imported model rendering. Regression tests cover failed preparation, late async completion after destroy, invalid tickets, idempotent teardown and disposal failures.

### Preserve AEGIS's lightweight default

- Keep the procedural WebGL2 companion and accessible 2D fallback as the default.
- Do not force Three.js or a full avatar engine into every user session.
- Make any future imported-avatar engine optional and lazy-loaded.
- Enforce explicit file provenance, uploaded-byte digest verification, size limits and performance budgets before parsing.
- Require user consent before microphone or camera access; never activate either automatically.
- Keep a failed replacement from blanking or corrupting the current avatar.

## Review gates before code reuse

Every candidate must pass all of these checks before integration:

- Verify the exact upstream repository, pinned commit/tag and licence file; a README badge alone is not enough.
- Review transitive dependencies, maintenance activity, security advisories and supply-chain scripts.
- Identify the smallest separable component or design pattern; avoid wholesale repository imports.
- Check provider neutrality, AEGIS policy gates, data handling and human approval boundaries.
- Measure bundle size, memory, CPU/GPU use and usability on mobile browsers and lower-powered devices.
- Add isolated regression tests and a rollback path before enabling it by default.

## Current status

- Repository review used the connected GitHub account through Composio plus direct GitHub repository metadata/content reads.
- No third-party package was installed or copied as part of this audit.
- The lifecycle helper is a new AEGIS implementation, not copied from AIRI or three-vrm.
- PR #107 remains a draft; the existing renderer and external model loader state are unchanged.
