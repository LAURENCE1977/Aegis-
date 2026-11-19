# AEGIS Browser Broker Contract

**Status:** design specification only. No browser runtime, external browser service, Docker socket, or browser credential has been connected by this document.

## Objective

Give ODIN/AEGIS controlled browser capability without moving privileged execution into the Cloudflare control plane or importing a second agent permission system.

The browser is an execution resource, not an authority. AEGIS Sentinel owns capability discovery, principal/resource grants, approvals, invocation policy and audit. A separate browser worker owns the browser process and per-session state.

## Trust boundaries

1. **AEGIS control plane (Cloudflare):** authenticates the owner, validates the exact request, checks the registered capability, grant, connection, budget and approval, and records append-only invocation events. It does not launch a browser, accept arbitrary CDP commands, or hold a Docker socket.
2. **Browser broker:** accepts only short-lived, signed, narrowly scoped execution tickets from AEGIS. It verifies ticket expiry, nonce, session binding, action, domain policy and request digest before forwarding a typed operation.
3. **Browser worker:** runs one isolated browser context per session. Authenticated sessions should use a separate process/container or stronger boundary per trust domain, not merely a new tab. Browser workers receive only the files and credentials explicitly assigned to that session.
4. **Human operator:** approves high-impact actions against a canonical summary and immutable input digest. The approval is consumed once immediately before execution.

A compromised browser worker must not be able to mint grants, approve its own actions, read another session's profile, or call privileged AEGIS APIs with the user's identity.

## Proposed capability surface

These are proposed action identifiers, not currently registered or executable capabilities.

| Action | Effect / risk | Approval | Required behaviour |
|---|---|---|---|
| `browser.session.create` | execute / medium | human-always | Create a clean, unauthenticated session with a bounded lifetime and explicit egress policy |
| `browser.session.open-auth-profile` | execute / high | human-always | Bind one owner-authorised auth profile to one isolated session; never accept a raw profile path |
| `browser.page.observe` | read / low | none after session grant | Return bounded text/accessibility data; redact secrets and restrict response size |
| `browser.page.navigate` | execute / medium | human-always for first navigation or domain change | Permit only approved HTTPS hosts; reject IP literals, private/link-local/metadata ranges and unsafe redirects |
| `browser.page.interact` | write / high | human-always | Typed allowlisted actions only; no arbitrary JavaScript or raw CDP |
| `browser.file.download` | write / high | human-always | Save into a per-session quarantine area; scan/type-check before attaching to a project |
| `browser.file.upload` | execute / critical | human-always | Exact destination, filename, byte digest and data classification shown to owner; explicit confirmation required |
| `browser.session.close` | write / low | none | Revoke session ticket and destroy context/profile copies; idempotent cleanup |

The capability registry already enforces that write/execute and high/critical actions use `human-always`. The final manifest must also specify data reads/writes, allowed egress hosts, auth mode, rate limit, timeout, request-size limit, provenance, licence review and a candidate/reviewed/approved status. A manifest stays `candidate` until the worker, broker, threat model and end-to-end tests have passed.

## Request and approval binding

Every operation is canonicalised and bound to:

- owner/principal ID;
- capability ID and immutable version;
- action ID;
- browser session/resource ID;
- provider connection ID, if an auth profile is used;
- exact target origin and operation summary;
- SHA-256 digest of the complete validated input;
- expiry, unique nonce and one-time invocation ID.

The approval is not a general permission to use a browser. It authorises only that exact operation and digest, for that resource, principal, connection and capability version. Any changed URL, destination, file, form payload or session invalidates the approval and requires a new one. The worker cannot change the operation after approval.

## Browser worker requirements

- No Docker socket in the AEGIS control plane. If Docker is used on a separate host, the broker must be the only narrowly exposed client of that host and must not offer arbitrary container creation.
- Dedicated unprivileged runtime identity; read-only root filesystem where practical; drop all unnecessary capabilities; `no-new-privileges`; seccomp/AppArmor or equivalent; bounded CPU, memory, PIDs, disk, runtime and network egress.
- No host filesystem mounts except narrowly scoped per-session directories. No host network, host PID, privileged mode or device mounts.
- One session identity per profile. Never mount the whole auth root into a browser container. Profile files are encrypted at rest, short-lived where possible, and deleted on close/expiry.
- Network egress is allowlisted at the worker boundary, not just checked in the UI. Resolve DNS safely, re-check redirect destinations, reject loopback/private/link-local/cloud-metadata addresses and prevent DNS rebinding/SSRF.
- No raw CDP endpoint exposed to the model. Do not expose `Runtime.evaluate`, `Runtime.callFunctionOn`, cookie APIs, permission escalation, request interception or arbitrary navigation through a generic passthrough.
- Downloads are quarantined, bounded by byte count and content type, malware-scanned where available, and never auto-executed. Uploads are always human-approved.
- Browser observations are untrusted data. Page text, screenshots, downloaded files and DOM attributes cannot issue tool instructions, change policy, approve actions or override system/developer instructions.
- Secrets never appear in logs, traces, screenshots, model prompts or browser tool receipts. Redaction is tested against actual pixels and serialized payloads, not merely mocked return values.
- Every action has a deadline, cancellation path, audit receipt, output-size limit and cleanup path. Cleanup failures are surfaced as unhealthy state, not silently reported as success.

## Minimum verification before enabling

1. **Isolation:** two concurrent sessions cannot read cookies, storage, downloads, traces, auth files or takeover surfaces belonging to each other.
2. **Auth:** no exposed API starts without strong authentication; token rotation/revocation and per-principal attribution are tested.
3. **Approval:** unapproved, expired, replayed, mismatched-digest, wrong-session, wrong-connection and wrong-principal requests are denied at both broker and execution boundary.
4. **Network:** SSRF tests cover IPv4/IPv6 loopback, RFC1918, link-local, metadata endpoints, DNS rebinding, redirects, alternate encodings and WebSocket/CDP paths.
5. **Browser API:** raw CDP is absent; typed operations reject unknown actions, unexpected fields, oversized input and unsafe selectors/URLs.
6. **Privacy:** screenshot and text redaction are verified using real images and representative secrets; failure to redact is fail-closed for external sharing.
7. **Lifecycle:** crash/restart, timeout, cancellation, orphan cleanup, storage exhaustion and worker disconnection all leave no reusable session credential.
8. **Supply chain:** pin image digests and dependencies; scan SBOM and image; review licence and vulnerability advisories for browser, fonts, codecs and automation libraries.
9. **Audit:** each allowed/denied action emits a durable event with exact digest, principal, session, capability version, approval and worker receipt. Missing audit persistence blocks execution.

## Integration sequence

1. Keep the capability candidate disabled while the request/receipt schemas and threat model are reviewed.
2. Build a mock browser broker adapter and prove Sentinel grant/approval/audit behaviour with deterministic tests.
3. Build a separate worker prototype on an isolated Linux host; do not run it on the user's iPad or inside Cloudflare Workers.
4. Add adversarial isolation and network tests before enabling any authenticated session.
5. Add a small owner-only read-only pilot, then expand one action at a time. Uploads, purchases, payments, account changes and public posting remain separately gated.
6. Only mark the capability approved after the owner-facing consent, operational monitoring and end-to-end verification are complete.

## Explicit non-goals

- No anti-bot or CAPTCHA bypass, stealth fingerprinting, or evasion of website controls.
- No unattended account creation, payments, purchases, public posting or destructive account changes.
- No autonomous approval, no model self-approval, and no fallback to an unreviewed browser provider.
- No dependency on a paid browser SaaS to make the core AEGIS workspace usable.


## Sentinel audit semantics and recovery

The existing Sentinel invocation path has two distinct audit boundaries:

- **Pre-execution authorization audit:** the `invocation_authorized` event must be durably recorded before the adapter is called. If this write fails, execution is blocked. A browser broker must preserve this fail-closed boundary and must not start or mutate a browser session without it.
- **Post-execution outcome audit:** an adapter side effect may already have happened before the `invocation_succeeded` event is written. If this write fails, the outcome is not safely reversible and must not be reported as if execution had been denied. Sentinel currently returns `allowed: true`, `reasonCode: SUCCESS_AUDIT_UNAVAILABLE` and `auditRecorded: false` in this case.

A production browser integration therefore needs a durable reconciliation path for missing outcome receipts. The broker should persist a bounded, tamper-evident execution receipt keyed by invocation ID and input digest, retry outcome-event delivery idempotently, and expose an operator-visible audit-degraded state until reconciliation succeeds. Receipt storage must not contain cookies, credentials, page bodies or raw form values. Reconciliation must never replay the browser action; it only repairs the audit record. If receipt persistence itself fails after a side effect, surface an explicit critical unresolved-outcome state and retain enough non-secret correlation metadata for manual investigation.

Denied and pre-execution failures must also preserve Sentinel's audit-unavailable behaviour: inability to durably record a denial must never cause the requested browser action to run. Tests must separately cover pre-execution audit failure, post-execution audit failure, receipt retry, duplicate delivery, worker crash after side effect, and receipt-store failure. The broker must not claim that an action failed merely because its final audit write failed.
