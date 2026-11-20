# AEGIS Adaptive Workspace — experience architecture

**Status:** Design contract / roadmap. This document describes the intended experience and does not claim that the proposed task surfaces are implemented.

## 1. Product experience

AEGIS is one coherent adaptive environment, not a collection of unrelated apps and not a chat screen with extra panels. It should feel like a capable command environment that can become the right working surface for the current outcome.

The interface has a stable identity and navigation, but its central workspace changes according to the work. Chat, voice, companion presence and direct manipulation are interaction channels; they are not the product boundary.

The experience must remain useful on a Chromebook, iPad, iPhone and ordinary mobile browser. Desktop density is progressive enhancement, never a prerequisite.

## 2. Three persistent layers

1. **Orientation rail** — current workspace/project, global navigation, search, activity and account controls. It stays predictable across modes.
2. **Adaptive work surface** — the primary task-specific environment. It can change structure without changing the user's project or losing context.
3. **Presence and control layer** — text/voice entry, companion access, task status, approvals, pause/cancel and provenance. It must never conceal consequential system state.

Avoid permanently displaying every tool, agent, metric and integration. Reveal complexity when it is relevant.

## 3. Task surfaces

The orchestrator may request a surface based on task intent. Surface selection is presentation, not a security decision.

| Surface | Primary content | Useful actions |
|---|---|---|
| Research | question, source set, evidence ledger, claims, comparisons, confidence and findings | inspect source, compare, annotate, export |
| Build / engineering | project tree, brief, plan, diffs, tests, preview, checkpoints and blockers | inspect file, review diff, run approved check, accept/reject proposal |
| Operations | jobs, dependencies, run state, budgets, approvals, audit and recovery | pause, resume, cancel, approve exact operation |
| Creative studio | brief, drafts, references, assets, variants and iteration history | refine, compare, version, export |
| Knowledge | concepts, documents, decisions, provenance, freshness and relationships | search, link, correct, supersede |
| Business / strategy | goals, assumptions, market evidence, options, risks, cost and action plan | scenario compare, validate assumption, prepare next step |
| Conversation | transcript, context references, response and suggested next actions | ask, clarify, switch surface |

A task may combine surfaces. For example, a software build can include research and operations panels without becoming three disconnected projects. The workspace remains the source of truth.

## 4. Surface selection contract

A surface proposal should carry:
- stable surface type and schema version;
- canonical workspace/project/job references;
- user outcome and relevant acceptance criteria;
- the reason this surface helps the task;
- required data references and their provenance;
- available UI actions, each linked to an existing server capability;
- responsive layout hints and accessibility alternatives.

The client may render only known, versioned surface types and allowlisted UI actions. It must not turn model-generated labels, URLs, HTML, scripts or arbitrary component descriptions into executable UI. Unknown surface types fall back to the standard workspace and remain visible as an unsupported proposal.

The orchestrator may suggest a surface. The client owns presentation. Sentinel alone decides whether protected operations are permitted.

## 5. Interaction principles

- **Outcome before tools:** ask what result is needed, then reveal the tools and steps relevant to that result.
- **Progressive disclosure:** start clear and calm; expose technical depth when requested or useful.
- **Visible work:** show current phase, completed steps, next checkpoint, blockers and whether the system is waiting for the user.
- **Inspectable decisions:** explain why a strategy or tool was selected when the choice materially affects cost, privacy, quality or risk.
- **Honest status:** distinguish proposed, queued, running, succeeded, failed, cancelled and awaiting approval.
- **Interruptible by design:** provide pause/cancel controls for long-running work and preserve a recoverable checkpoint.
- **Evidence beside conclusions:** keep sources, test results, diffs and assumptions close to the output they support.
- **No fake activity:** do not animate a process or imply background work when no job is running.
- **Accessible alternatives:** keyboard, touch, captions, screen-reader semantics and text-only interaction must remain first-class.

## 6. Visual language

The visual identity should be distinctive through information design and behaviour, not decorative sci-fi clutter.

- Use a restrained dark-first command environment with a small, deliberate accent palette; support light mode and user contrast preferences.
- Use typography, spacing, hierarchy and meaningful state indicators before glow, gradients or motion.
- Use motion only to communicate transitions, progress or relationships; respect reduced-motion preferences.
- Reserve high-attention colours for meaningful states such as blocked, warning, approval-required or verified.
- Keep navigation, status and primary controls consistent across surfaces.
- Prefer purposeful visualisations (timelines, evidence maps, dependency graphs, project canvases) only when they improve comprehension.
- Avoid dense tables and tiny controls on mobile; reflow to cards, focused panels and drill-down views.

The interface should feel advanced because it makes complex work understandable, not because it imitates a film prop.

## 7. Companion and voice integration

The companion is an optional, first-class presence within the same workspace. It can occupy a focused companion view, a compact dock or a voice-only mode. It must not displace the task's evidence, files or approvals.

The companion architecture remains separate from the intelligence core and from Sentinel. Voice, avatar, camera and screen perception states must be explicit, visible and user-controlled. The companion must never imply that it has acted merely because it has spoken.

## 8. Data and security boundaries

- Workspace/project records remain the durable source of truth.
- The browser receives only owner-authorised, bounded data and opaque references.
- Client state, visual surface proposals, model output and connected-source content are untrusted.
- A rendered action is not permission to execute it.
- Any external, destructive, financial, identity, privacy-sensitive or production-impacting action must pass through existing Sentinel policy, exact grants, approvals, rate limits and audit.
- Surface switching must not widen project, memory, device or integration scope.
- The client must not receive provider credentials, Composio API keys or secret values.
- Never execute model-generated code, markup or arbitrary links as part of rendering a surface.

## 9. Delivery slices

1. **Inventory and preserve:** map the existing index shell, companion renderer, project APIs and existing UI tests before changing the interface.
2. **Shell contract:** define stable navigation, orientation, presence and status regions without replacing existing routes.
3. **One adaptive surface:** introduce one task surface behind an explicit feature flag, using existing project data and read-only interactions first.
4. **Surface registry:** add a versioned allowlist and deterministic fallback, with tests for unknown and malformed proposals.
5. **Evidence and activity:** connect research/build/operations outputs to durable workspace events and provenance.
6. **Responsive validation:** test phone, tablet and desktop layouts, keyboard navigation, reduced motion and screen-reader labels.
7. **Progressive capability:** add write actions only after their server-side Sentinel contracts and approval UX are independently verified.

## 10. Acceptance criteria

The adaptive workspace is not ready to claim complete until:
- a user can identify the active project, task, status and next checkpoint at a glance;
- switching task surfaces does not lose workspace context or change permissions;
- unknown or malformed surface proposals render safely using the standard fallback;
- every consequential UI action maps to a server-side capability and is denied without Sentinel authorisation;
- source evidence, test outcomes and assumptions are inspectable;
- the core task can be completed on a narrow mobile viewport without horizontal page scrolling;
- keyboard and assistive-technology navigation remain usable;
- reduced-motion and text-only modes remain functional;
- visual changes pass existing frontend smoke and security UI tests.

## 11. Current implementation reality

The repository currently contains a compact single-page chat/workspace shell in `index.html`, an interactive companion renderer and several authenticated APIs. Existing project-space documentation notes that a full browser workspace UI is not yet implemented. This design is a target contract; it does not claim those future surfaces exist today.


## 12. First implementation slice — adaptive working focus

The existing chat surface now includes a working-focus selector for general assistance, research, build/engineering, creative work, strategy and operations. The selection updates concise workspace guidance and is passed to the authenticated AG-UI endpoint as `workFocus`.

The server accepts only the fixed enumerated values and applies a corresponding bounded reasoning preference in the system prompt. The preference explicitly grants no tools, access, permissions or approval; existing authentication, project ownership, tool registry and Sentinel boundaries remain authoritative. Missing focus defaults to `general`.

This is the first end-to-end adaptive reasoning slice, not a full adaptive workspace. The current surface remains chat-centred; no autonomous planner, new execution route, dynamic tool discovery, or separate task-specific canvas has been implemented. The next slices should add task outcome/acceptance criteria and visible checkpoints, then evolve the task surfaces while preserving the same security model.


## 13. Universal environment and Multiverse relationship

The adaptive workspace is one experience layer within the broader AEGIS Multiverse. Users may choose standalone AEGIS, a companion alongside an existing operating system, or a hybrid arrangement across devices. The product principle is: **independent when wanted, complementary when preferred, and connected when authorised**.

The companion is passive by default, with explicit Dormant, Ambient and Active states, visible controls and platform-specific limitations. Compatibility assessment must be transparent and read-only initially; existing security products should be complemented rather than silently disabled or replaced. Cross-device continuity must never widen permissions. The full product and architecture contract is in [AEGIS Universal Environment & Multiverse](AEGIS_UNIVERSAL_ENVIRONMENT.md). This is a direction and acceptance contract, not a claim that these capabilities are implemented.
