# AEGIS Platform Compatibility Strategy

**Status:** architecture direction; not a claim of implemented platform support.  
**Owner:** AEGIS core project.  
**Principle:** one secure core, multiple replaceable clients and infrastructure adapters.

## Objective

Make AEGIS usable across major platforms over time without maintaining separate products or duplicating business logic. The first practical target remains a responsive web application/PWA that works well on Chromebook, iPhone and iPad browsers.

## Target coverage

| Platform | Initial approach | Later extension |
|---|---|---|
| Chromebook | Responsive web/PWA in Chrome | Optional Chrome-specific integration only if justified |
| iPhone | Safari web/PWA | Native iOS wrapper/features only where browser APIs are insufficient |
| iPad | Safari web/PWA, responsive tablet layout | Native iPadOS integration only for validated gaps |
| Android | Responsive web/PWA | Android app/device integration and automated QA |
| Windows | Browser/PWA | Optional desktop shell and OS integrations |
| macOS | Browser/PWA | Optional desktop shell and OS integrations |
| Linux | Browser/PWA | Optional desktop packaging or local worker node |

This is a roadmap, not a support certification. Each row becomes supported only after target-device testing.

## Architecture

### 1. Portable core
The core owns identity policy, orchestration, agent lifecycle, memory semantics, task state, approvals, audit and capability policy. It exposes versioned APIs and must not depend on a specific UI framework or client operating system.

### 2. Client adapters
Clients render the same workflows and consume the same API contracts. Platform adapters isolate:
- secure credential/session storage;
- notifications and push permissions;
- file selection, import/export and local cache;
- voice capture/playback;
- camera/microphone and media permissions;
- deep links and share sheets;
- optional local automation/device capabilities.

Use feature detection and explicit permission states. Do not rely on user-agent sniffing or silently substitute a weaker security path.

### 3. Infrastructure adapters
Hide model providers, databases, queues, object storage, search, hosting and observability behind stable interfaces. Cloudflare is a practical starting host, not a permanent dependency. Keep portable task and data contracts so another compliant provider can be introduced without rewriting the product.

### 4. Background work
Durable work runs on the server-side runtime. Mobile and desktop clients submit, observe, approve, cancel and resume jobs; they must not be required to stay open. Never claim a client can run continuously in the background when its operating system may suspend it.

## Cross-platform engineering rules

1. Keep one canonical API and versioned data model.
2. Make the web/PWA client the first reference implementation.
3. Keep platform-specific code in adapters, not the domain/core layer.
4. Define capability contracts and adapter conformance tests.
5. Provide graceful fallbacks for unavailable APIs.
6. Design offline mode and sync conflict handling explicitly.
7. Treat local data as cache unless it is intentionally an encrypted offline artefact.
8. Require user consent for device permissions and audit consequential actions.
9. Test responsive layouts, accessibility, keyboard navigation, network loss, expired sessions and permission denial.
10. Evaluate maintenance, security and cost before adding native shells.

## Delivery sequence

1. Chromebook, iPhone and iPad browser/PWA reliability.
2. Stable API, MCP Bridge, identity and server-side durable runtime.
3. Shared web/PWA support on Android and desktop browsers.
4. Optional Android native/device integration and automated QA.
5. Optional desktop shells/local worker nodes.
6. Native iOS/iPadOS and other OS-specific features only when a real capability gap warrants them.

## Release gate

A platform is not declared supported merely because it loads. Validate sign-in, chat, memory, agent/job submission, status updates, approvals, file workflows, network interruption, session expiry, accessibility, security permissions and recovery on representative real devices and browsers.

