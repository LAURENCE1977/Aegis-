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
