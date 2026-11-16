# AEGIS connected GitHub repository inventory

Reviewed: 16 November 2026  
Account inventory: 9 repositories returned by the connected GitHub account listing.

This inventory identifies which repositories can contribute to AEGIS. It is a reuse triage, not a claim that every repository has received a full code or security audit.

| Repository | What it contains / review level | AEGIS decision |
|---|---|---|
| `LAURENCE1977/Aegis-` | Main AEGIS project and current build target | **Primary source of truth.** Preserve existing architecture and continue changes on reviewed feature branches. |
| `LAURENCE1977/auto-browser` | Browser automation/controller, session isolation, raw CDP policy, PII inspection, encrypted auth state and Witness receipts. Source-level review documented separately. | **Best browser-worker reference.** Do not embed its current Docker setup unchanged: Docker socket, root browser image, disabled Chromium sandbox, shared network and unauthenticated internal Playwright endpoint need hardening. |
| `LAURENCE1977/openclaw` | Large agent gateway/device integration project. README and licence reviewed in the external-platform review. | **Architecture reference only.** Reuse gateway/device concepts selectively; do not import a second agent runtime or let it replace Sentinel. |
| `LAURENCE1977/G0DM0D3` | Agent/model evaluation and privacy-oriented UX patterns. Licence reviewed as AGPL-3.0. | **Patterns only unless AGPL obligations are deliberately accepted.** Do not copy code into the proprietary AEGIS core without a licence decision. |
| `LAURENCE1977/3D-Website-Builder` | React/Three.js 3D website/portfolio builder source. No root README or licence file was found in the inspected root. | **Low priority.** It may inform optional visual/site-generation experiments, but it does not solve AEGIS backend, workspace, provider or security needs. No source reuse until ownership/licence is clarified. |
| `LAURENCE1977/charlieautomatesskills` | Collection of agent/automation skills attributed in its README to Charles Dove. No root licence file was found in the inspected root. | **Workflow inspiration only.** Do not install or copy the skills as project code until provenance and licence are confirmed. AEGIS already has its own durable task and Sentinel model. |
| `LAURENCE1977/storied-gecko-09ca7c` | Root is dominated by a single approximately 3.8 MB HTML artifact; no useful README/source-module structure was visible in the inventory pass. | **Not a current AEGIS dependency.** Too opaque to maintain or safely dissect without recovering the original source project and its licence. |
| `LAURENCE1977/storie-audio-lab-store-checker` | Single large HTML app artifact, no modular backend/source structure visible in the inventory pass. | **Business-specific, not core AEGIS.** Could be revisited later as a business-agent example, but should not be merged into the universal workspace. |
| `LAURENCE1977/storie-audio-lab-3` | Empty repository in the current root listing. | **No reusable implementation found.** |

## Rune lookup

No repository named `Rune` appears in the nine-repository account inventory. Two public projects with that name were identified:
- `CorvidLabs/rune`: MIT-licensed Ruby PTY runner with persistent CLI/TUI sessions and human attach/detach. It is the stronger AEGIS candidate for a future isolated terminal worker. Its environment inheritance, lack of OS sandboxing, local-only session trust model and fail-open chmod handling are documented in `AEGIS_RUNE_REVIEW.md`.
- `morinokami/rune`: separate TypeScript CLI framework, described as experimental; not the same project and not the preferred execution worker.

## Priority order

1. Keep AEGIS itself as the sole product/runtime authority.
2. Complete the Composio integration behind Sentinel (separate draft implementation PR).
3. Design a hardened, separate browser worker using auto-browser as a reference.
4. Consider CorvidLabs/rune for a separate terminal/PTy worker only when a trusted Linux execution host exists.
5. Revisit OpenClaw/G0DM0D3 only for specific gaps; do not add parallel orchestration stacks.
6. Keep the remaining repositories outside the core until a concrete capability and licence-safe source boundary is identified.

## Review limits

The inventory used the connected account's repository list, root directory listings, available READMEs, licences and selected source paths. The single-file HTML artifacts were not reverse-engineered. No repository was copied, installed, built or deployed as part of this inventory.
