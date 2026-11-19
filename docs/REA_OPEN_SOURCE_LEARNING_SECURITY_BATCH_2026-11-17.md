# REA — Open-source resource, learning and security-agent batch

Date: 17 November 2026  
Status: initial repository identity and metadata verification; deeper source review required  
Decision: **catalogue and selectively adapt concepts; do not install or execute any candidate**

This record extends the AEGIS Forge research pipeline. Repository metadata is a discovery signal, not a substitute for reviewing the exact pinned source revision, full licence text, dependency tree, security posture and runtime behaviour.

## AEGIS constraints applied

- AEGIS owns identity, task state, memory, orchestration, Sentinel policy, approvals, execution boundaries and audit.
- No candidate receives ambient shell, host filesystem, Docker socket, browser session, provider credential or unrestricted network access.
- Offensive-security functions are disabled by default and may only operate against explicitly authorised, narrowly scoped targets.
- No repository source is executed, installed, built or accepted as knowledge during discovery.
- Unknown, non-commercial or copyleft obligations are quarantined until a component-specific legal and architecture review is complete.
- Free-tier listings are not treated as guarantees: availability, quotas, geography, eligibility and terms can change.

## Candidate register

| Candidate | Canonical repository | Metadata observed 17 Nov 2026 | Initial decision |
|---|---|---|---|
| Free-for-dev | https://github.com/ripienaar/free-for-dev | Licence API field returned null; verify root licence and each linked service's terms independently | Read-only resource catalogue source; no runtime dependency |
| OSSU Computer Science | https://github.com/ossu/computer-science | MIT; active repository | Adapt curriculum structure and learning-path concepts; preserve attribution if content is reused |
| Awesome Selfhosted | https://github.com/awesome-selfhosted/awesome-selfhosted | API reports NOASSERTION; inspect repository licence and item-level licences | Metadata discovery only until rights are established; do not bulk-copy catalogue content |
| ARTEX | https://github.com/BaaRai/ARTEX | AGPL-3.0; repository description identifies it as an autonomous penetration-testing system and names Autumn-27/ARTEX as upstream | Security research only; no code reuse in MIT core without a separate compatibility decision; inspect provenance, forks and offensive capabilities |
| Cairn | https://github.com/oritera/Cairn | AGPL-3.0; described as a general-purpose AI state-space search engine initially validated on autonomous penetration testing | Study search/planning algorithms; no code reuse in MIT core without separate compatibility decision; never grant ambient execution |
| PentAGI | https://github.com/vxcontrol/pentagi | MIT | High-priority architecture study; isolate workers and independently review Docker, network, browser and credential boundaries |
| PentestGPT | https://github.com/GreyDGL/PentestGPT | MIT | Study human-guided task planning and structured security reasoning; verify current provider requirements and execution boundaries |
| Strix | https://github.com/usestrix/strix | Apache-2.0 | High-priority vulnerability discovery and evidence-validation study; review each dependency and scanner capability before any isolated prototype |
| CyberStrikeAI | https://github.com/AIPentest/CyberStrikeAI | Apache-2.0 | Study Go/Eino, MCP, RAG, role/skill and governed-execution patterns; C2 and offensive executor components are quarantined from AEGIS |

Metadata was obtained from the GitHub repository API on the date above. The `updated_at` field is not proof of meaningful maintenance, review quality or release stability. Free-for-dev and Awesome Selfhosted do not have a confirmed SPDX licence in the repository API response; do not infer permission from their popularity or README contents.

## Extractable AEGIS-native capabilities

### 1. Resource Intelligence

Build an AEGIS-owned, provenance-aware catalogue rather than making either list a runtime dependency.

Candidate record fields:
- canonical source URL, immutable commit or release, retrieval time and maintainer;
- repository licence and item-level licence/terms where applicable;
- service category, self-hosting status, free-tier limits, geography and eligibility;
- data handling, retention, telemetry, account requirement and egress;
- hosting/runtime requirements, resource footprint and portability;
- last verification time, evidence URL, reviewer and confidence;
- status: discovered, inspecting, verified, stale, rejected or superseded.

A free-tier claim expires into a stale/unverified state unless periodically rechecked. Never describe a service as permanently free based only on a directory entry.

### 2. Learning and mastery

Adapt OSSU's structured progression, prerequisites and project-based learning into a user-controlled learning graph:
- skills and concepts have explicit prerequisites and learning outcomes;
- lessons link to original sources and licence/attribution details;
- mastery requires evidence such as an exercise, explanation or project, not merely time spent;
- users can skip, revise or export their pathway;
- no learning score is used to infer sensitive traits or restrict unrelated capabilities.

### 3. Goal-directed planning and multi-agent coordination

Study ARTEX/Cairn/PentAGI for decomposition, state-space exploration, planner/worker separation, shared task state, supervision, retry/recovery and evidence aggregation.

Rebuild only the generic coordination mechanisms behind AEGIS contracts. Every worker receives a bounded task envelope and returns a typed result plus provenance. Workers cannot alter policy, grant permissions, approve their own work or rewrite audit history.

### 4. Authorised security assessment

Study PentestGPT, Strix, PentAGI and CyberStrikeAI for asset discovery, test planning, source-aware findings, validation and reproducible evidence.

The AEGIS security assessment contract must require:
- an authenticated owner or delegated authority;
- exact target identifiers and allowed test classes;
- explicit expiry, rate and resource budgets;
- deny-by-default network egress and no lateral movement;
- isolated disposable workers with no host control socket;
- approval for intrusive tests and any externally consequential action;
- immutable audit lineage and reproducible evidence;
- safe stop, cancellation, cleanup and finding disclosure workflow.

No autonomous exploitation, persistence, credential harvesting, command-and-control, stealth or testing of third-party targets is enabled by this research record.

## Priority and next gates

1. **P0 — Source and licence verification:** inspect exact pinned revisions, licence texts, NOTICE files, dependency licences, releases, advisories and maintainer history. Resolve ARTEX upstream/fork identity. Verify Awesome Selfhosted and Free-for-dev redistribution rights.
2. **P1 — Resource Intelligence schema:** design pure validators and fixtures for provenance, licence state, free-tier claims, expiry and stale status. Keep external entries untrusted data.
3. **P1 — Learning graph model:** define portable curriculum, prerequisite, exercise and mastery evidence contracts. Avoid copying course content before rights review.
4. **P1 — Security worker threat model:** specify worker isolation, egress, resource limits, target scope, approval, cancellation and evidence receipt before prototyping scanners.
5. **P2 — Comparative architecture benchmark:** compare planner/worker recovery and evidence quality using synthetic, non-networked fixtures.
6. **P2 — Isolated prototype:** only after licence and threat-model gates pass; no production route or permission expansion by default.

## Explicit non-decisions

- No candidate has been installed or integrated.
- No licence compatibility has been approved for code reuse.
- No autonomous penetration testing has been enabled.
- No free-tier service has been certified as currently available or permanently free.
- No source repository has been declared safe based on README claims or repository metadata alone.

## Primary sources

- https://github.com/ripienaar/free-for-dev
- https://github.com/ossu/computer-science
- https://github.com/awesome-selfhosted/awesome-selfhosted
- https://github.com/BaaRai/ARTEX
- https://github.com/oritera/Cairn
- https://github.com/vxcontrol/pentagi
- https://github.com/GreyDGL/PentestGPT
- https://github.com/usestrix/strix
- https://github.com/AIPentest/CyberStrikeAI
