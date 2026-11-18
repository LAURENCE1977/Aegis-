# AEGIS Companion Experience

**Status:** Companion profile persistence, bounded interaction customisation, profile export, confirmed profile purge and immersive text Companion Mode are implemented on draft PR #103. Source and isolated D1/CI are verified; production D1 provisioning, lifelike avatar runtime and voice runtime are not deployed.

## Product contract

- Agent AEGIS is the official, reserved companion identity.
- User-created profiles customise presentation and conversation style over the same AEGIS intelligence, memory, Sentinel policy and tool authority. A profile is not a second security principal or an agent with independent permissions.
- Custom profiles cannot add system prompts, tool definitions, permissions, Sentinel rules or memory scopes.
- Voice is disabled by default. No microphone capture, audio recording, voice cloning or external voice provider is active.
- The current avatar is a stylised 2D CSS presentation. It is not a lifelike human model, 3D rig or generated portrait.

## Persistent profiles

### Data model

Migration: `migrations/companion/0001_companion_profiles.sql`

- `companion_profiles` stores owner-scoped, immutable profile revisions with canonical JSON and SHA-256 digest.
- `companion_profile_preferences` stores the owner's active profile/version; a null selection means the official Agent AEGIS profile.
- `companion_profile_events` records created, updated, selected and reset events. Events and profile revisions reject UPDATE/DELETE.
- Updating a profile creates a new revision. Optimistic concurrency rejects stale writes.
- The active selection is checked against the exact owner/profile/version foreign key.

### API

- `GET /api/companion/profiles` — owner-scoped official and custom profile catalogue plus active selection.
- `POST /api/companion/profiles` — create a bounded custom profile and select it.
- `PATCH /api/companion/profiles/:id` — create a new revision using `expectedVersion`.
- `POST /api/companion/profile-selection` — select an exact custom revision or reset to official AEGIS with null values.
- `GET /api/companion/profiles/export` — export all bounded custom revisions, active selection, profile events and prior purge audit records as JSON.
- `POST /api/companion/profiles/purge` — delete custom revisions, preferences and profile events after the exact confirmation phrase `DELETE MY COMPANION PROFILES`; a minimal purge audit remains.

All writes require the signed owner session and same-origin protection. The server derives the current owner; caller-supplied owner IDs are rejected. The current authentication boundary is single-owner, not a multi-user tenancy system.

### Integrity and privacy

- Profile reads revalidate schema, identity and canonical SHA-256 digest.
- Profile history and audit events are append-only outside the explicit owner-requested purge workflow.
- Creation, active-revision updates, selection and purge use D1 batches so profile content, active selection and corresponding audit events commit or roll back together. Purge count is captured in the same batch before deletion, avoiding a stale preflight count under concurrent writes.
- Export and purge are available in the companion home under **Privacy & saved profile data**. Export downloads a JSON archive; purge requires the exact phrase and removes custom revisions, active selection and profile events. The remaining purge audit records owner scope, count and time only, without profile identifiers, content or digests.
- These controls are enabled only when the authenticated persistent profile store is available; session-only profiles are not sent to the export/purge endpoints.
- Free-text profile descriptions are stored as user-authored metadata but are never inserted into model instructions.
- Interaction settings are limited to four integer values (0–100) and one verbosity enum. The API rejects unknown fields, prompt text and authority-bearing settings.
- A configured, verified server profile takes precedence over client-supplied interaction settings.
- If the profile store is unavailable, the UI can use session-only profiles. The chat endpoint accepts only the bounded style fields, validates them again, and applies them without accepting arbitrary prompt text.
- Profile settings cannot change safety requirements, truthfulness, privacy, tool permissions, memory scope, Sentinel policy or approval requirements.

## Interaction preferences

`functions/lib/companion-interaction.mjs` converts validated values into deterministic tone guidance:

- Warmth
- Humour
- Directness
- Initiative
- Response detail

The directive explicitly states that initiative means suggesting or preparing options, never performing consequential actions without explicit approval. Sensitive contexts prioritise empathy and accuracy over humour.

The prompt builder loads the active profile from the verified owner-scoped store. When no profile database is configured, AG-UI can send the bounded style-only preference object. A persisted active profile always wins over client values.

## Companion Mode

- Full-screen responsive workspace with companion presence on one side and the existing live chat on the other.
- Reuses the existing conversation DOM and message history; it does not create a duplicate chat session.
- Close button, Escape-key exit, focus restoration, mobile single-column layout and scroll locking.
- Presence feedback follows text conversation states: idle, thinking, responding, error and disconnected.
- A restrained visual pulse indicates thinking/responding; reduced-motion preferences disable the animation.
- The interface clearly labels text-only operation and states that voice and lifelike avatar runtime are not connected.

## Verification

- D1 test configuration: `wrangler.companion-d1-test.toml`.
- D1 smoke seed: `scripts/companion-d1-seed.sql`.
- Store/API/UI tests cover owner isolation, immutable revisions, stale writes, profile digest tampering, strict field validation, session fallback, persisted-profile precedence, live chat continuity and responsive/reduced-motion UI contracts.
- Full workflow [44211655456](https://github.com/LAURENCE1977/Aegis-/actions/runs/44211655456) passed on code head `b8dcebe5ea506a21a84646dc626dbec8b3508d73`: **896 tests, 895 passed, 0 failed, 1 skipped**, including isolated capability/runtime/Queue/Forge/Learning/Companion D1 migrations and smoke checks. Tests cover atomic profile writes, rollback after failed preference persistence, single-registration privacy listeners and purge count capture before deletion.

## Not yet complete — production gates

1. Production D1 has not been provisioned or migrated. Until then, the interface correctly falls back to session-only profiles.
2. A governed retention policy, expiry/rotation rules and scheduled cleanup are not implemented. Export and explicit user-requested purge are implemented in source; production persistence must remain gated until retention semantics are reviewed and production D1 is provisioned.
3. Multi-user identity, household/team separation and independently authenticated reviewer identities are not implemented. The current owner session is a single-owner boundary.
4. Lifelike human avatar, 3D rigging, lip sync, animation assets and accessible fallback asset packs remain future work.
5. Voice output and optional voice input require a separate consent, device-capture, retention and provider-boundary design. No capture is enabled by this slice.
6. Accessibility preferences beyond system reduced-motion support are not yet wired to all interface components.

No production deployment, D1 provisioning or PR merge was performed.
