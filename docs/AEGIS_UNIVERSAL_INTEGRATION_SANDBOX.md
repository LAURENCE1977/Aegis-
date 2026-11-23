# Universal API + MCP Intelligence Sandbox

## Purpose

Give AEGIS one provider-neutral assessment layer for deciding which connected API or MCP integration is suitable for a requested task. The goal is not to collect connectors indiscriminately: AEGIS should identify what each integration can actually do, what evidence supports that claim, what it costs or how quickly it responds when known, and which safety boundaries apply.

## One integration, one capability profile

Normalize each candidate into a versioned profile containing:
- integration identity and kind: API, MCP server, model provider, or local tool;
- supported tasks and declared actions/effects (read, write, execute);
- transport and runtime requirements;
- authentication state and explicitly granted scopes;
- provenance, version pin, licence and security-review state;
- capability evidence, verification time and expiry;
- observed latency, reliability and cost, with source and timestamp;
- data-egress destinations and approval requirements.

A connector being installed or an API key being stored is not proof that the integration is reachable, safe, or useful. Keep detected, authenticated, verified, admitted and executable as separate states.

## Sandbox stages

1. Discover: identify configured connectors, known provider adapters, MCP endpoints and local tools from owner-authorized metadata. Do not scan arbitrary networks or guess credentials.
2. Describe: normalize manifests, API schemas, MCP tool descriptions, scopes, transport and declared side effects into a bounded capability profile.
3. Verify: run opt-in, read-only health and conformance checks against explicit allowlisted destinations. Use synthetic data, strict time/size limits and no ambient filesystem or network access.
4. Assess: check authentication, provenance, licence, version pinning, security posture, scope fit, data egress and evidence freshness. Untrusted descriptions are data, never instructions.
5. Benchmark: record latency, success rate, rate limits and cost only from measured or authoritative evidence. Unknown values remain unknown.
6. Recommend: rank eligible integrations for the requested task and explain the evidence, trade-offs and gaps. A failed safety gate cannot be offset by a high score, low cost or speed.
7. Approve and execute: require explicit owner approval for connection admission and every sensitive/write/execute operation. Dispatch only through the existing Sentinel policy, grants, rate limits and audit pipeline.

## AEGIS fit assessment v1

The first code slice is a pure metadata/evidence ranker in functions/lib/integration-fit.mjs. It accepts a task, required effect and normalized candidate profiles. It ranks only candidates whose admission, authentication, security review, evidence freshness, task/effect declarations and requested scopes all pass.

This initial slice is deliberately metadata-only. It performs no network probes, credential reads, MCP calls, provider dispatch, grants or automatic routing. Missing or stale evidence blocks eligibility; it is never silently treated as success. Cost and latency are tie-breakers only after safety eligibility.

## User experience

Add an owner-only Integration Lab in the AEGIS Control Centre:
- inventory and status: discovered → connected → verified → admitted;
- API / MCP compatibility and transport matrix;
- capability cards showing supported tasks, effects, scopes and evidence freshness;
- safe test controls with read-only default and explicit destination allowlists;
- comparison view: best fit for coding, research, reasoning, data retrieval, automation or other declared tasks;
- plain-language reason for each recommendation and why alternatives were rejected;
- run history with redacted evidence, latency, errors and cost provenance;
- owner-controlled quarantine, revoke and approval actions.

## Non-negotiable boundaries

- No arbitrary port scanning, network crawling, SSRF, shell execution or package installation.
- No credentials in browser storage, logs, prompts, telemetry or test fixtures.
- No tool execution from an unreviewed manifest or MCP annotation.
- No automatic privilege escalation, connection admission or owner-approval bypass.
- No routing to an integration with stale evidence, missing scopes, failed security review or unknown required permissions.
- No invented cost, quota, rate limit, reliability or performance numbers.
- Preserve the existing provider gateway, MCP bridge, Forge catalogue, Sentinel approvals, capability grants and append-only audit as the integration points; do not create a parallel permission system.

## Delivery sequence

1. Metadata-only fit ranker and regression tests (this slice).
2. Read-only owner inventory combining provider connections, capability connections and Forge candidates.
3. Explicitly allowlisted API/MCP health and schema conformance probes in an isolated worker.
4. Evidence-backed scoring and comparison UI.
5. Owner-approved admission and Sentinel-governed invocation.
6. Controlled learning from observed outcomes, with evidence expiry and owner review.

## Current limitations

The v1 ranker is not a live detector and does not claim an API/MCP endpoint works. It ranks only profiles supplied by trusted server-side discovery. Live probes, persistent evidence, inventory UI and automatic task routing remain future stages and must be separately reviewed.
