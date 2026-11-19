# AEGIS source review: auto-browser

Reviewed: 16 November 2026  
Repository: https://github.com/LAURENCE1977/auto-browser  
Default branch: `main`

This is a source-level architecture and security review for possible AEGIS integration. It is not a penetration test, a legal opinion, or a claim that the external project has been built or deployed by AEGIS. No source code was copied.

## Executive decision

**Keep auto-browser as the leading reference for a separately hosted browser worker, not as a library or a drop-in AEGIS runtime.**

It has several strong ideas worth adopting at the interface and policy level:
- per-session browser contexts and an optional per-session container mode;
- explicit tool classes (read-only, non-idempotent read, destructive and open-world);
- governed workflow profiles and human approval;
- a constrained raw-CDP allowlist;
- encrypted auth-state handling and bounded auth-profile archives;
- before/after action evidence, audit events and signed witness receipts;
- PII scrubbing of text, network bodies, console messages and screenshots.

The current isolated-container deployment still needs hardening before it should be trusted with AEGIS users' credentials or untrusted pages.

## Findings worth reusing as patterns

### 1. Tool taxonomy and governance

`controller/app/tool_gateway/registry.py` classifies tools into:
- read-only;
- read-only but non-idempotent/cost-bearing;
- destructive;
- open-world.

It also emits MCP annotations for read-only, destructive, idempotent and open-world behavior. `McpToolGateway` routes governed tools through an approval check, and explicitly requires `workflow_profile=governed` for `browser.eval_js`.

**AEGIS mapping:** retain the existing Sentinel capability manifest and exact-resource grant model. Add equivalent open-world/idempotency metadata only if the browser-worker interface needs it; do not add a second approval authority. Browser navigation, arbitrary page scripting, CDP attachment, downloads/uploads, session sharing and authenticated profile changes should be treated as open-world or consequential operations, not ordinary low-risk reads.

### 2. Action pipeline

`controller/app/actions/pipeline.py` evaluates Witness policy before execution, takes a before snapshot, blocks policy-denied actions, performs the action, takes an after snapshot, and records audit/Witness evidence. URL policy is checked at runtime; bot challenges request human takeover.

**AEGIS mapping:** preserve the same ordering in the worker protocol:
1. Sentinel authorises the exact capability, resource and connection.
2. The worker checks the exact session and destination policy.
3. A human approval token is validated for consequential actions.
4. The worker executes one bounded action.
5. The worker returns a structured effect receipt and bounded observation.
6. AEGIS records the result in its own append-only audit.

Never let the worker's internal policy replace Sentinel.

### 3. Raw CDP boundary

`controller/app/cdp/passthrough.py` exposes a short read-only command allowlist. It deliberately excludes:
- `Runtime.evaluate`, which can execute arbitrary JavaScript in the page context, steal cookies from authenticated profiles and bypass navigation restrictions;
- `Network.getCookies`, which can return HttpOnly cookie material.

The code notes that internal element-intelligence helpers use narrowly constructed CDP calls, while the separately governed `browser.eval_js` tool has its own approval path.

**AEGIS decision:** do not expose raw CDP to the model. AEGIS should offer semantic operations (navigate, inspect, click, type, wait, screenshot) and keep any script evaluation in a separate high-risk, human-approved path. Never return cookies, local storage, auth headers or raw storage state to the model.

### 4. Auth-state handling

`controller/app/auth_state.py` enforces `REQUIRE_AUTH_STATE_ENCRYPTION` on the read path as well as construction, rejects plaintext state when encryption is required, and creates a per-session copy before loading state into a new context. Auth-profile export/import has archive member, per-file and total-expanded-size limits, path validation and dedicated Witness receipts.

**AEGIS mapping:** encrypt credentials at rest, resolve them only inside the trusted adapter, bind them to a principal and provider, and never place credentials in model context, tool output, browser storage or logs. Re-check the active connection at invocation time to avoid using a revoked connection.

### 5. Evidence and signing

`controller/app/witness.py` hash-links receipts and can sign each chain hash with Ed25519. `witness_anchor.py` stores a separate head-hash/receipt-count anchor and detects a shortened or rewritten local chain. The project correctly documents the limits: an attacker who can rewrite both chain and local anchor can still defeat it; key compromise can rewrite and re-sign history; multi-worker writers need a shared ordering/anchoring design.

**AEGIS mapping:** its existing append-only audit remains authoritative. A future evidence-export feature could add signed, independently verifiable bundles and a remote anchor/countersignature. Do not describe a local hash chain alone as tamper-proof.

### 6. PII and network inspection

The current network inspector masks sensitive request/response header values (Authorization, Cookie, Set-Cookie, API keys, CSRF and proxy credentials), bounds captured bodies, and applies PII scrubbing to text-like bodies. Screenshot redaction now uses OCR bounding boxes and pixel-diff regression coverage.

One deliberate availability trade-off remains: if Pillow cannot decode an image, the scrubber returns the original image bytes and records the hits. The audit calls out that this is not a redacted image.

**AEGIS decision:** if redaction is required for an export, shared artifact or external model call, failure to redact must fail closed. An unredacted fallback must never be labelled or treated as redacted.

## Deployment/security blockers for direct reuse

### A. Docker socket is a high-authority control-plane credential

`docker-compose.isolation.yml` mounts `/var/run/docker.sock` into the controller so it can provision per-session containers. Access to a Docker daemon socket is effectively host-level authority. It must never be available to a model or to an internet-facing, weakly isolated control plane.

**AEGIS decision:** do not mount the host Docker socket into AEGIS. If using this project, run its controller on a separate trusted host or replace Docker access with a narrow, authenticated worker/orchestrator service that can create only fixed, policy-constrained browser sessions.

### B. The browser container is not yet hardened enough for an AEGIS trust boundary

The inspected `browser-node/Dockerfile` does not set a non-root `USER`. `browser-node/server.mjs` launches Chromium with `chromiumSandbox: false` and listens on `0.0.0.0:9223`. `session_isolation.py` creates containers with per-session profile/download mounts and configurable memory/PID/CPU limits, but the shown container creation does not set a non-root user, read-only root filesystem, dropped capabilities or an explicit no-new-privileges security option. It attaches the container to the controller's Docker network. The Playwright WebSocket port is internal to that network rather than host-published, but it is not independently authenticated in the inspected server code.

**AEGIS decision:** before production use, require:
- non-root browser process and Chromium sandbox enabled;
- read-only root filesystem, dropped Linux capabilities, no-new-privileges and a reviewed seccomp profile;
- per-session network isolation or a strict egress proxy/allowlist, not the general controller network;
- no host Docker socket or host filesystem mounts beyond the session's dedicated scratch/profile volumes;
- a fixed image digest, resource limits and bounded session lifetime;
- authenticated, short-lived, per-session worker credentials for the controller-to-worker WebSocket/API;
- explicit download/upload controls and no access to cloud metadata, internal admin services or other users' sessions.

### C. Shared mode is not a multi-tenant isolation boundary

The session-isolation audit verifies separate Playwright BrowserContexts, per-session auth-state copies and per-session artifact directories. It also documents that the default `shared_browser_node` shares a Chromium process, display and noVNC takeover surface. The optional `docker_ephemeral` mode improves the boundary, but does not by itself fix the container-hardening and Docker-network concerns above.

**AEGIS decision:** do not use shared-browser mode for different users or trust domains. Use one isolated worker/container per session, and treat confidential sessions as requiring the stronger mode.

### D. PII redaction is not a substitute for data minimisation

The August 2026 execution audit documents prior silent failures in screenshot redaction, PII pattern configuration, auth-state encryption enforcement, MCP export, JavaScript parsing and CI test collection. The maintainers report those findings fixed across v1.5.1–v1.6.0, and report the test suite grew from 637 to 873 tests after CI was changed to collect pytest-style tests.

This history is valuable because it demonstrates why effect-level tests matter: a test that checks a “redaction succeeded” event is not enough; the output pixels must actually change. It also means AEGIS must pin and re-audit an exact commit before any future reuse, rather than relying on old README claims or an unpinned tag.

## Recommended AEGIS integration shape

```text
AEGIS UI / Agent
      |
      v
Sentinel (identity, exact grant, approval, rate limit, audit)
      |
      v
AEGIS Browser Worker Adapter
      |  mTLS + short-lived per-session token
      v
Isolated Browser Worker
      |  fixed semantic operations only
      v
Per-session browser container
      |
      v
Egress proxy / destination allowlist
```

The worker returns only bounded, redacted observations and signed effect receipts. AEGIS records the authoritative decision and invocation outcome. The model never receives a Docker API, CDP endpoint, browser WebSocket URL, auth-state file, cookie jar or host path.

## Reuse map

| Auto-browser component | AEGIS treatment |
|---|---|
| Tool taxonomy and MCP annotations | Adapt the classification pattern into Sentinel capability metadata if needed |
| Action pipeline with pre/post snapshots | Adapt the sequence; keep Sentinel as policy authority |
| Raw CDP read-only allowlist | Adopt the deny-by-default principle; no raw CDP model tool |
| Auth-state encryption and per-session copies | Adopt the security requirements, not the storage implementation |
| PII scrubber and network-header masking | Reimplement or adapt only after pixel-level and payload-level tests; fail closed on redaction failure |
| Witness Ed25519 receipts and anchor | Consider for a later AEGIS signed evidence-export feature |
| Docker session provisioner | Do not import into Cloudflare; use a separately hardened worker/orchestrator |
| noVNC takeover UI | Consider only as an optional operator console with per-session auth and private networking |

## Provenance and limits

The root LICENSE declares MIT and names JAI Studios as copyright holder; the README links to the upstream `LvcidPsyche/auto-browser` project. The connected account's repository ownership does not establish authorship or remove upstream notice obligations. No source files were copied in this review.

Reviewed material included the current README, root licence, CI workflow, Docker Compose files, selected controller/browser-node modules, session-isolation audit, August 2026 execution audit, and focused tests. This was not a full line-by-line security audit; no containers were built, no live browser sessions were run, and no external penetration test was performed.

## Decision

**Do not merge the browser runtime into AEGIS.** Keep auto-browser as the leading browser-worker reference. Before any production connection, complete a pinned-commit code review, harden the container/network boundary, define the narrow authenticated worker API, and run end-to-end security tests against real browser effects.
