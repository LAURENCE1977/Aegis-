# Agent runtime and local inference ecosystem review — 2026-11-19

**Purpose:** Record current upstream evidence for possible AEGIS/ODIN capability adaptations. This is a source-review note, not an integration or endorsement.

## Candidate findings

| Upstream | Current evidence | Useful AEGIS pattern | Constraints and disposition |
|---|---|---|---|
| [Open Interpreter](https://github.com/openinterpreter/openinterpreter) | Current repository is a Rust reimplementation/fork of the Codex harness, updated 2026-11-15; Apache-2.0. It documents OpenAI-compatible providers, selectable harnesses, ACP, MCP, shared `.agents/skills` and `AGENTS.md`, local state, and sandbox/approval controls. | High-value architecture reference for provider-neutral coding-agent harnesses, ACP interoperability, portable skill directories and explicit sandbox/approval contracts. | Do not embed its command-execution runtime in the hosted AEGIS worker. Review the sandbox and approval implementation separately before any code reuse. Original Python project is now a community-maintained fork, so do not confuse it with the current Rust repository. |
| [LocalAI](https://github.com/mudler/LocalAI) | Active Go project; MIT; OpenAI- and Anthropic-compatible APIs, local model backends, MCP, chat/files/projects, speech and multimodal capabilities. Repository metadata showed active updates on 2026-11-19. | Strong candidate for a future optional self-hosted inference adapter. Preserve AEGIS's existing OpenAI-compatible provider contract and add LocalAI as a separately configured endpoint, rather than making it a required dependency. Useful patterns include backend capability discovery and local model lifecycle management. | Not a free cloud inference service: compute, storage, electricity and model downloads remain the operator's responsibility. Current desktop app is documented for macOS/Linux, and local server hosting is not suitable for direct execution on the user's iPad Air. Treat as a future mini-PC/Linux-host option; test memory/CPU/GPU requirements and endpoint authentication before enabling. Model weights, backends and add-ons can have their own licences. |
| [Scrapy](https://github.com/scrapy/scrapy) | Mature Python crawler; BSD-3-Clause; current upstream README describes structured web crawling and Python 3.11+. | Useful reference or optional isolated ingestion worker for approved public-source research, source metadata extraction and repeatable crawling pipelines. Keep source URL, retrieval time, content digest, licence/terms status and provenance with every record. | Do not add it to the Cloudflare request path or execute arbitrary spider code. A crawler needs explicit domain allowlists, robots/terms policy, request budgets, SSRF protections, bounded downloads and human review. A Python worker is a separate deployment/runtime decision. |
| [OpenHands Agent Canvas](https://github.com/OpenHands/OpenHands) | Current repository describes a self-hosted developer control centre supporting multiple local/remote/cloud agent backends and ACP-compatible agents; MIT. README explicitly warns that running without a sandbox gives the agent full filesystem access. | Useful reference for a unified multi-backend agent workspace, ACP adapters, durable automation scheduling and separating the control surface from execution backends. | Do not adopt its full stack or grant filesystem access. Docker/VM isolation, secrets handling, session authentication and backend hardening would need independent verification. Prefer extracting interface/adapter concepts over introducing a second orchestrator. |

## AEGIS/ODIN decisions

1. Keep AEGIS as the canonical project and integrate ODIN's intended capabilities into the existing workspace; do not create a parallel product or duplicate orchestration core.
2. Keep the provider gateway vendor-neutral. LocalAI should be a future optional OpenAI-compatible endpoint, not a mandatory install and not a reason to change the existing Cloudflare Workers AI default.
3. Use ACP/MCP and shared skill conventions as interoperability boundaries. AEGIS Sentinel remains the only authority for grants, approvals and execution; upstream agent frameworks do not inherit AEGIS permissions.
4. Keep all code execution in an isolated, explicitly authorised worker. No shell, filesystem, crawler, browser or external-network capability is enabled merely because an upstream project supports it.
5. Keep the browser/PWA usable without local inference. The user's iPad Air and iPhone remain clients; heavy local inference belongs on a separately provisioned host, if chosen later.
6. No source code, package, binary, model, backend, add-on or external service was installed or copied as part of this review.

## Verification still required before implementation

- Inspect exact upstream sandbox, permission, protocol and provider adapter code at a pinned commit.
- Confirm transitive dependency and model/backend licensing separately from repository-level licences.
- Threat-model local endpoint authentication, network exposure, SSRF, file access, resource exhaustion and supply-chain updates.
- Prototype the LocalAI endpoint only behind the existing provider interface and explicit operator configuration.
- Prototype crawler ingestion only in an isolated worker with strict egress and per-domain policy.
