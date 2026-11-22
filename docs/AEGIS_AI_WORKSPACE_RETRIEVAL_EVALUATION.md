# AEGIS AI Workspace & Retrieval Evaluation

**Status:** Design-only evaluation; no dependency, service, secret, database, or deployment changes.
**Parent work:** Universal API + MCP Integration Sandbox (PR #192).
**Decision requested later:** Approve a disposable proof-of-concept only after the compatibility and security gates below are satisfied.

## Executive recommendation

Evaluate the three projects as complementary components, not replacements:

- **LibreChat** — optional self-hosted chat and agent workspace.
- **LlamaIndex.TS** — application-side retrieval, connectors, context engineering and workflow layer.
- **SereneDB** — optional search/analytics backend for lexical, vector and hybrid retrieval.

AEGIS remains the system of record for identity, policy, approvals, audit, provider routing and health-data governance. None of these projects becomes an authority for AEGIS permissions.

## Verified fit and constraints

### LibreChat

- It is a self-hosted web application, not a Cloudflare Worker or static Pages feature.
- Its documented Docker Compose deployment includes MongoDB, Meilisearch, a RAG API and a vector database; MongoDB remains a core application dependency.
- It supports configured model providers, agents and MCP servers.
- MCP tools can be attached to chats or selectively assigned to agents. Tool availability must be explicitly limited; do not expose every connected tool to every agent.
- It does not run the model itself; configured external model providers or local model services perform inference.

**AEGIS fit:** consider it as an optional operator-facing workspace behind AEGIS authentication and authorization. Do not replace the existing AEGIS Control Centre or duplicate its user, grant or approval system. Before any deployment, decide whether LibreChat's own MongoDB-backed account/conversation state is acceptable and define data-retention, encryption, backup, access and deletion controls.

### LlamaIndex.TS

- Official documentation describes TypeScript support for Node.js, Deno, Bun and Cloudflare Workers, with runtime-specific limitations.
- It provides data connectors, indexes/retrievers, agents/engines, workflows and observability integrations.
- This makes it a plausible library behind AEGIS services, rather than a mandatory separate user-facing application.

**AEGIS fit:** prototype a narrow, read-only retrieval adapter first. Keep ingestion allowlisted, source provenance attached to every chunk, tenant/user filters enforced before retrieval, and retrieved text treated as untrusted data rather than instructions. Do not send private health data to external parsing or embedding services without a separately approved privacy assessment.

### SereneDB

- It exposes a PostgreSQL-compatible wire protocol and documents full-text, vector and hybrid search plus SQL analytics.
- Its installation documentation lists Linux CPU, memory and storage requirements; it is a server component, not a Cloudflare Worker.
- The quick-start Docker example uses a trust-authentication setting and states that credentials are not required by default. That example must not be copied into an internet-exposed deployment.
- A direct, supported LlamaIndex.TS-to-SereneDB adapter has not been established by this evaluation. Treat compatibility as unproven until a small integration test demonstrates it.

**AEGIS fit:** candidate retrieval index only. Existing AEGIS databases remain authoritative. Any SereneDB index must be rebuildable from approved source data and must not become the only copy of records.

## Proposed logical architecture

```text
AEGIS Control Centre / approved clients
                 |
        AEGIS identity + policy
                 |
     AEGIS gateway / Sentinel approvals
          /                  \
 Optional LibreChat       AEGIS services
 (operator workspace)          |
                          LlamaIndex.TS
                         retrieval adapter
                                |
                 approved source connectors
                                |
                existing data stores (source of truth)
                                |
                    optional Serenedb index
```

LibreChat is optional and separately hosted. LlamaIndex is an application library. SereneDB is optional infrastructure. AEGIS policy and audit checks remain in the execution path regardless of which UI or retrieval library is used.

## Compatibility matrix

| Area | Initial assessment | Required proof |
|---|---|---|
| Existing Cloudflare Pages/Workers | LlamaIndex.TS is documented for Workers with limitations; LibreChat and SereneDB are not Workers workloads | Keep Workers as gateway/UI; prove only the small LlamaIndex adapter on the actual runtime |
| Oracle Cloud | Potential container/VM host, but current tenancy, instance, region capacity and networking are unverified | Confirm existing host and available resources before proposing any deployment |
| Model providers | LibreChat supports configured providers; LlamaIndex supports multiple model integrations | Test the already-approved AEGIS provider gateway; no direct key duplication |
| MCP | LibreChat supports MCP servers and per-agent tool selection | Allowlist tools and scopes; route sensitive actions through Sentinel and AEGIS approvals |
| Retrieval | LlamaIndex supplies retrieval abstractions; SereneDB supplies search capabilities | Prove a supported driver/adapter, filters, deletes, re-indexing and provenance |
| Health Vision | No automatic suitability established | Keep Stage 1 isolated; no health image/note ingestion, model calls or shared general-purpose memory |
| Operations | Additional services add maintenance and attack surface | Resource budget, patching, backups, monitoring, recovery and owner runbook |

## Safe proof-of-concept sequence

1. **Inventory only:** map the existing AEGIS provider gateway, MCP bridge, Sentinel grants, audit path, data stores and deployment runtime. Do not infer infrastructure from the Oracle region selector.
2. **Library-only spike:** test LlamaIndex.TS in an isolated test harness using synthetic documents and the current supported runtime. No production credentials or live user data.
3. **Retrieval spike:** test SereneDB separately with synthetic records. Verify authentication, TLS, network binding, role permissions, tenant filters, deletion and rebuild behavior. Do not use the quick-start trust-auth configuration on a shared or exposed host.
4. **Adapter proof:** connect LlamaIndex to SereneDB only after the exact driver/client path is demonstrated. Record query correctness, filter enforcement, latency, failure behavior and operational cost. Unknown values stay unknown.
5. **LibreChat review:** evaluate in a disposable, isolated Docker environment only if a suitable existing host is confirmed. Use synthetic accounts and data; disable unneeded tools and public registration; do not connect production MCP servers or health data.
6. **AEGIS boundary test:** prove that LibreChat or a retrieved document cannot bypass AEGIS identity, Sentinel permissions, explicit approvals, rate limits or audit.
7. **Owner review:** publish evidence, risks, operating costs and a rollback plan. Only then ask for approval to build a controlled pilot.

## Security and privacy gates

- No public exposure of MongoDB, SereneDB, vector stores or internal MCP endpoints.
- No secrets in browser storage, source control, prompts, logs, telemetry or test fixtures.
- Use separate service identities, least-privilege scopes, TLS, secret rotation and explicit network allowlists.
- Treat connector manifests, MCP descriptions, retrieved documents and model output as untrusted input.
- Keep read-only as the default. Write/execute tools require exact-scope grants and owner approval through existing AEGIS controls.
- Do not create a second identity, permissions, grants, approval or audit system.
- Do not ingest Health Vision images, notes, identifiable health data or clinical records in this evaluation.
- Do not add public demo accounts or public demos to any private AEGIS workflow.
- Record licence, maintenance activity, dependency provenance, vulnerability posture and upgrade process before admission.

## Acceptance criteria

A component is not admitted merely because it installs or answers a test query. The evaluation must demonstrate:

- repeatable installation in an isolated environment;
- pinned versions and licence/provenance review;
- authenticated, encrypted connections and least-privilege identities;
- correct tenant/user filtering and source citations/provenance;
- prompt-injection resistance for retrieved content and tool descriptions;
- reliable deletion, re-indexing and recovery behavior;
- no bypass of Sentinel, grants, approval, rate-limit or audit controls;
- measured resource use and latency under a documented synthetic workload;
- a tested rollback that leaves existing AEGIS services and data unchanged.

## Explicit non-goals

This document does not authorize installing LibreChat, LlamaIndex or SereneDB; creating an Oracle instance; changing Cloudflare resources; adding secrets; connecting production MCP servers; migrating data; replacing an AEGIS database; enabling automatic agent routing; or merging the existing draft pull requests.

## Official references checked (22 November 2026)

- LibreChat docs: https://www.librechat.ai/docs
- LibreChat Docker deployment: https://www.librechat.ai/docs/local/docker
- LibreChat MCP: https://www.librechat.ai/docs/features/mcp
- LibreChat local deployment options: https://www.librechat.ai/docs/local
- LlamaIndex.TS docs: https://developers.llamaindex.ai/typescript/framework/
- SereneDB docs: https://serenedb.com/docs/
- SereneDB installation requirements: https://serenedb.com/docs/installation
- SereneDB security: https://serenedb.com/docs/security
