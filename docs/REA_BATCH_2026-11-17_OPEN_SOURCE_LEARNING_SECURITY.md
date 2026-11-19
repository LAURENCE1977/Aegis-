# REA Batch — Open-source learning, self-hosting and security agents

**Reviewed:** 17 November 2026  
**Status:** Initial repository-intake assessment; not a full code audit and not an integration claim.  
**Branch:** `feature/rea-open-source-security-learning-batch`  
**Source baseline:** AEGIS PR #101 head `74d1e53e7ea70ee713ff5b3b62d8f613bd3b2f73`.

## 1. Executive decisions

| Candidate | Primary research value | Initial disposition | Confidence |
|---|---|---|---|
| [free-for-dev](https://github.com/ripienaar/free-for-dev) | Free-tier and developer-resource discovery | Adapt as a curated, freshness-aware catalogue; never treat listed tiers as guaranteed free | Medium |
| [OSSU Computer Science](https://github.com/ossu/computer-science) | Structured computer-science curriculum | Adapt learning-path metadata and mastery progression; do not mirror course content without rights review | High |
| [Awesome Selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted) | Self-hostable software discovery | High-value catalogue source; build AEGIS-native metadata, provenance and compatibility ranking | High |
| [ARTEX candidate](https://github.com/BaaRai/ARTEX) | Planner/manager/worker and event-driven execution architecture | Hold for identity, provenance, licence and security review; do not assume it is unrelated to similarly named offensive infrastructure | Low |
| [Cairn candidate](https://github.com/oritera/Cairn) | Goal-directed search, shared state and agent coordination | Hold pending canonical identity, source, licence and implementation verification | Low |
| [PentAGI](https://github.com/vxcontrol/pentagi) | Multi-agent security workflow, worker supervision, knowledge graph and observability | Adapt selected patterns only; never import its runtime wholesale | Medium-high |
| [PentestGPT](https://github.com/GreyDGL/PentestGPT) | Human-guided security reasoning and task planning | Adapt workflow concepts behind AEGIS contracts; verify current branch, licence and provider assumptions | Medium |
| [Strix](https://github.com/usestrix/strix) | Vulnerability discovery and evidence-backed validation | Highest-priority security-agent research candidate; independently validate findings and execution boundary | Medium |
| [CyberStrikeAI](https://github.com/AIPentest/CyberStrikeAI) | Go/Eino agents, MCP tool recipes, roles and RAG architecture | Hold for source availability, provenance, licence and C2/security-executor review | Low-medium |

Confidence describes this intake pass, not software quality. Candidate names and repository URLs are discovery leads until the exact upstream, immutable commit, licence files, dependencies, release history and security advisories are checked.

## 2. AEGIS-native capabilities to extract

### 2.1 Resource Intelligence Catalogue

Build a provider-neutral catalogue for free, open-source and self-hostable resources.

Each record should include:
- canonical project/service identity and official source URL;
- source commit, retrieval time and evidence references;
- licence for code and separately for assets/data where relevant;
- self-hosting requirements, platform compatibility and operational footprint;
- free-tier limits, quotas, expiry/renewal conditions and required payment details;
- data handling, telemetry, account requirements and external egress;
- maintenance signals, security advisories and known limitations;
- status: verified, stale, unknown, discontinued or owner-reviewed.

Never label a service simply “free” when the evidence only establishes a limited trial, free quota, promotional credit or usage-limited tier. Re-check volatile pricing/limits before recommending or connecting a service. No service in this catalogue becomes a mandatory AEGIS dependency.

### 2.2 Learning and Mastery Engine

Use OSSU as a curriculum-structure reference, not as an unquestioned source of truth.

AEGIS should own:
- a versioned skill/knowledge graph with prerequisites and learning outcomes;
- user-selected goals, pace, accessibility and available study time;
- diagnostic assessment and evidence-based mastery estimates;
- spaced review, practice tasks, project-based learning and reflection;
- transparent source attribution and course/content licence metadata;
- user correction, export, deletion and control over learning history.

Do not scrape or redistribute third-party course materials by default. Link to original learning resources and preserve their licence and attribution conditions. Do not infer ability or educational credentials from incomplete activity data.

### 2.3 Self-hosted Software Intelligence

Use Awesome Selfhosted as a discovery seed. AEGIS must add its own independent evaluation:
- project identity and upstream provenance;
- licence compatibility and dependency/SBOM review;
- supported architecture, OS, CPU/RAM/storage and deployment requirements;
- security posture, maintenance, release cadence and vulnerability history;
- backup/restore, authentication, update and migration characteristics;
- external network requirements, telemetry and data residency;
- setup complexity, operational burden and exit/migration path.

A listing is not an endorsement. A project must pass a separate REA review before any code reuse, installation or connector activation.

### 2.4 Governed Security Research Engine

Build the capability around authorised defensive assessment, not unrestricted offensive autonomy.

Initial capability slices:
1. Asset/target registration with owner, exact scope, allowed methods, time window and rate limits.
2. Passive source and configuration analysis for AEGIS-owned repositories and explicitly supplied artefacts.
3. Dependency, secret-pattern, licence, configuration and code-risk checks using pinned tools or AEGIS-native bounded analysers.
4. Controlled dynamic tests against an explicitly authorised isolated target.
5. Independent finding validation, reproducible evidence, false-positive handling and confidence scoring.
6. Remediation guidance linked to exact source/configuration locations.
7. Retest and closure evidence, with append-only audit lineage.

Default posture is read-only. No internet-wide discovery, third-party target scanning, credential testing, persistence, C2, stealth, evasion, destructive payloads or autonomous remediation. Any later active test requires exact target scope, a registered capability, Sentinel approval, bounded worker isolation and a verifiable audit receipt.

## 3. Architecture extraction — do not import runtimes

### PentAGI

Research the planner/specialist decomposition, worker supervision, stuck-task recovery, knowledge graph and observability. Its documented distributed-worker approach is worth comparing with the existing AEGIS Runtime Worker and durable plan/run state.

AEGIS adaptation:
- AEGIS owns task IDs, objective digests, plans, state transitions, event history and cancellation.
- Specialist workers receive only a minimal, immutable task envelope.
- Workers cannot access Sentinel, Vault, D1 credentials or unrestricted host resources.
- Every result is treated as untrusted evidence and independently validated.
- AEGIS retains its own memory and provenance authority; external vector stores are optional adapters only.

### PentestGPT

Study human-guided task decomposition and structured reasoning. Preserve the human operator's ability to inspect the proposed test plan, scope and evidence before execution. Provider SDKs and paid model assumptions must not become core dependencies.

### Strix

Study vulnerability confirmation rather than merely generating plausible findings. AEGIS should distinguish:
- suspected issue;
- statically indicated issue;
- dynamically reproduced issue;
- independently verified impact;
- false positive / inconclusive;
- remediated and retested.

A generated proof-of-concept is not proof by itself. Evidence must be safe, minimal, reproducible and bounded to the authorised test target.

### ARTEX, Cairn and CyberStrikeAI

Do not make architectural claims from project names or marketing descriptions. First establish canonical repository identity and inspect the actual source tree, commit history, maintainers, licence, dependencies, workflows and security advisories.

For ARTEX specifically, the name has been associated in security reporting with offensive infrastructure and changing project identities. This does not prove that the BaaRai repository is the same project. Treat identity/provenance as an explicit blocking question; do not fetch, run or deploy binaries or scripts from unverified mirrors.

For Cairn, verify the exact owner/repository and distinguish goal-directed search or memory mechanisms from unrelated projects with the same name.

For CyberStrikeAI, inspect C2 and security-execution paths as separate high-risk components. MCP compatibility does not make a tool safe or authorised. Do not import C2, WebShell, persistence or unrestricted command-execution capabilities into AEGIS.

## 4. Mandatory trust boundaries

- **Sentinel:** sole authority for principal, exact resource, capability, scope, expiry, rate limit, approval, revocation and consequential action.
- **Forge:** source intake, provenance, REA, isolated analysis, candidate review and adaptation workflow. Forge cannot grant execution permission.
- **Vault:** server-side encrypted secrets only. No keys in browser storage, model prompts, source files, test fixtures or logs.
- **Runtime:** isolated workers with per-run filesystem/network/resource limits; no host Docker socket, ambient shell, shared user profile or unrestricted egress.
- **Knowledge Library:** only owner-reviewed, evidence-attributed material can become accepted knowledge. Repository text, tool output and model output remain untrusted data.
- **Audit:** append-only lineage with IDs, timestamps, policy decisions and digests. Avoid storing raw secrets, personal content or unnecessary provider payloads.
- **Human control:** inspect, approve, pause, cancel and revoke. No automatic install, scan, remediation or external action from discovery results.

Do not expose a generic “run any tool” endpoint. Register each operation as a typed capability with an explicit input schema, risk class, resource scope, timeout, output contract and tests.

## 5. REA work required before adoption

For every candidate:
1. Confirm the canonical upstream URL and exact owner/repository.
2. Pin an immutable commit and record the default branch/release examined.
3. Read root and nested licence files; inspect code, model, dataset, asset and documentation terms separately.
4. Inspect dependency manifests, lockfiles, build scripts, install scripts, containers and CI workflows.
5. Review permissions, secrets handling, network egress, filesystem access, subprocesses, browser control and telemetry.
6. Inspect open/closed security issues, advisories, releases, maintainer activity and project health.
7. Reproduce relevant tests in a disposable, network-restricted environment; never run untrusted code in the AEGIS control plane.
8. Benchmark on realistic low-resource targets and the current Cloudflare/browser-first architecture.
9. Record extracted mechanisms, adaptation design, rejected components, licence obligations and rollback plan.
10. Keep all source and outputs quarantined until owner review; no automatic acceptance into Knowledge Library or runtime.

## 6. Delivery order

| Order | Deliverable | Exit condition |
|---|---|---|
| 1 | Research identity/provenance and licence verification | Exact source and licence pinned for each candidate; unresolved projects remain held |
| 2 | Resource catalogue schema and import pipeline | Provenance, freshness, cost/limits and licence states validated by tests |
| 3 | Self-hosted software evaluator | Compatibility, operational footprint, security and maintenance evidence visible |
| 4 | Learning graph and mastery contracts | Prerequisite validation, user control, attribution and progress tests pass |
| 5 | Security finding/evidence contract | Confidence, reproduction, scope, false-positive and remediation states validated |
| 6 | Isolated security worker prototype | Deny-by-default egress, resource limits, cancellation and audit tests pass |
| 7 | Sentinel-governed active test capability | Exact-resource approval and independent evidence verification pass end-to-end |

No delivery item above is claimed as implemented by this research record.

## 7. Immediate next engineering tasks

- Add typed schemas and validators for resource records, learning nodes and security findings before implementing import or execution.
- Add deterministic tests for stale/free-tier evidence, unknown licences, ambiguous project identities, malformed source URLs, scope mismatch, expired approval, worker cancellation and untrusted tool output.
- Extend Forge candidate provenance to retain immutable source revision and licence evidence.
- Add a Security Research capability family to the registry only when each operation has a safe contract and Sentinel policy.
- Keep active scanning disabled until isolated-worker enforcement and end-to-end approval tests exist.

## 8. Source notes

- Free-for-dev: https://github.com/ripienaar/free-for-dev
- OSSU: https://github.com/ossu/computer-science
- Awesome Selfhosted: https://github.com/awesome-selfhosted/awesome-selfhosted
- ARTEX candidate: https://github.com/BaaRai/ARTEX
- Cairn candidate: https://github.com/oritera/Cairn
- PentAGI: https://github.com/vxcontrol/pentagi
- PentestGPT: https://github.com/GreyDGL/PentestGPT
- Strix: https://github.com/usestrix/strix
- CyberStrikeAI: https://github.com/AIPentest/CyberStrikeAI

This document records research direction and safety boundaries. It is not a licence opinion, penetration-test authorisation, security certification or claim that any upstream code has been adopted.
