# AEGIS Forge — Repository REA Follow-up (17 November 2026)

## Scope and evidence standard

This follow-up examines Plasmic, Mixpost and the two plausible repositories matching the ambiguous name “Shouter”. It is a bounded source-surface review, not a complete security audit. The reviewed surfaces include repository READMEs, licence statements/files and selected manifests where available. No upstream code was cloned, installed, built or executed. The current default-branch HEAD commit SHAs were not captured in this pass; therefore this report does not claim immutable source-level approval. A pinned-revision inspection is required before any code reuse.

AEGIS rule: extract the smallest useful mechanism behind AEGIS-owned interfaces. Do not import another platform's identity, permissions, memory, orchestration or control plane.

## 1. Plasmic

- Source: https://github.com/plasmicapp/plasmic
- Licence evidence: root README states that content outside `platform/` is MIT and `platform/` is AGPL (separate `LICENSE.platform.md`). The root MIT licence alone is not sufficient to license the whole monorepo.
- Inspected surfaces: root README, root `package.json`, `packages/host/package.json`, root and platform licence declarations.
- Architecture observed: TypeScript monorepo using pnpm workspaces, Nx and Lerna; includes public packages and a large `platform/` application. Root scripts include database setup/migrations, platform bootstrap, devcontainer checks and network/filesystem checks. The host package `@plasmicapp/host` is MIT, publishes a small React host library, and peers on React/React DOM >=18.
- Main capability: visual builder for React applications/sites, with drag-and-drop composition and integration with an existing codebase.
- AEGIS fit: possible optional visual page/content authoring tool for AEGIS web surfaces; not a foundation for the intelligence core, companion identity, mobile shell, Sentinel or Forge.
- Risks/constraints: AGPL boundary for `platform/`; substantial monorepo/build/database footprint; platform is not a small embeddable component. Hosted visual editing, if used, introduces an external control plane and must not become mandatory or own AEGIS data/permissions.
- Smallest useful mechanism: study component registration/host integration and design-system binding; if desired, prototype only a narrowly scoped MIT package against an isolated AEGIS demo.
- Hard gates: **partial pass** for selected MIT packages; **hold** for platform code unless AGPL obligations are deliberately accepted after legal review. No evidence supports whole-repository adoption.
- Provisional score: 66/100 (architecture/complexity and core-fit deductions; evidence incomplete).
- Decision: **reference / optional isolated prototype only**. Do not install the full Plasmic platform into AEGIS or use its AGPL platform code in a proprietary distribution without a deliberate compliance decision.
- Required next check: pin exact upstream commit and review the specific package and transitive licence notices before a prototype.

## 2. Mixpost

- Source: https://github.com/inovector/mixpost
- Licence: MIT in `LICENSE.md` and `composer.json`.
- Inspected surfaces: README, `composer.json`, licence and release summary.
- Architecture observed: Laravel/PHP package (PHP ^8.2) with Laravel Illuminate contracts 10.47/11/12, Guzzle, Laravel Horizon, Inertia, image/FFmpeg integrations and social-platform connector dependencies. The repository identifies itself as the Lite version of a commercial Pro product; Pro/Enterprise feature distinctions remain relevant.
- Main capability: self-hosted social media account management, post composition/versions, media library, scheduling queues/calendar, collaboration/workspaces and platform-provided analytics.
- AEGIS fit: optional publishing/scheduling service for user-approved social content, not an AEGIS core subsystem. Could be relevant to a future Creator/Publishing workspace, but it is a separate Laravel deployment and does not fit the current Cloudflare Pages/Functions/D1 runtime directly.
- Risks/constraints: PHP/Laravel/Horizon/FFmpeg adds a separate runtime and operational footprint; social APIs require platform accounts, tokens, quotas and continuing compatibility maintenance. User credentials/tokens must never be exposed to Mixpost outside a scoped integration; Sentinel approval and Vault-held credentials would be required. Lite is MIT but not equivalent to every Pro/Enterprise feature.
- Smallest useful mechanism: content calendar, post-version model and scheduling workflow concepts; alternatively, run Mixpost as an optional separately hosted service behind an AEGIS adapter.
- Hard gates: MIT passes for the reviewed package; **conditional** on optional deployment, provider/API terms, secret isolation and explicit user authorisation. Not acceptable as a mandatory free AEGIS dependency.
- Provisional score: 68/100 for an optional creator workflow; lower as a core dependency.
- Decision: **optional adapter/reference only; defer implementation** until AEGIS has a defined social publishing use case and supported account-consent flow.
- Required next check: pin exact commit, inspect all connector implementations, token storage, queue jobs, webhook/callback validation, media processing and API permissions before deployment or adaptation.

## 3. OpenShouter (Android spoken notifications)

- Source: https://github.com/edwardlthompson/OpenShouter
- Licence: MIT (repository README and root licence).
- Inspected surfaces: README, feature/permission descriptions and Android build requirements.
- Main capability: Android text-to-speech announcements for selected notifications and caller ID; app filters, format/ignore/replace rules, quiet hours, headset-only mode, gesture/quick-settings mute, battery/power events and optional on-device geofences. README states no Google Play Services, Firebase or tracking. Developer requirements specify JDK 17, Android SDK, compile/target 35 and minimum 26.
- AEGIS fit: potentially useful accessibility pattern for a mobile Companion notification/announcement adapter, especially eyes-free use and user-controlled per-app allowlists.
- Risks/constraints: Android-specific and cannot be treated as a cross-platform notification engine. Notification access, phone/caller and contact permissions, and optional location/geofence access are sensitive; each must be separately consented, minimised and revocable. Spoken content can disclose private messages to bystanders, so private-mode/headset/quiet-hour defaults and redaction controls are essential. It is not a screen reader or TalkBack replacement.
- Smallest useful mechanism: per-app notification allowlist + TTS formatting + explicit mute/quiet controls, implemented through Android APIs and AEGIS policy rather than importing a whole announcer app.
- Hard gates: **conditional pass** for an optional Android accessibility adapter; requires permission-by-permission review, privacy defaults and no hidden capture.
- Provisional score: 74/100 for the mobile accessibility use case; not a general AEGIS core capability.
- Decision: **selective adaptation candidate** for future Android Companion accessibility; no adoption or code copying yet.
- Required next check: pin commit; inspect Android manifest, notification listener service, telephony/contact/location permissions, geofence implementation, TTS handling, local history retention, network calls and tests.

## 4. bemusic/shouter (Icecast source client)

- Source: https://github.com/bemusic/shouter
- Licence: **not established in this review**; the repository listing and README do not show a licence file. Do not infer permission from public availability.
- Inspected surfaces: README and repository file listing.
- Main capability: programmable MP3 source client for an Icecast server. It requests the next song from a configured HTTP GET endpoint and sends a PUT callback when a track starts; it can transcode to a configured MP3 bitrate. Repository history shown by GitHub is very small (three commits; last activity surfaced as 2022).
- AEGIS fit: only potentially relevant to a separate music-radio/streaming project, not the universal assistant or core music-analysis workflow.
- Risks/constraints: streaming infrastructure, Icecast credentials, remote song URLs and callbacks require authentication, SSRF-safe URL policy, egress limits, format validation and secret isolation. The repository appears inactive and its licence is unresolved.
- Hard gates: **fail/hold** because licence and maintenance confidence are unresolved.
- Decision: **reject for current AEGIS intake / hold pending exact use case and licence**. Do not copy or run.

## Summary

| Candidate | Licence finding | AEGIS disposition | Dependency/adoption |
|---|---|---|---|
| Plasmic | MIT outside `platform/`; AGPL for `platform/` | Reference / isolated optional prototype | None |
| Mixpost | MIT Lite package; Pro/Enterprise are separate commercial offerings | Optional adapter/reference; defer | None |
| OpenShouter | MIT | Android accessibility adaptation candidate | None |
| bemusic/shouter | Licence not established | Hold/reject for current scope | None |

## Build implications

1. None of these repositories should be added to the AEGIS runtime now.
2. OpenShouter is the strongest direct user-facing capability candidate, but only for a future Android accessibility adapter.
3. Plasmic is a possible optional web-authoring aid, not a core UI/agent framework.
4. Mixpost is a separate optional publishing service, only if the product later needs social scheduling.
5. The bemusic Icecast client is unrelated to AEGIS's current core and has an unresolved licence.
6. Research and documentation do not increase AEGIS feature-completion percentage.
