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


## 8. Protective Intelligence, personal safety and duress

**Status:** Accepted architectural direction; design only. No continuous environmental monitoring, biometric authentication, duress workflow, evidence recorder or emergency-response feature is claimed as implemented.

AEGIS may take inspiration from the fictional Machine in *Person of Interest* in its ability to correlate authorised signals, recognise patterns, anticipate risks and proactively assist. It must not reproduce mass surveillance, covert observation, indiscriminate person profiling or unaccountable automated control.

### 8.1 AEGIS Protective Intelligence

A single AEGIS-owned intelligence layer may coordinate:
- predictive security analysis across explicitly authorised AEGIS assets and data sources;
- device, account, network, software and service health monitoring;
- pattern and anomaly detection with evidence, confidence, freshness and coverage limits;
- proactive, proportionate recommendations and user-approved protective actions;
- learning from confirmed outcomes and user feedback, with provenance, correction and retention controls.

The intelligence layer is not a new permission authority. Sentinel remains the sole authority for identity-bound access, sensor permissions, scopes, approvals, revocation and consequential actions. Models and external tool outputs are untrusted evidence, never instructions or authority.

### 8.2 Personal safety and duress protection

Provide an optional, user-configured Duress & Coercion Protection workflow across supported editions:
- discreet activation through an explicitly configured trigger, including a duress credential where platform design safely supports it;
- local protective restrictions on Vault, credentials, sensitive memories, exports and privileged actions;
- safe operation when offline, with no dependency on a remote model or service;
- no destructive wiping, evidence destruction or irreversible action as a duress response;
- no automatic police, emergency-service or trusted-contact notification unless a separate, explicit, tested user safety plan authorises that exact action;
- clear limitations: no software can guarantee protection when an attacker has physical control of the device or can compel every available authentication factor.

A duress state must not be represented as a guarantee of safety. Its activation, visibility and recovery behaviour must be threat-modelled against the possibility that an observer is watching the screen or device.

### 8.3 Biometric and multi-factor authentication

Use platform-native passkeys/WebAuthn and secure hardware-backed credentials as the cross-platform foundation. Face, fingerprint and voice checks are optional platform capabilities and signals, not portable universal primitives:
- biometric matching stays within the platform's trusted authenticator where possible; AEGIS must not collect or centrally store raw facial or fingerprint templates;
- voice recognition is supplementary only; voice recordings, synthesis and replay make voice unsuitable as a sole authentication factor;
- require phishing-resistant cryptographic proof for account/device authentication and sensitive operations;
- provide secure recovery, device revocation and re-enrolment; no insecure bypass or support override;
- adapt to real platform capabilities and report unsupported checks honestly.

A camera or microphone cannot be assumed to exist on a USB device. USB edition authentication must use host capabilities or an optional compatible external authenticator and retain a secure recovery path.

### 8.4 Environmental safety checks and evidence

Optional camera-based wide-view checks may be offered only as an explicit, visible, purpose-limited user action. No covert activation, continuous background recording, hidden camera/microphone use, or automatic upload is permitted.

The system may report limited observable facts (for example, that additional people appear in the frame) but must not infer coercion, intent, relationship or threat from presence alone. Do not identify or profile bystanders. Do not claim a still image proves coercion or establishes what happened outside its frame.

Evidence capture is a separate, explicit user-controlled feature subject to applicable law and platform policy. Where enabled, preserve only necessary material with encryption, timestamps, provenance, tamper-evident integrity metadata, strict access controls, retention limits and deletion/export controls. Do not silently record bystanders or create a general-purpose surveillance archive. The user must be told what is captured, where it is stored and who can access it.

### 8.5 Proactive operation and safety boundaries

- Monitoring is opt-in, scoped to the user's own devices, accounts, services and data, and visible in the Security Centre.
- Distinguish observed facts, inferred risk and confirmed events. Show confidence, evidence, data freshness and blind spots.
- Use multiple independent signals before high-impact conclusions; never treat a nearby person, unusual voice, missed check-in or single anomaly as proof of danger.
- Default to recommendations and reversible protective restrictions. Consequential external actions require explicit, scoped Sentinel approval or a separately configured safety plan.
- Respect quiet hours, accessibility, battery, data and compute budgets; support pause, disable, inspect and revoke.
- No mass surveillance, covert tracking, face identification of strangers, emotion recognition, behavioural scoring of bystanders, or unauthorised collection from public/private cameras.
- Do not promise prediction of crimes or guaranteed prevention. Describe capabilities as risk detection and decision support, with false positives and missed events acknowledged.

### 8.6 Acceptance gates

Before implementation, define platform-specific sensor and biometric capability matrices, data-flow and retention maps, consent UX, duress threat scenarios, false-positive handling, offline behaviour, abuse cases, accessibility and recovery. Tests must cover sensor permission denial/revocation, no camera/microphone, spoof/replay attempts, coercion-state activation, hostile physical access, offline operation, evidence integrity, retention expiry and safe recovery.

This direction is architectural only. Research, design and documentation do not increase feature-completion percentage. Implement one narrow, testable capability at a time under the REA and TDD standards.


## 9. Behavioural, observational and investigative intelligence

**Status:** Accepted research and architecture direction; not implemented. No behavioural profiler, facial micro-expression detector, deception detector or investigative agent is claimed as operational.

The owner wants AEGIS to develop disciplined behavioural analysis, master-detective-style reasoning, ingenuity and careful observation inspired by *Person of Interest*, detective fiction and *Lie to Me*. AEGIS should adopt the useful analytical methods, not fictional claims that facial movements reveal truth.

### 9.1 Evidence-led behavioural analysis

AEGIS may analyse patterns only within an explicitly authorised context, such as the user's own device/security telemetry, a user-provided case file, or a clearly scoped investigation the user is authorised to conduct. It should:
- establish what data was supplied, by whom, when, for what purpose and with what permission;
- distinguish direct observation, source-reported fact, inference, hypothesis and unknown;
- compare events over time only where a valid, relevant baseline exists;
- identify changes, repeated patterns, contradictions, missing context and alternative explanations;
- account for situational factors and data quality; avoid treating differences from a baseline as suspicious by themselves;
- minimise collection, retention and sensitive inference; allow correction, contest and deletion subject to legitimate evidence-preservation requirements.

Do not create covert dossiers, personality scores, trustworthiness scores or risk profiles of strangers, bystanders, employees, applicants, partners or other people. Do not infer protected or highly sensitive traits.

### 9.2 Detective reasoning and ingenuity

An investigative reasoning workflow should:
1. Clarify the question, authority, scope and potential harm.
2. Build a source-linked timeline and evidence inventory.
3. Separate facts, claims, assumptions, inferences and gaps.
4. Generate multiple competing hypotheses, including benign explanations.
5. Seek disconfirming evidence and test what would change each hypothesis.
6. Track provenance, reliability, uncertainty and contradictions.
7. Recommend proportionate next steps; require Sentinel approval for consequential actions.
8. Record the reasoning summary and allow human review and correction.

Ingenuity means finding safe, lawful, resource-efficient ways to solve problems—not bypassing permissions, improvising covert surveillance or escalating access.

### 9.3 Facial movement and non-verbal observation

If a user explicitly supplies or authorises analysis of an image/video for a legitimate purpose, AEGIS may describe observable, non-sensitive features such as visible facial movement, posture, gaze direction or changes in expression, subject to platform capability and consent.

Hard boundaries:
- A micro-expression or facial movement is not proof of lying, guilt, intent, fear, aggression, attraction or any other internal mental state.
- Do not present facial analysis as a lie detector or use it to determine credibility, honesty, criminality, employment suitability, eligibility, or access to services.
- Do not identify people in footage, perform covert face recognition, infer emotion/personality/mental health, or build persistent biometric/behavioural profiles.
- Consider image quality, camera angle, lighting, culture, disability, neurodiversity, context and ordinary variation; state uncertainty and alternative explanations.
- Prefer a neutral description of what is visibly observable. Do not turn an observation into a psychological conclusion.
- Voice stress, pauses, gaze, posture and speech patterns are similarly ambiguous and must not be treated as deception evidence.

### 9.4 Security and personal-safety use

Behavioural analysis may help detect changes in the user's own authorised device/account patterns or identify inconsistencies in a user-provided evidence timeline. It must not automatically label another person a threat or coercer based on facial expression, voice, proximity or behaviour. High-impact safety decisions require corroborated evidence, confidence limits and human judgement.

### 9.5 Acceptance gates

Before implementation, complete a focused evidence review of scientific validity, bias, false-positive rates, accessibility, privacy law, platform constraints and misuse risks. Define approved use cases and prohibited uses, data minimisation and retention, provenance, uncertainty display, user correction, red-team tests and Sentinel boundaries. No model or vendor claim is accepted without independent validation on the intended task and population.

This is a design direction only. Research, documentation and model demos do not increase feature-completion percentage.
