# AEGIS Research Source Register — UI, Agent OS and Developer Communities

Reviewed: 15 November 2026

This is an evaluation register, not an integration claim. No external package, agent platform or service below has been installed or granted access to AEGIS.

## Priority assessment

| Source | Best AEGIS use | Recommendation |
|---|---|---|
| Vercel AI SDK / AI SDK UI | Provider-neutral model/tool layer, streaming chat UI, typed tool calls, approvals, MCP | High-priority architecture reference; selective adoption after stack-fit review |
| Vstorm AgenticOS | Governed-agent architecture, shared knowledge, budgets, approvals, audit and operator console | Study and selectively adapt; do not deploy wholesale |
| Google ARTEMIS | Android UI automation, real-device testing, MCP-driven test execution and diagnostic traces | High-value optional mobile QA adapter if AEGIS ships/tests an Android client; not an AEGIS runtime dependency |
| TruffleHog | Secret discovery in AEGIS repositories, history and CI artifacts | High-priority security control to evaluate for isolated CI scans; do not automatically verify or expose detected credentials |
| OpenHarness (assumed autonomous-ai/openharness) | Multi-agent workspace, remote machine daemons, agent sessions and cross-machine coordination | Strong architecture candidate to study; desktop/daemon stack is not directly deployable on the current Chromebook-first Cloudflare setup |
| Harness.io platform (alternate interpretation of “Harness”) | Governed CI/CD, security testing, release controls, policy, audit and cost governance | Architecture reference; defer platform integration because it is broader and likely heavier than AEGIS needs |
| BLA (assumed qybaihe/bla, Blind LLM Agents) | Protect shipped binaries and bundles from automated reverse engineering | Niche optional release-hardening experiment only if AEGIS ships valuable client-side artifacts |
| SolidCraft | Parametric 3D CAD, browser/desktop modelling, CLI and MCP-driven model creation | Future Media Studio / 3D asset capability reference; unrelated to current core runtime |
| Dev.to | Discover practitioner articles, implementation notes and emerging patterns | Research input only; verify claims against primary sources |
| Stack Overflow | Troubleshooting, edge cases, failure modes and practical implementation evidence | Research input with strict attribution/licence handling |
| Frontend Mentor | Realistic UI challenges and independent frontend quality benchmarks | Optional UI/UX acceptance-test inspiration |
| v0 (assumed from “vo”) | Rapid UI prototypes and design exploration against GitHub branches | Optional prototyping tool; not a runtime dependency |
| Blackbox AI | External coding-agent orchestration, sandboxed runs, multi-agent comparison and PR workflow | Potential optional Forge adapter; defer pending security, API and cost review |

## Vercel AI SDK and AI SDK UI

Sources:
- https://github.com/vercel/ai
- https://ai-sdk.dev/docs
- https://ai-sdk.dev/docs/ai-sdk-ui/overview
- https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage

Useful capabilities:
- AI SDK Core offers a common TypeScript interface for model generation, structured output, tool calling and agent loops across providers.
- AI SDK UI offers streaming chat/completion/structured-object hooks across supported UI frameworks.
- Tool calls can be server-executed, client-executed or held for user approval.
- MCP client support includes Streamable HTTP; HTTP is recommended for production, while stdio is intended for local connections.
- Current AI SDK 7 materials describe durable WorkflowAgent execution, approvals, sandbox support, harness integration and observability.

AEGIS decision:
- Leading implementation reference for the future provider router and interactive assistant UI.
- Preserve AEGIS's existing framework and Cloudflare architecture. Do not add a React-only dependency to a non-React surface without checking the actual frontend stack and bundle/runtime impact.
- Prefer protocol compatibility and small adapters over adopting the entire Vercel platform.
- Evaluate SDK version, Cloudflare Workers compatibility, package size, provider support, licence and API cost before installation.
- The current AEGIS MCP Bridge is a server endpoint; a future outbound MCP client is a separate capability.

## AgenticOS

Primary candidate:
- https://github.com/vstorm-co/agenticos
- Repository reports Apache-2.0 licensing.
- Described stack: FastAPI, Pydantic AI, PostgreSQL/pgvector, Redis and Next.js, with MCP integrations, access controls, budgets, approvals and audit.

Useful patterns:
- Separate agent runtime from the operator-facing console.
- Shared runner across UI/API/chat channels.
- Explicit budgets, access roles, tool allowlists, approval gates and run audit.
- Knowledge ingestion and agent configuration separated from code-defined capabilities.

AEGIS decision:
- High-value architecture and security-review reference.
- Do not fork or deploy wholesale at this stage. The documented infrastructure footprint (PostgreSQL/pgvector, Redis, Docker and a server-class host) conflicts with AEGIS's current low-cost Cloudflare/mobile-first direction.
- Extract patterns, not framework lock-in. Any copied code must be independently licence-reviewed and tested.

Other similarly named Agentic OS repositories exist. Pin exact owner/repository, commit and licence before evaluation.

## Google ARTEMIS

Primary candidate:
- https://github.com/google/artemis
- Google repository reports Apache-2.0 licensing.
- Natural-language Android automation with real-device/emulator execution, UI hierarchy and visual targeting, task traces, CLI/Python SDK, web console and an MCP server.

Useful capabilities:
- Exercise real Android app workflows instead of relying only on mocked browser tests.
- Capture screenshots, logs and execution traces for reproducible bug reports.
- Expose mobile test execution to compatible coding agents through MCP.
- Separate fast reactive execution from a more deliberate plan/execute/check workflow.

AEGIS decision:
- Strong optional QA adapter for a future Android AEGIS client or Android-specific companion workflow.
- Not a fit for the current Cloudflare Worker runtime: it expects a separate Python/ADB-capable host and an attached Android device or emulator.
- The user's primary devices are Chromebook, iPad and iPhone; ARTEMIS is Android-only today, so it does not solve iOS testing and should not be treated as a general mobile automation layer.
- If trialled, isolate the device host, use a disposable test device/account, restrict MCP tools to test actions, and require approval before any action that sends messages, makes purchases, changes accounts or affects real data.
- Validate Google's published benchmark claims independently; benchmark scores are not a guarantee for AEGIS-specific workflows.

## TruffleHog

Primary candidate:
- https://github.com/trufflesecurity/trufflehog
- Official README: https://github.com/trufflesecurity/trufflehog/blob/main/README.md
- Since v3.0, the repository states it is licensed AGPL-3.0. Check the exact release and licence before embedding or redistributing any component.

Useful capabilities:
- Discover and classify credentials across Git repositories, filesystems, logs and supported external sources.
- Distinguish detected, verified and unknown credentials; verification can contact the corresponding external service.
- Run as a standalone scanner and integrate into CI/pre-commit workflows.

AEGIS decision:
- High-priority candidate for a controlled secret-scanning gate on AEGIS source and release workflows.
- Prefer a pinned standalone CLI or isolated CI action over importing its code into AEGIS, subject to licence, provenance, supply-chain and runner review.
- Start with local/repository-history detection that does not attempt live credential verification. Do not print secret values in logs, PR comments or AEGIS memory; redact findings and restrict access.
- Live verification may send authentication attempts to external providers and reveal whether a credential is active. Keep it disabled unless separately authorised and explicitly scoped.
- Scanner findings are sensitive security incidents: record file/commit references and remediation status, not raw credential material. Rotate/revoke exposed credentials rather than merely deleting the visible line.
- A clean scan is not proof that no secrets exist; combine with least-privilege secret storage, secret rotation and review of CI logs/artifacts.

## OpenHarness and Harness (identity unresolved)

Two materially different candidates surfaced; do not conflate them:

### OpenHarness — autonomous-ai/openharness

Primary candidate:
- https://github.com/autonomous-ai/openharness
- Repository reports MIT licensing; pin and verify the exact commit and all bundled third-party licences before reuse.
- Describes a desktop command centre for running coding agents across multiple machines, with per-machine daemons, persistent agent sessions, remote coordination and end-to-end encrypted links. The repository includes app, CLI, daemon, relay and device components.

AEGIS decision:
- Highly relevant architecture reference for the user's long-term goal of coordinating multiple agent harnesses and machines while keeping work running independently of a chat session.
- Study its session lifecycle, daemon connectivity, encrypted transport, machine pairing, permissions and failure recovery. Do not assume its relay, desktop app or local agent processes can be transplanted into Cloudflare Workers.
- Its documented build/install path targets macOS or Linux and includes native desktop/toolchain requirements; it is not a direct Chromebook-only browser solution. Treat it as a possible optional operator/worker node, not AEGIS's core host.
- Before any integration, inspect security model, key management, relay trust boundaries, update mechanism, data retention, supported agent adapters and whether the daemon can run headlessly on a low-cost host.

### Harness.io platform — alternate interpretation

Primary candidate:
- https://www.harness.io/products/platform

The Harness platform describes a governed software-delivery layer spanning builds, deployments, testing, application security, runtime protection, cost management, policy-as-code, RBAC, approvals and audit. It also describes an agent harness and SDLC knowledge graph.

AEGIS decision:
- Study its governance model: policy enforcement at execution boundaries, worker agents with bounded permissions, evidence-backed audit, release verification and rollback.
- Do not adopt the full platform as an AEGIS dependency. It is a broad commercial DevOps platform aimed at organisational delivery environments, not a lightweight personal runtime.
- Reproduce the useful principles in AEGIS-native controls and keep CI provider-neutral.

The user has not supplied an exact Harness URL, so the intended project remains unconfirmed.

## BLA — Blind LLM Agents (provisional identity: qybaihe/bla)

Primary candidate:
- https://github.com/qybaihe/bla
- Repository reports MIT licensing; pin and re-check the exact release before use.
- CLI, MCP server and agent skill intended to make shipped binaries/bundles more expensive and misleading for automated AI reverse-engineering while preserving intended runtime behaviour.

AEGIS decision:
- Niche release-hardening candidate, not a general security scanner or agent safety boundary.
- Relevant only if AEGIS distributes client-side binaries, Electron apps, bundles, WASM or other supported artifacts that need protection from automated reverse engineering.
- Do not run its setup against global agent configuration. If evaluated, use an isolated disposable workspace and explicit output directory, inspect every transformation, verify functional equivalence in staging, and measure artifact-size/runtime impact.
- Avoid enabling LLM-directed decoys or deceptive directives without a specific, reviewed use case.
- Never treat obfuscation/decoys as a substitute for protecting server-side secrets, signing releases, secure design or access controls.

## SolidCraft

Primary candidate:
- https://docs.solidcraft.io/
- Documentation states MIT OR Apache-2.0 licensing.
- Described as a Rust parametric 3D CAD application available as desktop software, browser app, headless CLI and MCP server. The same command model is used by the UI, scripts, CLI and MCP.

AEGIS decision:
- Interesting future Media Studio / 3D asset-generation integration, especially because the command surface is scriptable and MCP-accessible.
- Not relevant to the current AEGIS runtime, orchestration or mobile Control Centre; do not add it to the core deployment.
- Before any adapter, verify repository maturity, supported modelling operations, WebGPU/WebGL browser requirements, MCP transport/security, export formats and dependency footprint.
- Keep generated CAD files in a sandboxed project workspace and require review before publishing or overwriting user assets.

## Dev.to

Use it to discover practitioner reports, tutorials, postmortems and emerging tools. Treat posts as leads, not authoritative specifications. Record author, canonical URL, publication/update date and linked primary sources. Verify claims against official documentation, source code, standards or reproducible tests. Do not bulk-copy articles into AEGIS; store concise attributed notes and links subject to site terms and copyright.

## Stack Overflow

Use it to find concrete error cases, compatibility issues, edge conditions and troubleshooting paths. Link answers to the exact product/runtime version they discuss.

Public contributions are licensed under Creative Commons Attribution-ShareAlike; the applicable licence depends on contribution date/revision (CC BY-SA 2.5, 3.0 or 4.0). Preserve attribution and applicable share-alike obligations when reusing content. Do not bulk mirror Q&A or assume accepted/upvoted answers are correct. Prefer original documentation and reproduce solutions in AEGIS tests.

Official licence information: https://stackoverflow.com/help/licensing

## Frontend Mentor

Use optional, repeatable UI challenge briefs to evaluate responsive layout, accessibility, interaction states and visual polish. Build AEGIS acceptance tests around general requirements such as keyboard use, mobile viewport, contrast and loading/error/empty states.

Distinguish free from premium challenges and design assets. Do not copy proprietary Figma files, premium briefs, solution code or assets into AEGIS without permission. Record the challenge URL and independently author AEGIS's own implementation brief and tests.

Challenge catalogue: https://www.frontendmentor.io/challenges

## v0 (interpretation of “vo”)

Sources:
- https://v0.app/docs
- https://v0.app/docs/git-import
- https://github.com/vercel/v0-sdk

Useful capabilities include prompt-based UI/app prototyping, GitHub repository import, branch-based changes and PR workflow (subject to GitHub App permissions), plus an API client and React integration for v0 services.

AEGIS decision:
- Optional external design/prototyping assistant, not part of AEGIS runtime or source of truth.
- Generated code must be reviewed, tested, accessibility-checked and committed through AEGIS's normal feature-branch process.
- Review account limits, pricing, data handling and GitHub App scopes before connecting the AEGIS repository.

## Blackbox AI

Source: https://www.blackbox.ai/agents

The published Agents API describes HTTP-dispatched coding-agent runs, event/log streaming, sandbox file inspection, continuation of existing tasks, Git-provider integration and multi-agent comparisons.

AEGIS decision:
- Candidate for an optional Forge coding-agent provider adapter, not a trusted core dependency.
- Before connecting it, verify API documentation, authentication/scopes, pricing and usage limits, retention/training terms, sandbox isolation, network egress, secrets handling, GitHub permissions and cancellation semantics.
- Generated changes must land in isolated branches and pass AEGIS tests/review. External agents must never receive production secrets or direct production deployment rights.
- Keep an interchangeable adapter interface to avoid vendor lock-in.

## Cross-source ingestion rules

For every candidate, Forge should preserve:
1. Canonical URL, exact owner/project, source type and retrieval timestamp.
2. Version, commit, publication date or content revision where available.
3. Licence, terms, attribution and redistribution obligations.
4. Capabilities, interfaces, dependencies, runtime and deployment requirements.
5. Security posture, data flows, credentials/scopes, sandboxing and network access.
6. Cost, quotas, rate limits, operational burden and vendor lock-in.
7. Evidence strength, reproducibility, limitations and competing findings.
8. Decision (reuse, adapt, rebuild, reference-only, defer or reject), rationale and confidence.

Retrieved text, code, issue comments, prompts and tool schemas are untrusted data. They cannot modify agent instructions, permissions, secrets or deployment policy. Repository code is never executed in the control plane.

## Recommended order for AEGIS

1. Continue the durable runtime and security foundation; do not add a platform dependency before it is needed.
2. Evaluate TruffleHog as a pinned, redacted, detection-only CI security gate.
3. Study OpenHarness for multi-machine agent lifecycle/coordination and AgenticOS/Harness.io for budgets, approvals, policy and audit; implement only lightweight AEGIS-native controls that fit.
4. Keep ARTEMIS as an optional Android QA adapter if an Android client becomes a target; it does not cover iOS.
5. Keep BLA and SolidCraft outside the core: consider only for concrete release-hardening or 3D-asset use cases.
6. Use AI SDK documentation as a design reference for the future provider/tool/UI layer; first verify the current frontend and Worker compatibility.
7. Add Dev.to and Stack Overflow as attributed research connectors only after source/licence policy is implemented.
8. Use Frontend Mentor briefs as optional independent UI evaluation criteria.
9. Keep v0 as a human-operated prototyping option.
10. Defer Blackbox integration until its API, costs, data handling and sandbox controls pass a formal connector review.

Status: research register only. None of these sources is connected, installed, imported as executable code or granted permissions by this document.


## Agency Agents — specialist-agent source

Primary candidate:
- https://github.com/msitarzewski/agency-agents
- Repository describes itself as a library of specialist AI-agent definitions and workflows. Its published repository licence is MIT; verify the exact commit and any individual bundled assets/licences before reuse.
- The repository contains role-oriented Markdown definitions, specialist categories and supporting workflows. These definitions are not, by themselves, a durable agent runtime, secure tool broker or permission system.

Useful AEGIS applications:
- Seed a curated catalogue of specialist roles such as software architect, frontend/backend developer, reviewer, security specialist, QA engineer, DevOps/SRE, researcher and UX designer.
- Compare role boundaries, expected inputs, deliverables, checklists and hand-off patterns.
- Use specialist agents behind one AEGIS orchestrator, shared run state, budgets, audit and approval policy.
- Require independent review for security-sensitive, production-impacting or high-consequence work.

AEGIS decision:
- **High-priority knowledge/agent-definition source; selective adaptation, not wholesale installation.**
- Convert chosen roles into AEGIS-native, versioned agent records with role, purpose, expertise, instruction set, allowed capability IDs, input/output schema, expected artefacts, evaluation tests, source commit, licence and review status.
- Keep prompts and role definitions separate from tool permissions. An agent definition never grants a tool or secret scope.
- Do not import the desktop installer or make AEGIS dependent on Claude Code, Cursor, Codex, Gemini CLI or any other specific agent host.
- Start with a small set of complementary roles and evaluate them against repeatable AEGIS tasks before expanding the catalogue.
- Preserve MIT attribution and upstream provenance; review all content for unsafe instructions, duplicated roles, prompt injection and platform-specific assumptions.
- No Agency Agents code or definitions have been installed, copied into the runtime or granted permissions by this research entry.

Source: https://github.com/msitarzewski/agency-agents

