# AEGIS Security Suite — Architecture and Threat Model

**Status:** Accepted architectural pillar; design baseline only. No VPN, endpoint agent, firewall, scanner or device-protection feature is claimed as implemented.  
**Date:** 16 November 2026  
**Owner:** AEGIS core architecture  
**Related authorities:** Sentinel, Vault, Forge, Security Centre, Update & Maintenance System, REA Standard.

## 1. Purpose and promise

The AEGIS Security Suite is a modular, user-controlled security layer spanning account/session security, device posture, network privacy, threat detection, secure development and recovery. It should make security understandable and actionable without pretending that one product or VPN makes a device or person anonymous or invulnerable.

The suite is an AEGIS-owned experience and policy layer over trusted operating-system facilities and replaceable, independently assessed tools. It is not a new permission authority and must not become a monolithic privileged daemon.

**Non-negotiable principles**
- Free-to-use core; no mandatory paid VPN, API, hosted scanner, subscription or proprietary security service.
- Open standards and replaceable adapters; self-hosted and offline options where practical.
- Least privilege, default deny, explicit purpose and scope, user-visible status and revocation.
- No invented cryptography, VPN protocol or security claims. Use established, maintained protocols and platform security primitives.
- Security checks must not silently collect browsing history, inspect personal content or profile people.
- No autonomous destructive remediation, account lockout, device wipe, firewall/network changes or external scanning without the required explicit approval.
- Security functions must degrade safely when permissions, network, device APIs or optional services are unavailable.
- Security research and testing must be authorised and scoped. No default people-search/OSINT surveillance or offensive capability.

## 2. Product areas

### 2.1 AEGIS Security Centre

A single dashboard for:
- overall posture with evidence, timestamp, device and coverage limitations;
- device inventory and last-seen state;
- account/session and credential hygiene;
- VPN and network-protection status;
- detected risks, severity, confidence and recommended actions;
- approvals, exceptions, security history and audit records;
- recovery readiness, backups and update state.

Do not collapse unknown/unavailable checks into green. Show **protected**, **attention needed**, **not checked**, **unsupported** and **action required** as distinct states.

### 2.2 Network privacy and connectivity

Two different VPN use cases must remain separate in both UI and architecture:

1. **Privacy/exit VPN:** routes selected device traffic through a VPN provider or a user-operated exit server. It can protect traffic on an untrusted local network and hide the user's public IP from destination services, but shifts trust to the VPN operator/exit server. It does not guarantee anonymity, stop malware, prevent phishing or protect traffic outside its tunnel.
2. **Private device/mesh VPN:** connects a user's own devices and private services using authenticated device-to-device or overlay networking. It is for private access, not automatically an internet privacy service or public exit VPN.

Protocol and provider direction:
- Prefer established WireGuard-based implementations where the target platform supports them; use platform-native VPN APIs and OS controls.
- Evaluate self-hosted coordination/control options separately from the data-plane protocol. A self-hosted mesh controller does not automatically provide a privacy exit node.
- Optional third-party commercial VPNs may be adapters, never a required dependency; disclose provider trust, jurisdiction, logging policy, pricing and limits without promising anonymity.
- A self-hosted exit node still needs a reachable server/home endpoint, bandwidth, maintenance and secure key handling; it is not cost-free infrastructure.
- Never create a proprietary VPN protocol or roll cryptography.
- Per-app, split-tunnel, always-on and kill-switch support varies by operating system, vendor and device policy. Report actual platform support; do not promise identical controls on iOS, Android, ChromeOS, desktop and browser.
- A connection indicator alone is insufficient. Where platform permissions allow, check tunnel state, route/DNS behaviour and leaks; state when checks could not run. A kill switch must be an OS-enforced, tested capability, not a UI promise.

DNS protection should use trusted encrypted DNS mechanisms where supported, with clear resolver choice and fallback behaviour. Prevent silent fallback to an untrusted resolver where the OS allows policy enforcement; do not break connectivity without explaining the trade-off.

### 2.3 Device protection and posture

A common posture model with platform-specific adapters:
- OS version, security patch and update status;
- screen lock, device encryption and secure boot indicators where exposed;
- firewall and endpoint-protection state where exposed;
- application permissions and risky accessibility/device-admin grants;
- local storage and backup/recovery readiness;
- suspicious configuration changes and unfamiliar devices;
- security tool health, last scan and coverage limitations.

AEGIS should prefer native OS protection and reputable existing endpoint products over attempting to replace them. On iOS and ChromeOS, third-party apps have restricted visibility; do not imply full antivirus-style scanning or unrestricted process inspection. On Chromebook, prioritise ChromeOS updates, account security, safe browsing, extensions/permissions, Linux-container isolation and recovery hygiene. On iPhone/iPad, use supported privacy/security settings and managed VPN APIs; do not claim access to other apps' private data.

### 2.4 Threat detection and security intelligence

Translate evidence into understandable, prioritised findings:
- unfamiliar sign-in/device or session;
- outdated or vulnerable software;
- exposed secret or credential indicator;
- unexpected permission/configuration change;
- VPN disconnect or DNS/IP leak where measurable;
- suspicious service, process or network behaviour only on platforms where lawful APIs permit it;
- vulnerable dependency, unsafe code change, secret leak or failing security test in AEGIS development.

Every finding records source, timestamp, affected asset, evidence reference, confidence, severity, likely impact, recommended action and whether action requires approval. Avoid fear-based language and false certainty.

### 2.5 Secure development and AEGIS self-defence

The Security Guardian continuously checks the AEGIS code and release pipeline for dependency advisories, licence drift, exposed secrets, unsafe permissions, untrusted input, failing tests, migration risks, policy bypasses and suspicious changes.

Initial tool candidates are optional, scoped adapters—not mandatory runtime dependencies:
- CodeQL and secret scanning for source analysis;
- OWASP ZAP for controlled testing of AEGIS-owned web/API surfaces;
- Nuclei only with curated templates, exact authorised target scope, rate limits and impact controls;
- osquery for supported endpoint inventory/inspection;
- Lynis for supported Linux/server hardening checks;
- Sigma as a portable detection-rule format;
- Wazuh only after footprint, maintenance and platform fit are proven;
- Nmap and other network tools only for explicitly authorised inventory/testing.

All candidate tools must undergo the mandatory REA process, including exact source pin, licence/dependency review, security boundary analysis, target hardware/resource benchmark and a documented disposition. A tool's popularity or open-source label is not sufficient.

### 2.6 Recovery and resilience

Security includes recovery:
- encrypted, user-controlled backups and restore verification;
- exportable identity, configuration and user data;
- key recovery and loss-of-device procedures;
- update rollback and known-good versions;
- incident checklist and audit export;
- offline instructions for when AEGIS services are unavailable.

Never claim a backup is valid until a restore test has succeeded. Never make the only recovery key dependent on the device it is intended to recover.

## 3. Ownership and trust boundaries

- **Sentinel:** sole authority for identity-bound permissions, scopes, approvals, revocation, rate limits and consequential action decisions. Security modules cannot self-grant.
- **Vault:** encrypted custody of VPN private keys, provider tokens, device credentials and security integration secrets. Secrets never appear in prompts, logs, client bundles or repository files.
- **Forge:** source intake, REA, isolated evaluation, adaptation planning, tests and versioned security-tool integrations. Forge does not grant production privileges.
- **Security Centre:** user-facing posture, alerts, settings, history and approval presentation; not a separate policy engine.
- **Network adapters:** narrow calls to OS VPN/firewall/DNS facilities or approved VPN services. They return typed status/evidence and cannot access Vault directly.
- **Endpoint adapters:** read-only posture and inventory by default. Any remediation is a separate Sentinel-governed action.
- **Audit:** append-only, privacy-minimised event lineage. Store identifiers, status, timestamps and digests where possible; do not retain browsing content, packet payloads, raw secrets or unnecessary personal data.

Control plane and privileged execution must remain separate. Untrusted scanner output, repository content, signatures, detection rules and remote API responses are data, never instructions.

## 4. Threat model

### Assets to protect
User identity and sessions; Vault keys and provider credentials; device identity; private network routes and DNS choices; personal data; AEGIS source/build/release chain; memory and audit integrity; recovery material.

### Threat actors and failure sources
Opportunistic attackers on public Wi-Fi; phishing and credential theft; malicious or compromised apps/extensions; compromised VPN/provider/control server; supply-chain compromise; malicious repository or scanner content; stolen/lost device; misconfiguration; accidental user action; over-privileged AEGIS agent; false-positive or unavailable security signal.

### Principal threats and required controls

| Threat | Required controls |
|---|---|
| Stolen session or credential | Short-lived sessions, secure cookies/tokens, device/session revocation, Vault custody, secret redaction, audit |
| Compromised VPN provider/exit node | Explicit trust disclosure, key isolation, provider replaceability, no anonymity claim, optional self-hosting |
| VPN drop or DNS/IP leak | OS-supported always-on/kill switch where available, route/DNS checks, clear degraded state, tested fail-closed behaviour |
| Malicious endpoint/scanner output | Isolated execution, strict output schema, no shell/tool authority from results, resource and egress limits |
| Supply-chain/dependency compromise | Pinned sources, SBOM, licence/advisory scanning, signed releases, reproducible tests and rollback |
| Privilege escalation by agent/tool | Sentinel-only grants, least privilege, scoped worker identity, no self-approval, audit and revocation |
| Privacy overcollection | Data minimisation, local processing where feasible, explicit consent, visible sensor status, short retention |
| False positives or missed detections | Confidence and coverage labels, explainable evidence, multiple signals for high-impact action, human review |
| Device loss or failed update | Encrypted backups, tested restore, staged update, health check and rollback |

### Abuse and safety boundaries
- No covert surveillance, keylogging, credential harvesting, person profiling or unauthorised device/network scanning.
- No blanket packet capture or browsing-history collection.
- No automatic blocking, deleting, quarantining, wiping, account changes or public disclosure without explicit authorisation and recovery path.
- No security score that hides missing permissions or unsupported checks.
- No claim that a VPN prevents tracking, malware, phishing or all forms of interception.

## 5. Delivery sequence and acceptance gates

**Gate 0 — Architecture and platform capability matrix**
- Threat model, data classification, permission map and failure modes approved.
- Map what iOS, iPadOS, ChromeOS, Android and desktop actually expose.
- Decide core contracts and adapter boundaries; no privileged code yet.

**Gate 1 — Security Centre foundations**
- Device inventory and posture schema; evidence freshness; finding severity/confidence; audit history; Sentinel approval integration.
- Read-only by default and useful without a VPN provider or paid API.

**Gate 2 — Network protection**
- REA and compare WireGuard-based privacy VPN and mesh options separately.
- Implement only platform-supported adapters; key lifecycle through Vault.
- Verify reconnect, route/DNS behaviour, leak detection, fail-closed/kill-switch behaviour and recovery on each supported platform.
- Self-hosted option documented with server, bandwidth and maintenance requirements.

**Gate 3 — Device protection**
- Native OS posture adapters and least-privilege endpoint inspection.
- Explicit coverage limits for iOS/ChromeOS and optional deeper desktop/Linux modules.
- No always-on high-resource daemon on low-end devices.

**Gate 4 — Threat detection and Security Guardian**
- Curated rules, vulnerability/secret scanning, alert deduplication, confidence and false-positive handling.
- Controlled scans only against AEGIS-owned or explicitly authorised targets.

**Gate 5 — Recovery and maintenance**
- Backup/restore drills, incident response, signed update verification, staged rollout and rollback.
- Verify offline recovery and device replacement.

**Gate 6 — Cross-device coherence**
- Consistent user-visible policy and history across devices without assuming all platforms expose the same controls.
- Device-specific capability and consent states; revocation and lost-device workflow.

A gate is complete only when acceptance tests, platform evidence, threat-model review, resource measurements and rollback evidence exist. Documentation or research alone does not increase feature-completion percentage.

## 6. Performance, cost and privacy budgets

Every optional module must declare supported platforms, privileges, CPU/RAM/storage/network use, battery impact, update source, licence, data collected, retention, offline behaviour and cost. Default posture should be lightweight, on-demand and read-only. Continuous monitoring is opt-in and configurable. Core functionality must work without hosted paid APIs. Do not route all user traffic through AEGIS infrastructure or build a global VPN exit network.

## 7. Immediate next work

1. Map the current AEGIS Security Centre, Sentinel and Vault contracts to this architecture; identify existing coverage before proposing duplicate systems.
2. Create a platform capability matrix for iPhone/iPad, Chromebook, Android and desktop/Linux.
3. Run focused REA on WireGuard, self-hosted mesh/control-plane candidates and the highest-value defensive tools. Separate privacy VPN from private mesh networking.
4. Produce a small native adapter/API design and acceptance tests before implementation.
5. Keep all work on the existing feature branch/PR workflow. No production provisioning, secrets, paid services, VPN installation, scanning of third-party targets or PR merge without explicit approval.

**Current implementation status:** accepted design baseline only. No Security Suite feature completion is claimed by this document.
