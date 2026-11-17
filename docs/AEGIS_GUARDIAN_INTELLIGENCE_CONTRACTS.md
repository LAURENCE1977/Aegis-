# Guardian Intelligence Contracts

**Status:** Implemented as pure, read-only validation contracts on `feature/rea-open-source-security-learning-batch`. No persistence, API route, UI, scanner or worker execution is implemented by this slice.

## Purpose

Establish strict data contracts before adding resource catalogue ingestion, learning-path persistence or security research execution. These validators reject malformed and unexpected fields; they do not confer trust, prove a source is safe, authorise a scan or replace Sentinel.

## Implemented contracts

### Resource records

`validateResourceRecord(record)` validates:
- canonical HTTPS source identity and a pinned source revision;
- explicit category and licence review state;
- HTTPS licence evidence when the licence is marked verified;
- pricing model, evidence URL and ISO timestamp;
- explicit limits for free-tier and trial claims;
- hosting mode, operational requirements and limitations;
- strict field allowlists and bounded text arrays.

A `verified` licence state is only a structured owner-review assertion backed by a reference. It is not legal advice or an automated licence compatibility decision. A pricing record is time-bound evidence, not a promise that a provider's offer remains available.

### Learning graphs

`validateLearningGraph(nodes)` validates:
- unique stable node identifiers;
- bounded outcomes, difficulty and attributable HTTPS source references;
- explicit content-licence status;
- existing prerequisites and no self-dependencies;
- acyclic prerequisite graph.

The graph stores links and learning metadata, not copied course content. This validator does not infer learner mastery or redistribute third-party materials.

### Security findings

`validateSecurityFinding(finding)` validates:
- exact owner/resource identity and a SHA-256 scope digest;
- enumerated severity, confidence, status and assessment method;
- bounded evidence references with digests rather than raw tool output;
- timestamps, summary and optional remediation guidance;
- dynamic-test grant/approval identifiers bound to the same scope digest.

**Critical boundary:** this is structural validation only. A caller cannot make an assessment authorised by supplying `grantId` and `approvalId`. Before any dynamic test, a future server-side route must load the persisted target and scope, obtain the grant/approval from Sentinel's trusted server context, revalidate expiry/revocation/rate limits, and create an immutable audit receipt. Browser-supplied lineage fields must be rejected. No dynamic test execution exists in this slice.

## Tests and verification

The test-first RED run was recorded in GitHub Actions run `44127001100`: the new contract test module failed because the implementation module did not yet exist; 721 pre-existing tests passed and one was skipped.

The implementation was then added in `functions/lib/guardian-intelligence.mjs`. The focused contract tests cover:
- HTTPS/provenance and credential-bearing URL rejection;
- verified-licence evidence requirements;
- explicit free-tier/trial limits and timestamp validity;
- unexpected-field rejection;
- valid learning graphs, missing prerequisites, duplicate IDs and cycles;
- authorised dynamic-test lineage and exact scope-digest binding;
- digest-only evidence and rejection of raw tool output;
- evidence requirements for verified findings.

Full workflow verification is tracked separately in the PR and Actions run. Do not treat a Node test pass as proof of production deployment, security certification or a complete source audit.

## Next gates

1. Add property-based/adversarial cases for URL parsing, graph size/depth and malformed evidence.
2. Add a persistence layer with owner scoping, immutable provenance and append-only review events.
3. Add read-only catalogue and learning-graph APIs behind existing owner authentication and same-origin protections.
4. Add Security Research capability declarations only after a concrete operation schema, Sentinel policy and isolated worker contract exist.
5. Keep active scanning disabled until exact target registration, network egress controls, resource ceilings, cancellation and effect-level audit verification pass end-to-end.
