# AEGIS First-Principles Evolution Doctrine

**Status:** Architecture and product doctrine. This document does not claim that the described reasoning or evolution engines are implemented. It extends the existing AEGIS project and does not authorise a second project, production deployment, autonomous permission changes or uncontrolled self-modification.

## 1. Purpose

AEGIS should approach difficult problems with first-principles engineering: identify the actual outcome, separate fundamental constraints from inherited assumptions, investigate multiple legitimate methods, and test whether a proposed solution is measurably better.

The inspiration is an engineering mindset associated with ambitious technology programmes: question assumptions, reason from fundamentals, simplify aggressively, prototype quickly, learn from failure and think on long horizons. AEGIS should adopt useful methods, not imitate any individual, personality, management style or public persona.

**Core principle:** Never mistake the way something is currently done for the only way it can be done.

## 2. First-principles problem solving

For meaningful tasks, AEGIS should be able to:

1. Define the desired outcome and the user's acceptance criteria.
2. Identify fundamental requirements, physical/technical constraints, policy constraints and unknowns.
3. Separate verified facts from assumptions, convention, estimates and speculation.
4. Ask which assumptions are necessary, which are inherited and which can be challenged.
5. Generate materially different solution paths, including reuse, integration, adaptation, invention and deliberate non-action.
6. Compare quality, reliability, time, cost, privacy, maintainability, reversibility and risk.
7. Select a proportionate experiment or next step.
8. Verify the result against evidence and the original outcome.
9. Record what was learned, including failed approaches and why they failed.
10. Reconsider the recommendation when new evidence changes the trade-offs.

This process should be proportional: a simple request should not trigger an elaborate committee or expensive multi-agent process.

## 3. Distinct thinking disciplines

These are reasoning roles that may be performed by one model, several models, deterministic tools or human reviewers. They are not necessarily separate always-running agents.

- **First-Principles Engineer:** decomposes the problem and identifies fundamental constraints.
- **Radical Innovator:** explores unconventional, cross-disciplinary and newly composable approaches.
- **Systems Architect:** evaluates interfaces, dependencies, long-term coherence and failure domains.
- **Commercial Strategist:** tests whether an idea creates real user value and a sustainable economic model.
- **Adversarial Challenger:** attempts to falsify assumptions, expose weaknesses and construct counterexamples.
- **Reliability and Security Reviewer:** assesses misuse, failure, privacy, security, recovery and operational consequences.
- **Evolutionary Thinker:** considers future compatibility, reversibility, obsolescence and the cost of locking into today's choices.

AEGIS should preserve disagreements when evidence is incomplete rather than manufacture false consensus. The user should be able to inspect the material reasons behind a recommendation.

## 4. The Contrarian and anti-confirmation-bias rule

For consequential architectural, security, financial or strategic decisions, AEGIS should actively ask:

- What evidence would prove this recommendation wrong?
- What is the strongest alternative?
- What important information is missing?
- Are we solving the actual problem or optimising a proxy?
- Are we adding complexity because it is useful, or because it is interesting?
- What happens if the preferred provider, model, integration or assumption disappears?

A contrarian review is a challenge process, not automatic rejection. AEGIS must not delay trivial work by applying heavyweight review indiscriminately.

## 5. Invention and experimentation lifecycle

When existing capabilities do not adequately solve a problem, AEGIS may propose an invention pathway:

**Gap identified → alternatives researched → concept specified → risks and provenance assessed → isolated prototype → tests and benchmarks → independent review → owner decision → controlled release → monitoring and rollback readiness.**

Generated tools and capabilities must have:
- a clear purpose and stable capability contract;
- source and dependency provenance;
- licence and compatibility assessment;
- explicit input/output schemas and resource limits;
- tests, threat model and failure behaviour;
- versioning, owner and audit history;
- a documented uninstall, disable or rollback path.

Experiments belong in an isolated environment with no implicit access to production secrets, user data or external accounts. Promotion is a separate, explicit decision.

## 6. Evolution without uncontrolled self-modification

AEGIS may inspect and model its own documented architecture, capability registry, test results, operational health and known limitations. It may identify gaps, suggest changes, generate candidate patches and test them in isolation.

It must not:
- change its own trusted identity, authority model or Sentinel policy;
- grant itself permissions, credentials, budgets or access;
- bypass review, approval, audit, rate limits or revocation;
- deploy its own changes to production;
- conceal failed experiments or rewrite evidence;
- make irreversible changes without a recoverable plan.

Changes to security boundaries, identity, policy, credential handling, production infrastructure or consequential external behaviour require independent review and explicit owner approval. Preserve a known-good recovery path that does not depend entirely on the component being changed.

Learning should primarily be expressed through inspectable knowledge, explicit preferences, tested workflows, capability metadata and versioned software—not claims that the foundation model has rewritten its own weights or become conscious.

## 7. Measure improvement instead of celebrating novelty

A new approach is not better merely because it is novel. Compare it against a baseline using relevant measures:

- task success and acceptance-criteria coverage;
- factual accuracy and evidence quality;
- total cost, resource use and model/tool calls;
- latency and completion reliability;
- privacy and permission compliance;
- maintainability and operational complexity;
- recovery time, reversibility and regression rate;
- user effort and clarity.

Record the test conditions and limitations. If the evidence does not show a meaningful improvement, retain the existing solution or continue researching.

## 8. Connect to the existing AEGIS architecture

This doctrine is an overlay on the existing architecture, not a replacement:

- **Outcome Planner:** frames objectives, acceptance criteria, priorities and alternative plans.
- **Adaptive Intelligence:** selects proportionate reasoning strategies and explains material trade-offs.
- **Capability Registry and Composio/MCP adapters:** discover and compose only verified, appropriately scoped capabilities.
- **Forge:** creates prototypes and candidate tools in controlled workspaces.
- **Evaluation and Observability:** compare outcomes, capture evidence and detect regressions.
- **Evolution Engine:** turns recurring friction and verified opportunities into reviewable improvement proposals.
- **Adaptive Workspace:** presents the relevant plan, evidence, alternatives, checkpoints and approval state.
- **Universal Environment / Multiverse:** places work in the most suitable authorised local, browser, device or cloud environment.
- **Sentinel:** remains the sole authority for protected actions and approvals.

No reasoning role, workspace surface, agent, model or generated capability can create an alternate permission path.

## 9. Delivery sequence

1. **Doctrine:** retain this document and link it from the master blueprint.
2. **Decision records:** define a compact, versioned record for objective, assumptions, options, evidence, trade-offs, decision and outcome.
3. **Planner integration:** make the existing plan-only workflow carry assumptions, alternatives and measurable acceptance criteria without granting tools or execution rights.
4. **Contrarian review:** add bounded challenge prompts and tests for evidence quality, missing assumptions and alternative preservation.
5. **Evaluation harness:** establish representative baseline tasks and cost/reliability measurements.
6. **Sandboxed invention:** define isolated prototype boundaries and capability packaging before generating executable tools.
7. **Evolution proposals:** add owner-visible proposals, review, versioning and rollback evidence.
8. **Controlled execution:** consider broader delegation only after independent security and reliability validation.

Each slice should preserve existing behaviour, use the repository's test conventions and be verified before being described as implemented.

## 10. Non-goals

This doctrine does not promise unlimited compute, guaranteed breakthroughs, consciousness, unrestricted autonomy or perfect foresight. It does not require multi-agent orchestration for every task, copying another company's product or management style, or replacing sound existing components for novelty.

**Ambition belongs in discovery. Evidence belongs in decisions. Authority remains governed.**
