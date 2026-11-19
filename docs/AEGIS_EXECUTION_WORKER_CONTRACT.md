# AEGIS execution-worker contract

Status: architecture contract draft  
Date: 16 November 2026  
Scope: browser and terminal execution workers behind Sentinel

This contract translates the source reviews of auto-browser, CorvidLabs/rune and OpenClaw into one AEGIS-owned execution boundary. It deliberately does not import any of those runtimes.

## 1. Non-negotiable ownership

AEGIS remains the product and policy authority:
- Sentinel owns principal identity, capability grants, exact resources, approval requirements, rate limits, budgets and invocation audit.
- Durable tasks own task state, retries, idempotency, cancellation and recovery.
- The encrypted vault owns provider/browser credentials.
- The worker owns only the isolated execution environment and its bounded local process/browser session.
- The model never receives a Docker API, host shell, raw CDP endpoint, Playwright WebSocket, worker service credential, cookie jar or vault secret.

A worker cannot grant itself permissions, approve itself, expand its own command/tool allowlist or change the AEGIS policy attached to a task.

## 2. Two worker types, one control contract

### Browser worker

Expose semantic operations only:
- `navigate` to an approved URL;
- `inspect` visible page structure/text;
- `click` an identified element;
- `type` into an identified field;
- `wait` for a bounded selector/state;
- `screenshot` with an explicit redaction policy;
- `download` and `upload` through bounded, scanned artifact flows;
- `human_takeover` through a single-session operator channel.

Never expose raw CDP or arbitrary page JavaScript to the model. Any future script-evaluation feature is a separate high-risk capability requiring human approval and an isolated profile.

### Terminal worker

Expose fixed command IDs only:
- `command_id` maps to a reviewed executable and fixed argument schema;
- working directory is an AEGIS workspace ID resolved by the worker, never a caller-supplied filesystem path;
- no arbitrary shell string, `sh -c`, environment map, executable path or host path from model input;
- persistent PTY sessions may be used for long-running CLIs/TUIs;
- output is incremental by cursor, byte-bounded and redacted;
- completion requires process state or an explicit completion sentinel, not PTY quiet time alone;
- human takeover is session-scoped and time-limited.

Rune may be evaluated as one implementation of this interface after its environment, permissions and command-sandbox gaps are addressed.

## 3. Control-plane protocol

The worker service is private and reachable only over mTLS or an equivalent authenticated private transport. Each request also carries a short-lived AEGIS-signed task token.

Proposed endpoints (not yet implemented):

| Endpoint | Purpose | Required controls |
|---|---|---|
| `POST /v1/sessions` | Create one browser or terminal session | Sentinel-authorised task, fixed worker type, workspace ID, image digest, policy hash, expiry |
| `POST /v1/sessions/{id}/actions` | Execute one semantic browser action or registered command | Action ID, exact resource, schema validation, approval ID when required, idempotency key, deadline |
| `GET /v1/sessions/{id}/events?cursor=` | Read bounded progress/output deltas | Session ownership, cursor bounds, output budget, redaction |
| `POST /v1/sessions/{id}/takeover` | Start a human takeover channel | Operator identity, single-session audience, short TTL, explicit audit event |
| `DELETE /v1/sessions/{id}` | Stop and destroy a session | Session ownership, process/container termination, secret/artifact cleanup |
| `GET /v1/health` | Worker readiness | No secrets or host details in response |

The model may propose an operation, but the AEGIS server resolves the command/action ID and resource from trusted context. The worker must independently reject unknown IDs and mismatched policy hashes.

## 4. Task identity token

The AEGIS server signs a short-lived worker token containing at least:
- token ID and issue/expiry times;
- principal ID;
- task ID and parent-task/session lineage;
- workspace ID;
- worker type and session ID (or a create-session audience);
- capability ID, action ID and exact resource ID;
- approval ID and approval expiry, if required;
- allowed command/action IDs;
- egress policy hash;
- maximum wall-clock time, output bytes and artifact bytes;
- nonce/idempotency key.

Tokens are purpose-specific and single-task. They are not general provider credentials. The worker rejects expired, replayed, wrong-session, wrong-workspace, wrong-action and wrong-resource tokens. A new or expanded tool surface requires a new Sentinel decision.

## 5. Isolation requirements

Production workers must meet all of these:
- run on a separate execution host/service, not inside the Cloudflare request runtime;
- one trust domain per worker identity and one isolated container/VM per session for untrusted content;
- non-root process; Chromium sandbox enabled for browser workers;
- read-only base filesystem, dropped capabilities, no-new-privileges and reviewed seccomp/AppArmor policy;
- no Docker socket in AEGIS or in a model-reachable container;
- no host network, host PID namespace, privileged mode or broad host mounts;
- only the authorised workspace and session scratch directory mounted;
- CPU, memory, PID, wall-clock, concurrent-session and disk quotas;
- fixed image digest and signed build provenance;
- private service networking and authenticated worker-to-controller channel.

A browser/terminal worker is not considered isolated merely because it runs in Docker. The kernel, network, mounts, credentials and control socket are part of the boundary.

## 6. Network and SSRF policy

All worker egress goes through a dedicated policy-enforcing proxy. The proxy must:
- deny loopback, RFC1918, IPv6 unique-local, link-local, multicast, reserved and cloud metadata destinations by default;
- resolve DNS and pin the validated destination for the connection;
- revalidate every redirect and every new connection;
- defend against DNS rebinding, alternate IP encodings, IPv4-mapped IPv6 and mixed public/private DNS answers;
- allow only task-scoped destinations where a use case requires outbound access;
- log hostname, resolved IP, decision, status and reason, never request bodies, cookies or authorization headers;
- fail closed if policy or proxy state is unavailable.

Browser page JavaScript and terminal child processes must not have a direct egress path around the proxy.

## 7. Secrets and workspace data

- The AEGIS vault is the source of provider credentials and browser auth state.
- Secrets are resolved just in time by trusted server code or a dedicated secret broker.
- Secrets are not passed in command-line arguments, PTY input, model context, browser local storage, logs or tool output.
- Worker child environments are constructed from an explicit allowlist; parent process environment inheritance is forbidden.
- Browser auth state is encrypted at rest and scoped to principal + provider + session; the worker receives only the credential material needed for that session.
- Transcripts and artifacts are encrypted at rest, size-bounded, retention-limited and access-controlled by principal/task.
- If redaction is requested and fails, the artifact is not shared or sent to a model.

## 8. Approval and human takeover

The following require a human approval bound to the exact task, session, capability, action and resource:
- write, delete, submit, purchase, publish, deploy or send actions;
- terminal commands that mutate files or execute code outside the safe command registry;
- uploads, downloads that can introduce executable content, or sharing artifacts;
- arbitrary JavaScript or privileged browser operations;
- network destinations outside the default read-only policy;
- credential/profile changes and session sharing.

Human takeover tokens are short-lived, one-session and one-purpose. Takeover does not expand the underlying grant. The audit records who took over, when, what they changed and when control returned to the agent. A human cannot be silently substituted as the agent's approval authority.

## 9. Audit and effect receipts

Every invocation records:
- Sentinel decision, grant ID, approval ID, principal, task/session lineage;
- capability/action/resource and input digest;
- worker type, image digest, policy hash and worker session ID;
- start/end time, timeout/exit state and bounded output/artifact digests;
- egress decisions and destination identifiers (not secrets or request bodies);
- redaction status and whether human takeover occurred.

The worker signs an effect receipt with a per-worker Ed25519 identity. AEGIS verifies the signature and records the receipt digest in its append-only audit. For stronger tamper evidence, the audit head is anchored outside the worker host. A local hash chain alone is not described as tamper-proof.

**Current implementation status:** the Sentinel audit schema now has optional `grant_id`, `connection_id`, `approval_id`, `task_id`, `session_id`, `parent_session_id`, `worker_id` and `adapter_receipt_id` columns. The AG-UI tool path maps its validated `runId` to `task_id`, `threadId` to `session_id`, and identifies the logical executor as `aegis-ag-ui`. These IDs are correlation fields only; they do not authorise an operation. Parent lineage is not yet populated, and approval records are not yet bound to task/session lineage. A trusted server-side session registry and lineage-bound approval workflow are still required before multi-agent delegation.

## 10. Failure behavior

Fail closed when:
- Sentinel, audit storage, token verification, approval validation or egress policy is unavailable;
- worker identity, image digest, policy hash or session ownership does not match;
- secret resolution or redaction fails;
- output exceeds the configured budget;
- a worker attempts an unknown command/action, path, host or protocol.

For transient worker loss, the durable task remains retryable. The retry uses the same idempotency key and reconciles the previous worker/session state before repeating an action. A task is never marked successful merely because the worker process started or PTY output became quiet.

## 11. Acceptance tests

A production worker is not approved until tests prove:
1. no raw CDP or arbitrary shell interface is exposed to the model;
2. invalid, expired, replayed and cross-session task tokens are rejected;
3. one principal cannot list, attach to or read another principal's session;
4. worker children do not inherit AEGIS/provider/vault environment secrets;
5. command IDs map only to fixed argv templates and authorised workspace roots;
6. private/metadata/internal IPs are blocked, including redirects and DNS rebinding;
7. the worker has no Docker socket, privileged mode or host filesystem mount;
8. browser container is non-root with Chromium sandbox enabled and read-only base filesystem;
9. output, transcripts, screenshots, downloads and uploads are bounded;
10. redaction failure prevents external sharing;
11. write/execute actions require exact human approval and cannot self-approve;
12. human takeover is single-session, short-lived and fully audited;
13. worker receipts verify and task retries are idempotent;
14. session stop kills the process group/container and removes secrets/scratch data.

## 12. Implementation order

1. Finish and review the Composio read-only integration as the first external provider example.
2. Add purpose-scoped task identity tokens and approval/session lineage to AEGIS.
3. Define the private worker API and signed receipt format.
4. Build the terminal worker behind fixed command IDs, using Rune only as a reference.
5. Build the browser worker behind semantic actions, using auto-browser only as a reference.
6. Add egress proxy enforcement and adversarial integration tests.
7. Only then connect specialist agents to browser/terminal workers.

No worker runtime or third-party source code is added by this contract.
