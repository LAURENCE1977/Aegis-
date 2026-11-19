# AEGIS owner-repository integration review

Reviewed: 16 November 2026

This is a source-reconnaissance note for the existing AEGIS project. It does not copy code, install packages, connect services, change credentials, or deploy anything.

## Summary

Three repositories owned by the connected GitHub account are relevant to the AEGIS roadmap. They are not all suitable for direct reuse:

| Repository | What it offers | Licence evidence checked | AEGIS decision |
|---|---|---|---|
| `LAURENCE1977/auto-browser` | MCP-native Playwright browser control plane, human takeover, reusable auth profiles, approvals, audit/Witness receipts, local Docker deployment and model-provider adapters | Root LICENSE declares MIT, copyright JAI Studios | Highest-priority browser-worker candidate; inspect provenance and source in depth before adapting or connecting |
| `LAURENCE1977/openclaw` | Local-first personal-assistant gateway, channel/device adapters, swappable model providers, plugins, skills and host runtime | Root LICENSE declares MIT, copyright OpenClaw Foundation | High-value architecture reference for gateway, device/channel and plugin boundaries; do not embed the full runtime into AEGIS |
| `LAURENCE1977/G0DM0D3` | Multi-provider chat UI, OpenRouter/Venice/local OpenAI-compatible models, parallel model evaluation, response scoring and red-team research tools | Root LICENSE contains GNU AGPL version 3 terms; README also badges AGPL-3.0 | Study provider-selection, evaluation and privacy UX patterns; do not copy code until AGPL obligations and exact source provenance are reviewed |

## 1. auto-browser — browser execution candidate

Repository: https://github.com/LAURENCE1977/auto-browser

The README describes a browser controller built around Playwright and MCP, with:
- persistent browser sessions and named authentication profiles;
- operator takeover through a visual session;
- browser observation, DOM/text extraction and downloads;
- approval and operator-identity controls;
- audit events and signed Witness receipt bundles;
- policy profiles and PII scrubbing;
- an OpenAI-compatible model adapter for browser-driving agents;
- Docker Compose deployment with services separated into controller and browser-node.

The repository's CI workflow is substantial: Python 3.11/3.14 test matrices, lint and version-parity checks, agent/fixture evaluations, client and integration tests, dependency audits, package builds and Docker/controller tests. This is a stronger candidate than writing a second browser controller from scratch.

### Fit and constraints

- The existing AEGIS deployment is Cloudflare Pages/Workers. The browser controller is a Python/Docker service and is not a drop-in Worker dependency.
- The correct future shape is a separately isolated browser worker reached through a fixed, authenticated AEGIS adapter. AEGIS Sentinel must remain the policy/approval/audit authority.
- Never expose raw CDP, arbitrary browser URLs, host filesystem access or controller credentials to the model/tool loop.
- Require per-user/per-task browser profiles, strict egress and redirect rules, download controls, action-level approval for consequential actions, bounded observations and signed effect receipts.
- Keep browser execution disabled until a separate host/runtime and secure connectivity path are deliberately provisioned.

### Provenance and licence note

The root LICENSE is MIT and names JAI Studios as copyright holder. The README links to the upstream `LvcidPsyche/auto-browser` project. The current repository is under the connected GitHub account, but ownership of this repository alone does not prove authorship or eliminate upstream attribution obligations. Before adapting code, compare the exact source commit with upstream, inspect per-file notices and retain all required copyright/licence notices.

**Decision:** prioritise this repository for a focused architecture and security review. Prefer a narrow adapter to its existing controller over building a competing browser stack.

## 2. openclaw — gateway and cross-device reference

Repository: https://github.com/LAURENCE1977/openclaw

The README describes a local gateway that connects one assistant runtime to messaging channels, companion apps and device nodes. It separates the Gateway/control plane from the Control UI, CLI/TUI, channel adapters and local device capabilities. Models, tools, skills and plugins are replaceable. The README also makes clear that host tools run with significant local authority unless sandboxing is configured.

The root LICENSE is MIT and names the OpenClaw Foundation as copyright holder.

### Fit and constraints

- Useful architectural patterns: a single trusted gateway, replaceable channel/device adapters, model-provider abstraction, local credential custody and event-based integration boundaries.
- The full repository is very large and designed for a persistent local host, unlike AEGIS's current edge-first deployment. It should not be imported as a package or treated as a drop-in Cloudflare runtime.
- AEGIS already has its own identity, Project Spaces, model gateway, durable queue, capability registry and Sentinel. OpenClaw must not become a parallel authority for these.
- Any host-side node must be treated as a separately trusted execution environment, with explicit pairing, per-device identity, sandboxing, scoped capabilities and revocation.

**Decision:** use as a reference for AEGIS's future companion/device gateway and portable-host architecture. Do not merge its runtime into AEGIS.

## 3. G0DM0D3 — model evaluation and privacy UX reference

Repository: https://github.com/LAURENCE1977/G0DM0D3

The README describes:
- OpenRouter, Venice and local OpenAI-compatible provider selection;
- multi-model parallel response races and tiered evaluation;
- composite response scoring;
- local-only mode and privacy controls;
- browser-local conversation history with export/import;
- a single-file browser UI and a separate Cloudflare telemetry function;
- red-team input transformation tools.

The README explicitly notes that provider catalogues change and individual model availability can drift. It also documents that prompts go to configured model providers, provider keys are held in browser storage in the standalone app, and telemetry is enabled by default unless disabled. These are important lessons for AEGIS: provider availability must be refreshed, and AEGIS must keep credentials server-side rather than reproduce browser-key storage.

### Fit and constraints

- Reuse the concepts, not the browser credential design: AEGIS already has a server-side model gateway and encrypted secret-vault foundations.
- AEGIS could later add a measured model-evaluation benchmark: same prompt, fixed test cases, provider/model metadata, latency, token/cost estimate and rubric-based output scoring. Scores must be evidence-based and must not be presented as objective truth without validation.
- Local-model support is a future host/gateway integration. An iPad browser cannot be assumed to reach a local Ollama/LM Studio service safely or reliably.
- Red-team transformation features must remain a controlled evaluation mode, not be allowed to weaken AEGIS's system policy or Sentinel controls.

### Licence

The root LICENSE contains GNU AGPL version 3 terms and the README identifies the project as AGPL-3.0. Any copying, adaptation, network deployment or combination needs a deliberate licence-compatibility review and compliance with applicable source-offer and notice obligations. Do not lift source files into AEGIS merely because both repositories are under the same GitHub account.

**Decision:** high-value reference for model evaluation, provider discovery and privacy controls; no source-code reuse until AGPL obligations and provenance are reviewed.

## Recommended AEGIS sequence

1. **Browser worker review:** inspect auto-browser's controller API, authentication, profile store, isolation mode, egress policy, approval semantics, audit receipts and current CI/security findings. Produce a file-level reuse map and threat model.
2. **Gateway pattern review:** inspect OpenClaw's gateway/device identity and plugin contracts, then map only the relevant patterns to AEGIS's existing Bridge and capability model.
3. **Model evaluation design:** define a small deterministic benchmark for AEGIS's existing Workers AI, Anthropic and Qwen adapters. Keep evaluation separate from production routing until reproducible results exist.
4. **Implementation gate:** any code adaptation must be pinned to an exact upstream commit, preserve licence notices, use AEGIS-native interfaces, add regression tests first and pass the full Node.js 22 suite.
5. **No deployment by implication:** Docker services, local hosts, API keys, OAuth accounts, Cloudflare resources and production flags remain untouched until explicitly authorised and tested.

## Evidence limitations

This pass inspected repository metadata, selected READMEs, root licence files and the auto-browser CI workflow/Compose configuration. It did not perform a full source-code audit, execute builds, run the external projects' tests, verify every third-party notice, or inspect all transitive dependencies. The findings are architectural triage, not a security certification or legal opinion.
