# AEGIS Infinity — Machine Control adapter evaluation

**Status:** architecture evaluation; no Machine Control code vendored, no device commands enabled, and no deployment performed.
**Parent:** PR #202 free-first orchestration and device bridge.
**Upstream:** https://github.com/kzahel/machine-control
**Reviewed licence:** MIT (retain upstream copyright and licence notices if code is ever reused).
**Cost policy:** zero paid services; no trial activation or automatic billing.

## Decision

Adopt Machine Control as the leading candidate for a target-native device-control adapter behind the existing AEGIS device bridge. Do not replace ODIN, the AEGIS runtime, device registry, or Sentinel. Do not make Machine Control's CLI or MCP transport the security boundary: AEGIS must own target identity, authenticated device sessions, capability grants, owner approval, audit, cancellation and revocation.

The upstream project provides a common target-oriented interface while retaining native platform mechanisms. Its documented platform routes include ChromeOS accessibility/CDP and capture/input, Android ADB-based discovery/lifecycle/capture/input, and native desktop accessibility/control on Windows, macOS and Linux. Platform maturity differs; capability discovery and route-specific evidence must be preserved rather than advertising every platform as equally complete.

## Fit with current AEGIS implementation

Already present in the AEGIS branch:
- owner-authenticated device invitation, enrolment, registry and revocation APIs;
- per-device credentials, heartbeat and device-assigned run observation;
- a runtime queue that produces plans only;
- Sentinel grants, approvals and append-only audit foundations;
- an MCP endpoint that is currently authenticated and read-only.

Not yet present:
- a native Android companion and Android Keystore integration;
- a Chromebook companion/controller and completed pairing;
- a trusted device-side Machine Control adapter;
- an action-request lifecycle that connects an approved plan to a bounded device operation;
- device-side approval presentation/confirmation and end-to-end cancellation.

The existing device API is therefore a useful control-plane foundation, not proof that AEGIS can currently operate a phone or computer.

## Proposed integration boundary

1. AEGIS/ODIN selects an enrolled target using its server-owned device ID and authenticated owner relationship.
2. Sentinel resolves a version-pinned capability manifest and exact target/action scope. The device cannot self-assign capabilities.
3. A device-side AEGIS agent invokes a reviewed, pinned Machine Control adapter locally. Do not expose a generic remote shell or arbitrary CLI argument pass-through.
4. The adapter returns a bounded structured result separating request acceptance, delivery, observed effect, evidence and uncertainty.
5. AEGIS records redacted before/after audit events and returns only the permitted result to ODIN/ChatGPT.
6. Stop, cancellation, lease expiry and revocation must prevent further operations. A timeout or uncertain effect must not automatically replay a consumed approval.

MCP may be used as a transport/facade, but the trusted authorization decision remains in Sentinel and the device's authenticated local agent. Do not expose Machine Control directly to a model with unrestricted tool access.

## Platform rollout

### Android phone — first practical target

Machine Control's Android route uses ADB and includes device selection, status/doctor, bounded lifecycle, app deployment/launch, screenshots, logs and explicitly scoped shell operations. For AEGIS, begin with read-only discovery/status and one-shot screenshot only after owner permission. Add app launch and input later as separate narrowly scoped capabilities.

Requirements and cautions:
- Pair one exact physical device; reject ambiguous multi-device selection.
- Require explicit Android debugging authorization and show the owner which host is trusted.
- Never store an ADB private key, device PIN or raw device credential in the repository, model context, URL or logs.
- Do not use the upstream protected PIN-unlock path for ordinary AEGIS automation. Keep screen unlock and protected authentication out of the initial capability set.
- ADB shell is a powerful boundary. Do not expose it as a general-purpose AEGIS tool.

### Chromebook — evaluate without changing the owner's current device

The upstream ChromeOS implementation is a dedicated-appliance route. Its setup guide requires Developer Mode; enabling Developer Mode powerwashes the Chromebook and erases local user data. It also uses privileged root SSH, system configuration changes and a target-specific bootstrap.

**Do not enable Developer Mode, powerwash, disable rootfs verification, install root SSH, or change the current Lenovo Chromebook.** The owner's existing Chromebook is not to be treated as a disposable test appliance. First investigate a non-destructive ChromeOS/PWA/browser route with lower fidelity, and clearly report its limits. Only consider the upstream dedicated-appliance profile on a separate expendable Chromebook after explicit owner approval and a verified backup.

### Windows/macOS/Linux

Keep these as future adapters. They require a target-resident controller, native OS permissions and a separately reviewed remote transport. Do not infer that ChatGPT's connected GitHub or Cloudflare account grants access to a user's desktop.

## Security and acceptance gates

Before any mutating device action is enabled:
- exact enrolled device and owner principal are derived server-side;
- the adapter binary/revision and manifest version are pinned;
- each operation has a typed schema, bounded arguments, target binding and expiry;
- grant and exact-input approval are checked by Sentinel, and one-time approval is consumed immediately before the side effect;
- audit persistence is mandatory and fail-closed;
- device credentials remain device-specific, revocable and unavailable to the model;
- action output is size-bounded and redacted;
- idempotency, cancellation, lease expiry, replay, concurrent invocation, revocation and uncertain outcomes have tests;
- the owner can see and stop active device access;
- real-device verification is supervised and separately approved.

Initial read-only capability proposal:
- `device.target.status.read`
- `device.desktop.capabilities.read`
- `device.desktop.snapshot.read`
- `device.desktop.capture.once` (explicit permission; local artifact retention bounded)

Do not grant keyboard, pointer, text entry, app launch, install, shell, arbitrary file access, microphone, camera streaming, account changes or protected unlock in the initial slice.

## Licensing and supply-chain handling

Machine Control's repository declares MIT. If code is copied or vendored, retain its copyright and licence text, pin the exact reviewed commit, record files and modifications, scan dependencies, and maintain an update path. Prefer a narrow adapter around the upstream CLI/contracts over copying its entire implementation. Re-check the licence and upstream security advisories at the time of adoption.

## Next implementation sequence

1. Finish and verify the current AEGIS binding correction and PR checks.
2. Pin and review the upstream Machine Control commit plus Android and ChromeOS platform docs.
3. Add a pure adapter contract and fixture-based tests to AEGIS; no real device side effects.
4. Implement read-only Android capability discovery/status through a local companion using the existing per-device identity.
5. Add explicit owner-approved screenshot observation only after privacy, retention and audit tests.
6. Evaluate a non-destructive Chromebook browser route separately; do not use the upstream powerwash-dependent bootstrap on the owner's current device.
7. Only then design narrowly scoped input/app-control actions behind Sentinel.

## Evidence and limitations

This is a source/documentation review, not a live test. Upstream platform claims are not AEGIS compatibility evidence. No device has been paired to Machine Control, no upstream code has been copied, no command has been executed on the owner's phone or Chromebook, and no production configuration has changed.
