# AEGIS Experiment History Analysis

## Purpose

`summarizeAgentExperimentHistory(records)` is a pure, owner-scoped analysis primitive for persisted `aegis.experiment-record.v1` records. It verifies each record's SHA-256 digest before using its measurements and refuses mixed-owner histories.

## Comparison cohorts

Records are compared only when their benchmark identity and measurement conditions match:

- benchmark ID and version
- workload digest
- runtime and runtime version
- region, concurrency, warm-up count, measured-run count and timeout
- currency and evaluation criteria

The unique measurement-context ID and record timestamp are deliberately not part of the cohort identity: separate runs can be compared when the actual declared workload and conditions are equivalent.

## Candidate eligibility

A candidate appears in a longitudinal comparison only when it is present, safety-approved and has fully known criterion outcomes in every record in that cohort. Candidates that are unsafe in any observation are listed as excluded. Incomplete or missing observations are not silently treated as a pass.

For each eligible candidate the report shows the earliest and latest recorded cost, elapsed time and passed/failed criterion counts, plus arithmetic endpoint deltas. Cost is represented as a decimal string in minor currency units so large integer values do not lose precision.

## Interpretation limits

This is descriptive evidence, not statistical analysis. It does not calculate confidence intervals, significance, causation, or a winner across different candidates. It does not update model weights, memory, prompts, tools, Sentinel policy, permissions or execution authority. It does not run experiments or independently retrieve the referenced evidence artifacts.

A lower endpoint cost or elapsed time is not proof of a durable improvement. A human must inspect the underlying benchmark records and evidence before acting on any observed change. Sentinel remains the authority for consequential actions.


## Authenticated API integration

The owner-facing Pages endpoint is:

- `GET /api/experiment-records/analysis`

It reuses the existing owner-session guard and calls the internal runtime route using the server-only service credential and fixed `owner` principal. The browser never receives the runtime bearer token and cannot select a principal.

The internal route is:

- `GET /v1/experiment-records/analysis`

The runtime loads the authenticated owner's records through the existing keyset-paginated D1 store. It verifies stored row metadata and each record digest before analysis. It reads at most 500 records; if another page exists beyond that bound, it returns HTTP 413 rather than silently analysing a partial history. A corrupt record or failed integrity check causes the analysis request to fail closed without returning a partial report.

The endpoint is read-only. It does not create records, run benchmarks, schedule agents, write experiment events, change policy, or invoke Sentinel-authorised actions. The runtime Worker and D1 still need their separately approved deployment/configuration before the endpoint can operate outside the preview environment.


## Evidence-led improvement proposals

The proposal layer converts the verified analysis report into cautious, deterministic review leads:

- `GET /api/experiment-records/proposals` is protected by the existing owner-session guard.
- The internal `GET /v1/experiment-records/proposals` route uses the same trusted owner principal, service bearer and bounded record-history loading as analysis.
- A proposal is emitted only from a comparable cohort with at least two complete observations, for a candidate not listed as excluded or incomplete, and only when at least one measured dimension improved between the endpoints.
- Any observed regression in another measured dimension is called out as a risk. Proposals preserve the baseline/latest values, deltas, workload digest and first/last source record IDs.
- The benefit wording is explicitly potential and observational. Proposals never declare a winner, forecast future performance or rank candidates across incomparable cohorts.
- Each proposal requires human review and independent Sentinel authorisation before consequential action. The output is marked `execution: not_authorised`.

The proposal builder trusts its input to be the output of the existing digest-verifying history analyser; the runtime endpoint enforces this by building the report directly from owner-scoped persisted records. Evidence references remain references: this layer does not fetch source artifacts, independently verify their contents, persist proposals, invoke Sentinel or execute actions. A proposal is a review lead, not an approval or an instruction to deploy.


## Human proposal review ledger

Proposal review observations are recorded separately from the immutable experiment evidence:

- Owner-authenticated Pages route: `/api/experiment-records/proposals/reviews` (GET and same-origin POST).
- Internal runtime route: `/v1/experiment-records/proposals/reviews`, protected by the existing runtime bearer and trusted owner principal.
- The runtime recomputes the current proposal from digest-verified persisted records before accepting a review. Stale proposal IDs are rejected with 409.
- Supported decisions are `accepted_for_further_review`, `rejected`, `needs_more_evidence`, and `withdrawn`. There is intentionally no `approved` decision.
- Each event records the proposal ID, reviewer principal, note, decision, workload digest, and first/last source record IDs. Event IDs are idempotent; reuse with different content is rejected.
- Review events are append-only and owner-scoped. They are not edits to the proposal or experiment evidence.
- Every returned event explicitly reports `approvalGranted: false` and `execution: not_authorised`. A review decision is not a Sentinel decision and cannot authorise a change.

This ledger captures human review, not deployment readiness. Evidence artifact retrieval and independent verification remain a separate future capability; references and record digests alone do not prove the truth of an external artifact.


Proposal IDs are versioned (`proposal:v1:` for the current contract). A future incompatible proposal interpretation must increment the version, so old human-review events cannot silently attach to a new proposal definition.
