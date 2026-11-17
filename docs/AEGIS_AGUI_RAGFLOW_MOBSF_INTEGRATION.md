# AEGIS architecture graph, AG-UI and mobile-security integration decisions

Date: 17 November 2026
Branch: `feature/composio-audit-lineage-verified`

## Decisions

### 1. Forge architecture graph — native implementation

The isolated Tree-sitter pipeline now has a deterministic graph serializer in `scripts/forge-tree-sitter-architecture-graph.mjs`.

Its intended contract is:
- Stable file and declaration node identifiers.
- Module-import, symbol-import, local-call and resolved named-re-export edges.
- Source path and source coordinates on every edge.
- Unresolved import, symbol and re-export evidence retained separately.
- Weakly connected components over resolved local module edges, including singleton/disconnected files.
- Existing module-cycle results preserved.
- Explicit `execution: none` and the parser's bounded input limits preserved.

The graph is an evidence-backed view of the selected source bundle, not a complete semantic model, package graph, build graph or runtime call graph. No source is executed.

The serializer is not yet integrated into production Forge routes or the UI. It must pass the full test workflow before promotion. Next work: graph schema validation, namespace-member edge integration, disconnected-component tests, and an interactive viewer whose edges open the exact source evidence.

### 2. AG-UI — protocol compatibility, not authority

Upstream:
- Repository: https://github.com/ag-ui-protocol/ag-ui
- Documentation: https://docs.ag-ui.com/
- Licence: MIT.
- The 1.0 specification defines 31 event types across eight families and uses a versioned event schema.

AEGIS already has a live streaming endpoint and a bounded, owner-only terminal-run replay endpoint. The current replay intentionally emits only lifecycle and custom audit-reference events because persisted run history does not establish assistant message content, tool-call arguments/results or specialist execution. Do not fabricate richer protocol events from incomplete records.

Implementation sequence:
1. Keep the existing endpoint and replay path; do not create a second transport.
2. Add a pinned AG-UI 1.0 schema fixture and conformance tests for each event AEGIS actually emits.
3. Preserve arrival order; timestamps are metadata, not a substitute for event ordering.
4. Add durable message/tool/state/activity/subagent events only when the underlying AEGIS runtime actually persists those records with provenance and owner visibility.
5. Validate tool-call events against the Sentinel-approved invocation and append-only audit record. A protocol event is never an approval or permission grant.
6. Add reconnect/replay cursor and bounded snapshot/delta tests before UI integration.

The protocol's broader event vocabulary is not a requirement to emit every event immediately. Unsupported or unpersisted event families remain absent.

### 3. RAGFlow — research source, not AEGIS memory authority

Upstream:
- Repository: https://github.com/infiniflow/ragflow
- Licence: Apache-2.0.
- RAGFlow 1.0.0 was announced 6 November 2026 and includes a Go rewrite, NATS and Kvrocks changes, agentic chat and document parsing/retrieval updates.
- The upstream project documents knowledge compilation into wikis, graphs, trees, PageIndex, mind maps, timelines and skills, as well as multi-step retrieval and grounded citations.
- Its recommended starting deployment is approximately 4 CPU cores, 16 GB RAM and 50 GB disk, with further resources depending on workload and models.

Decision: adapt selected algorithms and interaction patterns natively rather than require a full RAGFlow deployment. A separate optional adapter may be considered later, but must be version-pinned, permission-scoped and removable.

AEGIS-native knowledge pipeline:
1. Preserve original evidence identity, owner, digest, source and acquisition timestamp.
2. Parse documents into structure-aware sections, tables, pages and chunks; preserve offsets and parent-child relationships.
3. Generate lexical and semantic retrieval candidates using replaceable local engines.
4. Rerank only within the caller's authorised evidence scope.
5. Require every answer claim to resolve to evidence references; represent gaps, conflicts and uncertainty.
6. Compile reviewed evidence into optional wiki, graph, tree, timeline and task-skill views.
7. Keep candidate knowledge separate from accepted memory. Promotion, correction, expiry and deletion remain governed by AEGIS memory policy and user controls.
8. Never treat retrieved document text as instructions to agents or tools.

Resource policy: no mandatory Elasticsearch, NATS, Kvrocks, external embedding API, hosted model or 16 GB memory footprint. Benchmark local alternatives on target hardware before selecting any engine.

### 4. MobSF — optional isolated mobile-app security worker

Upstream:
- Repository: https://github.com/MobSF/Mobile-Security-Framework-MobSF
- Licence: GPL-3.0.
- Supports static analysis for Android, iOS and Windows mobile artifacts and source packages; dynamic analysis uses supported emulators, simulators or physical test devices; upstream exposes REST/CLI integration.

Decision: adapter research approved; no MobSF service, Docker image, emulator, device or binary is installed or activated by this change.

Required boundary:
- Accept only owner-supplied artifacts or artifacts with explicit source provenance and testing authority.
- Verify size, media type, digest and archive expansion limits before intake.
- Run static analysis in an isolated, disposable worker with no general network egress, no host mounts, no secrets and strict CPU/memory/time limits.
- Dynamic analysis is a separate high-risk capability requiring explicit Sentinel approval, a disposable test device/emulator and network isolation.
- Never install an unknown app on the user's everyday phone/tablet or execute it on the AEGIS host.
- Treat reports and extracted strings as untrusted data. Scan for prompt injection, secrets and malicious links before indexing.
- Normalize findings into AEGIS evidence records: tool/version, artifact digest, rule/check ID, severity, confidence, affected component, source location, evidence excerpt digest, remediation and scan timestamp.
- A MobSF score is a signal, not proof of malware or safety. Preserve tool uncertainty and false-positive review.
- Review GPL-3.0 obligations and bundled component licences before redistributing or linking code. A remote API adapter does not automatically eliminate all licence or deployment obligations.

## Acceptance gates

No production route or automatic scan is added until all applicable gates pass:
- Exact upstream commit/tag and licence/dependency inventory recorded.
- Threat model and untrusted-output handling reviewed.
- Bounded API contract and authentication tests.
- Isolation and resource-limit tests for any worker.
- Sentinel exact-resource approval tests for dynamic/device/network actions.
- Reproducible CI, including failure-path tests.
- Performance and resource benchmarks on supported target environments.
- User-facing scope, retention, export and deletion behaviour documented.

## Current status

- Multi-hop named re-export adapter: full workflow 44095169702 succeeded.
- Architecture graph serializer and tests: implementation is committed; latest workflow verification is pending/being reconciled. Do not describe it as CI-green until the matching run completes successfully.
- AG-UI live streaming and bounded replay: existing implementation remains in place; full 1.0 conformance expansion is future work.
- RAGFlow: native design direction recorded; no heavyweight dependency installed.
- MobSF: isolated adapter design recorded; no worker or dynamic analysis activated.
- No PR merge, production deployment, device scan, source execution or paid service activation.
