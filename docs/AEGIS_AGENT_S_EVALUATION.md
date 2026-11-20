# Agent S / S3 / S4 evaluation for AEGIS

**Status:** research and architecture recommendation only. No Agent S code, dependencies, credentials, desktop-control permissions, or runtime execution have been added to AEGIS.

**Reviewed:** 20 November 2026  
**Upstream:** https://github.com/simular-ai/Agent-S  
**License:** Apache-2.0 (upstream repository LICENSE; retain notices and mark modified files if code is ever adapted).

## Executive recommendation

Treat Agent S as an optional future **computer-use adapter**, not as AEGIS's agent orchestrator, model gateway, workspace, or security boundary. Reuse architectural ideas selectively. Do not transplant the full framework or enable its local code-execution environment inside AEGIS.

The best near-term value is to define a narrow AEGIS-owned computer-use capability contract, then consider a separately deployed Agent S worker only when AEGIS has an approved, isolated desktop runtime and a tested Sentinel bridge.

## What was reviewed

- Agent S3 (gui-agents): visual desktop interaction using screenshots, GUI grounding, mouse/keyboard actions, planning and optional reflection.
- Agent S4 (agent-s4): a research system that evolves a repository of agent interfaces through a Builder/task-agent loop, evaluates variants in isolated benchmark VMs, and tracks experiment state/cost.
- Upstream LICENSE, package metadata, S3 README, S3 agent/grounding code and local execution controller.

Primary upstream sources:
- https://github.com/simular-ai/Agent-S
- https://github.com/simular-ai/Agent-S/blob/main/gui_agents/s3/README.md
- https://github.com/simular-ai/Agent-S/blob/main/agent_s4/README.md
- https://github.com/simular-ai/Agent-S/blob/main/gui_agents/s3/utils/local_env.py
- https://github.com/simular-ai/Agent-S/blob/main/gui_agents/s3/agents/grounding.py

## Findings

### Agent S3: useful capability, unsuitable as a direct in-process dependency today

S3 accepts a natural-language instruction plus a screenshot observation and returns an information object plus proposed action strings. Its architecture separates the worker model from the grounding/agent-computer interface. It supports configurable main and grounding model endpoints, with the README describing providers including OpenAI-compatible/OpenRouter and self-hosted endpoints.

Important operational requirements and limitations:
- It is a desktop agent, not a browser-only library. It expects a supported desktop environment and screenshot/GUI access.
- Its README calls for a separate grounding model endpoint and matching screen-coordinate dimensions.
- The upstream package metadata includes a broad dependency set (including OCR, PyAutoGUI, Selenium, platform-specific automation libraries and multiple model SDKs) and currently constrains Python to >=3.9 and <=3.12.
- It is therefore a poor fit for direct installation into AEGIS's existing web worker/runtime and would add substantial deployment weight.

### Critical security finding: do not enable upstream LocalEnv as-is

The reviewed S3 LocalController executes generated Bash via /bin/bash -lc and generated Python via the current Python interpreter. These subprocesses run with the privileges of the account running the agent. The Bash path has a timeout, but the Python path shown in the reviewed implementation has no subprocess timeout. The upstream README explicitly warns that this is arbitrary local code execution.

AEGIS must not expose this facility to an agent, browser session, connector, or user workspace. A timeout alone is not a security boundary.

If computer use is later enabled, AEGIS should own the execution boundary:
1. Separate disposable desktop worker/VM/container per task or tightly scoped session.
2. No host filesystem mounts, host credentials, or ambient cloud credentials.
3. Network egress deny-by-default with explicit destination allowlists.
4. No shell/Python execution capability in the first release; GUI-only actions.
5. Screenshots and outputs treated as untrusted data; redact secrets before persistence.
6. Per-action policy checks, rate/cost budgets, deadlines, cancellation and audit events.
7. Sentinel approval bound to the exact task, desktop session, action class and resource; approval must not be reusable for another action.
8. Human confirmation for irreversible actions (payments, sending messages, deleting, publishing, account/security changes).
9. A kill switch that terminates the worker and revokes its short-lived credentials.

### Agent S4: promising learning pattern, not an immediate runtime component

S4 is not simply another task agent. It uses a Builder/meta-agent to inspect task trajectories and evolve a repository of interfaces, while task agents evaluate variants on isolated VMs. It uses population-based selection, validation reevaluation, run databases and cost limits. The README describes a Landlock sandbox for the Builder in the documented benchmark harness.

Potential AEGIS lesson:
- Let agents propose reusable workflow tools/interfaces from observed task traces.
- Evaluate proposed tools against held-out tests and regression fixtures.
- Promote only reviewed, signed, versioned artifacts.
- Keep the task agent/model/harness fixed while comparing interface variants.
- Record token/cost and task outcomes to prevent apparent improvements from hiding excessive spend.

Do not copy S4's benchmark orchestration, AWS VM setup, or self-modifying repository loop into the current AEGIS runtime. That would add significant infrastructure and an autonomous code-modification risk before the basic integration control plane is complete.

## Proposed AEGIS integration boundary

If approved in a later implementation phase, expose an AEGIS-owned adapter with a contract conceptually equivalent to:

- inspect_screen(session_id) -> bounded screenshot reference + metadata
- propose_actions(task_id, observation_ref) -> typed action proposals (not executable code)
- execute_action(task_id, session_id, typed_action, approval_ref) -> bounded result
- close_session(session_id) -> terminated state

These are design concepts, not existing API routes.

The adapter must:
- return typed actions such as click, type, keypress, scroll and wait; reject arbitrary code strings;
- route every execution through Sentinel and the exact-resource grant/approval system;
- use a separate short-lived desktop worker, never the AEGIS web process;
- accept only allowlisted target applications/domains and bounded action sequences;
- emit audit records for observation, proposal, approval, execution and result;
- fail closed when the worker, policy service, approval, or audit store is unavailable.

## Fit with the current AEGIS roadmap

| Area | Recommendation |
|---|---|
| Provider gateway | Keep AEGIS-owned and provider-agnostic. Agent S is not a replacement. |
| Agent orchestration | Keep AEGIS orchestration and handoff policy. Agent S is a specialist computer-use worker only. |
| Workspace/source of truth | Keep AEGIS workspace and artifact model authoritative. |
| Composio/API integrations | Prefer direct, scoped APIs over GUI automation whenever a reliable connector exists. |
| Browser/desktop automation | Consider Agent S behind a separate worker boundary after Sentinel integration. |
| Skill/interface learning | Borrow S4's evaluate-before-promote pattern later; do not allow live self-modification. |
| iPad/phone access | Agent S's local desktop package is not a native iPad/iPhone capability. A remote isolated desktop could be explored later, but adds infrastructure. |

## Decision

**Research status: worthwhile; direct integration: defer.**

No package installation, source-code copying, API calls to Simular, account creation, paid service, deployment, permission change, or production change is part of this evaluation.

Next safe engineering step, when the core integration control plane is ready: add a design-only computer-use adapter contract and threat-model tests. Only then prototype a separate, GUI-only worker behind Sentinel. Do not import or enable LocalEnv.
