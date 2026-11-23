# AEGIS Infinity — free-first orchestration and device bridge

**Status:** architecture proposal; no runtime worker, device pairing, provider write access, or production deployment is enabled by this document.  
**Branch:** `feature/aegis-infinity-free-first-orchestration-2026-11-23`  
**Parent:** PR #201 (connector isolation and diagnostics).  
**Operating constraint:** use existing free services and free tiers only. No paid API, subscription, credit purchase, trial conversion, or usage that can incur a charge.

## 1. Purpose — preserve AEGIS, bridge the operating gaps

AEGIS Infinity remains the existing AEGIS project and architecture. This work is not a product redesign. The objective is to let the owner-authorised ChatGPT operator coordinate problem-solving and build work across the existing AEGIS runtime, phone, Chromebook, GitHub, Cloudflare, Krystal.io, Oracle Cloud and Composio connections.

The system should:
- accept a goal or detect an authorised event;
- break work into small, independently tracked tasks;
- inspect the relevant services and identify the actual blocker;
- dispatch safe work to the right service or connected device;
- verify the result, record evidence and retry recoverable failures;
- contact the owner only when approval, a missing prerequisite, or a human-only action is needed.

A device is an optional worker, not the system's single point of failure. If the phone or Chromebook is offline, cloud-side tasks remain queued and resume when a worker reconnects.

## 2. Hard zero-cost policy

- Do not add paid APIs, paid model endpoints, paid automation plans, paid hosting, or paid add-ons.
- Do not create a billing resource, enable a paid feature, upgrade an account, start a trial, or increase a quota.
- Treat all free-tier quotas as hard ceilings. Stop safely before an action could exceed a free allowance.
- If a service's current plan or remaining allowance cannot be verified, do not assume it is free.
- AI-provider adapters must be disabled by default and may use only a provider explicitly verified as free for the intended use. No card-required trial or promotional credit is considered a durable free service.
- Keep a manual ChatGPT hand-off path. Do not claim that a ChatGPT subscription or this chat session provides a free, unattended model API.

## 3. Important capability boundary

This ChatGPT conversation cannot remain awake, continuously reason, or independently resume work after the conversation is closed. AEGIS can run its own event-driven coordinator and scheduled checks, but that is not the same thing as this exact ChatGPT session operating in the background.

The free-first implementation should therefore separate:
1. **Always-on orchestration:** free-tier event intake, durable task state, bounded scheduled checks and worker dispatch.
2. **AI reasoning:** optional, pluggable model adapters only where a genuinely free allowance is verified; otherwise pause at a reasoning checkpoint and request ChatGPT/operator input.
3. **Human approval:** an owner notification and approval queue for privileged or consequential actions.

Never represent an alternate free model as the ChatGPT model or silently send owner data to a new AI provider.

## 4. Candidate free Cloudflare runtime — verify account plan before use

The existing AEGIS Cloudflare Pages/Functions and D1 architecture should be inspected and extended rather than replaced. Candidate components, subject to confirming the actual account is on the free plan and checking current quotas:

- **Workers:** short request handlers and bounded orchestration steps.
- **Queues:** durable task dispatch and retry; free-plan documentation currently states 10,000 queue operations per day and 24-hour message retention. Queue retention is not a substitute for durable application task history.
- **D1:** task records, worker registrations, approvals, run history and audit references, subject to its current free limits.
- **Cron Triggers:** periodic reconciliation and stale-lease recovery, within the free-plan trigger and CPU limits.
- **Durable Objects:** consider only if a single-owner coordinator/lease service is needed and the free SQLite-backed limits are confirmed.

Current Cloudflare documentation references:
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Queues limits: https://developers.cloudflare.com/queues/platform/limits/
- Queues on Workers Free: https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/
- Durable Objects pricing and free-plan availability: https://developers.cloudflare.com/durable-objects/platform/pricing/

The published free limits can change. At the time this design was researched, Cloudflare documents 100,000 Workers requests/day, 10 ms CPU/request and five Cron Triggers/account on Workers Free; Queues are available on Free with 10,000 operations/day and 24-hour retention. These figures must be rechecked against the account and current provider documentation before implementation. Exceeding a free limit must cause a visible, safe pause, never an automatic paid upgrade.

## 5. Task lifecycle and reliability

Use an explicit task state machine:

`queued -> leased -> running -> awaiting_approval -> completed`

Failure paths:
- transient provider/network failure: bounded retry with exponential backoff and jitter;
- worker disappears: lease expires, task returns to `queued`;
- retry budget exhausted: `dead_letter` with safe diagnostic and owner notification;
- approval required: `awaiting_approval`, no side effect until approved;
- free quota reached or uncertain: `paused_quota`, no paid fallback.

Every task should carry:
- immutable task ID and idempotency key;
- owner/principal ID and originating goal;
- allowlisted capability and provider lane;
- bounded input reference (not secrets);
- attempt count, lease expiry and timeout;
- approval requirement and approval record;
- result summary, evidence references and safe error category;
- created/updated/completed timestamps.

Use append-only audit events for task creation, dispatch, provider response category, approval, retry, completion and cancellation. Never store raw credentials or unredacted provider payloads in task logs.

## 6. Worker registration and device bridge

Workers register over outbound authenticated HTTPS; no public ADB, open inbound device ports, shared passwords, or unrestricted remote shell.

### Android phone worker
- A small AEGIS companion/broker receives signed, short-lived, allowlisted jobs.
- Use Android WorkManager for deferrable sync/reconciliation and an appropriately declared, user-visible foreground service only when continuous user-noticeable work is genuinely required.
- Use push notifications to wake/signal the app when supported; do not rely on permanent background polling.
- Pairing, accessibility, screen capture, app control and local-file access are separate permissions with visible status and revocation.
- Sensitive operations require on-device confirmation; no unattended messages, purchases, account changes or destructive actions.

Android guidance: https://developer.android.com/develop/background-work/background-tasks

### Chromebook worker
- Treat it as an optional local executor for browser sessions, files and development tools that cannot run in the cloud.
- It works only while the device, relevant app/session and network are available; cloud tasks must not depend on it.
- Register a worker heartbeat and capability list. When offline, expire its lease and return its jobs to the queue.
- Do not store provider secrets in ordinary files or expose a local unauthenticated control port.

## 7. Service adapters and simultaneous build coordination

Keep independent provider adapters and credentials:
- GitHub: repository, branch, PR and CI operations.
- Cloudflare: Pages/Workers/D1/Queues and account diagnostics.
- Krystal.io: custom adapter only after owner-provided restricted token is stored in the approved vault; begin with DNS reads.
- Oracle Cloud: separate tenancy identity and signing/resource-principal setup; begin with read-only identity/resource inventory.
- Composio: fixed allowlist and owner-scoped connection inventory; never arbitrary tool-slug execution.
- ChatGPT: human/operator reasoning and approval channel, not an assumed reusable session token.

A coordinator may run independent read-only inspections in parallel. Cross-service changes must be planned as a dependency graph and applied sequentially with verification. No credential from one provider may be reused as another provider's credential.

## 8. Approval policy

Autonomous without further approval:
- read-only inspection of already-authorised resources;
- local analysis and repository research;
- tests in isolated branches/environments;
- task retries within bounded limits;
- drafting proposed changes.

Explicit owner approval required:
- merge, production deploy or rollback;
- DNS, nameserver, domain, email/MX or hosting changes;
- IAM, roles, permissions, secrets or credential rotation;
- database writes/migrations outside disposable test databases;
- purchases, billing changes, paid plan activation or quota increases;
- social publishing, messaging or external communications;
- destructive or difficult-to-reverse operations;
- pairing or granting new phone/Chromebook permissions.

A kill switch must stop dispatch immediately while preserving the audit trail.

## 9. Owner contact and notifications

Use the AEGIS authenticated notification inbox as the source of truth. A device notification is a convenience channel, not the only record. The owner should be contacted only for:
- an approval that blocks progress;
- a missing account prerequisite or authorisation;
- a task that exhausted safe retries;
- a security event, quota pause or worker compromise;
- a concise milestone summary when a meaningful piece of work is verified.

Do not promise delivery through ChatGPT, SMS, email, Android push or Chromebook notifications until that channel is explicitly connected and tested.

## 10. Implementation sequence

1. Verify actual Cloudflare plan, Pages project, D1 bindings/migrations, existing Workers, Queues, Cron Triggers and free-tier usage. Read-only inventory only.
2. Define task schema, state transitions, idempotency, lease/recovery and append-only audit tests.
3. Implement queue-backed coordinator in an isolated branch and local/test environment; no production deployment.
4. Add a worker registry and authenticated outbound heartbeat protocol.
5. Add one low-risk GitHub read-only worker and verify dispatch/recovery.
6. Add Cloudflare read-only diagnostics and then other provider adapters independently.
7. Add Android and Chromebook workers only after the broker, permissions and kill switch are tested.
8. Add owner notification and approval UX.
9. Test quota exhaustion, provider outage, expired credentials, duplicate delivery, worker disconnect, prompt injection and kill-switch behaviour.
10. Deploy only after tests, preview review and explicit owner approval.

## 11. Verified observations at the time of writing

- PR #201's latest head `eee4bd50a0629a4fed4f40838a6030ddf07655a5` has a successful AEGIS test workflow, including Node tests and isolated D1 migration/capability/Forge verification.
- Cloudflare Pages posted a successful preview deployment for that commit; this is a preview, not a production deployment.
- A read-only Cloudflare Workers inventory returned one script, `lozwebsite`, in the authenticated account. It did not show an AEGIS-named Worker script. This does not prove that no AEGIS Pages Functions, Queues, D1 databases or Cron Triggers exist.
- The first Workers inventory attempt used a stale account identifier and was rejected; the retry against the account actually exposed by the connector succeeded. Do not reuse the stale identifier.
- No AEGIS queue-backed coordinator, paired Android worker, Chromebook worker or 24/7 AI reasoning loop has been verified as deployed.
- No production resource, DNS record, secret, device pairing or paid service was changed during this research.

## 12. Acceptance criteria

- Zero paid dependencies and no path that silently upgrades or incurs charges.
- Task state survives worker restarts and duplicate delivery.
- Offline phone/Chromebook workers do not block cloud-side work.
- Each provider remains isolated and least-privileged.
- Read-only work can proceed autonomously; high-impact writes require explicit approval.
- All task outcomes are auditable and secrets are redacted.
- Free quota exhaustion pauses safely and notifies the owner.
- Documentation clearly distinguishes an event-driven AEGIS coordinator from continuous operation by this ChatGPT session.
