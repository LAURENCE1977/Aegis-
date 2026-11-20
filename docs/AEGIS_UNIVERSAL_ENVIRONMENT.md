# AEGIS Universal Environment & Multiverse

**Status:** Product and architecture direction, not an implementation claim. This contract extends the existing AEGIS project; it does not create a second product or authorise deployment, OS replacement, background surveillance or new permissions.

## 1. Product principle: freedom of environment

**AEGIS is independent when wanted, complementary when preferred, and connected when authorised.**

A user may choose to:
- run AEGIS as their primary, standalone digital environment;
- use AEGIS as a companion alongside an existing operating system and applications; or
- use a hybrid arrangement, with standalone AEGIS on some devices and companion mode on others.

These are modes of one AEGIS ecosystem, not separate products or identities. Users can change their chosen mode without losing their workspace, subject to supported export, migration and synchronisation capabilities.

AEGIS must never force replacement where safe integration is better, or force integration where independent operation is preferred.

## 2. AEGIS Multiverse: one identity, multiple environments

The Multiverse is a family of supported environments connected by a common, user-controlled AEGIS identity and workspace model.

Potential environments include:
- desktop and laptop hosts (Windows, macOS, Linux and ChromeOS);
- mobile and tablet hosts (Android and iOS/iPadOS);
- AEGIS-managed standalone environments, initially investigated as a Linux-based distribution or dedicated-device experience;
- browser-hosted and remote/cloud workspaces;
- local servers, mini PCs and other suitable computing devices;
- future device classes where a supported and secure integration surface exists.

“Universal” is an architectural goal, not a promise that every platform exposes identical APIs or permits identical background behaviour. Each platform adapter must document actual support, restrictions and evidence.

## 3. Companion presence: passive by default, active on request

On supported host systems, an optional AEGIS companion may remain available with a low-resource presence and respond when called.

Its operating states are:
- **Dormant:** no active assistance; only the minimum service needed for an explicitly enabled wake or notification mechanism.
- **Ambient:** limited, visible and user-authorised signals may be monitored for a stated purpose.
- **Active:** the user has invoked a task and the companion performs only the capabilities authorised for that task.

The user must be able to see, pause, disable and configure companion presence. No covert monitoring, keylogging, indiscriminate screen capture, microphone/camera activation or collection of unrelated activity is permitted. Voice, camera, screen and accessibility permissions must be explicit, revocable and visibly indicated.

Platform constraints are first-class. Where an OS restricts persistent background execution, AEGIS must use permitted alternatives (manual launch, notifications, widgets, shortcuts, browser/PWA capabilities or supported background tasks) and clearly explain the limitation. It must not claim persistent presence where the host does not allow it.

## 4. Compatibility intelligence and coexistence

An optional first-run and ongoing compatibility assessment may identify:
- host OS, version and device capabilities, using permitted APIs;
- available AEGIS adapters and supported features;
- existing browser, security and privacy capabilities that the user chooses to disclose;
- overlap, gaps, conflicts and integration opportunities;
- local processing, storage and connectivity constraints.

The assessment must distinguish detected facts, user-provided information, inferred possibilities and unknowns. It must not silently inspect installed applications or security products beyond approved platform interfaces and user-granted scope.

AEGIS should complement existing protection by default. It must not disable, uninstall, weaken, bypass or compete with an existing security product without a separate, informed user decision and a verified safe migration path. If overlapping protection could cause conflicts, explain the risk and offer options rather than changing settings automatically.

Compatibility results should be actionable: “available”, “available with permission”, “limited by host”, “not supported” or “not verified”. Never imply a security guarantee based solely on the presence of an integration.

## 5. Shared core, local autonomy and synchronisation

The ecosystem should share durable workspace identity, user preferences, project references and authorised knowledge while allowing each environment to operate within its local capabilities.

Design goals:
- local-first operation where practical, with useful offline and degraded modes;
- explicit choices for what synchronises, where it is stored and which devices may access it;
- encrypted transport and storage, device identity, revocation and least-privilege scopes;
- conflict-aware synchronisation with provenance and recoverable history;
- no silent cross-device expansion of permissions;
- local work remains available during network outages where its dependencies permit;
- reconnecting devices revalidate identity, grants, revocations and policy before sensitive sync or action.

A permission granted on one device must not automatically authorise the same action on another. Device trust and action approval are separate decisions.

## 6. Sentinel and security invariants

Sentinel remains the sole authority for protected operations across all worlds and modes.

- A surface, companion, OS adapter or AI agent cannot grant itself access.
- Host OS permissions remain authoritative; AEGIS cannot promise to bypass them.
- Every integration is scoped to owner, device, purpose, resource and action.
- Sensitive actions require just-in-time approval bound to the exact operation and relevant parameters.
- Device loss, session expiry, connection revocation and policy changes must propagate to eligible environments.
- Local-only mode must fail safely when a required security or authorisation dependency is unavailable.
- Logs and telemetry must minimise personal data and remain inspectable under user controls.

## 7. Delivery strategy

1. **Contract and inventory:** document supported host capabilities, current AEGIS architecture and security boundaries.
2. **Companion foundation:** define a narrow, optional companion service with explicit presence states, pause/disable controls and no broad system access.
3. **Platform adapters:** implement one host at a time, beginning with the most practical desktop/browser target; test actual background and permission behaviour.
4. **Compatibility assessment:** provide transparent capability and coexistence reports, initially read-only.
5. **Cross-device identity and sync:** define device registration, revocation, selective sync and offline conflict handling before sharing sensitive state.
6. **Standalone environment research:** evaluate a Linux-based AEGIS environment and dedicated hardware as a separate, evidence-led track; do not attempt a custom kernel or OS replacement as an early milestone.
7. **Multiverse validation:** test transitions between companion, hybrid and standalone environments without permission leakage or loss of user control.

## 8. Acceptance criteria

The direction is not implemented until tests and user-visible evidence demonstrate:
- a user can choose standalone, companion or hybrid mode;
- unsupported host capabilities are reported honestly;
- companion presence can be paused and disabled;
- no background sensor or screen access occurs without explicit permission and visible state;
- existing security software is not silently disabled or replaced;
- device identity and permissions remain distinct;
- offline and reconnect behaviour is documented and tested;
- cross-device synchronisation cannot widen privileges;
- Sentinel remains authoritative for consequential actions.

## 9. Non-goals and guardrails

This direction does not mean building every OS from scratch, promising universal low-level system access, replacing established security vendors by default, or creating an always-watching agent. AEGIS may integrate with specialist tools and host-native security features where that is safer and more reliable than rebuilding them.

The product promise is freedom of environment and continuity of assistance—not unrestricted access.
