# AEGIS agent-control and text-to-CAD research — 2026-11-19

## Purpose

Follow up the user's request to investigate T3 Code and text-to-CAD projects for possible use in AEGIS. This is a source/licence/architecture review, not an installation or security certification. The goal is to extract compatible interfaces and ideas without replacing AEGIS or importing whole platforms.

## 1. T3 Code — pingdotgg/t3code

- Repository: https://github.com/pingdotgg/t3code
- Licence: MIT; verified from the repository's root LICENSE file.
- Product: a host-run control plane for coding agents, with web, desktop, iOS and Android clients.
- Supported agent examples include Claude Code, Codex, Cursor, OpenCode and ACP-compatible agents.
- The host environment owns provider processes, terminals, Git operations and project files. Clients communicate with it over authenticated RPC/WebSocket.
- T3 Code also exposes an MCP server for outside agents. Its documentation explicitly includes ChatGPT and Claude Code as possible external MCP clients. Access is approved by the owner and can be read-only or limited by a selected permission-mode ceiling.
- It uses agents already installed and authenticated on the host; it does not bundle or resell model tokens. Codex CLI and Claude Code use their own sign-in flows.
- Remote clients can connect through T3 Connect or a private network, but the host machine must remain running and reachable.

### Security and platform caveats

- The documented initial default permission mode is **Full access**. T3 Code also offers Supervised, Auto-accept edits and Auto modes. AEGIS must not inherit Full access as a default.
- A worktree is not a security sandbox. Filesystem, process and network authority still belongs to the host runtime.
- T3 Connect and MCP grants are separate trust boundaries. A hosted MCP client such as ChatGPT can receive access to a host environment only after the owner approves the named audience and grant.
- T3 Code is a substantial TypeScript monorepo with desktop/mobile clients and a host runtime. Wholesale import would duplicate AEGIS's Control Centre, orchestration and policy layers.
- It is not a zero-host cloud service: a compatible Windows/Linux/macOS host and installed agent CLIs are required. The phone/web client is a remote control surface, not the execution host.

### AEGIS decision

**High-value architecture reference; do not embed the full application.**

Adapt selectively:
1. Provider/agent adapters behind a normalized AEGIS worker contract.
2. One host-owned execution environment with browser/mobile clients as control surfaces.
3. MCP as a narrow, separately authenticated outside-agent interface.
4. Thread/task-scoped permissions and explicit read-only versus supervised grants.
5. Durable run/turn receipts and project-local worktree isolation, while remembering that worktrees are not hostile-code sandboxes.

AEGIS remains the authority for project identity, task state, Sentinel, exact capability grants, approval, budgets, secret custody and audit. Any future T3-compatible worker must run outside the Cloudflare control plane in a separately isolated environment with filesystem and network restrictions. Default to read-only planning and supervised execution; never allow an agent to widen its own grant.

No T3 Code installation, account connection, MCP pairing, credential transfer or repository import was performed.

## 2. Text-to-CAD — earthtojake/text-to-cad

- Repository: https://github.com/earthtojake/text-to-cad
- Licence: MIT; verified from the repository's root LICENSE file.
- Product: an agent skill/toolchain for designing physical parts and assemblies from natural-language requirements.
- Core geometry path: Python scripts using build123d and OpenCASCADE (OCCT).
- Outputs include STEP, STL, 3MF, GLB and DXF. The skill set also covers engineering drawings, manufacturing checks, finite-element stress checks, robotics/simulation descriptions and rendering workflows.
- It integrates with several coding-agent CLIs and skill/plugin systems. The agent writes Python model scripts; the local CAD command/server runs them and provides a viewer.
- The documented installer targets macOS/Linux and Windows. It installs a local Python/uv-based CAD command and agent integrations; this is not a browser-only or iPad/Chromebook-native service. The official install guide reports the CAD kernel environment is downloaded on first use (about 240 MB download / 620 MB disk).

### Security and platform caveats

- Agent-authored Python model scripts are executed by the CAD runtime. Treat generated scripts and imported CAD files as untrusted. AEGIS must not execute them in its Cloudflare control plane or in a privileged application process.
- A production AEGIS adapter would need a dedicated disposable worker, bounded CPU/memory/time/disk, no ambient credentials, restricted egress, per-job filesystem isolation, explicit user approval before export or external fabrication actions, and cleanup evidence.
- CAD kernel/native dependencies and rendering requirements make this a heavier specialist worker than a lightweight browser UI. It is not a suitable mandatory dependency for every AEGIS user or session.
- The README says usage statistics and crash reports are sent by default with a random identifier, while excluding files, paths and prompts. AEGIS must surface this disclosure and review opt-out controls before adopting the worker.
- Fabrication services, CNC/printing providers and any model/image inputs require separate consent, provenance, licensing and data-transfer checks.

### AEGIS decision

**Strong optional specialist capability; adapt the skill/job contract, not the whole runtime.**

A future CAD Forge adapter could accept a structured design brief, material/process constraints and bounded references, then return a validated artifact bundle (native script, STEP/GLB/STL/DXF, measurements, checks, provenance and worker receipt). Keep model generation, geometry execution and manufacturing checks in an isolated worker. The browser workspace should display previews and evidence without executing the source script.

Do not make this a core dependency until an affordable, persistent Linux/Windows worker and mobile-compatible artifact review path are available.

No package, CAD kernel, agent plugin, model script or fabrication service was installed or run.

## 3. Amagine3D — amagine-ai/Amagine3D

- Repository: https://github.com/amagine-ai/Amagine3D
- Licence: Apache-2.0; verified from the root LICENSE.
- Focus: hardware enclosures and assemblies generated from product requirements, reference images, dimensions and internal component geometry.
- Uses editable Python/build123d source and BRep geometry, with STEP/STL/3MF export. Its documented workflow includes measured wall thickness, fit/clearance, collision and manufacturing checks.
- The current README specifies Node.js 22.19+, Python 3.10–3.13, npm, a modern desktop browser and an OpenAI Responses-compatible model gateway. It describes a local Express API (default loopback port 6161), a browser workbench and a local Python environment containing build123d/OCP and related geometry libraries. This is a browser-facing local application, not a hosted cloud CAD service; it also needs a configured model API/gateway.

### AEGIS decision

**Useful secondary architecture reference for a future Hardware/CAD Studio.** Its requirements-first design flow, semantic scene, geometry evidence and export readback are valuable. It has a browser workbench, but the documented setup still requires a local Node/Python server and model gateway; it is not a hosted AEGIS feature or a proven mobile workflow. Do not import its runtime or execute its generated code in the AEGIS control plane.

No code or dependencies were imported or run.

## 4. CADAM — Adam-CAD/CADAM

- Repository: https://github.com/Adam-CAD/CADAM
- Licence: GPL-3.0; verified from the repository's LICENSE file.
- Product: a browser-based text-to-CAD application using OpenSCAD WebAssembly, Three.js preview, React and Supabase. It advertises natural-language and image-guided generation, parametric controls and STL/SCAD/DXF exports.

### AEGIS decision

**UX and workflow reference only.** Its browser preview and parameter-control patterns are worth studying. Do not copy its source into AEGIS's MIT-licensed codebase without a deliberate copyleft/licensing decision. Its React/Supabase/OpenSCAD stack is not a reason to replace AEGIS's existing architecture.

No code or dependencies were imported or run.

## 5. Combined architecture decision

The candidates complement each other but should not become one bundled runtime:

- **AEGIS:** canonical workspace, provider routing, durable jobs, Forge, Sentinel, approvals, secrets, budgets, provenance and audit.
- **T3 Code-style worker control:** optional remote execution host and MCP/ACP worker adapters; never the authority for AEGIS permissions.
- **Text-to-CAD/Amagine3D:** optional CAD worker capability behind a typed job/artifact contract.
- **CADAM:** browser interaction and parametric-preview research only.

Recommended sequence:
1. Finish and review the existing AEGIS worker/approval/audit foundations.
2. Define one provider-neutral worker contract and test it with a harmless, read-only adapter before any shell or CAD execution.
3. Define a CAD job manifest and artifact/evidence receipt without adding a CAD runtime dependency.
4. Prototype in a disposable worker with no secrets and no network egress; measure resource use and mobile preview compatibility.
5. Keep all external fabrication, purchasing, publishing and deployment actions behind separate explicit approvals.

## Sources inspected

- T3 Code README, LICENSE, internals overview, permission modes, outside-agent MCP guide, remote-access guide, environment-auth and provider-constraints documentation.
- text-to-cad README, LICENSE, AGENTS.md, pyproject.toml, CAD skill definition and contributing guidance.
- Amagine3D README and LICENSE.
- CADAM README, package.json and LICENSE.

This review did not install, run, connect, copy or deploy any candidate. Licence verification is limited to the checked repository LICENSE files and does not replace review of transitive dependencies, assets or any later version.


## 1A. Ghost identity check — multiple unrelated repositories share this name

The Instagram reference is not conclusively identified from the public evidence retrieved. The creator attribution to Robert Guiterraz was not independently verified. Do not treat any one of these repositories as the Reel's project without a direct Reel link or matching screenshot.

### [ghostapp-ai/ghost](https://github.com/ghostapp-ai/ghost) — likely meaning of "Ghost platform"

- GitHub metadata currently reports `NOASSERTION`, but the inspected root `LICENSE` and `package.json` explicitly state MIT. The root licence reserves any `pro/` directory, if present, to a separate `pro/LICENSE`; no top-level `pro/` directory was present in the inspected 319-entry recursive tree.
- The inspected recursive Git tree contained 319 entries and was not truncated. The repository is a Tauri v2 + Rust + React application; the root README and core source files, product/roadmap/security documents, Cargo manifest and package manifest were inspected.
- Product direction: local-first "Agent OS" with file indexing, FTS5/vector search, native Candle embeddings, local Qwen GGUF chat/agent inference, ReAct tool calling, MCP client/server, AG-UI, A2UI and A2A. The app advertises Windows/macOS/Linux/Android releases and says iOS is "ready", but the README's download table has no iOS release.
- The README's "zero cloud" claim needs a qualification: the first-run model download is from Hugging Face over HTTPS; optional Ollama is localhost; MCP servers may themselves be remote/external. Its Security document describes zero telemetry and only Hugging Face first-run model download plus localhost Ollama as network exceptions.
- Pricing is not simply "everything free": the inspected PRODUCT.md describes Free ($0), Pro ($8/month) and Teams ($15/user/month), with semantic search, full MCP catalogue and team capabilities listed as paid tiers. The main application licence is MIT; feature availability/pricing is a separate product decision.
- The native agent uses local Qwen model tiers, with a ReAct loop and bounded iteration/tool-call limits. Its agent configuration defaults `auto_approve_safe=true`; code classifies read-only built-ins as Safe, ordinary file writes as Moderate, and shell commands as Dangerous (always approval-required). Sensitive path detection is substring-based and external MCP tool risk is heuristic. This is not a substitute for AEGIS's exact capability/resource/scope/connection/approval policy.
- The MCP catalogue can install runtimes and configure/connect third-party MCP servers. That is a supply-chain and execution boundary: no one-click install or auto-connect should be copied into AEGIS without pinned packages, verified provenance/licences, isolated execution, least privilege, egress policy, secret custody and explicit approval.
- AEGIS decision: **high-value architecture reference, not a replacement for AEGIS and not yet an adopted dependency**. Study the local model fallback chain, hybrid local search, protocol adapters and capability discovery UX. Retain AEGIS as the canonical project/workspace, memory, task ledger, Sentinel, approval, secrets and audit authority. The Android release could be a research option; no evidence yet establishes reliable ChromeOS/iPad browser compatibility or suitability for this user's iPad hardware. Do not install it or move user data into it as part of this research.

### [NORTHTEKDevs/ghost](https://github.com/NORTHTEKDevs/ghost) — desktop computer-use tool, not the same app

- Root LICENSE is MIT. The inspected recursive tree contained 345 entries and was not truncated; README, SECURITY.md, Cargo workspace manifest, MCP server, HTTP server, shell/session code, focus policy, audit and doctor implementation were inspected.
- Provides local MCP stdio, CLI and REST control for native Windows/Linux desktop apps, windows, browser tabs and terminal sessions. Its purpose is verified desktop automation, not a unified ChatGPT/Claude account cockpit.
- Security policy says the MCP server is stdio-only; the HTTP server binds `127.0.0.1:7878` by default and has **no authentication**. The address can be changed, so exposing it to a network would hand desktop control to anyone who can reach it. The shell can run arbitrary commands and can be disabled with `GHOST_SHELL=off`.
- Its default background-focus policy, independent foreground-interference audit, explicit emergency stop and action verification are useful design patterns. AEGIS should adopt the concepts of verified action receipts, observable state, foreground safety and a global stop control, not grant the tool broad desktop authority.
- AEGIS decision: **use as a reference for a future opt-in, separately isolated desktop worker**. It is not a browser-only service and is not directly usable from an iPad or phone without a supported Windows/Linux host. No binary, service, MCP server or shell was installed or run.

### [zruss11/Phantom](https://github.com/zruss11/Phantom) — closest match to "Claude and ChatGPT in one platform"

- README describes one desktop cockpit for running Claude Code, Codex, Amp and OpenCode simultaneously, with unified ChatGPT subscription and Claude Code OAuth sign-in, parallel tasks, per-task Git worktrees, shared context, usage tracking and a local MCP server.
- The inspected recursive tree contained 3,075 entries and was not truncated. README, MCP guide and Rust backend/Tauri manifests were inspected. The README's download table lists macOS Apple Silicon and Intel only. It requires installed coding-agent CLIs.
- No root LICENSE file was present at the inspected default branch. Public source visibility is not an open-source licence; **do not copy, bundle or adapt its code** unless an explicit licence is added and reviewed.
- Its worktrees provide task-level Git separation, not a security sandbox. Its local MCP server is documented as loopback-only with a bearer token and optional project allowlist; its tools include task/workspace deletion, so access still needs a strict owner-controlled boundary.
- AEGIS decision: **strong product/workflow reference for the exact multi-agent cockpit idea, but not a usable or approved dependency**. It is macOS-only in the inspected release instructions and has no verified licence. AEGIS can implement the useful UX natively: provider/agent selection, parallel task views, task-linked context, usage/cost visibility and local MCP control, while retaining AEGIS Sentinel and its own worker isolation.

### [CryptoDmitry/Ghost-Agent](https://github.com/CryptoDmitry/Ghost-Agent) — identity/provenance mismatch

- GitHub metadata and root LICENSE report MIT, and the recursive tree contained 82 entries without truncation.
- The current README describes a Coreon MCP execution engine and points to a separate Coreon repository/branch. However, `package.json` names the package `ralph-claude-code` and points its repository metadata to `frankbria/ralph-claude-code`; the implementation status document also describes Ralph CLI loops. This is a material project identity/provenance mismatch.
- AEGIS decision: **quarantine from adoption until upstream identity, current source lineage, package metadata and actual purpose are reconciled**. Do not assume it is the Instagram Ghost or use its README as reliable evidence.

### Overall Ghost conclusion

The public evidence points to several different products:
- `ghostapp-ai/ghost`: local-first private Agent OS, MIT code, Free/Pro/Teams product tiers.
- `NORTHTEKDevs/ghost`: local Windows/Linux computer-use MCP/CLI/HTTP worker, MIT.
- `Phantom`: closest explicit ChatGPT + Claude Code cockpit, but macOS-only in README and no licence file found.
- `CryptoDmitry/Ghost-Agent`: MIT-labelled repository with inconsistent README/package/source identity.

The exact Robert Guiterraz Reel cannot be conclusively matched without its URL or a screenshot. The safest AEGIS direction is to combine the *ideas* — provider-neutral agent cockpit, local-first memory/search, optional desktop computer-use worker, MCP/ACP interoperability and task-linked shared context — under AEGIS's existing policy and execution architecture. Do not import any of these whole applications or expose a desktop-control server over the public network.

No Ghost/Phantom package, binary, model, local agent, MCP server, credentials or service was installed, connected, run or deployed.


## 6. OpenHands, OpenCode and Orca — coding-agent workflow candidates

### [OpenHands Agent Canvas](https://github.com/OpenHands/OpenHands)

- Root licence and package metadata: MIT. Inspected recursive tree: 3,277 entries, not truncated. Reviewed README, package manifest, Dockerfile, self-hosting guide, cloud sandbox/runtime services, MCP service, credential validation and secret-redaction code.
- Current repository is the **Agent Canvas** self-hosted developer control centre. It can run OpenHands, Claude Code, Codex, Gemini CLI, Pi, OpenCode or any ACP-compatible agent, with local, Docker, VM, remote and optional cloud backends. The browser UI can switch backends while preserving conversations.
- Local install requires Node.js 24+ and `uv`; Docker is the safer documented path for an execution sandbox. A no-sandbox install runs the agent server directly as the host user and has full filesystem access. Self-hosting guidance explicitly says the agent can read/write files, execute shell commands and reach the network; the host must be protected like a machine containing production credentials.
- The self-hosting guide recommends firewall-deny by default, loopback-bound internal services, TLS reverse proxy, a random `LOCAL_BACKEND_API_KEY` and public mode so the key is not baked into the browser bundle. It also documents a same-origin localStorage exposure risk from the bundled editor path; path-prefix routing is not isolation.
- MCP implementation includes server test/health checks, read-only credential probes for known integrations, OAuth status handling, credential redaction and explicit distinction between connectivity-only and verified health.
- AEGIS decision: **strong architecture reference for a future remote agent-worker service and ACP backend registry**. Adapt the separation between browser control surface and host-owned runtime, backend switching, runtime health and secret-redacted MCP connection tests. Do not import the whole React/Electron app or let it become AEGIS's policy authority. AEGIS must require an isolated worker, not rely on UI prompts or a Git worktree as a sandbox. No runtime was installed or launched.

### [OpenCode](https://github.com/anomalyco/opencode)

- Root licence and package metadata: MIT. Inspected recursive tree: 12,697 entries, not truncated. Reviewed README, LICENSE, SECURITY.md, the canonical tool runtime and its tests, MCP connection state machine and MCP configuration UI.
- OpenCode is an open-source coding-agent CLI with a desktop beta for macOS, Windows and Linux. Its README describes a build agent (full access) and a plan agent (read-only, asks before bash). It has an extensible tool runtime, provider protocols and MCP connections.
- Its own SECURITY.md is explicit: **there is no sandbox**. The permission system is a user-awareness/confirmation feature, not security isolation. Server mode is opt-in and unauthenticated unless `OPENCODE_SERVER_PASSWORD` is set. It recommends Docker or a VM when true isolation is needed.
- AEGIS decision: **valuable optional coding-agent backend and tool/MCP architecture reference**, not a security boundary. AEGIS can support OpenCode behind a future ACP/worker adapter, but must retain its own exact grants, approval, sandbox, budget and audit. Do not run OpenCode with ambient AEGIS credentials or production filesystem/network access.

### [VirtusLab/orca](https://github.com/VirtusLab/orca) — deterministic agentic development flows

- Licence: Apache-2.0. Inspected recursive tree: 1,091 entries, not truncated. Reviewed README, LICENSE and AGENTS.md architecture instructions.
- A CLI and Scala 3 flow-as-code library for deterministic, resumable development workflows. It can orchestrate Claude, Codex, OpenCode, Pi and Gemini backends. Its built-in implement flow creates a feature branch, plans tasks, implements each task, runs per-task review/fix and final review, commits each completed stage and can resume after interruption from the last committed stage.
- Its AGENTS.md documents an unusually useful capability split: `InStage` gates agent runs and `WorkspaceWrite` gates Git/filesystem/PR writes; workspace-write authority is designed not to cross concurrent fork boundaries. The production minting door is narrow, with compile-time capture checking only partially enabled and runtime thread checks covering the rest.
- Critical caveat: README says coding-agent tool usage is auto-approved by default, so write-capable turns can edit files and run shell without prompting. It explicitly requires a sandbox such as Docker/VPS/Sandcat or narrower agent tools. It is designed for one developer, not a multi-tenant service.
- AEGIS decision: **excellent architecture pattern reference for durable stage orchestration, task-level review, resumable progress and separation of model-execution authority from workspace-write authority**. Re-express those concepts in AEGIS-native job/step envelopes and Sentinel grants; do not adopt its default auto-approval or run its CLI on the AEGIS control plane.

### [cold-atom/Orca](https://github.com/cold-atom/Orca) — Godot-specific safety-first editor agent

- Licence: MIT. Inspected recursive tree: 516 entries, not truncated. Reviewed README, SECURITY.md, ORCA.md and plugin README.
- This is a Godot editor plugin, not the VirtusLab CLI. Plan mode is read-only; Work mode defaults to review edits with Apply/Reject, hash-bound proposals, stale-state checks, diffs and conflict-checked Revert. Auto-apply is scoped to bounded project scripts; scene/config changes retain review. It supports local models through Ollama/LM Studio/OpenAI-compatible servers and optional exact-project MCP connections.
- The 1.9.0 Blender Asset Studio work is a release candidate, not the latest published release; the README states 1.8.0 remains the published release. SECURITY.md describes typed, hash-bound native operations, exact project/live-session approvals, process ownership and bounded preview decoding; it also states the user-trusted editor/workspace is not a security sandbox.
- AEGIS decision: **strong reference for review-first UI, hash-bound change proposals, revert/recovery, scoped Auto apply and native editor integration**, but Godot-specific and not a general agent runtime. No plugin or native helper was installed.

### [Hyper-Int/OrcaBot](https://github.com/Hyper-Int/OrcaBot) and [BuildContext/orca-mcp](https://github.com/BuildContext/orca-mcp)

- OrcaBot describes itself as web-based agentic coding orchestration; its inspected tree has 1,067 entries and a third-party licence inventory, but no root project licence was found. Treat the project as **no licence grant / no code reuse** until the owner supplies one. Its third-party inventory includes components under MIT, BSD-2-Clause, Apache-2.0, AGPL-3.0-or-later and proprietary terms, so bundling its environment would require a full component-level review.
- `BuildContext/orca-mcp` is MIT and has 106 tree entries, but it is a separate community MCP bridge for the **stablyai/orca** IDE, not VirtusLab/orca. Its README and SECURITY.md call it an RCE-class bridge: it runs with host-user privileges, has no OS/filesystem/network sandbox, and its toolsets default open (including admin/raw CLI). Its HTTP mode binds loopback and uses token/OAuth controls, but those do not isolate the host.
- AEGIS decision: OrcaBot is held for licensing; orca-mcp is a threat-model reference only. Do not connect either to AEGIS or expose host-control MCP to untrusted callers.

## 7. Combined agent architecture decision

The strongest ideas now converge:
- **OpenHands Agent Canvas:** browser control surface, remote backends and ACP-compatible agent workers.
- **OpenCode:** practical multi-provider coding agent and MCP tool lifecycle.
- **VirtusLab/orca:** deterministic, resumable stage workflows and separate agent-run versus workspace-write capabilities.
- **cold-atom/Orca:** hash-bound review/apply/revert and scoped automation UX.
- **T3 Code:** host-owned terminal/agent process management and separately approved MCP access.
- **AEGIS:** sole owner of identity, project truth, canonical job/step state, exact grants, Sentinel, approvals, secret custody, cost ceilings, evidence and audit.

Recommended implementation direction: define one AEGIS worker/ACP contract, run workers in disposable isolated environments, and keep all writes and external effects behind Sentinel. A Git worktree, a prompt-level permission setting or an MCP bearer token is not a sandbox. No whole application should be imported; adopt narrow interfaces and independently authored AEGIS implementations.
