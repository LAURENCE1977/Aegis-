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

The serializer remains an isolated Forge analysis module, not wired into production repository routes or the UI. Its architecture-graph tests passed in the Node.js/Cloudflare runtime stage of workflow `44099632898`; the full workflow, including isolated D1 checks, completed successfully. Next work: schema validation, namespace-member edges, richer type/reference edges, and an interactive viewer whose edges open exact source evidence.

### 2. AG-UI — protocol compatibility, not authority

Upstream:
- Repository: https://github.com/ag-ui-protocol/ag-ui
- Documentation: https://docs.ag-ui.com/
- Licence: MIT.
- The 1.0 specification defines 31 event types across eight families and uses a versioned event schema.

AEGIS already has a live text-streaming endpoint and a bounded, owner-only terminal-run replay endpoint. The live endpoint emits actual assistant text deltas and can execute at most one server-registered tool per run through the existing Sentinel-enforced tool boundary. The terminal replay intentionally emits lifecycle and custom audit-reference events because persisted run history does not establish assistant message content, tool-call arguments/results or specialist execution. The live endpoint now emits TOOL_CALL_START, TOOL_CALL_ARGS, TOOL_CALL_END and TOOL_CALL_RESULT around actual server-registered tool execution. Tool-call arguments/results are size-bounded and correlated by the provider call ID and live run message ID. The start/args/end events describe the proposal; the result is emitted only after the Sentinel-mediated execution function returns. This does not grant authority or bypass capability approval. Persisted terminal replay remains lifecycle/audit-reference only; it does not fabricate missing assistant messages or tool history.

Implementation status:
1. Existing live endpoint and terminal replay path retained; no second transport.
2. Live text and tool-call lifecycle events are implemented with focused protocol/API regression tests.
3. Event arrival order is preserved; timestamps remain metadata.
4. Tool execution continues through the server registry and Sentinel invocation boundary; protocol events do not grant permission.
5. Durable state/activity/subagent replay, reconnect cursors and snapshot/delta support remain future work and must be backed by persisted, owner-scoped records before UI integration.
6. Latest tool-call event byte-limit and full-workflow verification is pending CI; do not mark this increment complete until the run is green.

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

Decision: adapter research approved; no MobSF service, Docker image, emulator, device or binary is installed or activated by this change. A pure report-normalization contract is implemented in `functions/lib/mobile-security-report.mjs`; it accepts a narrow static-only report shape, validates artifact/evidence digests and locations, bounds input size/findings, marks all findings `unreviewed`, and explicitly sets authority/remediation permission to `none`/`false`. It does not call MobSF or run apps.

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

- Multi-hop named re-export adapter: full workflow `44095169702` succeeded.
- Architecture graph, knowledge chunking/retrieval/compiler and static mobile-report normalizer: Node.js/Cloudflare runtime tests and all isolated capability, runtime and Forge D1 checks passed in full workflow `44100779738` (completed/success).
- Architecture graph serializer and tests: Node.js/Cloudflare runtime test stage and all isolated D1 checks passed in workflow `44099632898` (completed/success). It remains isolated from production routes/UI.
- AG-UI: live text streaming and bounded terminal replay are implemented; full event-family conformance, persisted event semantics and TOOL_CALL_* visibility remain future work.
- RAGFlow: native foundations now include Markdown chunking, lexical BM25 retrieval and evidence-bound compilation; upload/extraction/storage integration and semantic retrieval remain future work. No heavyweight dependency installed.
- MobSF: static report normalization contract implemented and tested; no scanner worker, Docker service, emulator, device or dynamic analysis activated.
- No PR merge, production deployment, device scan, source execution or paid service activation.
