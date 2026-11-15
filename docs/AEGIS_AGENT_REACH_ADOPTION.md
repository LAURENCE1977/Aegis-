# AEGIS Agent Reach — architecture review and native implementation plan

**Reviewed upstream:** [Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach)  
**Reviewed revision:** `main` tree `c70ae6da5d39bc90e09ad2ae0575ccc89f31e284`  
**Upstream version:** `1.6.1`  
**Upstream licence:** MIT (retain the notice if any code is copied)  
**Review date:** 2026-11-15

## Decision

Build an AEGIS-native, compatible **read-only source-reach layer**. Do not install Agent Reach's Python CLI into the Cloudflare Worker and do not give agents arbitrary shell access to run its upstream commands.

Agent Reach's useful idea is its channel abstraction: each source exposes named actions, ordered backends, health checks and actionable setup state. AEGIS should preserve that user-facing model while implementing adapters inside its existing Worker/Queue/Sentinel architecture.

This is an architectural review, not a claim that any new source adapter is live.

## What upstream provides

The reviewed upstream repository is a Python 3.10+ CLI/skill package. Its README documents:

- A common channel/action interface and a `read <url>` dispatcher.
- Default channels including GitHub, YouTube, Bilibili, V2EX and web; optional and experimental channels include Reddit, LinkedIn, X/Twitter, Facebook, Instagram, XiaoHongShu and others.
- Ordered primary/fallback backends and channel health diagnostics.
- Local setup/configuration and per-channel session state.
- Read-only intent: search and read, not posting, commenting, liking or messaging.
- Several upstream dependencies (for example yt-dlp, Jina Reader, Exa, OpenCLI and platform-specific CLIs); some sources need a user login or transcription API key.

Important distinction: Agent Reach orchestrates existing upstream tools. It is not itself a universal scraper or a guarantee that every platform is accessible. Its own capability notes distinguish declared support from actions actually verified on a particular machine.

## AEGIS-native mapping

| Agent Reach concept | AEGIS implementation |
|---|---|
| Channel | Canonical capability manifest in `functions/lib/capability-registry.mjs` |
| Channel action | Manifest action with effect, risk, required scopes and approval policy |
| Backend order/fallback | Server-owned adapter route table; never agent-supplied |
| `doctor` / channel health | Read-only source health endpoint with last-checked time and failure class |
| Local config / login | Owner-managed connection record; credential material held in a secret vault, not D1 |
| Agent command | Durable agent run -> strict capability bridge -> Sentinel -> adapter |
| Rate limits / concurrency | Per-provider and per-principal budgets, plus durable queue leases |
| Source result | Normalized, provenance-bearing, size-limited result with source URL and retrieval time |

## Security differences we require

Agent Reach is designed primarily for a local command-capable agent. AEGIS is a multi-user server runtime, so local trust assumptions cannot be carried over.

1. **No arbitrary command execution.** Worker adapters are typed server-owned functions. No `exec`, shell, Python package installer or user-supplied command strings.
2. **No browser-cookie import.** AEGIS must not copy a user's Chrome cookies or browser profile. Connections are explicit, revocable and scoped; session tokens are encrypted in a dedicated secret store.
3. **No credential material in D1 or agent context.** D1 stores secret references and connection metadata only.
4. **No agent-controlled fallback.** The adapter router selects from a reviewed server-side list. The model cannot provide an endpoint, backend, proxy, cookie or header.
5. **SSRF and egress controls.** Every adapter has a fixed hostname allowlist. Resolve and validate all addresses, reject loopback/private/link-local/reserved ranges, revalidate redirects, limit response size and enforce deadlines.
6. **Sentinel is mandatory.** Each invocation binds trusted principal, capability/version, action, exact resource, required scopes, active grant, connection, approval and input digest. No manifest or role label grants permission.
7. **Read-only first.** No posts, comments, likes, follows, messages, account changes or other external writes in this integration.
8. **Untrusted content stays data.** Search results, pages, transcripts and comments are untrusted input. Prompt-injection content must never become instructions or tool authority.
9. **Rate limits are respected.** Honor upstream 429/Retry-After and platform blocks; no account rotation, proxy hopping or repeated attempts to evade a block.
10. **Auditable provenance.** Store source, backend identifier, URL, fetched-at time, content hash, status and redacted error metadata. Do not store raw cookies, auth headers or unbounded page bodies in audit logs.

## Phased implementation

### Phase 0 — foundations (current PR #29)
- Durable agent run orchestration and strict capability bridge.
- Exact-resource, scoped, expiring capability grants.
- Existing Sentinel policy and human approval remain the only authorization route.
- No adapter execution is enabled by this document.

### Phase 1 — public, low-risk sources
Implement one source at a time behind the same adapter contract:
1. Public GitHub repository/issue/PR metadata using the GitHub API.
2. Public web page reader using a reviewed provider or direct constrained fetch.
3. YouTube metadata/subtitles where a lawful, stable source is available.

Each source must have: manifest, exact actions/scopes, egress allowlist, input schema, output schema, timeout/size limits, rate limit, provenance, unit tests, adapter contract tests and a non-production integration check.

### Phase 2 — authenticated read-only sources
Only after the secret vault and connection lifecycle exist:
- Reddit and X/Twitter, subject to current platform terms and supported access paths.
- LinkedIn and other login-dependent channels only after an explicit account connection and risk review.

No cookie scraping or browser-profile cloning. Login-required support must be transparent and user initiated.

### Phase 3 — health and resilience
- Source health snapshots with `healthy / degraded / unavailable / needs-connection`.
- Backend failover only across pre-reviewed providers for the same declared action.
- Circuit breakers, Retry-After handling, bounded retries, queue backpressure and duplicate suppression.
- Owner controls to disable a source, revoke a connection or revoke all grants for a provider.

## Adapter contract (target)

An adapter is a server-owned module with a narrow interface:

```js
{
  id: 'github.public-read',
  version: '1.0.0',
  actions: ['repository.read', 'issue.read', 'pull-request.read'],
  egressHosts: ['api.github.com'],
  async healthCheck(context) { /* no secrets in output */ },
  async execute(action, input, trustedContext) {
    // typed input; fixed upstream; bounded normalized output
  }
}
```

The router supplies the adapter and trusted connection reference after Sentinel authorization. The agent supplies only a validated action and input. The adapter cannot expand its own scopes or egress hosts at runtime.

## Explicit non-goals

- Reproducing Agent Reach's full Python CLI or installing its dependencies in Cloudflare Workers.
- Scraping every platform or promising permanent access.
- Bypassing CAPTCHAs, access controls, paywalls, rate limits or platform blocks.
- Posting, commenting, liking, messaging or other write operations.
- Claiming 24/7 source monitoring until deployed queues, schedules, health checks and alerting are proven in the target environment.

## Current status

- Upstream reviewed; MIT licence confirmed in its `LICENSE`.
- Architecture and migration plan recorded here.
- AEGIS currently has the agent orchestrator, capability bridge and grant storage primitives in PR #29.
- **No Agent Reach adapter is currently registered, connected to a real upstream, or enabled for agent execution.**
- PR #29 remains draft and its base must be reconciled with the latest PR #27 head before merge.
