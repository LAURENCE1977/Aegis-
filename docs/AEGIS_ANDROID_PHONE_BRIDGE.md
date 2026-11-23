# AEGIS Android phone bridge — implementation contract

**Status:** backend pairing endpoints, D1 registry migration, browser-safe credential handling, the AEGIS Devices screen, owner-approved agent-plan assignment and device-authenticated read-only plan observation are implemented in the PR branch. CI Node tests and isolated local D1 migration/smoke checks pass. No real phone is paired, no native Android app is installed and production has not been changed.
**Parent:** free-first orchestration work in PR #202.
**Cost policy:** zero paid services, no trials, no billing activation, no automatic upgrade.

## 1. What the phone connection is

The ChatGPT Android app does not expose a supported API that lets AEGIS or this chat control Android settings, files, apps, screen or input. ChatGPT-side GitHub/Cloudflare/Composio authorisations also do not become credentials inside AEGIS.

The supported direction is an AEGIS-owned Android client connecting outbound over HTTPS to the AEGIS runtime. The phone is an optional worker and owner console; cloud-side task state remains authoritative and continues when the phone is offline.

First client target: an installable Android PWA for sign-in, task/approval visibility and device health. A native Android companion can follow only where background execution or OS APIs justify it. A PWA is not represented as a reliable always-on executor.

## 2. Trust boundaries

- The runtime's `AEGIS_JOB_TOKEN` is an owner/admin credential and must never be copied to a phone.
- Each enrolled device receives its own high-entropy, revocable credential. Store only a one-way hash server-side. Browser/PWA enrolment sets a Secure, HttpOnly, SameSite=Strict cookie and does not expose the credential to page JavaScript; native enrolment returns the credential once for Android Keystore storage.
- Pairing is initiated by an authenticated AEGIS owner session, uses a short-lived single-use code/QR, and is rate-limited. The phone confirms the device name and requested permissions before enrolment.
- Device identity, owner identity, platform, granted capabilities, token version, last-seen time and revocation state are stored in D1. Audit pairing, heartbeat, permission changes, token rotation and revocation without logging credentials.
- Device requests use HTTPS, bounded JSON and strict same-origin checks where a browser origin exists. Pairing invitations are limited to five per owner per hour; heartbeats are throttled to one per device per 30 seconds. Replay-resistant timestamps/nonces must be added before command delivery.
- Revocation takes effect on the next request. Token rotation invalidates the previous token. A lost phone can be revoked from the owner console.

## 3. Initial capability allowlist

Initial enrolled-device capabilities are observational only:

- `device.status.read` — report app version, platform and coarse connectivity state.
- `aegis.jobs.observe` — list only jobs explicitly assigned to that device and read their safe status.
- Approval-inbox access is deliberately withheld: no device approval-review endpoint or decision-relay workflow is implemented yet. It must not be offered as a granted capability until that path has its own Sentinel policy, owner confirmation, replay protection and audit coverage.

Not enabled in the first slice: shell/ADB, arbitrary process launch, arbitrary URL fetch, accessibility automation, screen capture, microphone/camera, contact/message access, purchases, account changes, unrestricted file reads/writes, or background keystrokes.

Any later local capability must have its own exact action schema, scope, expiry, on-device permission, Sentinel approval policy and audit event. A device registration is never itself permission to execute work.

## 4. Background behaviour

- Android PWA: foreground use and best-effort browser push only after the owner explicitly enables notifications. Browser lifecycle restrictions apply.
- Native Android: use WorkManager for deferrable sync and a user-visible foreground service only for work that genuinely qualifies. Do not promise uninterrupted execution; Android may defer or stop work.
- Use bounded heartbeats and exponential backoff. Do not poll continuously or waste free-tier Worker requests.
- Cloud queue, leases and retry state remain authoritative. An offline device loses its lease; the task returns to the queue and can be picked up elsewhere.
- Chromebook uses the same versioned device API as a separate optional worker, not a privileged master device.

## 5. Pairing and API sequence

1. Owner signs in to AEGIS on the phone or another trusted browser.
2. Owner requests a device pairing invitation. The server creates a random, short-lived, single-use invitation and stores only its hash.
3. Phone scans the QR or enters the invitation, verifies the displayed AEGIS origin and requested capabilities, and confirms pairing locally.
4. Server consumes the invitation atomically, creates a device ID and per-device token, stores only the token hash, and returns the raw token once over HTTPS.
5. Browser clients receive a Secure, HttpOnly, SameSite=Strict cookie; native clients store the one-time token in Android Keystore. Never place tokens in URLs, logs, source code or browser localStorage.
6. Client sends a bounded heartbeat. Server verifies the device token hash, revocation state, owner and rate limit, then records last-seen status.
7. Owner can inspect, rotate or revoke the device from the AEGIS control centre.

Implemented Pages API routes in this branch: `POST /api/devices` creates an owner-authenticated invitation; `GET /api/devices` lists safe device metadata; `PATCH /api/devices` revokes an owner device; `POST /api/device-enrol` atomically redeems a single-use invitation; `POST /api/device-heartbeat` authenticates a device-specific credential; and `POST /api/device-assign-run` assigns a planned agent run to an active owner device with `aegis.jobs.observe`. The runtime exposes `GET /v1/devices/{deviceId}/agent-runs`, authenticated with that device's own credential, and returns only plans explicitly assigned to that device. The same-origin Pages route `GET /api/device-agent-runs?deviceId={deviceId}` provides the equivalent read-only projection to the browser PWA using its Secure, HttpOnly device cookie; native clients can use the runtime endpoint with the `Device` authorization scheme. The assignment column/index is added by `migrations/runtime/0005_device_agent_run_assignments.sql`. This is read-only observation, not remote task execution. The runtime's `AEGIS_JOB_TOKEN` is never issued to a phone. **Critical binding requirement:** Pages `AEGIS_DB` and the runtime Worker's `DB` must point to the exact same runtime D1 database ID. The device registry, pairing records, `agent_runs`, and assignment column are a shared data model; two separate runtime databases will make owner assignment appear successful while the device runtime cannot see the device or assigned plan. Separately, Pages `CAPABILITY_DB` and the runtime Worker's `CAPABILITY_DB` must point to the dedicated capability D1 database for grants, provider connections/secrets, approvals, invocation audit and rate limits. Never point either capability binding at the runtime database. Verify both binding pairs before any deployment. These endpoints still require an owner-approved deployment before they are live.

## 6. Free-first constraints

- Reuse the existing AEGIS runtime and D1/Queue design; do not introduce a second coordinator.
- Before provisioning, verify the actual Cloudflare plan, account-wide remaining quota and the current free-tier terms.
- No paid push provider, hosted model, API credits, paid automation or trial conversion.
- If the free allowance cannot be verified or is exhausted, pause sync/dispatch safely. Never enable paid usage automatically.
- Use local test fixtures and CI before any remote resource creation. No production D1 migration, Worker deployment, DNS change or secret configuration is part of this design document.

## 7. Acceptance criteria before calling the phone connected

- Pairing requires a valid owner session and a single-use invitation with a short expiry.
- Invitation replay, expired invitation, wrong owner, brute-force attempts and revoked device are rejected.
- Raw device tokens never appear in D1, audit events, URLs, logs or error responses.
- Device capabilities are server-derived from an allowlist; client input cannot self-grant permissions.
- Heartbeat requests are authenticated, bounded, rate-limited and idempotent.
- Offline/reconnected device behaviour does not duplicate or lose durable tasks.
- Owner can revoke a device and observe the revoked state.
- Tests cover the complete flow with disposable D1; no production resource is needed for CI.
- Browser PWA can read only the plans assigned to its own active device through the same-origin HttpOnly-cookie route; native clients can use their per-device credential directly. Neither route exposes job tokens or supports task execution.
- Real Android installation, permission review and a successful heartbeat are required before reporting the phone as paired.

## 8. Delivery order

1. **Implemented:** pure registration, heartbeat, pairing-code and credential validators with tests.
2. **Implemented:** D1 device/invitation schema and append-only device-event table; local migration smoke checks pass.
3. **Implemented:** owner-authenticated invitation create/list/revoke APIs and single-use enrolment API.
4. **Implemented:** authenticated, throttled heartbeat and revocation; token rotation remains outstanding.
5. **Implemented:** mobile-friendly AEGIS Devices screen for creating codes, pairing this browser/phone, checking connection and revoking devices.
6. **Implemented:** owner-approved assignment of planned agent runs to an active device with the observation capability; device-authenticated `GET /v1/devices/{deviceId}/agent-runs` returns only that device's assigned plans. This first slice is read-only; no device execution or approval consumption is enabled.
7. **Next:** build a native Android companion for Android Keystore and WorkManager-backed sync; browser PWA remains best-effort only.
8. **Next:** add Chromebook as a second client against the same contract.

**Current verified state:** the source-level pairing flow and Devices UI are covered by the AEGIS Node test suite; the `0004_devices.sql` migration and device registry smoke fixture pass against disposable local D1 in CI. No production D1 migration or Pages deployment has been performed. No actual phone has completed pairing or heartbeat yet, and device-assigned jobs are not enabled.

## 9. Owner-facing planned-run inventory (2026-11-23)

- Added owner-session-authenticated `GET /api/agent-runs`, returning a maximum of 50 recent runs with a deliberately small projection: ID, objective, status, parsed plan, assigned device ID and timestamps. Internal idempotency keys, specialist storage, error internals and credentials are not returned.
- The current AEGIS runtime is single-owner; the endpoint relies on the existing owner session and does not claim multi-tenant row isolation.
- The Devices panel now displays the planned-run inventory and offers assignment only for runs in `planned` state and active devices carrying `aegis.jobs.observe`.
- Assignment reuses the existing owner-authenticated `POST /api/device-assign-run` route. It grants read-only observation, not execution, shell access, approval consumption or permission escalation. A planned run can only be assigned once; silent reassignment is rejected so the original device's assignment cannot be overwritten.
- The endpoint, frontend and regression tests are committed to the PR #202 feature branch. The follow-on capability-tightening and single-assignment guard are covered by fresh regression tests; CI for the latest head is running. Treat the change as verified only after the full Node suite and isolated D1 checks complete.
- No production deployment, database migration, device pairing or device-side execution has been performed.
