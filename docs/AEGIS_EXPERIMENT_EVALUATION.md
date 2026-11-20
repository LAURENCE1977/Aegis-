# AEGIS Experiment Evaluation — initial runtime slice

**Status:** Implemented as a pure deterministic evaluator; not connected to orchestration, persistent learning, model calls or execution.

## Purpose

The Outcome Planner proposes approaches. The experiment evaluator answers a different question: when comparable, measured results exist, what do those results actually support?

It is deliberately allowed to return no recommendation. AEGIS must not manufacture certainty when evidence is incomplete or when the trade-offs are genuinely incomparable.

## Input contract

`evaluateAgentExperiment({ priority, criteria, candidates })` accepts:

- one of the existing priorities: `balanced`, `lowest_cost`, `fastest` or `highest_reliability`;
- one to eight uniquely identified acceptance criteria;
- two to eight candidate results;
- a shared currency and a shared `measurementContextId` across candidates;
- non-negative integer-string cost in that currency's minor units;
- positive elapsed time in milliseconds;
- an explicit safety-check result plus a bounded safety evidence reference;
- exactly one `pass`, `fail` or `unknown` result per criterion, with an evidence reference for pass/fail outcomes.

All identifiers, counts, lengths and numeric ranges are bounded. Costs are compared as integers, never floating point. Mixed currencies and mismatched measurement-context identifiers are rejected rather than silently normalised.

The measurement-context identifier is a caller-supplied comparability label, not proof that two runs truly occurred under identical conditions. Evidence references are recorded but not independently fetched or verified by this module.

## Comparison rules

- **Lowest cost:** cost first, then passed criteria, then elapsed time.
- **Fastest:** elapsed time first, then passed criteria, then cost.
- **Highest reliability:** passed acceptance criteria first, then cost, then elapsed time.
- **Balanced:** calculate the Pareto frontier across passed criteria, cost and elapsed time. A recommendation is returned only when one safe candidate uniquely dominates the others. Multiple non-dominated candidates produce no winner.

If any safety-eligible candidate has an unknown criterion result, the evaluation is marked incomplete and no recommendation is made. Candidates whose safety checks failed are excluded. If none remain, the result is `no_safe_candidate`.

Ties in priority-based comparisons do not produce an arbitrary winner. The candidate order is diagnostic only; it is not a tie-breaker disguised as evidence.

## Safety and authority boundary

This module is pure computation. It does not:

- run candidate experiments;
- call models, tools, providers or external services;
- verify evidence references;
- persist results or update user/project memory;
- change priorities, acceptance criteria or Sentinel policy;
- approve, execute, deploy or spend.

The supplied safety result is evidence metadata, not an AEGIS permission grant. Sentinel remains authoritative for every protected action. Any future experiment runner, evidence verifier or learning store requires its own threat model, tests, provenance and approval boundaries.

## What this establishes — and what it does not

This is an initial comparison primitive, not an autonomous learning system. It creates a deterministic way to compare measured candidate outcomes and to abstain when evidence is insufficient. It does not yet establish that AEGIS improves over time, because no experiments are run and no outcomes are retained or fed back into future recommendations.

The next engineering stages are: define reproducible benchmark scenarios; run only safe, isolated experiments; verify evidence provenance; record immutable experiment outcomes; evaluate recommendation quality over time; and propose any resulting policy or model changes for human review. No self-modification of Sentinel or production authority is permitted.


## Immutable experiment record contract — initial source slice (20 November 2026)

`workers/runtime/agent-experiment-record.mjs` now exports `createAgentExperimentRecord`, an asynchronous, side-effect-free record builder. It creates a versioned `aegis.experiment-record.v1` value containing the owner and source-run references, benchmark identity, a bounded measurement-context record, the deterministic evaluation and an evidence manifest.

The measurement context records the benchmark/workload digest, runtime and version, region, concurrency, warm-up count, measured-run count and timeout. Every safety and pass/fail criterion reference, each candidate's cost and elapsed-time measurement, and the benchmark workload must resolve to a manifest entry with the matching evidence kind, a SHA-256 digest and a canonical UTC capture timestamp. The benchmark workload evidence digest must equal the workload digest recorded in the measurement context. Candidate metrics, criterion counts, safety exclusions, evaluation status and currency are validated; the deterministic evaluator is rerun from the normalized candidate inputs and any inconsistent recommendation or ranking is rejected before a record is produced. The record contains only an explicit field allowlist; arbitrary caller payload fields are not copied. Evidence and candidate ordering are canonicalised before the record digest is calculated, and the returned object is deeply frozen.

**Evidence boundary:** the builder records digests and references; it does not fetch evidence, prove that a digest matches an external artifact, or independently establish that the declared measurement environment is truthful. A measurement-context ID is not a security credential or proof of reproducibility.

This remains a pure record-contract slice. It does not run experiments, persist records, expose an API, update memory, change policy, invoke tools or authorise execution. Persistent append-only storage, evidence verification and an isolated experiment runner remain separate future stages.

### Evidence manifest completeness hardening

The record builder now rejects manifest entries that are not referenced by the benchmark context or evaluation. This keeps the evidence set minimal and auditable: every included artifact reference must support a specific recorded workload, cost, elapsed-time, safety or criterion measurement. It still records references and digests only; it does not independently retrieve or authenticate external artifacts.


### Record digest verification

`verifyAgentExperimentRecordDigest(record)` recomputes the canonical SHA-256 digest for a versioned record and returns false when the record is malformed, has an unexpected top-level field, or its contents no longer match the stored digest. This is an integrity/checksum check, not a digital signature or proof of origin: anyone able to replace both the record and its digest can recompute an unkeyed SHA-256 value. A future persistence boundary must protect stored records with authenticated ownership, append-only controls and an independently protected audit trail.


## Owner-scoped experiment record storage — staged contract (20 November 2026)

`migrations/runtime/0003_experiment_records.sql` adds a D1 schema for immutable experiment payloads and an append-only event ledger. The record key is composite (`principal_id, record_id`), so the same record ID can exist in separate principal namespaces. The migration adds indexes for principal-scoped history, blocks record updates/deletes, and blocks event updates/deletes. A unique tombstone index permits at most one logical deletion event per record.

`workers/runtime/experiment-record-store.mjs` provides append, get, list and tombstone operations. Every data query scopes by the supplied principal; appends require the record's embedded owner ID to match that principal and verify its canonical digest before storage. Repeated identical appends are idempotent; a conflicting record ID with different content is rejected. Reads verify the stored digest again before returning data.

**Authentication gate:** the principal argument is trusted server context, not user input. The current runtime's shared `AEGIS_JOB_TOKEN` authenticates a service, not an individual end user. For that reason these operations are not wired to an HTTP route and must not be called with a request-body owner ID or the record's owner field as authority. A future authenticated user/session adapter must establish the principal before invoking this store.

**Deletion and retention boundary:** tombstoning hides a record from normal get/list operations and appends an audit event; it does not erase the payload. Physical purge, retention duration, backup expiry and any legal erasure workflow are deliberately not implemented until an authorised retention policy is defined. The event ledger itself is append-only.

This stage does not create an API endpoint, authenticate users, run experiments, execute tools, change Sentinel policy, or deploy production. The D1 migration and store tests still require CI/integration execution against the repository's actual test environment.

The history listing uses keyset pagination ordered by creation timestamp and record ID, with a bounded page size, so callers can continue through a principal's records without offset-based page drift.

The existing Pages login uses a signed single-password session, but its HMAC payload currently carries an expiry only; it has no stable user or subject identifier. That session proves access to the single-owner app, but it does not yet supply a distinct principal claim suitable for a multi-user data boundary. The runtime's separate bearer token remains service authentication. A future adapter must explicitly establish the intended account/principal on the server before storage calls.
