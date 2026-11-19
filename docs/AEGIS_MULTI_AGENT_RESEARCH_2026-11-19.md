# AEGIS multi-agent and open-source research — 2026-11-19

## Scope and method

This scan follows the request to inspect GHOST-related GitHub projects and other relevant Open* projects. I inspected recursive Git trees (not just landing pages), project READMEs, licence files, dependency manifests, architecture/security documentation, and selected implementation files. Recursive tree results were complete (not truncated) for the repositories listed below.

This is an architecture/reuse assessment, not a formal security audit. No third-party code or dependencies were imported.

## 1. GHOST — RusbehAbtahi/GHOST

Repository: https://github.com/RusbehAbtahi/GHOST  
Recursive tree: 772 entries; not truncated.  
Licence: **PolyForm Noncommercial 1.0.0** (verified from the repository's LICENSE file).  
Main stack: Python, Streamlit, MCP, Chroma, sentence-transformers, PyTorch, AWS SDK.

### Why it matches the Reel

The README explicitly describes the near-term multi-client design with ChatGPT as **Requirements Manager and Architect**, Claude as **Coder and Tester**, and GHOST as the shared coordination layer. It describes an MCP interface, a GHOST Workbench/Blackboard, actor-specific context, persistent memory, and deterministic orchestration.

### What is actually implemented versus planned

- The repository has a substantial existing Python application: agent pipeline, preprocessing, retrieval/reranking, memory, Skills, CLI, MCP tools, and AWS runtime-control components.
- The MCP server implementation uses Streamable HTTP and separates the transport/authentication layer from tool dispatch. The inspected auth code validates Cognito JWTs and produces an authenticated owner identity.
- Current MCP tools include prompt engineering, memory/collections, CLI operations, Spotify, and a persistent-chat prototype.
- The ActiveBlackboard requirements explicitly distinguish the current **single-stream Persistent Chat prototype** from the future multi-chat/multi-actor Blackboard. The same requirements say the final multi-actor coordination semantics are not yet fully designed.
- The LLMClient implementation inspected is currently an OpenAI Python-client wrapper; the README's hybrid orchestration vision should not be mistaken for a completed, provider-neutral multi-agent runtime.

### AEGIS decision

**Architecture reference only; do not copy code into AEGIS for commercial use under the current licence.** PolyForm Noncommercial is not a permissive commercial licence. A separate written commercial licence from the author would be needed before considering reuse in a commercial AEGIS product.

Useful ideas to study independently:
- shared Blackboard with explicit actor identity and separate private contexts;
- MCP as a capability boundary, with authentication and owner-scoped operations;
- persistent memory with explicit activation, append and resume semantics;
- deterministic orchestration around model-driven workers;
- explicit distinction between implemented features and future requirements.

Do not inherit its heavy Python/RAG stack or AWS/Streamlit architecture into AEGIS.

## 2. OpenHands Agent Canvas — OpenHands/OpenHands

Repository: https://github.com/OpenHands/OpenHands  
Recursive tree: 3,277 entries; not truncated.  
Licence: **MIT** (verified from LICENSE).  
Main stack: React, TypeScript, Vite, Node, Agent Server, Docker; optional automation service.

### What it does

Agent Canvas is a self-hosted browser control centre for coding agents. It can connect to multiple local, remote, Docker/VM or hosted Agent Server backends. Its Agent Client Protocol (ACP) integration launches external agent CLIs as subprocesses and relays turns over JSON-RPC/stdio.

The inspected ACP documentation lists Claude Code, Codex, Gemini CLI, Pi and OpenCode. It documents use of the provider CLI's own sign-in on the machine running the agent, or an API key where required. It also supports scheduled/event-triggered automations and a frontend that can switch between registered backends.

### Security findings

- The self-hosting guide warns that an agent can read/write its host filesystem, execute shell commands and access the network; anyone who can reach an exposed agent server can exercise that authority.
- The guide recommends firewall restrictions, HTTPS, an API key, and Docker sandboxing where appropriate.
- The architecture document makes the boundary explicit: the Canvas frontend renders and routes requests; the Agent Server executes agent actions; sandbox/workspace isolation belongs to the runtime, not the frontend.

### AEGIS decision

**Best browser-first architectural reference in this scan.** Study and independently adapt:
- ACP-style provider/agent adapters;
- multiple backend registry and health/fallback selection;
- conversation/workspace separation;
- server-side secret handling;
- automation triggers and execution receipts;
- strict separation between UI, agent runtime and sandbox authority.

Do not import the whole application. AEGIS already has its own workspace, provider gateway, safety state machine and deployment direction. Any worker runtime must remain isolated, network-restricted and human-gated; the browser must never become the execution authority.

## 3. Orca — stablyai/orca

Repository: https://github.com/stablyai/orca  
Recursive tree: 42,588 entries; not truncated.  
Licence: **MIT** (verified from LICENSE).  
Main stack: large TypeScript/Electron desktop application, React Native mobile companion, remote/cloud services.

### What it does

Orca runs Claude Code, Codex and other CLI agents in parallel, each in its own Git worktree. Its orchestration model includes durable Runs, Tasks, Dispatches, supervised workers, inbox messages, completion receipts and decision gates. It supports diff review, GitHub workflows, remote hosts, and a mobile companion for monitoring and steering work.

The mobile README describes a companion paired to the desktop/host runtime over WebSocket; it is not a standalone browser-only development environment.

### Important security warning

Orca's supported-agent documentation says new launches default to permission-bypass flags for several agents. It also explicitly says a Git worktree is **not** a security sandbox: an agent can still access files and network resources available to its process. Its documented **Manual** permission mode is the safer reference for AEGIS. AEGIS must not inherit YOLO/bypass defaults.

### AEGIS decision

**Strong reference for orchestration lifecycle and parallel work isolation; poor candidate as a direct dependency.** Its very large desktop/native/mobile stack is incompatible with a lightweight browser-first AEGIS integration. Study:
- Run → Task → Dispatch state model;
- explicit worker identity and completion receipts;
- decision gates and coordinator inbox;
- separate Git worktrees per worker;
- review/diff feedback loops;
- remote runtime lifecycle and mobile status surfaces.

Do not copy its default permission-bypass behaviour.

## 4. OpenCode — anomalyco/opencode

Repository: https://github.com/anomalyco/opencode  
Recursive tree: 12,689 entries; not truncated.  
Licence: **MIT** (verified from repository metadata and LICENSE).  
Current default branch: dev; active repository at the time of this scan.  
Main stack: TypeScript/Bun monorepo.

### What it does

OpenCode is a provider-flexible coding agent for terminal, desktop and mobile. Its architecture includes a dedicated AI/provider package and agent/session packages. The current README describes a read-only **plan** agent and a full-access **build** agent, plus custom agents and parallel sessions.

### AEGIS decision

**Useful reference for the provider-neutral agent adapter and planning/build permission split.** Study its provider package boundaries, model metadata, session lifecycle and read-only planning mode. It is primarily a coding-agent runtime, not a full multi-agent project orchestrator, so AEGIS should treat it as an optional worker/adapter rather than replace its own coordinator.

## 5. Cross-project conclusions for AEGIS

The strongest combined architecture is not to embed any one of these platforms wholesale:

1. **AEGIS remains the authority** for project state, task planning, audit history, approvals and user-facing workspace.
2. A provider-neutral adapter layer can connect supported agents (for example, Claude Code, Codex and OpenCode) through explicit, documented interfaces such as ACP or a narrow process adapter.
3. Each worker receives a scoped task, workspace and capability set. Parallel workers use separate worktrees or equivalent isolated workspaces.
4. AEGIS tracks Run/Task/Dispatch state, worker identity, logs, changed files, test results and explicit completion receipts.
5. Planning/review agents are read-only by default. Write, shell, network, deployment and credential actions require explicit policy and, where appropriate, human approval.
6. A worktree is source-control isolation, not a sandbox. Execution still needs a separate runtime boundary, restricted filesystem mounts, network egress policy, secret isolation and cleanup.
7. Use official provider CLI sign-in or supported API credentials only; do not depend on unofficial subscription-token extraction or credential sharing.
8. Preserve deterministic fallback and low-cost/local operation when no paid provider is configured.

## Priority

| Candidate | Best contribution | AEGIS disposition |
|---|---|---|
| OpenHands Agent Canvas | Browser UI, ACP adapters, backend registry, automations | Highest-priority architecture reference |
| Orca | Parallel worktrees, worker dispatch, decision gates, receipts | High-priority orchestration reference; no wholesale import |
| OpenCode | Provider abstraction, agent/session UX, plan/build split | High-priority optional worker reference |
| GHOST | Blackboard, memory, MCP capability boundary | Research only unless commercial licence is obtained |

**Status:** Research documented only. No third-party package installed, no source copied, no production settings changed, and no merge/deployment performed.
