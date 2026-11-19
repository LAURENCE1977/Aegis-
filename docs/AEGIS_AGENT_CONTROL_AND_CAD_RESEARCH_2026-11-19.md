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
