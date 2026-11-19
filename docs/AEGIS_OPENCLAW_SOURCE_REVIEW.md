# AEGIS source review: OpenClaw gateway patterns

Reviewed: 16 November 2026  
Repository: https://github.com/LAURENCE1977/openclaw  
Default branch: `main`  
Licence: MIT (root licence reviewed)

This is a targeted architecture/security-pattern review of the connected account's OpenClaw repository. The codebase is very large; this is not a full security audit and no source code was copied.

## Executive decision

**Use OpenClaw as a reference for device pairing, operator scopes, approval audience, runtime identity and egress proxy design. Do not embed its gateway or agent runtime into AEGIS.**

OpenClaw is a complete multi-channel agent gateway with its own sessions, tools, plugins, devices, approvals, sandboxing and provider integrations. AEGIS already has its own product/workspace model, durable tasks and Sentinel. Adding the whole gateway would create two authorities and duplicate the most security-sensitive systems.

## Patterns worth adapting

### 1. Separate device admission from capability approval

The pairing design has two distinct gates:
- device pairing admits a device identity to the gateway;
- node capability approval controls which declared commands/capabilities that paired device may expose.

A new or widened capability surface becomes a pending request; it does not grant access until approved. The gateway compares the live connection's pairing identity and generation with the persisted approval before updating the active surface. A short-lived bootstrap token (10 minutes) is distinct from the durable paired-device credential.

**AEGIS mapping:** keep device enrolment, user identity, provider connection and capability grants as separate state machines. Pairing a phone, tablet or worker must never automatically grant filesystem, browser, shell or provider access. Capability expansion requires a new explicit grant/approval.

### 2. Fine-grained operator scopes

The operator scope model separates read, write, admin, pairing, approvals and talk permissions. Unknown future operator scopes require an exact match rather than being implicitly accepted. The docs explicitly warn that these roles/scopes are not hostile multi-tenant isolation.

**AEGIS mapping:** keep server routes and worker tokens purpose-scoped. A read-only dashboard token must not inherit connection-management or approval powers. Unknown scopes fail closed. Do not mistake a role label or a shared bearer token for per-user isolation.

### 3. Approval bound to session audience and lineage

`approval-session-audience.ts` resolves the requesting session and its operator-visible ancestors, canonicalises session keys, deduplicates the audience and applies a bounded traversal. The intent is to stop an approval created for one delegated session from silently becoming valid for unrelated sessions.

**AEGIS mapping:** when AEGIS adds specialist agents/subtasks, bind an approval to the exact principal, task/session, parent lineage, capability, action, resource and expiry. A child agent must not inherit a parent's approval for a different operation or resource.

### 4. Purpose-scoped runtime identity

`agent-runtime-identity-token.ts` defines a purpose-specific agent-runtime identity token with explicit session identity, expiry, execution lineage and admission facts. The code treats missing admission information as unknown rather than inferring it from routing. Some handoff tokens have short lifetimes (for example, 60 seconds).

**AEGIS mapping:** issue short-lived worker tokens that are bound to one task, workspace, session and allowed operation. Never reuse a broad API key as a worker identity. Missing or stale admission context must deny execution.

### 5. Three independent enforcement layers

OpenClaw's sandboxing guidance makes a useful distinction:
1. sandbox policy decides where tools execute;
2. tool policy decides which tools are available;
3. elevated execution is a separate escape hatch that can run outside the sandbox.

Its documentation also says sandboxing is off by default and is not a perfect security boundary.

**AEGIS mapping:** Sentinel grants decide whether an action is allowed; a separate runtime policy decides where it can execute; human approval decides whether a consequential action may proceed. A privileged/elevated path must never bypass Sentinel. Untrusted code execution should not inherit a sandbox-off default.

### 6. Egress proxy as an actual security boundary

The network-proxy documentation treats destination policy as the real boundary. It calls for strict destination validation, DNS pinning, private/loopback/metadata protection and logs that record destination/decision/status without request bodies, authorization headers or cookies.

**AEGIS mapping:** enforce network policy outside the model and outside page JavaScript, ideally in a dedicated egress proxy. Revalidate redirects and DNS resolution, block internal/reserved/metadata ranges, and do not let a browser or CLI worker bypass the proxy with a direct network route.

### 7. Central dangerous-tool classification

`dangerous-tools.ts` centralises high-risk tools such as direct command execution, shell/process control, session spawning/sending, node command relay, configuration mutation and plugin lifecycle. It also distinguishes owner/trusted-operator identity from ordinary authenticated callers.

**AEGIS mapping:** keep one central list of capabilities that must never be exposed through a weaker HTTP/model surface. The AEGIS manifest registry should remain the allowlist source; route wrappers must not accidentally expose a lower-level tool that bypasses the manifest.

## Important limits and warnings

- OpenClaw's own operator-scope documentation says its role/scope model is not hostile multi-tenant isolation. AEGIS must maintain its own per-principal workspace, vault, grant and audit boundaries.
- Sandboxing is off by default; tool policy and sandbox policy are separate. A denied tool must not become available just because it runs in a sandbox, and a sandbox must not be described as an approval.
- Elevated execution is an explicit escape hatch. AEGIS should not introduce a comparable bypass around Sentinel.
- The project is a large gateway with many channels, plugins, device types and runtime backends. Embedding it would duplicate AEGIS's architecture and significantly expand the attack surface.
- The repo is MIT-licensed, but no code was copied. Any later reuse still requires exact commit pinning, source review, tests and retention of notices.

## Recommended AEGIS changes inspired by this review

1. Keep pairing/enrolment separate from capability grants.
2. Bind approvals to principal + task lineage + capability/action + exact resource + expiry.
3. Use purpose-scoped, short-lived worker identity tokens.
4. Make sandbox policy a separate mandatory layer for untrusted code/browser execution.
5. Enforce egress through a proxy with DNS/redirect/private-address controls.
6. Maintain one central dangerous-capability denylist for weak interfaces.
7. Treat every privileged path as a separate audited action, never a hidden fallback.

## Decision

**Adopt the patterns, not the gateway.** The most valuable near-term AEGIS improvement is task/session-bound worker identity and approval audience, followed by a mandatory isolated execution backend and central egress policy.
