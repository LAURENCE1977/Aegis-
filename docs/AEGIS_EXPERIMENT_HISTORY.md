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
