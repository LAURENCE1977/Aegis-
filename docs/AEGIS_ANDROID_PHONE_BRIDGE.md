# AEGIS Android phone bridge — implementation contract

**Status:** design contract for the next implementation slice; no phone is paired and no Android app is installed.
**Parent:** free-first orchestration work in PR #202.
**Cost policy:** zero paid services, no trials, no billing activation, no automatic upgrade.

## 1. What the phone connection is

The ChatGPT Android app does not expose a supported API that lets AEGIS or this chat control Android settings, files, apps, screen or input. ChatGPT-side GitHub/Cloudflare/Composio authorisations also do not become credentials inside AEGIS.

The supported direction is an AEGIS-owned Android client connecting outbound over HTTPS to the AEGIS runtime. The phone is an optional worker and owner console; cloud-side task state remains authoritative and continues when the phone is offline.

First client target: an installable Android PWA for sign-in, task/approval visibility and device health. A native Android companion can follow only where background execution or OS APIs justify it. A PWA is not represented as a reliable always-on executor.

## 2. Trust boundaries

- The runtime's `AEGIS_JOB_TOKEN` is an owner/admin credential and must never be copied to a phone.
- Each enrolled device receives its own high-entropy, revocable credential. Store only a one-way hash server-side; display the raw credential once during pairing.
- Pairing is initiated by an authenticated AEGIS owner session, uses a short-lived single-use code/QR, and is rate-limited. The phone confirms the device name and requested permissions before enrolment.
- Device identity, owner identity, platform, granted capabilities, token version, last-seen time and revocation state are stored in D1. Audit pairing, heartbeat, permission changes, token rotation and revocation without logging credentials.
- Device requests use HTTPS, bounded JSON, strict origin handling where a browser origin exists, replay-resistant timestamps/nonces where commands are introduced, and per-device rate limits.
- Revocation takes effect on the next request. Token rotation invalidates the previous token. A lost phone can be revoked from the owner console.

## 3. Initial capability allowlist

Initial enrolled-device capabilities are observational only:

- `device.status.read` — report app version, platform and coarse connectivity state.
- `aegis.jobs.observe` — list only jobs explicitly assigned to that device and read their safe status.
- `aegis.approvals.review` — display an approval request and relay the owner's explicit decision; it cannot approve on the owner's behalf.

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
5. Client stores the token in platform-protected storage; never in URL parameters, logs, source code or browser localStorage.
6. Client sends a bounded heartbeat. Server verifies the device token hash, revocation state, owner and rate limit, then records last-seen status.
7. Owner can inspect, rotate or revoke the device from the AEGIS control centre.

The runtime's current bearer-only API does not yet implement this pairing sequence. Do not simulate pairing by sharing `AEGIS_JOB_TOKEN` or a ChatGPT connector credential.

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
- Real Android installation, permission review and a successful heartbeat are required before reporting the phone as paired.

## 8. Delivery order

1. Add pure registration/invitation/token validators and tests.
2. Add D1 device and append-only device-event schema.
3. Add owner-authenticated invitation create/revoke and device enrolment routes.
4. Add per-device heartbeat, status and token rotation/revocation routes.
5. Add the minimal Android PWA pairing/status/approval UI.
6. Add assigned-job delivery only after task schemas, leases, Sentinel policy and approval consumption are connected.
7. Evaluate a native Android worker for WorkManager-backed sync after PWA limitations are measured.
8. Add Chromebook as a second client against the same contract.

**Current verified state:** AEGIS has an independent runtime source tree and plan-only specialist orchestration, but its runtime resources are not deployed. No Android companion, pairing endpoint, device registration or phone connection is currently verified.
