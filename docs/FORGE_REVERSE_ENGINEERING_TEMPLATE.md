# AEGIS Forge reverse-engineering report template

Use this report for each inspected repository, MCP server, API, SDK, package, framework, standard or engineering technique. The goal is to understand transferable behaviour and build an AEGIS-native implementation, not blindly install or copy the upstream project.

## 1. Source identity and provenance

- Candidate ID:
- Canonical source URL:
- Owner / project:
- Source type:
- Pinned commit / tree / blob SHA:
- Default branch and observed date:
- Archive / fork status:
- Primary language:
- Upstream description:
- Inspection method and tool versions:
- Files actually inspected (exact paths and blob SHAs):
- Files not inspected / tree truncation:

## 2. Licence and reuse boundary

- Repository-level licence metadata:
- Actual LICENSE / COPYING file evidence:
- Licence identifier and version:
- Licence for bundled assets, docs, examples and generated content:
- Dependency licences:
- Attribution / notice requirements:
- Copyleft, network-copyleft or trademark constraints:
- Licence review status: review-required / verified / not-applicable
- Permitted activity: learn concepts / implement independently / reuse selected code / reject
- Reviewer and review date:
- Unresolved legal questions:

Do not treat GitHub SPDX metadata or a repository badge as a completed licence review.

## 3. What the project actually does

- User problem:
- Primary users and deployment model:
- Main user journeys:
- Inputs and outputs:
- Main components and their responsibilities:
- State and persistence model:
- Agent / tool / model interactions:
- Scheduling and background execution:
- External dependencies and services:
- Failure, retry and recovery behaviour:

Separate observed facts from author claims and your own inference.

## 4. Architecture and implementation evidence

For each relevant file, record the exact path and pinned SHA.

| Area | Upstream implementation | Evidence path / SHA | Limitation or risk |
|---|---|---|---|
| Entry points | | | |
| Orchestration | | | |
| State / memory | | | |
| Tools / adapters | | | |
| Permissions / approvals | | | |
| Secrets | | | |
| Persistence | | | |
| Jobs / schedules | | | |
| UI / protocol | | | |
| Logging / audit | | | |
| Tests / benchmarks | | | |

## 5. Security and trust analysis

- Threat model and trust boundaries:
- Authentication and identity source:
- Authorization and scope enforcement:
- Human approval semantics:
- Secret storage and redaction:
- Filesystem, process, container and browser access:
- Network egress / SSRF controls:
- Prompt injection and untrusted data handling:
- Tenant / owner isolation:
- Audit and revocation:
- Known CVEs, advisories and unsafe defaults:
- Security properties that are claimed but not demonstrated:

## 6. Portability, cost and operational fit

- Runtime and language:
- Supported OS / browsers / devices:
- CPU / RAM / GPU requirements:
- Cloud account requirements:
- Free-tier quota and expiry:
- Paid usage / hidden billing triggers:
- API keys / credentials required:
- Offline / mobile behaviour:
- Background execution and durability:
- Operational burden:
- Fit with AEGIS's Chromebook, iPhone and iPad first target:

## 7. Reusable ideas — not dependencies

List the smallest transferable ideas worth learning from. For each, say why it helps AEGIS, what assumptions must be changed, and what not to copy.

| Idea | Value to AEGIS | Upstream assumptions | AEGIS-native adaptation |
|---|---|---|---|
| | | | |

## 8. AEGIS-native implementation specification

- AEGIS capability name:
- User-facing outcome:
- Canonical AEGIS module / service:
- API and data contracts:
- Required permissions:
- Risk tier:
- Sentinel policy and approval requirements:
- Audit events:
- Secret references:
- Adapter boundary:
- Background job / retry requirements:
- Mobile / browser UI:
- Free-tier and resource budget:
- Rollback / disable behaviour:

AEGIS identity, memory, jobs, capability registry, Sentinel, approval store, vault, audit and budgets remain authoritative.

## 9. Test plan and proof

- Unit tests:
- API / contract tests:
- Security negative tests:
- Cross-owner / cross-project tests:
- Failure and retry tests:
- Browser / mobile tests:
- Performance / resource tests:
- Licence checks:
- Required CI run and commit:
- Preview verification:
- Known untested conditions:

No capability is marked available until the acceptance tests and evidence exist.

## 10. Decision and next action

- Decision: reuse / adapt / rebuild / combine / reject
- Why:
- Exact code permitted for reuse, if any:
- Required notices / attribution:
- First minimal AEGIS-native slice:
- Tests to write first:
- Owner approval needed:
- Blockers:
- Next checkpoint:

## 11. Evidence confidence

Mark each statement:

- Verified: directly inspected source, test, API response or reproducible behaviour.
- Reported: upstream documentation or maintainer claim not independently reproduced.
- Inferred: reasoned from partial source or architecture.
- Unknown: not yet investigated.

Keep the report tied to the pinned source version. If upstream changes, create a new revision rather than silently rewriting the evidence.
