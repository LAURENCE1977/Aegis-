# AEGIS Forge — Repository Batch Review (17 November 2026)

## Scope and method

This is a first-pass repository triage, not a full source-level REA for every candidate. Repository metadata, default-branch commit, README and licence evidence were checked where available. No upstream repository was cloned, installed, executed or added as a dependency. Candidate source revisions are pinned below so a later full REA can be reproducible.

Architectural rule: do not import whole repositories. Extract or rebuild the smallest useful primitive behind AEGIS-owned interfaces. AEGIS retains intelligence, memory, orchestration, policy, Sentinel, audit and permission authority.

## Previously present in AEGIS

The following supplied repositories were not found as installed dependencies or existing source modules in the inspected AEGIS feature-branch tree, and prior project context contains no record of their adoption:
- `founded-labs/react-native-reusables`
- `founded-labs/react-native-reusables-templates`
- `coleam00/context-engineering-intro`
- `microsoft/semantic-kernel`
- `OpenMOSS/ABC-Bench`

Existing AEGIS assets that overlap conceptually, but are not copies or integrations of these projects:
- `AGENTS.md`, `docs/AEGIS_MASTER_BLUEPRINT.md` and `docs/AEGIS_REVERSE_ENGINEERING_STANDARD.md` already provide project context, build constraints, engineering rules and validation expectations.
- AEGIS has its own Cloudflare Pages/Functions architecture, D1 persistence, Forge candidate/knowledge APIs, auth, tests and feature-branch CI.
- No React Native application shell or Semantic Kernel dependency was found in the inspected tree.

## Candidate assessments

### 1. React Native Reusables

- Repository: https://github.com/founded-labs/react-native-reusables
- Licence: MIT (upstream LICENSE inspected).
- Pinned default-branch commit at review: `d430e9a74e3acee2671c597fe8f846e7b4a460af`.
- Repository metadata: TypeScript; active; upstream push 2026-11-14.
- Purpose: reusable shadcn-style React Native UI components built around Nativewind/Uniwind and Radix-inspired primitives.
- AEGIS value: potential foundation/reference for a future mobile companion and Control Centre component layer.
- Limits: UI primitives only. Does not provide AEGIS identity, secure storage, permission enforcement, agent runtime, cross-device memory or a complete mobile platform.
- Security boundary: biometric unlock must use OS authenticators and hardware-backed credentials; never trust a UI component as an authentication authority.
- Decision: **selective reference / prototype candidate**. Do not install into the current web application or replace the existing UI. Evaluate only when the React Native mobile shell is scheduled. Preserve MIT notices for any copied portions.

### 2. React Native Reusables Templates (interpreted meaning of “template” in this batch)

- Repository: https://github.com/founded-labs/react-native-reusables-templates
- Licence: MIT (repository metadata and upstream template listing).
- Pinned default-branch commit at review: `ecdc14b50fa9ad4d905085dc394cf783d48ad66d`.
- Upstream push: 2026-07-02.
- Purpose: minimal, Uniwind and Clerk-auth starter templates for universal Expo/React Native applications.
- AEGIS value: useful reference for bootstrapping a future cross-platform mobile app and assessing native/web layout parity.
- Limits: Clerk template is not a fit for AEGIS identity architecture; no hosted auth provider may become mandatory. Template package versions and native compatibility require a separate pinned dependency review.
- Decision: **reference only**. Prefer minimal/Uniwind patterns; do not adopt Clerk or replace AEGIS auth. This review assumes this is the “template” meant; an additional template repository requires its exact URL.

### 3. Context Engineering Intro

- Repository: https://github.com/coleam00/context-engineering-intro
- Licence: MIT (upstream LICENSE inspected).
- Pinned default-branch commit at review: `a2d84b021cee1e2f4e77ba854bba0be8cb319035`.
- Upstream push: 2026-03-16.
- Purpose: project context, examples, feature briefs and PRP-style implementation plans with validation gates; centred on Claude Code but described as transferable.
- AEGIS value: reinforces the need to give coding agents verified context, examples, explicit acceptance criteria and test commands.
- Limits: a template/workflow, not an agent runtime or memory system. Claude-specific slash commands/settings should not be imported as if they were portable.
- Existing overlap: AEGIS already has `AGENTS.md`, a canonical master blueprint, REA standard, feature tests and CI. Do not duplicate these with another parallel documentation framework.
- Decision: **adapt principles only**. Keep one canonical AEGIS build context and task/acceptance record. The current TDD and branch/CI workflow already captures the most useful parts.

### 4. Microsoft Semantic Kernel

- Repository: https://github.com/microsoft/semantic-kernel
- Licence: MIT (upstream LICENSE inspected).
- Pinned default-branch commit at review: `ff22ec32ed31096c98ad63376d4ecc9aefe0ff38`.
- Upstream push: 2026-11-13.
- Purpose: model/provider integration, plugins, agents, multi-agent orchestration, process workflows and vector-store connectors across .NET, Python and Java.
- Important upstream status: the current README identifies **Microsoft Agent Framework** as the production-ready successor and directs Semantic Kernel users to a migration guide.
- AEGIS value: useful patterns for provider adapters, typed functions, plugin contracts, workflow state and agent interoperability.
- Limits: substantial framework and language/runtime footprint; could duplicate AEGIS-owned orchestration, memory, tool registry and policy. Sample quickstarts commonly assume hosted model credentials, so those are not a free-core guarantee.
- Decision: **selective architecture reference only; no dependency**. AEGIS remains the authority and provider-agnostic core. If deeper study is justified, assess the successor separately rather than beginning a new integration on a superseded framework.

### 5. ABC-Bench

- Repository: https://github.com/OpenMOSS/ABC-Bench
- Pinned default-branch commit at review: `265af02a78fd8bc6b84d75b4001e23983fa41db9`.
- Upstream push: 2026-01-20.
- Purpose: benchmark coding agents on real repository tasks including exploration, code changes, environment setup, containerised services and external end-to-end API verification. README describes 224 tasks from 127 MIT-licensed source repositories and a dataset hosted separately on Hugging Face.
- Licence finding: **no repository LICENSE file was found at the reviewed revision**. The README statement that benchmark tasks were curated from MIT-licensed repositories does not establish the licence for ABC-Bench's own harness, dataset, assets or every task.
- Runtime/cost: documented quickstart requires Docker and Terminal-Bench; examples use hosted model identifiers and concurrent containerised jobs. Not suitable as a mandatory AEGIS dependency or a routine free CI job.
- AEGIS value: benchmark design ideas for full-lifecycle Forge evaluation, task reproducibility, environment verification and end-to-end acceptance.
- Decision: **hold code/dataset reuse pending explicit licence verification**. Paper/README may inform independent benchmark design, with attribution. Do not download/execute the dataset or run container tasks as part of AEGIS CI yet.

### 6. “Vibe coding”

- No unique repository was specified by this phrase. It is a broad development style, not a precise source identity.
- Search surfaced unrelated templates, including `edusatyaki/VibeCoding`, but there is insufficient evidence that this is the repository intended.
- Decision: **no repository intake**. AEGIS will use specification-first, context-rich, test-driven, human-reviewed engineering rather than unbounded “vibe coding”. Provide the exact GitHub URL if a particular project was intended.

## Summary decisions

| Candidate | Licence | Decision | Dependency added |
|---|---|---|---|
| React Native Reusables | MIT | Mobile UI reference/prototype candidate | No |
| RNR Templates | MIT | Minimal/Uniwind patterns only; no Clerk auth | No |
| Context Engineering Intro | MIT | Adapt context/PRP/validation principles; avoid duplicate docs | No |
| Semantic Kernel | MIT | Architecture reference only; successor noted | No |
| ABC-Bench | Unverified repository/dataset licence | Hold reuse; benchmark design reference only | No |
| Vibe coding | Unspecified | No exact repository to assess | No |

## Next build action

Continue the active Forge provenance work on the existing feature branch:
1. Persist validated source provenance records by owner and immutable repository revision.
2. Enforce deduplication and append-only provenance events in D1.
3. Expose an authenticated, same-origin, bounded API.
4. Verify the new migration in local D1 CI.
5. Keep the mobile UI work for the dedicated mobile-shell milestone.

No upstream source was copied, installed or executed. No production migration or deployment was performed. PR #101 remains unmerged and requires explicit user approval to merge.
