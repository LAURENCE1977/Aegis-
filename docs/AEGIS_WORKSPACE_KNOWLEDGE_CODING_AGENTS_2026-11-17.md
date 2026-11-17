# AEGIS Workspace, Knowledge & Coding-Agent Ecosystem Research

**Research date:** 17 November 2026  
**Status:** Research intake and architecture recommendations; no upstream code imported or executed.  
**Scope:** ToolJet, Mattermost, Outline, Plausible, Continue, Roo Code, SWE-agent, Plandex, GPT Pilot, Tabby and Goose.

## Executive direction

These projects cluster into three complementary layers: (1) workspace and collaboration, (2) private observability, and (3) a software-agent workforce for planning, codebase understanding, controlled edits, tests and review.

AEGIS should not become a bundle of eleven platforms. It should own one identity, task graph, memory/knowledge model, Sentinel policy plane, audit history and user experience. Candidates are reference implementations or optional adapters behind those contracts.

## Candidate review

| Candidate | Useful mechanisms to investigate | Initial disposition / caveats |
|---|---|---|
| **ToolJet** | Visual internal-app builder, typed component/data contracts, connector proxying, workflow builder, environment separation, RBAC, audit and Git sync; MCP surface for coding agents to create/edit apps against real schemas. | Strong workspace-builder reference. Repository is AGPL-3.0; treat as optional self-hosted product or learn architecture, not automatically embed code. Inspect edition boundaries, connector secrets and generated-query execution. |
| **Mattermost** | Channel/thread model, incident collaboration, role-scoped workspaces, integrations, workflow hooks, notifications and searchable operational history. | Strong optional collaboration adapter. Mattermost Team Edition core is MIT; add-ons and Enterprise features have separate licensing/terms. Keep AEGIS task and audit authority canonical; chat history is not the source of truth. |
| **Outline** | Markdown-compatible knowledge base, realtime collaborative editing, document collections, permissions, search, links and version history. | Valuable UX and knowledge workflow reference, but current Outline 1.10.1 is under BSL 1.1, not an OSI open-source licence; its additional grant excludes a commercial Document Service and its change date is 2030-09-09. Do not assume code reuse or hosted multi-tenant use is permitted. |
| **Plausible** | Privacy-preserving aggregate analytics, event goals, simple dashboards, low-footprint tracking, API exports and operational reporting. | Strong privacy-by-design reference. Community Edition is AGPL-3.0; tracker is MIT. Prefer AEGIS-native aggregate event schema and opt-in telemetry; avoid user-level profiling, fingerprinting and unnecessary third-party egress. |
| **Continue (continuedev/continue)** | IDE/CLI coding workflow, context selection, codebase retrieval, model/tool adapters, prompt/configuration and developer feedback loops. | Historical architecture reference only: repository README says it is no longer actively maintained and is read-only; final 2.0.0 line is Apache-2.0. Verify any successor before adoption. |
| **Roo Code (RooCodeInc/Roo-Code)** | Specialized modes (Architect, Ask, Code, Debug, Orchestrator), mode-specific tool access, custom modes, context mentions and explicit tool approvals. | Strong workflow-pattern reference, not an active dependency: repository was archived 15 May 2026 and the extension shut down. Apache-2.0. Rebuild the mode/permission model natively; do not inherit unmaintained code. |
| **SWE-agent** | Issue-to-patch loop, structured agent-computer interface, environment/tool observations, concise action feedback, configurable interaction loop and benchmark/evaluation harness. | MIT. Upstream recommends mini-SWE-agent for current development, as it supersedes SWE-agent and is simpler. Study the newer mini-SWE-agent path first. Cybersecurity modes are not permission to enable offensive activity in AEGIS. |
| **Plandex** | Long-task planning, plan/tell workflow, staged multi-file changes, context management, diff review and local/self-hosted operation. | Useful plan/implementation separation. Cloud service was winding down from 3 October 2025; local mode requires user-supplied model-provider credentials/API access. Do not make a paid API a core requirement. |
| **GPT Pilot** | Stepwise feature development, human checkpoints, incremental debugging, context selection and developer review rather than one-shot code generation. | **Do not install, run, or adopt.** Upstream disclosed a supply-chain credential-stealing worm in the repository from 24 Aug 2025 until 11 Jun 2026, and says the project is no longer maintained. Current licence is FSL-1.1-MIT with a Competing Use restriction until the applicable change date. Research only; treat historical commits and releases as hostile evidence. |
| **Tabby** | Self-hosted code completion, local/on-premise model serving, repository context, OpenAPI integration and low-infrastructure deployment. | Strong local-first coding-assistance reference. Verify current licence, model/runtime requirements, telemetry and resource use before any adapter or deployment. Avoid making GPU acceleration mandatory. |
| **Goose (aaif-goose/goose)** | General-purpose local agent, desktop/CLI/API surfaces, MCP extensions, ACP interoperability, portable YAML recipes, subagents, resumable state, sandbox mode and adversary review. | High-value architecture reference; Apache-2.0. Current upstream moved from block/goose to aaif-goose/goose under the Agentic AI Foundation. Study GDK/runtime boundaries and security controls; built-in sandbox or prompt-injection detection does not replace Sentinel. |

## Reverse-engineering opportunities for AEGIS

### 1. AEGIS Workbench (ToolJet-inspired)
- Build operational screens from AEGIS-owned page, component, query and action schemas.
- Use a visual editor over typed contracts; do not generate arbitrary executable UI logic by default.
- Data connectors are capability-scoped adapters. All reads/writes pass Sentinel, schema validation, row/field scoping and audit.
- Separate development, preview and production data contexts. Version every app definition and support diff/rollback.
- Agent-generated apps remain drafts until human review and policy validation.

### 2. Shared workspace and communication (Mattermost-inspired)
- Channels, threads, mentions, activity feeds, task-linked discussion and incident rooms.
- Link messages to canonical AEGIS task/run/resource IDs; messages are collaboration context, not instructions with authority.
- Notifications support opt-in, quiet hours, deduplication, rate limits, channel preferences and revocation.
- Preserve exportability and avoid vendor-specific lock-in.

### 3. Knowledge Forge (Outline-inspired)
- Markdown-first documents, collections, backlinks, version history, realtime collaboration and permission-aware search.
- Connect each knowledge item to source provenance, owner/workspace scope, confidence, temporal validity, supersession and retraction.
- Retrieved documents are untrusted evidence, never policy or executable instructions.
- Use native AEGIS storage/contracts; do not copy BSL code or assume Outline is an unrestricted open-source dependency.

### 4. Privacy-preserving observability (Plausible-inspired)
- Aggregate operational metrics: feature use, latency, error classes, task outcomes and opt-in product feedback.
- No covert analytics, persistent cross-site IDs, device fingerprinting, emotion inference or raw prompt capture by default.
- Define event minimisation, retention, sampling, export and user controls before adding tracking.
- Separate security audit records from product analytics; never aggregate away evidence needed for accountability.

### 5. AEGIS Forge — controlled coding workforce
Combine the strongest ideas from Continue, Roo, SWE-agent/mini-SWE-agent, Plandex, Tabby and Goose:
- **Architect:** read-only discovery, requirements, dependency graph and implementation plan.
- **Researcher:** source inspection, API/schema discovery, provenance and licence evidence.
- **Implementer:** scoped workspace/branch edits only.
- **Debugger:** reproduce, isolate, instrument and diagnose failures.
- **Test engineer:** test-first changes, focused regression tests, full verification.
- **Reviewer:** independent diff, security, licence, maintainability and acceptance review.
- **Orchestrator:** decomposes tasks and delegates bounded sub-tasks; cannot grant permissions.
- **Local coder:** optional local model/completion path with transparent device capability and cost limits.

Each role is a profile over one AEGIS agent contract, not an independent identity or authority. A task carries a bounded workspace, branch, allowed paths, tools, network policy, budget, deadline and cancellation token. Agent outputs are proposals until independently tested and reviewed.

### 6. Portable recipes and agent interoperability (Goose-inspired)
- Define versioned AEGIS workflow recipes with typed inputs/outputs, declared tools, preconditions, risk class and approval checkpoints.
- Support MCP/ACP as adapters, not the internal authority model.
- Recipes and imported skills are data until provenance, licence, static analysis and human review are complete.
- Parallel subagents get isolated workspaces and cannot write shared state or approve one another's actions.

## Mandatory security and autonomy boundaries

- Sentinel remains the sole policy authority. Agent modes, recipes, MCP servers, ACP peers, IDE plugins and UI buttons cannot self-authorise.
- No model/provider credential is placed in prompts, source files, logs, imported collections or workspace artifacts. Use short-lived server-side secret handles.
- Coding agents get no ambient host shell, unrestricted filesystem, Docker socket, arbitrary network or production credentials.
- Use isolated ephemeral workspaces, pinned dependencies, resource/time/output limits, network deny-by-default, secret redaction, cancellation and complete action receipts.
- Tool calls and file edits are individually scoped and audited. Approval binds to immutable task intent and exact resource scope; changed intent invalidates approval.
- Never let a coding agent merge PRs, deploy production, change access controls, rotate secrets or perform destructive operations without explicit user approval and fresh Sentinel authorisation.
- Prompt-injection detection and sandbox features from upstream projects are defence-in-depth only, not security guarantees.
- GPT Pilot remains a hard exclusion pending independent incident review; do not run old releases or assume the cleaned current branch makes historical versions safe.

## Suggested build sequence

1. **Forge contracts:** agent profile, task plan, workspace, tool request, patch proposal, test evidence, review result and execution receipt.
2. **Read-only code intelligence:** repository map, symbol/reference search, dependency graph, test discovery and bounded context retrieval.
3. **Plan/diff workflow:** task decomposition, staged patch proposals, preview and human approval.
4. **Isolated implementation worker:** scoped branch/worktree, deny-by-default egress, resource limits and cancellation.
5. **Test and review gates:** TDD, focused regression, full suite, independent diff/security review and evidence capture.
6. **Workspace/Knowledge UI:** task-linked docs, discussions, dashboards and app builder over AEGIS contracts.
7. **Opt-in analytics:** aggregate metrics with privacy/retention controls.
8. **Optional adapters:** Mattermost, ToolJet, local model/completion and ACP/MCP interoperability only when a concrete user need justifies them.

## Verification status and open work

- Research was performed against public upstream README, licence and project documentation pages on 17 November 2026.
- This is an initial screen, not a complete legal review, code audit, dependency audit, reproducible-build check or security certification.
- Exact version/commit pins, full dependency licences, telemetry defaults, threat models, release cadence and self-hosted edition limits still require per-project inspection before adoption.
- No source code was cloned, executed, installed or incorporated in this research batch.
- GPT Pilot's published supply-chain incident is a blocking security finding, not a routine caveat.
- No new agent execution path, external service connection, analytics tracker or workspace platform was enabled by this research.
