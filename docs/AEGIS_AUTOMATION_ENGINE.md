# AEGIS Native Automation Engine

## Status — definition contract v0.1

The first AEGIS-native automation-definition contract is implemented in `workers/runtime/automation-contract.mjs` and covered by `tests/automation-contract.test.mjs`.

This is a **contract-only foundation**. It does not yet schedule or execute automations. The following remain unimplemented:

- D1 persistence for definitions, versions, schedules, runs, steps and append-only run events;
- owner-authenticated create/list/update/pause/resume/archive APIs;
- next-run calculation and a central scheduler;
- Queue dispatch, outbox recovery and dead-letter handling for automation runs;
- Cloudflare Workflows integration for long-running, checkpointed execution;
- Sentinel authorization and atomic approval consumption at every consequential step;
- notifications, run inspection, logs and the mobile Automation Centre UI.

No AEGIS D1 database, Queue, Workflow or dedicated runtime Worker has been provisioned. No automation has been activated or executed.

## Definition contract

Every definition has:

- `schemaVersion: 1`, a stable slug ID and a positive definition version;
- a bounded name and optional description;
- one typed trigger;
- 1–20 ordered, uniquely identified steps;
- a bounded retry policy (default: one attempt, 30-second backoff);
- bounded execution limits (default: 300-second timeout, 20 runs/day, one concurrent run).

Definitions are versioned. Lifecycle state is separate from the immutable definition and must be persisted/audited by the future repository.

### Triggers

- `manual`;
- `schedule/interval` with a minimum five-minute interval;
- `schedule/daily` with an explicit IANA timezone and 24-hour local time;
- `schedule/weekly` with unique ISO weekdays, local time and IANA timezone;
- `event` with one exact `aegis.*` event name. Wildcard subscriptions are rejected.

### Step types

- `agent.plan` — creates a bounded plan for one registered AEGIS specialist. It does not invoke tools or execute code.
- `capability.invoke` — references one exact capability, action, resource and non-wildcard scope list. Human approval is mandatory and cannot be disabled in the definition.
- `notify.owner` — an internal owner notification only. The definition cannot supply an email address, external recipient or arbitrary delivery channel.

No shell, JavaScript, Python, arbitrary HTTP, dynamic module, external adapter name or user-supplied executable script is accepted.

### Conditions

Conditions use a small declarative language (`exists`, `not_exists`, `equals`, `not_equals`, `contains`). Paths are limited to trigger payloads or outputs from earlier steps. There is no `eval`, expression language, arbitrary property traversal or reference to a future step.

### Lifecycle

The pure transition policy currently permits:

- `draft → active` or `draft → archived`;
- `active → paused` or `active → archived`;
- `paused → active` or `paused → archived`;
- `archived` is terminal.

The future API must authenticate the owner, apply these transitions atomically and append an audit event. Creating a definition must not automatically activate it.

## Security and execution invariants

1. Default deny: only registered trigger and step types are accepted.
2. Capability steps carry exact scopes, resource and action identifiers; no wildcard scope or resource is accepted.
3. Every capability invocation requires a human approval bound to the exact definition version, step, action, resource and canonical input digest.
4. The execution service must re-check the current grant, connection health, scope, rate limit and approval immediately before every consequential operation.
5. Definitions and run state are data, never executable code.
6. Retries, timeout, daily-run and concurrency limits are bounded. Each handler must be idempotent.
7. Every transition, attempt, approval decision, retry, cancellation and terminal result must produce append-only, owner-scoped audit history.
8. Pause/cancel must stop future dispatch and prevent new steps from starting; in-flight external effects cannot be silently assumed rolled back.
9. Notifications are owner-only until separate channel capabilities are reviewed and approved.
10. No scheduler, queue consumer or workflow may infer permission from an agent plan or a discovered integration.

## Target runtime architecture

AEGIS remains the source of truth. Cloudflare is the first replaceable infrastructure adapter:

1. **D1** — canonical definitions, immutable versions, next-run indexes, run/step state, approval references and append-only events.
2. **One central Cron Trigger** — finds due definitions with indexed, bounded queries. Do not create one account-level Cron Trigger per automation.
3. **Queues** — dispatch small run-ID/version references, not full mutable definitions or secrets.
4. **Workers Workflows** — execute long-running multi-step runs with durable checkpoints, retry, sleep and recovery.
5. **Sentinel** — authorize each capability step against the exact current grant and one-time approval.
6. **Automation Centre** — mobile-first creation, schedule/trigger editor, conditions, pause/resume, approvals, run history, step logs, retries and notifications.

The current runtime Worker is still a separate source-only service with a health-check task; it is not a deployed automation service. AEGIS must not depend on ChatGPT scheduled tasks to run while ChatGPT is idle.

## Cloudflare Free-plan reference check — 20 November 2026

These are published account-plan allowances, **not a claim that this account is on the Free plan or has this quota remaining**.

| Service | Published Free allowance | Design consequence |
|---|---|---|
| Workers | 100,000 requests/day; 10 ms CPU per invocation; 5 Cron Triggers/account | Use one central scheduler. Keep request handlers and Cron work bounded. |
| D1 | 5 million rows read/day; 100,000 rows written/day; 5 GB total storage; 10 databases | Index owner/status/next-run queries. Avoid full scans and unnecessary event duplication. |
| Queues | 10,000 operations/day; 24-hour message retention | A normal delivery usually costs write + read + delete; retries add reads. D1 outbox recovery must survive queue expiry. |
| Workflows | 3,000 steps/day; 1 GB-month persisted state; 3-day default state retention; 10 ms CPU per step on Free | Keep steps small and state compact. Define retention and quota handling explicitly. |

Official references:

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Queues limits](https://developers.cloudflare.com/queues/platform/limits/)
- [Workflows pricing](https://developers.cloudflare.com/workflows/reference/pricing/)
- [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/)

Free-tier quotas are shared account-wide. Other projects can consume them. The future scheduler must expose quota exhaustion and defer work safely; it must not upgrade plans, enable paid usage or spend money automatically. The account's actual plan and usage headroom must be verified before provisioning.

## Delivery sequence

1. Complete and review the existing security/Sentinel integration foundation.
2. Add the D1 automation definition/version, schedule, run, step and append-only event schema.
3. Add owner-authenticated, same-origin APIs and atomic lifecycle transitions.
4. Add a single central scheduler with bounded due-run selection and idempotent run creation.
5. Add Queue dispatch, durable outbox recovery, retry budgets and dead-letter behavior.
6. Add Workflows for checkpointed execution and human-wait states.
7. Integrate Sentinel grants, exact approvals, revocation, rate limits and audit before enabling capability steps.
8. Build the mobile Automation Centre and observable run history.
9. Add specialist-agent delegation only through the same governed step contracts.

Do not merge an external workflow platform as the canonical engine. External projects may inform UX or adapters, but AEGIS owns automation identity, versioning, state, approvals and audit.
