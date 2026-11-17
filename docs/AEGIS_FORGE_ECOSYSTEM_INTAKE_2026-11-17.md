# AEGIS Forge — Ecosystem Intake (17 November 2026)

**Status:** Research intake only. No upstream code, packages, models, containers, MCP servers, accounts or services were installed, executed or connected.

## Candidate review

| Candidate | Exact identity / evidence | AEGIS decision |
|---|---|---|
| AI-Goldfish-Monitor | Interpreted as [Usagi-org/ai-goofish-monitor](https://github.com/Usagi-org/ai-goofish-monitor), MIT. Xianyu marketplace monitor with Playwright, account sessions, proxy rotation, task scheduling and AI analysis. | **Patterns only; reject scraper/account automation.** Consider generic user-authorised scheduling/notifications only. Never import marketplace cookies, evade platform controls or rotate accounts/proxies. |
| faster-whisper | [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper), MIT; CTranslate2 Whisper inference. | **Strong optional local STT adapter.** Benchmark against existing Whisper.cpp; unify under one AEGIS transcription contract rather than duplicate systems. Pin model revisions and measure CPU/RAM/latency. |
| RepoMix | Interpreted as [yamadashy/repomix](https://github.com/yamadashy/repomix). Repository-to-LLM context packer with MCP/explorer and Tree-sitter compression. | **Reuse pattern only.** Add deterministic, secret-redacted, path-allowlisted repository snapshots only if existing code intelligence has a measured gap. Not a second canonical code index. Verify exact release/dependency licences before reuse. |
| FLUX | [Black Forest Labs FLUX](https://github.com/black-forest-labs/flux). | **Model-specific licence hold.** FLUX.1 schnell is Apache-2.0; FLUX.1 dev family has a separate non-commercial/non-production licence. Never label the whole FLUX family Apache/open source. Commercial use of dev weights needs a separate licence. Inventory weights, VAE, code and assets independently. |
| Qwen3-TTS | [QwenLM/Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS), repository states Apache-2.0. | **High-value optional local TTS adapter.** Benchmark model tiers and inspect each weight/model-card licence. Voice cloning requires explicit speaker consent, provenance, disclosure and deletion controls; never clone arbitrary uploaded voices. |
| UniCloud | Interpreted as [paulkokos/UniCloud](https://github.com/paulkokos/UniCloud), MIT multi-cloud file manager demo (small repo; 13 commits surfaced). | **Low-confidence architecture inspiration only.** Not evidence of production-grade Drive/OneDrive/iCloud integration. AEGIS retains provider-neutral file contracts, minimal OAuth scopes, local-first storage, sync conflict handling and revocation. |
| TrailBase | [trailbaseio/trailbase](https://github.com/trailbaseio/trailbase), Rust/SQLite backend with auth, realtime, WASM and MCP; OSL-3.0. | **Architecture study; code reuse on hold.** OSL-3.0 has reciprocal/source-availability obligations for distributed derivatives. Do not replace AEGIS Forge D1/SQLite or import code until component-level compatibility review. |
| Certimate | [certimate-go/certimate](https://github.com/certimate-go/certimate), MIT; self-hosted ACME certificate issue/deploy/renew/monitor workflows. | **Useful operational pattern; optional adapter later.** Begin with read-only certificate inventory/expiry. Issuance/deployment needs exact-domain authorisation, isolated DNS/API secrets, staged renewal, rollback and human approval. |
| OpenPanel | [Openpanel-dev/openpanel](https://github.com/Openpanel-dev/openpanel), GitHub identifies AGPL-3.0; its website publishes a separate EULA restricting third-party commercial service use. | **Do not adopt as core analytics.** Reconcile GitHub licence and current EULA before any deployment/reuse. AEGIS should own opt-in aggregate telemetry; no session replay, covert fingerprinting, raw prompt/audio/content capture or cross-site tracking. |
| cf-workers-docker | Interpreted as [cmliu/CF-Workers-docker.io](https://github.com/cmliu/CF-Workers-docker.io), Cloudflare Worker Docker registry proxy. | **Reject as build-chain dependency.** Third-party registry proxying adds egress and image supply-chain risk. Use approved registries, immutable OCI digests, verified provenance/signatures and egress allowlists. |
| n8n MCP | [czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp), MIT; reads/debugs/validates/edits n8n workflows and can manage credentials. | **Optional connector pattern, not orchestrator.** AEGIS owns tasks, schedules, policy and audit. Start read-only. Workflow edits, credential changes, activation and execution require exact scope, diff preview, explicit approval, idempotency and rollback. Hosted tier is not a free core dependency. |
| vibe-coding-prompt-t | Exact repository identity not established from supplied string. | **Unresolved hold.** Need exact URL/owner; do not invent a match or licence. |
| BuildingAI | Interpreted as [BidingCC/BuildingAI](https://github.com/BidingCC/BuildingAI), visual no-code agent platform; repository licence Apache-2.0. | **Study mechanisms, not platform adoption.** Useful ideas: typed visual workflow contracts, app manifests, connector schemas and previewable drafts. Sentinel remains sole execution authority; no billing/model aggregation/hosted service becomes mandatory. |
| IDA Pro MCP | [icryo/ida-pro-mcp](https://github.com/icryo/ida-pro-mcp), MIT; IDA analysis over MCP. | **Specialist optional reverse-engineering adapter only.** Requires separately licensed IDA Pro. Documented arbitrary IDAPython execution is high risk: disable by default; analysis-only allowlists, disposable isolated databases, no host shell/network/secrets, and approval for scripts/database writes. |
| SaaS boilerplate template | Generic category; no vendor or repository specified. | **No candidate selected.** AEGIS should own auth, ownership/tenancy, audit, and a free core. Any exact template needs licence, hidden-service, telemetry, default-secret, auth and dependency review. |

## Cross-cutting architecture

1. **Speech:** consolidate STT/TTS behind one local-first media contract. faster-whisper is a benchmark alongside Whisper.cpp; Qwen3-TTS is optional output. Pin model revisions and separately review model-weight licences.
2. **Repository intelligence:** Repomix is a context-packaging technique, not a replacement for AEGIS provenance, code memory or canonical repository index. Redact secrets and bound paths, bytes and token budgets.
3. **Visual generation:** FLUX licences are variant-specific. Schnell's Apache-2.0 status does not transfer to dev weights.
4. **Backend/cloud:** TrailBase, UniCloud and Certimate remain optional patterns. AEGIS keeps canonical data ownership, portable exports, local/offline operation and replaceable providers.
5. **Workflow/reversing:** n8n MCP and IDA Pro MCP remain subordinate adapters. Tool descriptions, repository content and tool output are untrusted; Sentinel checks every action independently.
6. **Observability:** no session replay, persistent device fingerprinting, raw prompts or hidden analytics. Prefer opt-in aggregate counters and local diagnostics.
7. **Supply chain:** no registry proxy or unpinned container pull. Pin immutable digests, verify provenance/signatures where available, scan SBOMs, isolate builds and deny arbitrary egress.

## Delivery order

- **P0:** typed contracts for local STT/TTS, repository context packaging, workflow adapters and certificate inventory.
- **P1:** benchmark faster-whisper vs Whisper.cpp on CPU, memory, latency, accuracy and target devices; benchmark Qwen3-TTS tiers separately.
- **P2:** add Repomix-like deterministic packaging only if existing code intelligence has a measured gap.
- **P3:** implement minimal opt-in aggregate observability and read-only certificate posture.
- **P4:** optional n8n read-only inspection and IDA analysis-only adapter after Sentinel scopes, isolation and audit coverage are proven.

## Explicit non-actions

No package/model/container/browser extension/MCP server/account/cloud drive/analytics tracker/provider was installed, run, connected or deployed. No marketplace login state/cookies were imported. No IDA script, workflow mutation, credential operation, certificate issuance, DNS change, registry proxy or model download was performed. This is research, not implementation progress.
