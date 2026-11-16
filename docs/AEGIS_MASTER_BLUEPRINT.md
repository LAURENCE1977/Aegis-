# AEGIS Master Blueprint & Build Handover

**Canonical project record.** Last refreshed: 16 November 2026.  
**Repository:** https://github.com/LAURENCE1977/Aegis-  
**Purpose:** Let a fresh AI/engineering session resume AEGIS from repository evidence without depending on previous chat history.

> Read this document and `AGENTS.md` before making changes. Then inspect the live repository, branches, pull requests, CI and deployment state. This document is a durable blueprint, not a substitute for checking live state. Distinguish verified implementation from plans. Never claim work is complete without evidence.

## 1. Mission

AEGIS is Laurence's personal, open, modular, mobile-first AI operating system. It should combine ChatGPT's reasoning and conversational strengths with AEGIS's persistent memory, specialist agents, controlled tools, execution, monitoring and durable background work.

The intended system is a two-way ecosystem:
- ChatGPT handles conversation, reasoning, planning, research and creative collaboration.
- AEGIS owns durable memory, task state, agents, integrations, execution, monitoring and jobs that continue while ChatGPT is idle.
- A shared intelligence layer provides approved project context, skills, knowledge, capability schemas, provenance and audit.
- ChatGPT can call approved AEGIS capabilities through a standards-based bridge.
- AEGIS can call available OpenAI models through the API and other providers through adapters. API use is separate from a ChatGPT subscription and may incur separate charges.

This does not copy ChatGPT's private infrastructure, alter GPT-6 weights or inject knowledge into model weights. It builds an interoperable, provider-agnostic counterpart using open standards.

## 2. User constraints and working agreement

- Primary device: Chromebook; also iPad Air and iPhone.
- Browser/mobile-first. Do not assume the Chromebook is available while the user is working.
- User is on ChatGPT Free. Do not assume paid Codex/cloud features or permanent ChatGPT background access.
- Prefer free or very low-cost services and verify current free-tier limits before depending on them.
- Avoid terminal-heavy setup and avoid making the user do work the assistant can perform through authorised integrations.
- Never request passwords, API keys, PATs, session secrets or other credentials in chat.
- Be autonomous and decisive, but honest. No invented progress, tests, permissions, merges or deployments.
- Human approval is required for irreversible, production-impacting, security-sensitive, costly, destructive or externally consequential actions.
- Use feature branches, preview deployments, least privilege, audit trails and rollback.
- Keep updates concise: Verified complete / Working but limited / Not built / Blocked by / Next action.

## 3. Target system capabilities

1. Orchestration and provider/model routing with cost, latency, capability and fallback policies.
2. Durable memory and attributed knowledge with search, provenance, versioning and correction.
3. Specialist agents and reusable skills with narrow roles and constrained tools.
4. MCP/API/browser integrations with scoped credentials, approvals, audit and revocation.
5. Forge: discover, inspect, compare, evaluate, plan, adapt, implement, test, review and maintain useful capabilities.
6. Knowledge Forge: ingest repositories, technical literature, standards, APIs, MCP manifests, SDKs, benchmarks and engineering methods; evaluate evidence, licence, provenance, dependencies, security, applicability and freshness.
7. Security Centre: identity, sessions, policy enforcement, secrets, audit, threat detection and revocation.
8. Control Centre: mobile-first task, agent, job, approval, log and health dashboard.
9. Media Studio: future modular creative/media capabilities.
10. Durable 24/7 runtime: scheduled and event-driven jobs, queues, retries, resumability, checkpoints, monitoring and human approval gates.

Do not describe roadmap items as implemented.

## 4. AEGIS Bridge — ChatGPT and client compatibility

Build a secure, provider-neutral compatibility layer:
- Current MCP specification and JSON-RPC transports; check official current spec before implementation.
- Discoverable tools, resources and prompts with stable IDs and versioned schemas.
- OAuth 2.1/PKCE where client requirements demand it; scoped authorisation, revocation, rate limits and audit.
- Shared approved memory, skills, knowledge and project context.
- Task submission, status, result retrieval and audit visibility.
- OpenAI API and other model-provider adapters.
- Controlled outbound MCP/API connections.
- Durable job handoff to AEGIS runtime.
- Default-deny permissions; agents/tools cannot self-grant privileges.
- No arbitrary execution of untrusted repository code in the control plane.

Client compatibility is not model compatibility. The bridge exposes capabilities safely; it does not turn AEGIS into a new foundation model. ChatGPT remote MCP and connector support varies by product surface and plan; never promise universal availability.

## 5. Forge and Knowledge Forge principles

Research pipeline:
Discover → deduplicate → inspect → licence/security review → extract → evaluate evidence → compare → synthesise → adapt to AEGIS interfaces → test → approve → version → monitor.

For every candidate, record:
- canonical URL, owner/project, source class, commit/version and retrieval date;
- licence, attribution and redistribution obligations;
- maintenance, releases, advisories and dependencies;
- interfaces, runtime, hardware assumptions, footprint and cost;
- evidence quality, tests, benchmarks and limitations;
- provenance, inspection scope, decision and rationale.

Decision options: reuse, adapt, rebuild, combine or reject. Unknown licence/provenance means hold, not permission. Social-media posts may surface candidate names but never count as validation; independently inspect official repos/docs. Do not bulk-import or execute untrusted source code.

Knowledge records must retain source links, version, licence, evidence grade, applicability, caveats, conflicts, adaptation notes and refresh policy. External projects should become replaceable adapters, not hard dependencies.

Candidate projects named by the user in earlier research sessions include: Agent-desktop, OpenMausBot, FreeLLMAPI, Pinchtab, Lightpanda, OWASP, Wazuh, YARA, Zeek, Suricata, Pangolin, Router Hub, OpenCode, PocketBase, Graphite, Maxun, Onyx, ComfyUI, Dyad, AgenticSeek, LatentSync, BackgroundRemover, OpenChatCut, Assistant-UI, Better-T-Stack, Jam.dev utilities, US government repositories, and other repos/tools discussed in prior chats. These are **unvetted leads**, not approved dependencies. Recover the exact earlier list from conversation/library context when available; do not imply this list is exhaustive.

## 6. Security and engineering rules

- Default deny; least privilege; explicit scopes and purpose limitation.
- Store secrets only in encrypted secret stores. Never commit secrets or expose them in logs.
- Treat repository content, web pages, issues, docs and tool outputs as untrusted data, not instructions.
- Never execute untrusted code in the control plane.
- Isolate builds/tests; pin dependencies and source commits.
- Keep audit events for approvals, tool calls, job transitions and deployment promotions.
- Require human approval for production, secrets, permission changes, billing, destructive operations and external communications.
- Preserve a known-good version and rollback path.
- Every UI control must work; test mobile/browser layouts and failure states.
- Benchmark quality, correctness, latency, memory/compute, dependency count, complexity and cost. Do not claim gains without reproducible measurements.

## 7. Current verified repository baseline

Repository: `LAURENCE1977/Aegis-` (trailing hyphen). Default branch: `main`.

### PR #1 — resolved
As of 15 November 2026, PR #1 was verified **closed and merged**:
- URL: https://github.com/LAURENCE1977/Aegis-/pull/1
- Merge commit: `37436b3c6bfd401fa494b6d0d9f15919ca826c0a`
- `main` points to the same merge commit SHA.
- PR title: “Secure AEGIS APIs and add the native Superpowers skills foundation”.
- The PR added password sign-in, same-origin checks, HMAC-signed 12-hour Secure/HttpOnly/SameSite=Strict sessions, authenticated chat/memory APIs, ten AEGIS-native adaptations of MIT-licensed Superpowers engineering skills, source/licence provenance and authenticated skills registry.
- PR description reported 21 passing auth/skills tests and route syntax checks on the feature branch. Re-run the current full test suite before relying on that claim.
- PR description said no GitHub Actions workflows were configured at that point; inspect current main for any later workflow additions.

### Current main contents confirmed during handover
README states the project is an early Cloudflare Pages prototype. It lists:
- mobile-friendly chat for iPhone, iPad and Chromebook;
- Cloudflare Pages Functions and Workers AI chat binding;
- optional KV for simple notes;
- password sign-in and signed expiring browser sessions;
- ten adapted engineering skills with contextual guidance;
- authenticated module/skills endpoints;
- Forge capability declarations and engineering-intelligence record validators;
- authenticated read-only public GitHub repository discovery.

README explicitly says the full autonomous task runner, provider router, durable engineering knowledge store, general MCP/API connector manager, voice engine and production Forge sandbox are **not yet present**.

Forge documentation says:
- current GitHub discovery is read-only public metadata;
- candidate and knowledge record validators exist;
- Forge/Engineering Intelligence declarations remain planned;
- records are not yet persisted;
- repository code is not executed and registry grants no permissions.


### AEGIS Bridge implementation snapshot — 15 November 2026
- PR #3: https://github.com/LAURENCE1977/Aegis-/pull/3 — **closed and merged**.
- Merge commit: `6b00b9fe1406d5d27c06674d6d4f5ce8dc504ee7`; live `main` was verified at this SHA.
- Cloudflare Pages production deployment from main succeeded at `https://1a7b66da.aegis-6yk.pages.dev`.
- Initial endpoint: `POST /mcp`, stateless MCP Streamable HTTP revision `2026-07-28`.
- Implemented operations: `server/discover`, `tools/list`, `tools/call`.
- Initial tools are read-only: `aegis_get_status`, `aegis_list_modules`, `aegis_list_skills`.
- Security: bearer token via encrypted `AEGIS_MCP_TOKEN` or existing signed AEGIS session; Origin validation when supplied; protocol/header consistency; JSON negotiation; 64 KiB request limit; no CORS; no write or code-execution tools.
- Interim bearer token is not OAuth 2.1 and has no per-client scopes/revocation. OAuth 2.1/PKCE and scoped client lifecycle remain required before broad external exposure.
- CI for the Bridge branch passed 68 tests. Main's post-merge CI also passed.
- The Pages project configuration did not list an `AEGIS_MCP_TOKEN` encrypted secret when checked; therefore the Bridge endpoint remains fail-closed until that secret is configured. Do not expose or request its value.

### AEGIS Runtime implementation snapshot — 15 November 2026
- PR #4: https://github.com/LAURENCE1977/Aegis-/pull/4 — **closed and merged on 16 November 2026**. Merge commit: `33820ca985b97be6152575ed6b267d0b5f8155e6`.
- Branch: `feature/aegis-durable-job-runtime`; latest source head at the time of this update must be re-verified live.
- Added a separate Cloudflare Worker runtime under `workers/runtime/`, D1 schema under `migrations/runtime/0001_jobs.sql`, and deployment template `workers/runtime/wrangler.toml.example`.
- Authenticated API: `POST /v1/jobs`, `GET /v1/jobs/:id`, `GET /health`; interim bearer token `AEGIS_JOB_TOKEN`, no permissive CORS, same-origin enforcement when Origin is present, 8 KiB request limit.
- Only allowlisted task is `aegis.health_check` with an empty payload. No arbitrary code, shell, URL fetch, model calls, deployment or external write operations.
- D1 stores durable job records and job-event audit entries. Queue consumer handles execution. Cron outbox sweep recovers pending dispatches and expired two-minute leases. Attempt fencing prevents a stale worker from overwriting a newer attempt. Optional Idempotency-Key prevents duplicate job creation.
- The first test run was deliberately red because the job contract module did not yet exist. After implementation, CI passed **82 tests, 0 failed** on head `8e7644fee23c8c281888cc802fb60da9047c6c0e`. Re-check CI for any later head after documentation/formatting updates.
- Runtime source is not deployed. Cloudflare account inspection found no D1 databases or Queues and only two unrelated Worker scripts (`artist-hub-preview-20261113`, `project-andromeda`). Do not confuse them with AEGIS.
- PR #4 does not change the live Pages project. Resource provisioning and Worker deployment remain separate and require a cost/limit check plus appropriate authorisation.
- See `docs/AEGIS_RUNTIME.md` for API, data model, deployment preparation and limitations.

### AEGIS dead-letter recovery — PR #8
- PR #8: https://github.com/LAURENCE1977/Aegis-/pull/8 — open draft, based on the former PR #4 feature branch; it has not been merged.
- Adds a dedicated `aegis-jobs-dlq` consumer, conditional terminal failure for exhausted deliveries, idempotent audit events, and protection for active leases and terminal jobs.
- The latest checked head `2e590313628f26c8a31646e608ff515f13b53cee` has one successful Node.js test run (`43728470853`, 87 passed) and one duplicate run cancelled; Cloudflare Pages preview succeeded. This is test/preview evidence only, not live Queue/D1 verification.
- Because PR #4 is now merged, retarget/reconcile PR #8 with `main` before merging; inspect the resulting diff and rerun checks.

### Important branches and prior refs
- `feature/aegis-security-forge-foundation` was the PR #1 head.
- `feature/aegis-bridge-compatibility` was previously created; inspect whether it still exists and compare it with current main before using it.
- Previous feature preview URL: https://85fc6acf.aegis-6yk.pages.dev (historical preview; verify before use).
- Historical feature SHA before merge: `1a2848695d7dd35380e9dbfaa5a46f33dfe9b6a7`.
- Historical pre-merge main SHA: `b583badb729dea6e9ff29164cba7100059eba045`.

## 8. Cloudflare deployment and secrets

- Cloudflare Pages project: `aegis`, connected to this GitHub repository; production branch `main`, branch previews enabled (last known configuration).
- Verify current production deployment and branch preview before claiming deployment success.
- Cloudflare account inspection on 15 November 2026 found no D1 databases or Queues. Two existing Worker scripts were unrelated to AEGIS. The runtime source in PR #4 is not yet deployed; no AEGIS Queue consumer or Cron job is running.
- Expected encrypted Pages secrets:
  - `AEGIS_PASSWORD` — unique value, at least 12 characters.
  - `AEGIS_SESSION_SECRET` — cryptographically random, at least 32 characters.
- Presence of these secrets was not verified in this handover. Never retrieve, display or ask for their values. Verify only presence/configuration metadata where supported.
- Other Cloudflare resources seen previously (`artist-hub-preview-20261113`, `project-andromeda`, and Pages project `storied-gecko-09ca7c`) are not AEGIS; do not confuse them.

## 9. 24/7 runtime — first source slice implemented, not deployed

A ChatGPT scheduled automation is not an AEGIS runtime. The native runtime must run while ChatGPT is idle.

PR #4 contains the first isolated Worker source slice:
1. Authenticated job submission and status API.
2. D1 schema for durable job records and audit events.
3. Queue-backed consumer.
4. Cron outbox recovery for pending dispatches and expired leases.
5. Attempt fencing and optional idempotency key. Attempt IDs are captured atomically with `UPDATE ... RETURNING attempts`, preventing a stale worker from adopting a newer attempt after lease recovery.
6. Strict allowlist containing only a no-argument health-check task.

PR #4 is merged into `main` at `33820ca985b97be6152575ed6b267d0b5f8155e6`. Its final Node.js CI run `43725405757` passed **83 tests, 0 failed**. The stale-attempt regression was reproduced against the old code (82 passed, 1 failed) before the fix. The Cloudflare Pages preview did not deploy the separate runtime Worker; no production Worker deployment is implied by this merge.

Still missing:
- Cloudflare D1/Queue resource provisioning and deployment.
- Real D1/Queue integration tests and live Worker verification.
- Durable Workflows/checkpointing for longer multi-step tasks.
- Approval gates, task cancellation, notifications and Control Centre UI.
- Specialist agents, provider routing and authorised connectors.

Cloudflare free-tier reference check (15 November 2026): Workers Free includes 100,000 requests/day and 10 ms CPU per invocation; D1 Free includes 5 million rows read/day, 100,000 rows written/day and 5 GB total account storage; Queues Free includes 10,000 operations/day and 24-hour message retention. D1 overages are rejected at free limits; Queue operations/retries count toward the daily allowance. The design must monitor usage and remain within limits. Sources: Cloudflare Workers pricing/limits, D1 pricing/limits, and Queues pricing/limits. Do not assume an account's current plan or remaining usage without checking it.

The next deployment stage needs one D1 database, one Queue and one separate Worker. Resource creation/deployment is not yet performed. Review account usage, ensure no paid upgrade or spending-limit change, then provision only the minimum resources. Never enable billing or exceed free limits without explicit approval.

## Mandatory repository reverse-engineering and adoption policy

This policy applies to **every repository the user supplies or asks AEGIS to investigate**, including repositories discovered through GitHub, social media, articles, lists and other projects.

For each candidate, Forge must:
1. Identify the exact upstream repository, owner, default branch, relevant commit/tag and project purpose.
2. Inspect the whole repository when useful: source tree, architecture, entry points, interfaces, tests, build/deployment files, dependencies, security posture, maintenance and issue history. Do not rely on README summaries alone for adoption decisions.
3. Reverse-engineer the capabilities and design patterns that solve an AEGIS need. Map useful modules, algorithms, workflows, data models and UI patterns to AEGIS interfaces.
4. Choose explicitly between **rebuild natively**, **adapt selected components**, **combine patterns**, **fork/adopt the whole repository**, or **reject/defer**. Record why.
5. Prefer an AEGIS-native implementation for core identity, policy, Sentinel, permissions, memory, task state, approvals, audit and provider abstraction. External code must not bypass these boundaries.
6. If the complete upstream repository is the best technical and maintenance option, prefer a fork into the AEGIS build over an unnecessary rewrite. Verify that forking and the intended modifications/redistribution comply with the exact licence and any third-party notices. A fork is not permission to remove upstream attribution or licence obligations.
7. Before copying, adapting, forking or deploying, review the applicable licence at repository, package and file level; check trademarks, patents, assets, datasets, model weights and third-party components separately. Unknown or incompatible rights mean hold the candidate and do not copy it.
8. Keep adopted projects isolated and replaceable where practical. Pin upstream commits, preserve provenance and notices, document local patches, track upstream security fixes and define a merge/rebase strategy. Do not import unnecessary dependencies or weaken AEGIS controls to fit an upstream project.
9. Never execute untrusted repository code in the AEGIS control plane. Use an isolated, resource-limited build/test environment and inspect install scripts, workflows, binaries and network access before running anything.
10. Record the decision and evidence in the research register, including exact upstream URL/ref, licence, inspected scope, useful components, adaptation/fork plan, risks, tests, cost, rollback and refresh cadence.

**Default decision rule:** reverse-engineer every candidate; build our own version when that is the better long-term fit; otherwise use a scoped adapter or fork the whole repository when that is demonstrably the best option. Personal-use intent does not override licence, security, privacy or third-party rights. Never claim a repository was fully inspected when only selected files or metadata were reviewed.

## Research source intake — 15 November 2026

A research source register is maintained at [docs/RESEARCH_SOURCE_REGISTER.md](RESEARCH_SOURCE_REGISTER.md). It evaluates Vercel AI SDK/UI, Vstorm AgenticOS, Dev.to, Stack Overflow, Frontend Mentor, v0 and Blackbox AI.

Current decisions:
- AI SDK/UI: leading architecture reference for provider-neutral model/tool integration, streaming UI, approvals and MCP; verify actual frontend/runtime fit before adding dependencies.
- AgenticOS: study governance, budgets, audit and shared-runner patterns; do not deploy its heavier self-hosted stack wholesale.
- Dev.to and Stack Overflow: attributed research sources, not authoritative specifications; respect licences and reproduce technical solutions.
- Frontend Mentor: optional UI quality/acceptance-test inspiration; do not copy premium assets or briefs.
- v0: optional human-operated UI prototyping tool, not AEGIS runtime.
- Blackbox AI: defer connector until API, costs, privacy, sandboxing and GitHub permissions are reviewed.

These are research-only candidates. None is connected, installed or granted permissions. “vo” was interpreted as v0; correct this if a different product was intended.

## Runtime dead-letter recovery update — 16 November 2026

A new feature branch `feature/aegis-runtime-dlq-recovery` ports the previously developed PR #8 dead-letter recovery behavior onto the current `main` baseline, avoiding the stale integration-test conflict. It adds regression coverage for exhausted deliveries, idempotent audit, terminal-job protection, active-lease protection and unknown-queue fail-closed handling; implements queue-aware processing; and registers the dedicated `aegis-jobs-dlq` consumer. The change is source-only and must pass fresh tests and preview checks before merge. It does not provision or deploy D1, Queues or the separate runtime Worker.

## 10. Implementation sequence

1. Re-read this blueprint and `AGENTS.md`; inspect live main, branches, PRs, Actions and Cloudflare.
2. Review and integrate PR #8 dead-letter recovery against the now-merged runtime, then review PR #13 capability registry. Preserve the distinction between source merge, resource provisioning and live Worker deployment.
3. Validate runtime code against a real local D1/Queue emulator or disposable test resources; add recovery, retry, concurrency and failure-path tests.
4. Provision one D1 database, one Queue and a separate Worker only after confirming account free-tier headroom and no billing change.
5. Deploy the Worker with an encrypted `AEGIS_JOB_TOKEN`; verify health, submit, status, completion, idempotency, Cron recovery and DLQ behavior.
6. Add controlled job types and approval gates; do not add arbitrary execution.
7. Add persistent memory and Knowledge Forge with provenance and search.
8. Add MCP/OpenAPI ingestion and controlled connector manager.
9. Build mobile-first Control Centre for jobs, approvals, logs and health.
10. Add specialist agents and model routing incrementally.
11. Add self-improvement loops only after isolation, tests, review, audit and rollback exist.

## 11. Required workflow for every code change

1. Load the installed test-driven-development skill before implementation.
2. Inspect current code and define acceptance criteria.
3. Write regression tests first (red).
4. Implement the smallest change (green), then refactor.
5. Run relevant tests and report exact results.
6. Review security, permissions, error paths, cost and mobile/browser compatibility.
7. Commit on a feature branch and open/update a PR.
8. Verify preview deployment.
9. Merge/promote only with appropriate authorisation.
10. Update this blueprint and the build-state log after meaningful milestones.

## 12. Fresh-session startup instruction

When a new AI session starts:
1. Read `AGENTS.md`, this master blueprint and `README.md`.
2. Fetch current `main`, branches, all PR states, latest commits and CI results.
3. Inspect Cloudflare production/preview state and relevant configuration metadata.
4. Compare live state against this document; update stale facts before acting.
5. Resume the highest-priority unfinished item without asking the user to repeat known context.
6. Do not claim the document itself proves a feature works; code, tests and deployment are the evidence.

**Canonical source:** this file in the GitHub repository. Update it as architecture and implementation change.


## 13. Cross-platform strategy — architecture requirement

Detailed target matrix and release gates: [docs/PLATFORM_COMPATIBILITY.md](PLATFORM_COMPATIBILITY.md).

AEGIS must be designed as a platform-independent core with replaceable client and infrastructure adapters. Cross-platform support is a long-term requirement, not a promise that every feature will be available on every device at launch.

### Platform direction

- **First delivery target:** responsive web application / installable PWA, tested on Chromebook browsers, iPhone Safari and iPad Safari.
- **Next client targets:** Android and desktop browsers, using the same web client and capability contracts wherever practical.
- **Later native targets:** Android, iOS/iPadOS, Windows, macOS and Linux clients only where browser/PWA limitations justify the additional maintenance.
- **Server/runtime:** keep orchestration, memory, policy, agent execution and durable jobs behind documented APIs and portable contracts. Cloudflare is the current low-cost hosting choice, not a permanent architectural lock-in.

### Core and adapter boundaries

Keep business logic out of platform-specific UI code. Define versioned interfaces for:
- identity, authentication and session lifecycle;
- model/provider routing and streaming;
- agent runs, task state, approvals, cancellation and audit;
- memory, files, search and synchronisation;
- notifications, scheduling and background execution;
- voice input/output, media capture and playback;
- browser/device automation and local capabilities;
- secrets, secure storage and platform permission prompts.

Use capability detection rather than user-agent sniffing. A client must show a clear unsupported/permission-required state when a capability is unavailable. Never silently weaken security or pretend a background task is running when the operating system has suspended it.

### Portability rules

1. Keep a single canonical API and data model; version contracts and maintain backwards compatibility where practical.
2. Make the web/PWA client the reference implementation; add native shells only for capabilities that demonstrably need them.
3. Keep provider, database, queue, object-storage and deployment integrations behind adapters so infrastructure can be replaced.
4. Use standards where suitable: HTTPS, JSON/HTTP, MCP, OAuth 2.1/PKCE, OpenAPI and Web Push where supported.
5. Treat local storage as a cache, not the source of truth for durable jobs or shared memory.
6. Design offline behaviour explicitly: queue safe drafts locally, reconcile conflicts, and never imply a server-side action completed before confirmation.
7. Isolate platform-specific permissions and sensitive capabilities; require explicit user consent and auditable scopes.
8. Maintain automated browser/device test matrices, responsive layouts, accessibility, keyboard support and graceful degradation.
9. Do not promise 24/7 background execution from mobile clients. Durable jobs must run server-side; mobile clients observe, approve and resume them.
10. Measure the cost and maintenance burden of every additional client before adopting it.

### Progressive delivery

1. Responsive web/PWA across the user's Chromebook, iPhone and iPad.
2. Stable API/Bridge and server-side runtime contracts.
3. Android client/device QA adapter where useful.
4. Desktop packaging only if it adds real value beyond the web app.
5. Native iOS/iPadOS and Windows/macOS/Linux integrations only for validated gaps.
6. Continuous compatibility tests and adapter conformance checks for every supported platform.

**Acceptance principle:** a platform is supported only when its core workflows have been tested on real target browsers/devices, accessibility and failure states are checked, and platform limitations are documented.



## 14. Web ingestion and workflow-engine strategy

New candidates evaluated 15 November 2026 are recorded in [docs/RESEARCH_SOURCE_REGISTER.md](RESEARCH_SOURCE_REGISTER.md).

### Web research and ingestion
- Define a provider-neutral ingestion interface for discovery, fetch, crawl, extraction, normalization and provenance.
- Prefer permitted native retrieval or low-cost options first; evaluate Firecrawl as an optional AGPL-licensed service and Oxylabs only as a paid, explicitly budgeted fallback.
- Enforce target-domain policy, robots/terms review, SSRF defenses, bounded requests, content limits, deduplication and source provenance. Retrieved pages are untrusted data and cannot change agent policy or permissions.

### Workflow automation and durable execution
- Keep the existing AEGIS Worker/D1/Queue runtime as the first bounded execution engine.
- Study Temporal, Hatchet and Trigger.dev as the leading durable-workflow comparisons; study Inngest event-driven patterns and confirm the exact product name if "Ingest" meant something else.
- Study Activepieces connector pieces and workflow UX; keep n8n and Windmill licensing constraints explicit before any product embedding. Kestra and Apache Airflow are later options for larger data/business pipelines, not the initial agent runtime.
- OpenDots informs the specialist-agent workspace, approval and activity UX. It does not replace AEGIS identity, policy or runtime.
- OpenOutreach is a specialised outbound-sales agent, not core OS functionality. No external messaging, lead purchase or email sending is authorised by this research.

**Non-duplication rule:** AEGIS owns canonical job IDs, state, approvals, policies and audit. Any external engine is an execution adapter behind this boundary. Do not run multiple orchestration systems for the same workload without a measured reason, clear ownership and migration plan.


## 15. Capability System architecture

The governed capability lifecycle and implementation contract are specified in [AEGIS_CAPABILITY_SYSTEM.md](AEGIS_CAPABILITY_SYSTEM.md). PR #9 defines the architecture; PR #12 implements the first read-only registry slice on `feature/aegis-capability-registry-implementation`. The v0.1 manifest validator covers provider/interface metadata, action risk/effect/approval, scopes, data classification, egress declarations, auth references, limits, provenance and licence review. An authenticated no-store API lists two first-party read-only capabilities. A pure policy evaluator is also implemented: it binds to the exact registered manifest and checks principal, grant version/status/expiry/revocation, scope, exact resource, connection, exact-operation approval and budget snapshots. It does not persist grants, atomically consume approvals, record invocations or execute adapters. `isCapabilityGranted()` still fails closed; no grant store supplies real permissions. The manifest `approved` status is review metadata only, not permission. Latest recorded Node.js 22 CI on head `6ed236f313bb4ba23dde0a2cb970815031770ab5` (run `43729190428`) passed 110/110 tests. The current runtime remains health-check-only; do not widen its task allowlist until persistent policy, atomic approvals, isolated adapters, secrets, durable audit, revocation, idempotency, SSRF controls and cost limits are implemented and tested.


## Durable capability approvals — implementation slice

PR #16 adds a D1-backed approval-record persistence primitive and migration. Each record binds principal, capability/version, action, exact resource, optional connection and input digest; decisions are limited to pending/unexpired requests; consumption uses one conditional SQL update to prevent replay and concurrent double-use.

At the PR #16 baseline this was storage-only. PR #21 now adds an authenticated owner-only inbox and approve/deny API, plus a bounded human-readable operation summary. The API supplies the owner identity and does not accept browser-supplied operation bindings. This is still **not a complete approval workflow**: there is no human-facing review UI, invocation integration or durable invocation audit pipeline. Approval creation remains internal; the server-side operation builder must derive the digest from the validated operation, and execution must atomically consume the approval immediately before a side effect. Do not expose write/execute capability actions until policy, API, UI, audit and invocation are integrated and tested together.

### Owner-only approval inbox API — PR #21

PR #21 extends the D1 approval records with a bounded human-readable operation summary and adds authenticated `GET /api/approvals` plus same-origin `POST /api/approvals` approve/deny decisions. The API supplies the owner identity server-side, rejects unknown request fields, caps request bodies, returns no-store responses, and redacts input digests and connection IDs from the browser response. Expired pending requests can be seen but not approved. Approval creation remains internal; browser clients cannot create or rebind requests.

**Verification status:** implementation and regression tests are present on `feature/owner-approval-api`. The linked GitHub Actions status endpoint currently reports no status checks for the head commit, and this environment could not clone the repository to run Node tests locally. Therefore CI/test execution is **unverified**, not passed. PR #21 is open and unmerged. No D1 migration has been applied to Cloudflare, no approval UI or invocation/audit integration exists, and no external action can be executed through this API. Keep this feature behind review until tests are run; do not merge or deploy without explicit approval.


## Project Spaces and Agent Teams — implementation foundation

Project Spaces provide owner-scoped durable project context and an append-only typed activity timeline. The implementation adds authenticated workspace list/create/detail and event APIs, a shared D1 schema, and bounded request validation. The workspace timeline can surface memory lifecycle events where the required migrations are present. This is a persistence/API foundation, not an autonomous agent runtime: AEGIS's canonical job runtime remains the source of job state, and the capability registry, grants, approvals, Sentinel and audit remain the authority for actions. Source and regression tests are present on `repair/project-spaces-clean-main`; production D1 resources, migration application, UI integration and deployment have not been verified.


## Sentinel invocation gate — source integration

The Sentinel mediation primitive is being ported onto the clean Project Spaces branch as `functions/lib/sentinel.mjs`, with focused tests. Its intended sequence is trusted policy-context loading, exact-manifest policy evaluation, redacted audit, atomic consumption of any one-time human approval, then adapter invocation. It is deliberately not exposed through a public API or agent runtime yet. A complete execution boundary still requires persistent grants and connections, encrypted secret resolution, concrete durable audit, payload digest derivation, isolated adapters and egress enforcement. Source integration is not deployment; no D1 migration or production resource is enabled by this step.


## MCP Forge Catalogue — clean-main implementation slice

The metadata-only MCP Forge catalogue is being integrated on a clean branch from current `main`. It validates bounded candidate records, pinned source revisions, licence-review metadata, transport/runtime/auth declarations, explicit egress hosts and per-action effect/risk/scope/approval policy. It exposes defensive-copy list/get/search operations only; it cannot connect, install, approve or execute a server. Source URLs reject IP literals and local/internal hostnames, and the module performs no remote fetch. The ingestion/admission pipeline, persistent storage, advisory scanning, sandbox conformance and Sentinel-connected execution remain separate milestones.


## Free-Tier Ledger — verified-offer boundary

The native Free-Tier Ledger validates provider allowance records against official pricing/terms URLs, explicit quota periods, card requirements, commercial-use status, overage behavior and verification timestamps. A record is considered current only when its status is `verified` and its verification age remains within the configured window; candidate and expired records are never treated as confirmed free capacity. The ledger is descriptive only: it does not create accounts, provision services, activate paid usage or store provider credentials.


## Governed capability persistence and intelligence foundation

The current-main capability stack adds exact-resource grants, principal/provider connection metadata, AES-256-GCM credential storage with versioned keyring support, append-only invocation audit, and a validated provider/model catalogue with conservative token estimation and context fitting. These are persistence and planning primitives only: no provider credentials or vault keyring have been configured, no migrations applied to production D1, no provider connections established, and no adapter execution enabled. All real actions remain gated by Sentinel and exact-operation approval.


## Durable specialist orchestration — plan-only foundation

The runtime Worker can persist bounded agent-run objectives, queue them through the existing job Queue, and produce deterministic specialist plans with lease recovery and idempotency. This is not autonomous execution: no model, tool, browser, shell, MCP or external API is invoked. Agent orchestration is disabled unless `AGENT_RUNS_ENABLED=true`, and requires `migrations/runtime/0002_agent_runs.sql` before activation. The migration and Worker changes are source-only until explicitly deployed. See `docs/AEGIS_AGENT_ORCHESTRATION.md`.


## Sentinel D1 composition — trusted adapter boundary

A server-side `createSentinelDependencies` factory composes the persistent D1 grant, connection, approval, atomic-consumption and append-only audit stores with a fixed adapter allowlist. Adapter registration is pinned to exact approved capability/action pairs from the canonical registry. Dispatch never derives a network destination from manifest metadata, request fields or agent-provided names. The adapter receives a minimal frozen context without vault references or arbitrary endpoints. The first built-in adapter is a local read-only module catalogue that accepts no input and performs no network, filesystem, process or secret access.

The composition root verifies the canonical SHA-256 digest against the exact input again before dispatch and passes a canonical, deeply frozen payload to the adapter. It is still a library-only composition; no public route, production D1 database, migration application or Worker deployment is enabled. Arbitrary HTTP, MCP, browser, shell, write and delete adapters remain disabled.


## Forge repository inspection

AEGIS Forge now has owner-authenticated, read-only endpoints to inspect public GitHub repository trees and read selected text blobs by immutable SHA. Requests and responses are bounded; outbound requests use only the fixed GitHub API origin, reject redirects and have a timeout. Source is never installed or executed and remains untrusted reference data. See [AEGIS Forge](AEGIS_FORGE.md).


## Owner-controlled capability grants

The owner-only `/api/grants` route provides bounded grant history, exact-resource grant creation and revocation. The server derives principal, actor, capability version and scopes from the approved registry; browser-supplied principals/scopes are rejected. A grant is not an approval and cannot bypass Sentinel's human approval gate. See [AEGIS capability grant management](AEGIS_CAPABILITY_GRANT_MANAGEMENT.md).


## Project Space handover briefs

The owner-only `GET /api/workspaces/:id/brief` endpoint creates a bounded, read-only handover brief from one active Project Space. It includes recent event summaries and accepted, non-restricted, unexpired project memories only; source URLs and raw event bodies are excluded. Content is marked untrusted reference data and never grants permissions. See [AEGIS Project Space briefs](AEGIS_PROJECT_BRIEFS.md).


## Bounded GitHub public-discovery adapter

A second fixed Sentinel adapter, `aegis-github-public-discovery:discover`, reads public repository metadata only. Its destination is pinned to `api.github.com`, redirects are rejected, request timeouts are bounded, and streamed response bodies are capped at 64 KiB. It accepts exactly one canonical GitHub repository URL and does not read repository files, execute code, access private repositories or derive destinations from user-supplied endpoints. The adapter is registered in the server-side adapter map but is not exposed through a Sentinel route. Before exposure, add an atomic per-principal/action rate limiter and verify exact-resource grants for the target repository. Existing Forge source inspection remains a separate read-only research route.


## Forge candidate evidence and licence review

Forge candidates are owner-scoped and pinned to immutable Git tree revisions. Discovery never implies approval: candidates begin unassessed and licence-review-required. Reuse, adaptation, combination or approval requires explicit owner attestation, HTTPS evidence and a review note. D1 triggers protect source identity, enforce licence gates and preserve append-only review/status events. Candidate review is metadata-only; it does not install, build or execute upstream code.


## First owner-facing invocation route

`POST /api/sentinel/invoke` exposes exactly one action: `aegis-module-catalogue:list` on resource `aegis:modules` with empty input. It requires a valid owner session, same-origin request, configured AEGIS D1 and an exact active grant. The route derives the canonical input digest server-side and calls `runSentinelInvocation` through the trusted D1 composition root. It returns output only after the success audit is recorded. Unknown capabilities, actions, resources, adapter names, endpoints and non-empty inputs are rejected. This is a source-level restricted route, not a general tool endpoint; no external or consequential action is exposed.


## Atomic capability invocation rate limits

Migration `0006_invocation_limits.sql` adds an atomic per-principal, capability and action counter in fixed UTC-minute windows. A conditional D1 UPSERT reserves a slot only while the manifest's `requestsPerMinute` budget remains; old buckets are pruned after 24 hours. Sentinel requires a successful reservation after exact policy checks and before pre-execution audit, approval consumption or adapter execution. Exhaustion returns HTTP 429; rate-limit store failure returns 503. Both fail closed and attempt a redacted denial audit. CI applies migrations 0001–0006 to disposable local D1 and asserts three reservations against a limit of two leave the counter at exactly two. No remote or production D1 database is changed.


## AG-UI model gateway and bounded Sentinel tool loop

The AG-UI 1.0 endpoint supports authenticated streaming chat through the default Workers AI text-only route. An optional Qwen OpenAI-compatible provider can expose exactly two server-defined read-only tools only when the owner explicitly enables `AEGIS_AGENT_TOOLS_ENABLED=true`, selects the tested `qwen3.8-flash` model, configures its runtime API key/workspace/region and provides AEGIS D1. The tool loop permits one tool call and one no-tools follow-up only. Tool arguments are strict, resource IDs are derived server-side, and execution passes through exact grants, atomic rate limits, Sentinel audit and the fixed adapter registry. Provider frames are capped at 16 KiB, total provider bytes at 256 KiB and user-visible output at 12,000 characters. No private GitHub access, source-file reading, shell, browser, MCP, writes or deletes are enabled. No provider secrets or runtime flags are set by this code change.


## Anthropic provider adapter

The server-side AG-UI model gateway now has an optional Anthropic Messages SSE adapter. It uses the fixed Anthropic API endpoint, a server-side ANTHROPIC_API_KEY runtime secret and an explicitly configured AEGIS_ANTHROPIC_MODEL. Anthropic text deltas are translated into the existing AG-UI stream. Tool calling remains disabled for this adapter; the governed Qwen tool loop is separate. A GitHub Actions secret is not automatically available to Cloudflare runtime. See docs/AEGIS_MODEL_PROVIDERS.md.


## Composio GitHub integration — feature branch verification (16 November 2026)

**Status: implemented on a draft feature PR; not merged and not production-live.**

- Canonical branch: `feature/composio-audit-lineage-verified`
- Current commit: `cc809d84c73107bb74617fb4c8c830d8a9cbfa25`
- Canonical review PR: https://github.com/LAURENCE1977/Aegis-/pull/101
- PR #100 is the superseded earlier Composio copy; do not merge both.
- Composio remains a replaceable connector. AEGIS owns principal identity, capability manifests, grants, Sentinel policy, encrypted secret references, invocation audit and revocation.

### Implemented boundary

- Owner-only `POST /api/connections/composio` starts a Composio Sessions API session with exactly the GitHub toolkit and the fixed `GITHUB_GET_A_REPOSITORY` tool, then creates a GitHub OAuth link. `GET` reports connection status; `DELETE` revokes the AEGIS connection, vault reference and Composio session. The GitHub OAuth grant may still need separate disconnection at Composio.
- Session and connected-account references are stored through the AEGIS encrypted Vault. The Composio API key is resolved only from a server-side runtime secret. No provider token, API key, session ID or vault reference is returned to the browser or agent.
- Owner-authenticated `POST /api/sentinel/composio-github-repository` accepts exactly `{ owner, repo }`. The server derives the resource `github:repository:<owner>/<repo>` and routes the fixed read-only `get-repository` capability through Sentinel. Callers cannot select tool slugs, accounts, URLs, adapters or arbitrary actions.
- The adapter verifies the exact active Composio connection, exact-resource grant, session toolkit status and one-tool session allowlist before invoking the provider. Response fields are validated and bounded. It reads repository metadata only; it does not read source files, execute code or modify repositories.
- Migration `0007_audit_execution_context.sql` preserves task, session, parent-session, worker and adapter receipt lineage in append-only invocation audit.
- Regression coverage: `tests/composio-client.test.mjs` and `tests/composio-sentinel-adapter.test.mjs`.

### Verification evidence

- Node.js test suite and isolated local D1 migration verification passed on the current commit (GitHub Actions run: https://github.com/LAURENCE1977/Aegis-/actions/runs/43845542328).
- Cloudflare Pages push preview deployed successfully for the current commit: https://f88e52c7.aegis-6yk.pages.dev
- Workflow actions now use `actions/checkout@v7` and `actions/setup-node@v7`; the Node.js 20 deprecation warning is gone. One non-failing notice remains about the future `ubuntu-latest` image migration.
- A browser smoke check of the preceding preview loaded the login page with HTTP 200 and no console exceptions. It displayed that `AEGIS_PASSWORD` and `AEGIS_SESSION_SECRET` are not configured. The latest preview has not yet had a separate browser smoke check.

### Remaining activation gates

The live Composio OAuth flow has **not** been exercised from the AEGIS preview. Before that can happen, the Cloudflare preview needs the owner authentication secrets, D1 binding and migrations, `COMPOSIO_API_KEY`, `AEGIS_VAULT_KEYRING` and `AEGIS_VAULT_ACTIVE_KEY_VERSION` configured as server-side secrets/bindings. Then the owner can connect GitHub in AEGIS and create the exact `github:repository:read` grant. Never paste these secrets into chat or commit them.

The next safe milestone is to verify that full owner-controlled connection and read-only lookup flow in preview. Only after that should another Composio toolkit (for example Slack or Drive) be added as a separate fixed capability with its own scopes, tests and connection lifecycle. Do not expose arbitrary Composio tools or broad multi-tool sessions.
\n\n## AEGIS upstream repository assessment — 16 November 2026\n\nThis is a research and architecture decision record, not a claim that all listed projects have been installed. Upstream repository metadata and selected READMEs/licenses were inspected on 16 November 2026. Keep AEGIS's current Cloudflare Worker + D1 control plane; Python-heavy components belong in isolated optional workers/services, not directly inside the Worker runtime.\n\n### Explicit repository identification\n\n- System Design Interview notes: `liquidslr/system-design-notes` — confirmed by description. Use as a private study/reference pointer only. The repository does not expose a recognised SPDX license in GitHub metadata and its notes are based on a copyrighted commercial book. Do not bulk-copy, republish, or embed its text in AEGIS. Extract general architecture principles independently and cite sources.\n- Open-source project management: `makeplane/plane` is the likely intended project, but the user's wording does not uniquely identify it. Plane is an actively updated, self-hostable project tracker for issues, cycles, modules, pages and roadmaps; AGPL-3.0. Treat as an external integration target, not code to merge into AEGIS. Ask for confirmation if the user meant another PM system.\n- AI CRM: `twentyhq/twenty` — confirmed by description. It is a substantial TypeScript/NestJS/React CRM with PostgreSQL/Redis, workflows and agent-facing extension points. The root LICENSE is mixed: most of the app is AGPLv3 with an application exception, selected packages are MIT, and files marked `@license Enterprise` are commercial. Use its published APIs/SDK as an optional connector; do not copy core source into AEGIS without a file/package-level license review and legal review.\n\n### Agent frameworks and orchestration\n\n| Candidate | Upstream | AEGIS decision |\n|---|---|---|\n| LangChain | `langchain-ai/langchain` | Study adapters/model integrations; do not make it the AEGIS core. Broad overlap and extra dependencies. MIT. |\n| LangGraph | `langchain-ai/langgraph` | Strongest external orchestration reference for resumable stateful graphs, checkpoints and human approval. Keep AEGIS-native workflow state machine first; consider an isolated adapter/worker only when durable multi-step workflows outgrow the native engine. MIT. |\n| LlamaIndex | `run-llama/llama_index` | Use selected parsing/indexing patterns only. Current project README says its primary focus has shifted to LlamaParse/LiteParse and document parsing; avoid adopting the whole framework by default. MIT. |\n| AutoGen | `microsoft/autogen` | DO NOT adopt for new production work: upstream README marks it archived/unmaintained and directs new users to Microsoft Agent Framework. |\n| Microsoft Agent Framework | `microsoft/agent-framework` | Replacement worth benchmarking if a dedicated Python/.NET multi-agent runtime is needed; not required inside the current JS/Cloudflare core. MIT. |\n| CrewAI | `crewAIInc/crewAI` | Useful reference for role-based crews and event-driven Flows; do not add alongside multiple competing orchestrators. MIT. |\n| Pydantic / PydanticAI | `pydantic/pydantic-ai` | Strong typed Python worker boundary, validation and structured outputs. Use for Python services if introduced; use native schema validation in the TypeScript core. MIT. |\n| OpenAI Agents SDK | `openai/openai-agents-python` | Optional provider/agent adapter and sandbox-agent reference. Do not couple AEGIS's identity, policy or task state to one model vendor. MIT. |\n| MCP | Model Context Protocol | Keep as an interoperability boundary for external tools/resources. Every tool remains behind Sentinel grants, schemas, audit and resource scoping. Build AEGIS's own policy enforcement; MCP is not a security boundary by itself. |\n| Composio | `ComposioHQ/composio` | KEEP current integration. Use per-user sessions and fixed, least-privilege tool allowlists; keep AEGIS Vault, Sentinel and append-only audit authoritative. Never expose arbitrary tool execution. MIT SDK repository. |\n\n### Data ingestion, chunking and browser tools\n\n| Candidate | AEGIS decision |\n|---|---|\n| Docling (`docling-project/docling`) | PRIORITY: optional local Python ingestion worker for PDFs, office docs, HTML, tables, OCR, audio/video and structured exports. MIT; supports local/air-gapped processing and MCP integration. Keep the original file and page/element provenance alongside parsed output. |\n| Unstructured (`Unstructured-IO/unstructured`) | Alternative/fallback parser for formats/connectors Docling does not handle well. Avoid running both on every file; benchmark on a representative corpus. Apache-2.0 OSS library; distinguish it from paid hosted services. |\n| Airbyte (`airbytehq/airbyte`) | Later-stage connector/ELT option for scheduled bulk sync from many systems. Heavy for the current single-user/low-cost AEGIS deployment; prefer Composio/API connectors and native import first. |\n| Chonkie (`feyninc/chonkie`) | Candidate chunking library for a Python ingestion worker. Benchmark against a small AEGIS-native structure-aware chunker before adopting. MIT. |\n| Playwright (`microsoft/playwright`) | PRIORITY for deterministic browser automation, integration tests and controlled browser tasks. Keep it in an isolated browser worker; do not expose raw browser sessions to model-generated scripts. Apache-2.0. |\n| Browser Use (`browser-use/browser-use`) | Optional AI-driven browser agent for tasks where page understanding and adaptive interaction matter. Its open-source library is MIT, but hosted browser/agent services and inference are separate paid usage. Pin exact versions; isolate it from Sentinel and require approval for consequential actions. |\n\n### Databases, vector search and memory\n\n| Candidate | AEGIS decision |\n|---|---|\n| PostgreSQL + pgvector | BEST future relational/vector combination if AEGIS migrates beyond D1. pgvector is PostgreSQL-licensed; Postgres is permissively licensed. Do not add a second database until D1 limits justify it. |\n| Qdrant (`qdrant/qdrant`) | Best standalone vector-store candidate if scale, filtering or hybrid vector search outgrows SQL/D1. Apache-2.0; self-hostable. Keep optional and benchmark before deployment. |\n| Weaviate (`weaviate/weaviate`) | Capable alternative, but its source tree mixes BSD-3-Clause code and a separately licensed `wl` enterprise directory. No reason to add alongside Qdrant/pgvector initially. |\n| Redis (`redis/redis`) | Cache/queue/ephemeral coordination only, not the canonical memory store. Redis 8+ is tri-licensed (RSALv2, SSPLv1 or AGPLv3); older releases differ. Review exact version and use case before adoption. Prefer Cloudflare-native queues/KV/Durable Objects while AEGIS stays on Workers. |\n| Elasticsearch (`elastic/elasticsearch`) | Powerful full-text/search/analytics but operationally heavy; repository default licensing is a triple license (AGPLv3, SSPLv1, ELv2) with per-path exceptions. Not a current fit. |\n| Mem0 (`mem0ai/mem0`) | PRIORITY as a memory research/benchmark candidate, not a replacement for AEGIS's canonical store. Apache-2.0 OSS. Evaluate extraction, deduplication, entity linking and temporal retrieval; hosted/proprietary benchmark features may not be present in OSS. Preserve provenance, user corrections and explicit forget controls. |\n| Zep / Graphiti (`getzep/graphiti`) | For the requested Zep family, the current open-source Graphiti repository is the more relevant codebase: Apache-2.0 temporal knowledge graphs with source episodes, entity relationships and validity windows. Prototype only after D1 memory schema is stable; requires a graph database, LLM and embedder supplied by the operator. |\n\n### Evaluation, guardrails and observability\n\n| Candidate | AEGIS decision |\n|---|---|\n| RAGAS (`vibrantlabsai/ragas`) | Use for retrieval/RAG quality metrics and generated test datasets in offline evaluation. Apache-2.0. Metrics using LLM judges incur model cost. |\n| DeepEval (`confident-ai/deepeval`) | Strong candidate for pytest-style agent trajectory, tool-call, hallucination and task-completion regression tests. Apache-2.0. Start with this for CI; avoid adopting RAGAS and DeepEval simultaneously until distinct coverage is demonstrated. |\n| Langfuse (`langfuse/langfuse`) | Strong future self-hosted tracing, usage/cost, prompt and eval dashboard. Core areas MIT, but enterprise directories/components have separate terms. Self-hosting adds operational load; initially retain AEGIS's own D1 audit and add a vendor-neutral OpenTelemetry export boundary. |\n| Arize Phoenix (`Arize-ai/phoenix`) | Useful alternative for tracing and evaluation, but repository LICENSE is Elastic License 2.0, including restrictions on offering it as a hosted/managed service. Do not embed or offer as part of AEGIS without license review. |\n| Guardrails AI (`guardrails-ai/guardrails`) | Use selected validators/patterns as defence-in-depth for structured outputs. Apache-2.0. It does not replace deterministic Sentinel authorization, input validation, tool allowlists or human approval. |\n\n### Recommended AEGIS-native architecture\n\n1. **Control plane:** keep the current TypeScript/Cloudflare Worker + D1 architecture. AEGIS owns identity, tasks, grants, Sentinel policy, approvals, audit, memory records and provider abstraction.\n2. **Orchestration:** implement a small native durable workflow/state-machine layer with explicit task states, retries, idempotency keys, checkpoints, cancellation and human approval. Borrow LangGraph design concepts; do not install LangChain + LangGraph + CrewAI + AutoGen + Agents SDK as parallel cores.\n3. **Connectors:** Composio remains a replaceable execution adapter. Add Plane/Twenty connectors only as separate fixed, scoped capabilities. MCP is the common protocol, never the permission system.\n4. **Ingestion:** add a queued, isolated Docling worker first. Retain source files, hashes, parser version, page/section offsets, permissions and provenance. Use Chonkie only after chunking benchmarks.\n5. **Memory:** D1 is the canonical source of truth. Build AEGIS-native memory records with source evidence, confidence, created/valid-time, supersession/retraction and access scope. Evaluate Mem0 and Graphiti against this schema; do not let a vector/graph index become the only copy of a fact.\n6. **Retrieval:** start with SQL/keyword + embeddings in the current store where supported. If a dedicated vector service is needed, choose one: Qdrant standalone, or PostgreSQL + pgvector if moving the relational database. Never deploy Qdrant, Weaviate, pgvector and Elasticsearch all at once.\n7. **Browser:** Playwright for deterministic tests/actions; Browser Use only for adaptive AI browser operation in a sandboxed worker with explicit domain/action policy and confirmation gates.\n8. **Quality/security:** add DeepEval CI regression suites for tool traces and task outcomes; add RAGAS later if RAG-specific metrics justify it. Keep native Sentinel enforcement and append-only audit. Consider Langfuse only when trace volume and dashboard needs justify self-hosting.\n9. **Portability/cost:** avoid mandatory hosted APIs, proprietary embeddings, cloud vector stores or per-token services. Keep parsers, chunkers, indexes, evaluators and orchestration behind interfaces; all model inference costs remain separate from software licensing. No repository makes LLM tokens free or guarantees 15-year free operation.\n\n### Prioritised adoption sequence\n\n- **P0 — design only, no new dependency:** native workflow/state machine, typed capability manifests, durable D1 task/checkpoint schema, memory provenance schema, tool policy contract.\n- **P1 — first practical components:** Docling isolated ingestion spike; Playwright deterministic browser test harness; DeepEval CI suite; Composio connector remains current.\n- **P2 — benchmark before choosing:** Mem0 vs AEGIS-native memory; Graphiti temporal graph; Chonkie vs native chunking; Qdrant vs PostgreSQL/pgvector.\n- **P3 — optional product integrations:** Plane and Twenty via APIs/Composio; Airbyte for multi-source scheduled ingestion; Browser Use for adaptive browser work; Langfuse for self-hosted observability.\n- **Do not adopt:** archived AutoGen for new production work; multiple competing orchestration frameworks; multiple vector stores; Redis/Elasticsearch/Weaviate without a demonstrated requirement; copying unlicensed/copyrighted study notes.\n\n### Evidence and implementation gate\n\nThis assessment does not install dependencies, create containers, migrate databases or enable new external accounts. Each P1/P2 adoption requires a separate issue/PR, a small proof of concept, license/security review, benchmark, tests and rollback plan. Preserve the existing Composio PR #101 and do not merge the superseded PR #100.\n

## OpenJarvis upstream assessment — 16 November 2026

**Canonical upstream:** https://github.com/open-jarvis/OpenJarvis  
**Inspected revision:** `b3b7f07efda4ea30fe61f25309d4af5b9dba5c34` (main; source paths and architecture search results pinned to this revision).  
**Licence:** Apache-2.0 (root LICENSE inspected).  
**Inspection scope:** README, pyproject metadata/dependency groups, root licence, architecture overview and learning docs, plus selected security guardrails, sandbox mount validation and scheduler source. This is a focused architecture/licence review, **not** a full repository audit; no upstream code was executed and no upstream test suite was run.

### What it is

OpenJarvis is a substantial local-first personal-AI framework organised around five primitives: Intelligence (model catalogue/configuration), Engine (pluggable inference backends), Agentic Logic (pluggable agents), Tools & Memory (tool execution and retrieval backends), and Learning (trace-driven analysis and routing). Its engine abstraction supports local runtimes such as Ollama, vLLM, SGLang and llama.cpp, alongside cloud-provider adapters. The project also contains scheduled/continuous agents, document retrieval, telemetry, benchmarks, CLI/API/GUI surfaces, optional Rust extensions and desktop packaging.

Project metadata marks the package **Alpha**, supports Python `>=3.10,<3.14`, and exposes a broad set of optional feature groups. It is a Python service/application ecosystem, not a Cloudflare Worker library. Its dependencies and hardware assumptions make wholesale embedding in AEGIS's TypeScript/Cloudflare control plane inappropriate.

### AEGIS decision

**Decision: adapt selected interfaces and operate as an optional isolated local-inference sidecar; do not fork or merge the whole repository into the AEGIS core at this stage.** The repository is valuable enough for a deeper benchmark, but its runtime overlaps with AEGIS's own orchestration, scheduling, memory, security and provider-routing responsibilities.

- **Build AEGIS-native:** identity, Sentinel policy, exact grants, approvals, canonical task state, D1 memory/provenance, audit, provider selection policy and user-facing control plane.
- **Potential adapter:** an opt-in OpenJarvis service on a separately managed PC/server, exposing only a narrow authenticated inference/health/model-catalogue contract. AEGIS must treat it as an untrusted replaceable provider; every AEGIS action and external tool still passes through Sentinel. No direct sidecar-to-provider credential sharing.
- **Borrow design patterns:** common inference-engine interface, model/hardware capability catalogue, engine health/fallback, trace schema, energy/latency/cost-aware benchmarking and outcome-based routing. Reimplement only the small contracts needed in TypeScript rather than importing the Python framework.
- **Benchmark before enabling:** compare a small set of local models against AEGIS's existing provider path on task quality, tool-call correctness, p50/p95 latency, tokens/sec, RAM/VRAM, energy per task, cold start and failure recovery. Record model-weight licences separately from the framework licence.
- **Do not duplicate scheduling:** OpenJarvis's local polling/thread scheduler is not a substitute for AEGIS's durable Queue/D1/lease/outbox runtime. AEGIS remains authoritative for schedules and job state.

### Security findings and limits

- OpenJarvis's `GuardrailsEngine` wraps inference with configurable input/output scanners for secrets and PII. Its default mode is `WARN`; it is defence-in-depth, not deterministic tool authorisation, identity, approval or prompt-injection containment. It must never replace Sentinel.
- The inspected mount validator supports blocked path patterns and allowed roots, but an empty allowed-root list is treated as allowing all non-blocked paths. Any optional sandbox integration must explicitly configure narrow roots, validate resolved paths/symlinks and retain AEGIS's own isolation and approval boundary; do not inherit permissive defaults.
- The scheduler, local stores, GUI, channel connectors and tool execution surfaces are not to be exposed directly to AEGIS or the public internet. Only a narrow, authenticated adapter may cross the boundary.
- Apache-2.0 permits adaptation subject to its notice/licence conditions. Any future redistribution must include the licence and required notices and mark modified upstream files. Review licences for dependencies, optional extras, bundled assets and model weights independently; Apache-2.0 on the repository does not license every model or service it can connect to.

### Status

- [x] Canonical upstream identified; focused architecture and licence review recorded.
- [x] No dependency installed, fork created, service deployed or production setting changed.
- [ ] Full file-level security/dependency review and upstream test execution.
- [ ] Local sidecar proof of concept on suitable hardware, with measured cost/quality/latency/energy results.
- [ ] Sentinel-gated adapter contract and tests before any AEGIS connection is enabled.

The current user devices (Chromebook, iPad and iPhone) should continue using the mobile-first AEGIS web client. Local inference should be hosted on a separately capable machine or optional service; do not assume the Chromebook can run large models locally. Local model weights reduce dependence on paid inference APIs but do not make compute, electricity, storage or hardware free.

## Live pull-request reconciliation — 16 November 2026, 11:20 UTC

**Canonical integration candidate: PR #101** — branch `feature/composio-audit-lineage-verified`, head `00a4683b50894e8b7ac5d0f6696887fde4f1d07c`. This branch contains the Composio read-only GitHub adapter, Sentinel audit lineage, the repository reverse-engineering policy and the focused OpenJarvis assessment. Its latest observed AEGIS tests workflow completed successfully. PR #101 remains a draft and is not merged.

PR #102 (`feature/sentinel-lineage-verified`, head `1d88987fb3e8ea4d5f593c2481c0a0525debf8f6`) is a divergent duplicate of the same Composio/Sentinel implementation. GitHub compare reports the #102 head is one commit ahead and five commits behind #101; its unique change is a 16-line blueprint handover correction, not a separate feature implementation. Do not merge both PRs. Keep #101 as the sole integration candidate and close #102 as superseded after this reconciliation. The #102 workflow was still running at the time of this note; its result does not supersede the successful #101 run.

No PR has been merged, no production deployment or secrets have been changed, and live Composio OAuth/provider calls remain unverified. Re-check the canonical PR head and CI immediately before any future merge.


## Composio catalogue capability audit — 16 November 2026

**Purpose:** identify Composio capabilities that can extend AEGIS without weakening its native control plane. This is a targeted multi-domain catalogue discovery, not a claim that every one of Composio's 500+ app integrations or every tool in every toolkit has been exhaustively enumerated. Discovery covered GitHub, Cloudflare, developer infrastructure, security, collaboration, project management, research/scraping, model routing, embeddings/memory, file ingestion, browser automation, databases, identity/secrets, workflow engines, monitoring, and content/social platforms. Tool schemas were inspected for representative high-impact workflows. No new app connection, external action, paid operation, deployment or credential was activated by this audit.

### Current AEGIS overlap — do not duplicate

- **GitHub:** the feature branch already contains one fixed, owner-controlled, read-only Composio GitHub repository-metadata capability through Sentinel, Vault, exact-resource grants and append-only audit. It is not a general GitHub connector and does not expose arbitrary tool slugs. Keep this as the first connector proof.
- **Native AEGIS capability/security stack:** capability manifests, grant and connection metadata, encrypted Vault, approval primitives, Sentinel composition, invocation audit and rate limits are AEGIS-owned. Composio must remain an adapter behind these boundaries.
- **Native provider intelligence:** AEGIS already has a model/provider registry and routing primitives. Composio's OpenRouter tools are optional provider adapters/discovery helpers, not a reason to make Composio the model-routing authority.
- **Native durable runtime:** AEGIS owns D1/Queue job identity, state, leases, idempotency, retries and audit. Temporal, Trigger.dev, Make and similar workflow products must not create a second canonical job ledger.
- **Native Forge/MCP catalogue:** Composio discovery can feed candidate metadata into Forge, but cannot approve, install or execute a server automatically.

### High-value Composio capabilities not yet integrated into AEGIS

| Priority | Composio capability family | Useful AEGIS role | Decision |
|---|---|---|---|
| P1 | GitHub expanded read-only operations | Branches, commits, PRs, workflow runs, issue search and immutable source retrieval for Forge/CI intelligence | Extend only as separate fixed Sentinel actions; preserve read-only scope first |
| P1 | Security review and vulnerability data: Strale, CVE.now, GitHub audit/security metadata | Dependency checks, CVE enrichment, diff/code review and supply-chain signals | Add a read-only security-evidence adapter; treat results as advisory and verify against upstream advisories |
| P1 | Browser Use | Isolated browser worker for adaptive website tasks, authenticated flows and screenshots | Strong candidate; never run inside the control plane; exact domains, credential bindings, cost cap, approvals and full action audit required |
| P1 | Temporal | Durable long-running workflows, timers, signals, histories, schedules and child workflows | Benchmark against native Cloudflare runtime; adopt only if real workflow complexity justifies an external engine |
| P1 | Trigger.dev | Background task execution, queues, delay, concurrency and idempotency | Alternative benchmark to Temporal, not a parallel second runtime |
| P1 | Better Stack / Sentry / Datadog | Uptime, browser synthetics, incidents, errors and operational telemetry | Instrument AEGIS with OpenTelemetry first; connect one monitoring backend only when needed |
| P1 | OpenRouter / Gemini / Mistral / OpenAI | Optional inference, model catalogue and embedding/OCR providers | Keep behind AEGIS provider interfaces and cost/budget policy; never let provider tool calls bypass Sentinel |
| P2 | Mem0 | Memory extraction/retrieval benchmark | Compare with native AEGIS memory; never canonical storage and no unreviewed memory writes |
| P2 | Context.dev / Serper / DeepSeek search | Web search, extraction, page parsing, structured data and research | Useful replaceable research adapters; enforce source provenance, content limits, domain policy and untrusted-content handling |
| P2 | Mathpix / Mistral OCR / Context.dev parse | OCR and document extraction for Knowledge Forge | Compare against the planned isolated Docling worker; select one per file class based on quality, privacy and cost |
| P2 | Notion MCP / Slack / Microsoft 365 | Team knowledge, message search and notifications | Add only after the relevant account is actively connected and exact scopes are designed |
| P2 | ContentStudio / GetAnyAPI | Optional publishing, social analytics and broad public-data retrieval | Specialist modules only; paid API costs, platform terms, provenance and explicit publishing approval |
| P3 | Supabase / Neon / Infisical | Optional database migration, identity experiments and secret-sync integration | Do not add now; D1 and AEGIS Vault remain authoritative until a measured requirement exists |
| P3 | Make | External workflow templates and webhook bridge | Reference/optional edge adapter only; no Make-owned canonical jobs or policy |
| Defer | Asana / Linear / Jira / Teams and other PM suites | External project/task synchronisation | No need to introduce another project system until a concrete workflow and connected account exist |

### Connection and cost observations from this discovery session

- Active authenticated connections observed: GitHub (two account entries; choose the intended account explicitly), Cloudflare, and several restricted instant/tool-specific services including Context.dev, DeepSeek search, Serper, Strale, OpenRouter, OpenAI, Mistral OCR, Gemini, Browser Use, Mathpix, ContentStudio/GetAnyAPI and others. An instant connection is **not** unrestricted access to every tool in that toolkit; only its returned allowlist may run.
- GitHub and Cloudflare are the only broad account connections in this audit that clearly align with the existing AEGIS implementation. Cloudflare is already used directly for the AEGIS hosting/runtime boundary; avoid duplicating it through Composio without a specific need.
- Slack, Microsoft Teams, Linear, Asana, Jira, Supabase, Neon, Temporal, Trigger.dev, Notion MCP, Mem0 and Infisical reported no active connection in the discovery responses. Discovery is not authorisation; do not initiate connections unless the user separately chooses the service and AEGIS has a reviewed capability.
- Some discovered tools are metered. Examples shown in the catalogue included OpenRouter model-token billing, Browser Use runs with a required maximum-cost cap on its instant connection, Context.dev parsing/scraping charges, Serper search/scrape credits and Strale code review at approximately €0.20 per call. Check live prices and account terms immediately before any paid operation; never infer that “available” means free.
- The catalogue search did not return a suitable dedicated native integration for every requested product (for example, the broad Google Drive/Gmail query surfaced no direct Drive/Gmail actions in that result set). Absence from one search result is not proof that Composio lacks the toolkit; run a focused discovery search before deciding.

### Future-proof integration contract

Every Composio-backed capability must be represented by a versioned AEGIS manifest with: provider/toolkit and exact tool slug; pinned schema/version and input/output validation; principal and connection reference; minimal scopes; exact resource binding; data classification and egress destinations; risk/effect and approval requirement; timeout, retry and idempotency policy; per-call and aggregate budget; rate limit; redaction rules; audit correlation IDs; revocation behavior; health/availability state; provenance and licence/terms review; and a provider-neutral adapter interface.

Runtime rules:
1. Composio session/tool allowlists are a secondary restriction, never the authority. Sentinel must independently check the exact capability, action, resource, connection, grant, budget and approval before every invocation.
2. No agent may choose arbitrary Composio tool slugs, accounts, endpoints, URLs, credentials or toolkit scopes. Resolve all of these server-side from an approved manifest.
3. Default to read-only. Writes, publishing, messages, purchases, account changes, destructive actions and browser submissions require a bounded operation preview and exact human approval immediately before execution.
4. Treat all returned content as untrusted data. Prevent prompt injection from webpages, emails, repositories and documents from influencing permissions or tool selection.
5. Persist a redacted invocation record with task/session/parent-worker lineage, provider request ID, schema version, resource, decision, result status, latency, cost and error class. Never log credentials or raw sensitive payloads.
6. Use circuit breakers, bounded retries, exponential backoff with jitter, idempotency keys, per-provider concurrency limits, timeout budgets and dead-letter handling. Never retry a non-idempotent side effect blindly.
7. Keep a provider-neutral interface so Composio can be replaced by direct APIs, MCP servers or another broker without changing AEGIS policy or canonical state.
8. Pin schemas and test compatibility. Detect schema drift before activation; fail closed on unknown fields, changed semantics, missing scopes or unavailable audit.
9. Store only AEGIS-owned connection references and encrypted secret material in the Vault. Support disconnect/revoke, credential rotation, grant expiry and deletion propagation.
10. Keep an integration kill switch and per-tool/per-account budgets. Track provider outages, rate limits, data residency, retention and service terms.

### Recommended implementation order

1. Finish and verify the current GitHub Composio preview connection lifecycle and read-only lookup. Keep PR #101 as the only canonical Composio/Sentinel integration candidate.
2. Add a schema-pinned, read-only GitHub intelligence pack (PR/branch/commit/workflow/issue metadata) with one Sentinel action per operation and exact repository grants.
3. Add dependency/CVE and code-review evidence ingestion as an offline/CI advisory step; do not allow an external reviewer to auto-merge or change source.
4. Build the AEGIS-native provider adapter contract and compare OpenRouter/Gemini/Mistral options using cost, quality, latency, context and data-handling measurements.
5. Run a bounded Browser Use proof of concept only after the isolated worker and domain/action policy exist.
6. Benchmark Temporal against the current native runtime with representative multi-step workflows. Choose one execution authority; do not activate Temporal and Trigger.dev together.
7. Add one observability backend only after OpenTelemetry events and AEGIS audit are stable.
8. Evaluate document OCR/search and Mem0 only against the existing Docling/native-memory roadmap.
9. Add team, social and productivity connectors only when a real user workflow requires them and the relevant account is actively connected.

**Audit conclusion:** Composio is valuable as a broad connector catalogue and replaceable execution adapter. It should not become AEGIS's operating system, memory authority, workflow database, model router, security boundary or unrestricted agent tool belt. The strongest near-term additions are read-only GitHub intelligence, supply-chain/security evidence, a carefully sandboxed browser adapter and a measured workflow-engine comparison. No new integration is enabled by this research record.


## Composio GitHub read-only expansion — 16 November 2026

The first incremental expansion of the catalogue audit is now implemented on the canonical Composio feature branch:

- Added a separate `aegis-composio-github-pull-request-readonly` capability and owner-authenticated endpoint.
- The action reads one exact pull request, with exact owner/repository/PR resource binding and a distinct `github:pull-request:read` grant scope.
- Added a fixed Composio client action for `GITHUB_GET_A_PULL_REQUEST`; no agent-supplied tool slug, account, endpoint or arbitrary arguments.
- The session allowlist now contains exactly two read-only tools: `GITHUB_GET_A_REPOSITORY` and `GITHUB_GET_A_PULL_REQUEST`. No write tools, MCP, shell or multi-execute.
- Pull-request output is allowlisted and omits body/comments/review text. It verifies the returned PR number and base repository against the exact requested resource; branch refs and SHAs and change counts are bounded.
- Existing one-tool sessions remain valid for repository metadata. Pull-request reads require an owner reconnect to create the refreshed two-tool session; the adapter fails closed when the PR tool is absent.
- Added endpoint, client, adapter, manifest and response-binding tests. The implementation and full Node/D1/Forge workflow passed on commit `5417937c52bbc140401290b2f54eac8ce7aa9807`; Cloudflare Pages preview also succeeded.
- Documentation: `docs/AEGIS_COMPOSIO_GITHUB_READONLY.md`.

**Not yet implemented:** GitHub Actions workflow/run/job reads, commit and branch intelligence, issue reads, security/CVE feeds, browser execution, Temporal/Trigger.dev comparisons, and provider/monitoring adapters. Each remains a separate reviewable capability; do not widen the current allowlist implicitly.


### Composio GitHub Actions read-only monitoring — 16 November 2026

A third fixed read-only Composio GitHub tool is now registered and implemented:

- Tool: `GITHUB_LIST_WORKFLOW_RUNS_FOR_A_REPOSITORY`.
- Capability: `aegis-composio-github-workflow-readonly`.
- Action: `list-workflow-runs`.
- Scope: `github:workflow:read`.
- Resource: exact repository `github:repository:{owner}/{repo}`.
- Optional branch filter is validated; pagination is fixed to page 1 and ten results.
- Output verifies repository identity and branch, restricts URLs to the exact repository, and excludes commit messages, logs, artifacts and arbitrary free-form content.
- The session allowlist now contains exactly three read-only GitHub tools: repository metadata, pull-request metadata and workflow-run summaries. No write operations, workflow dispatch, job-log download, MCP, shell or multi-execute.
- Owner reconnect is required to provision the updated three-tool session; older one- and two-tool sessions continue to serve the actions they already contain and fail closed for missing tools.
- Added client, adapter, capability manifest, endpoint and security tests. The complete Node/D1/Forge workflow and Cloudflare Pages preview passed on commit `98e9402e0be2315d237ab5a638e7a133ca5a27a0`.

**Next CI-monitoring extension:** a separately governed read-only workflow-job summary action, bound to one exact workflow run. Job logs, reruns, dispatch and cancellation remain disabled.


## AI research intake and standing intelligence feed — 16 November 2026

The source register and preliminary decisions for the newly supplied repositories are maintained in [docs/AEGIS_RESEARCH_INTAKE.md](AEGIS_RESEARCH_INTAKE.md). This includes the Google Elephant-Goldfish Model, Vercel agent-browser, Runanywhere TrnRT, ORACLE-org/ORACLE, rederive, Coolify, OpenProject, unresolved Kiri/Hex Brain identities, and Oracle namesakes.

TLDR AI is a standing discovery source for AI models, agents, open-source projects, developer tooling, research, infrastructure, security and industry developments. Primary archive: https://tldr.tech/ai/archives ; RSS: https://tldr.tech/api/rss/ai . Follow original sources before changing architecture or adding dependencies. Treat newsletter summaries as leads, not verified evidence. Every candidate must pass AEGIS reverse-engineering, licensing, security, cost and Sentinel review.


### Composio GitHub workflow job and step summaries — 16 November 2026

A fourth fixed read-only GitHub tool is now implemented:

- Tool: `GITHUB_LIST_JOBS_FOR_A_WORKFLOW_RUN`.
- Capability: `aegis-composio-github-workflow-jobs-readonly`.
- Action: `list-workflow-jobs`.
- Scope: `github:workflow-jobs:read`.
- Resource: exact workflow run `github:workflow-run:{owner}/{repo}/{runId}`.
- Fixed to the latest attempt, page 1 and at most twenty jobs. Each job returns bounded status/conclusion and up to one hundred step name/number/status/conclusion summaries.
- Every job must belong to the requested run; job URLs are constrained to the exact run. Runner names, logs, artifacts and arbitrary provider fields are not returned.
- The Composio session allowlist now contains exactly four fixed read-only tools: repository metadata, pull-request metadata, workflow-run summaries and workflow-job summaries. It still excludes writes, dispatch, reruns, cancellation, log/artifact downloads, MCP, shell and multi-execute.
- Owner reconnect is required to provision the four-tool session. Older one-, two- and three-tool sessions retain only the actions they already contain and fail closed for missing tools.
- Added client, adapter, manifest and endpoint tests. The full Node/D1/Forge workflow passed on commit `266c8af916de70de3eb9acb98166d776f359a1d9`; Cloudflare Pages preview deployed.

**Next:** update the owner-facing Composio connection/capability UI to explain the new read-only scopes and reconnect requirement, then test a real approved connection and exact-resource grants. No write-capable GitHub tools are to be added as part of this monitoring pack.


## Composio GitHub Actions read-only intelligence — 16 November 2026

The fixed Composio GitHub session now includes four read-only tools: repository metadata, one pull request, bounded workflow-run summaries and bounded latest-attempt workflow-job/step summaries. Workflow jobs are bound to the exact owner/repository/run ID, have a separate Sentinel capability and grant scope, and return an allowlisted summary rather than logs, artifacts, runner details or arbitrary provider fields. Job URLs must be canonical HTTPS github.com paths for the exact run and job; query strings and fragments are rejected. The complete contract is in [docs/AEGIS_COMPOSIO_GITHUB_READONLY.md](AEGIS_COMPOSIO_GITHUB_READONLY.md).

The job-list client method is covered by fixed-tool request tests; adapter tests cover exact-run matching and output minimization; endpoint tests cover authentication, origin and exact input validation. The workflow job capability remains read-only. Do not add workflow log downloads, artifact downloads, reruns, dispatch, cancellation or other Actions write operations without separate risk analysis, approval design and a dedicated Sentinel action.


### Security Centre Composio controls — 16 November 2026

The owner-facing Security Centre now exposes the four approved Composio GitHub read-only actions:

- Repository metadata.
- Exact pull-request metadata.
- Bounded workflow-run summaries.
- Exact workflow-run job and step summaries.

The UI has explicit buttons to prepare each exact grant and separate buttons to invoke the read. Preparing a grant only fills the owner grant form; it never creates a grant. The owner must review and submit the grant separately. All reads use the fixed server routes and Sentinel. Read controls are disabled until the Composio connection is active, and connection errors disable them again.

The session is pinned to four fixed read-only GitHub tool slugs. Existing sessions may need owner reconnect to refresh the tool allowlist. Logs, artifacts, dispatch, rerun, cancellation, writes, MCP, shell and arbitrary tool selection remain disabled.

Verification: the full Node/D1/Forge workflow passed for the code/UI commit `1a996add06fe4eebb74a7b0b7b811ec503afc448`; Cloudflare Pages preview deployed successfully. Documentation changes followed in commits `585f6c491c30873898172be2f389a3a67951749c` and `199395832ebddad685aa4c6b5e7419928e22eb95`.


### Composio workflow intelligence available to AEGIS agents — 16 November 2026

The server-owned Qwen tool registry now includes `aegis_read_github_workflow_runs`. It accepts only an owner, repository and optional validated branch; AEGIS derives the exact repository resource and invokes the fixed Composio workflow-run adapter through Sentinel. The model cannot choose the Composio tool slug, account, connection, session, URL or permissions. A separate `aegis-composio-github-workflow-readonly` grant with `github:workflow:read` and an active Composio connection are mandatory. No grant means a durable Sentinel denial before provider execution.

AG-UI now passes server environment bindings into the agent tool runner so the Composio adapter can use the server-side API key and encrypted session reference. The browser still cannot supply credentials, tool schemas or permissions. The feature remains subject to the existing explicit agent-tool opt-in and Qwen model allowlist. The tool registry now contains three fixed read-only actions; one tool call per run remains the maximum.

Tests cover tool registration, malformed/extra arguments, exact-resource derivation, denial without a grant, AG-UI tool routing and audit lineage. CI for the current implementation is being verified; do not mark the change complete until Node tests, local D1/Forge checks and Pages preview all finish successfully.


### Exact workflow-job inspection available to AEGIS agents — 16 November 2026

A fourth server-owned agent tool, `aegis_read_github_workflow_jobs`, is now registered alongside module listing, public GitHub discovery and workflow-run summaries. It accepts exactly owner, repository and a positive integer workflow run ID. AEGIS derives the exact `github:workflow-run:{owner}/{repo}/{runId}` resource and invokes the fixed Composio latest-attempt job reader through Sentinel.

The separate capability `aegis-composio-github-workflow-jobs-readonly` and `github:workflow-jobs:read` scope are mandatory. The model cannot select a tool slug, connection, account, session, endpoint, resource or permission. Results are limited to twenty jobs and bounded step name/number/status/conclusion summaries; provider runner details, logs, artifacts, reruns, dispatch and cancellation are excluded.

The agent tool registry now has four fixed schemas, matching the provider adapter's maximum tool count. Tests verify invalid run IDs and extra fields are rejected, no-grant calls are audited and denied before Composio network execution, and AG-UI routes the tool correctly. Node.js tests, local D1 capability/rate-limit/audit checks, Forge licence/source-integrity checks and Cloudflare Pages preview passed on code commit `df7b3459fb9cb47c1257541caa2a0c32c29ee738`.


## Agent runtime lifecycle and history controls — 16 November 2026

The separate Cloudflare runtime now has owner-authenticated agent-run history and cancellation primitives:

- `GET /v1/agent-runs` returns a bounded page (1–50, default 20) using stable keyset pagination on `created_at DESC, id DESC`; the cursor is validated and timestamp ties do not skip or duplicate records.
- `GET /v1/agent-runs/{id}` reads one durable run.
- `POST /v1/agent-runs/{id}/cancel` records an idempotent cancellation marker and one append-only lifecycle event.
- Cancellation is fenced against initial outbox dispatch, cron recovery, queue claim, plan persistence, retry and dead-letter handling. A delivery racing with cancellation is acknowledged without generating a plan.
- The existing constrained database status enum is preserved; the API derives terminal `cancelled` status from `cancelled_at`. This avoids a risky table rebuild and keeps the event foreign key stable.
- Runtime migrations `0003_agent_run_cancellation.sql` and `0004_agent_run_listing.sql` add the cancellation marker and history index.
- CI now applies all runtime migrations to an isolated local D1 database and verifies the cancellation marker, history index and append-only agent-run event triggers.

The runtime remains source-only and is not deployed or provisioned. Agent runs still produce a plan only; no specialist model execution, shell, browser or external side effect is enabled. The latest implementation commit `25044908e05ef892ae37544cfc4d93dab3d49a20` passed the full suite (507 tests, 0 failures), runtime D1 migration checks, Forge/capability D1 checks and Cloudflare Pages preview.


### Agent-run event timeline — 16 November 2026

Added owner-authenticated `GET /v1/agent-runs/{id}/events` with a 1–50 event page size, newest-first keyset pagination on `created_at DESC, event_id DESC`, exact parent-run existence checks, strict cursor/query validation and bounded JSON detail parsing. Malformed or oversized event detail is redacted to an empty object rather than returned raw. Migration `0005_agent_run_event_listing.sql` adds the per-run cursor index; CI verifies the index and append-only event triggers in isolated D1. The event timeline remains read-only and cannot alter or delete audit records.

Latest verified implementation commit: `5c36daa16378af68b3cee2357d92844983f08c14`. CI: 509 tests passed, 0 failed; capability, runtime and Forge D1 migration/smoke checks passed; Cloudflare Pages preview succeeded.


## Upstream research register — 16 November 2026

A repository-by-repository and protocol-by-protocol research review is recorded in [AEGIS_UPSTREAM_RESEARCH_2026-11-16.md](AEGIS_UPSTREAM_RESEARCH_2026-11-16.md). It resolves the supplied Doory, Astryx, THX-02/FormTriage, LLM-from-scratch, Awesome LLM Apps, AI Engineering Hub, Project Ideas and Resources, and PewPie references; records licence constraints and architecture decisions; and maps MCP v2, AG-UI 1.0, Cloudflare Agents, A2A, guardrails, Tree-sitter, provider routing, WebLLM, Extism/QuickJS, voice frameworks, CRDTs and OpenFGA into the AEGIS roadmap.

**Decision:** AEGIS keeps its own TypeScript Worker/D1/Queue/Sentinel control plane. External projects remain replaceable adapters or research references. No third-party model, memory store, authorization engine, orchestration runtime or paid API is activated by this research. The unresolved “Tailored repo” needs its exact GitHub URL before it can be audited.
