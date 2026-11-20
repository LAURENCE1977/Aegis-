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

The measurement context records the benchmark/workload digest, runtime and version, region, concurrency, warm-up count, measured-run count and timeout. Every safety and pass/fail criterion reference in the evaluation must resolve to a manifest entry with the matching evidence kind, a SHA-256 digest and a canonical UTC capture timestamp. Candidate metrics, criterion counts, safety exclusions, evaluation status, currency and recommendation consistency are validated before a record is produced. The record contains only an explicit field allowlist; arbitrary caller payload fields are not copied. Evidence and candidate ordering are canonicalised before the record digest is calculated, and the returned object is deeply frozen.

**Evidence boundary:** the builder records digests and references; it does not fetch evidence, prove that a digest matches an external artifact, or independently establish that the declared measurement environment is truthful. A measurement-context ID is not a security credential or proof of reproducibility.

This remains a pure record-contract slice. It does not run experiments, persist records, expose an API, update memory, change policy, invoke tools or authorise execution. Persistent append-only storage, evidence verification and an isolated experiment runner remain separate future stages.