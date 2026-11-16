# AEGIS Interactive Human Companion Architecture

**Status:** Foundational architecture decision; implementation is not yet present unless explicitly identified below.

## 1. Product decision

The interactive human companion is a first-class AEGIS experience, not a separate chatbot, third-party avatar product or decorative talking head.

Owner-selected direction:
- Appearance is customisable by each user.
- The primary experience is a full-screen interactive human.
- AEGIS provides an official, recognisable persona and supports user-created companion identities.
- Users can switch to voice-only, text, compact or invisible modes.
- The companion helps users achieve their best, listens when they need to be heard, and never manufactures emotional dependence.

The human presentation is an interface to AEGIS intelligence. It is not the intelligence, memory store, policy authority or source of truth.

## 2. Architectural boundaries

Keep these concerns separate and connected through versioned, provider-neutral contracts:

1. **AEGIS Intelligence Core** — reasoning, task planning, knowledge, governed memory, orchestration and capability selection.
2. **Companion Experience Engine** — conversational turn management, interaction context, presence state, response intent and experience adaptation.
3. **Persona & Identity Registry** — official AEGIS persona definitions and user-created companion profiles.
4. **Appearance & Avatar Renderer** — face/body assets, rig, animation, expressions, gestures, clothing, scene and rendering.
5. **Voice & Audio Engine** — speech input/output, voice selection, turn-taking, interruption, audio state and optional lip synchronisation.
6. **Perception Gateway** — consent-gated camera, microphone, screen, image and document inputs. It exposes bounded observations, not raw device authority.
7. **Client Experience Shell** — full-screen companion, shared workspace, accessibility controls and responsive browser/mobile surfaces.
8. **Sentinel** — independent policy enforcement for permissions, approvals, data access, device access, external actions, audit and revocation.

The companion engine may request actions from AEGIS but cannot grant itself permissions. Avatar animation must never be treated as evidence of a real emotion, identity or intention.

## 3. Identity model: official persona and custom companions

Separate identity from appearance.

### Official AEGIS persona
Maintain one canonical, versioned AEGIS persona specification defining recognisable values, communication principles, boundaries and interaction defaults. It is the shared character foundation across installations.

The official persona is not a fixed face, voice, gender presentation or age presentation. Those are presentation choices, not the moral identity of AEGIS.

### User-created companions
A user may create one or more companion profiles with independent:
- display name and optional description;
- appearance and presentation preferences;
- voice and speech settings;
- conversational style and humour preferences;
- interaction defaults and accessibility preferences;
- permitted personalisation and memory scope.

A profile is a presentation and interaction configuration. It does not create a separate security principal, bypass Sentinel, gain independent access to user data or inherit permissions from another profile.

### Identity separation
Keep distinct identifiers for installation, human user, companion profile, persona definition/version, avatar/voice asset pack and active conversation/session.

Never use a companion display name or visual likeness as authentication. Users can export, switch, rename, reset or delete custom profiles. Disclose whether an appearance or voice is generated, licensed, imported or user-supplied.

## 4. Full-screen interactive experience

The primary interface is a full-screen human companion environment with:
- live conversational view and natural turn-taking;
- expressive but restrained facial animation and gestures;
- interruption and barge-in support;
- visible listening, thinking, speaking, muted and disconnected states;
- captions, transcript and text fallback;
- optional shared workspace for documents, images, code, plans and tools;
- clear controls for microphone, camera, screen sharing and session exit;
- compact, voice-only, text-only and invisible modes.

The companion must not silently activate microphones, cameras or screen capture. Capture state must be visible, permissioned, revocable and controlled by the user. Background listening, wake-word detection and proactive notifications are opt-in, separately configurable and off by default.

The UI must work on modest mobile browsers first. Full-screen rendering should degrade gracefully to a static portrait, waveform or text interface on devices that cannot sustain real-time 3D or video rendering.

## 5. Interaction and presence state model

Use an explicit state machine rather than inferring state from animation:

- idle — available, not capturing;
- listening — user-authorised audio input active;
- thinking — processing a turn;
- speaking — audio output active;
- interrupted — current output stopped for user input;
- shared_workspace — user has opened a collaborative visual surface;
- paused — companion presence paused;
- disconnected — service or transport unavailable.

State transitions are driven by session events and permission state. Facial expression and gesture are presentation outputs only. The UI must not imply the system is listening when it is not, or imply it is not listening when capture is active.

## 6. Provider-neutral interfaces

Define stable internal interfaces so AEGIS can replace renderers, speech engines, models and transport providers without rewriting its identity or memory.

Conceptual contracts:
- PersonaProvider: resolve and validate a versioned persona profile.
- AvatarRenderer: load assets, render a frame/scene and receive bounded expression/gesture cues.
- SpeechInputProvider: produce transcript or structured audio observations from an authorised stream.
- SpeechOutputProvider: synthesize text/audio using the selected voice profile.
- ConversationSession: manage turns, interruption, context references and lifecycle.
- PerceptionAdapter: submit consented image/document/screen observations with provenance.
- CompanionEventBus: publish typed lifecycle and presentation events.
- SentinelPolicyClient: request decisions for protected operations; never duplicate or replace Sentinel authority.

Use versioned schemas, capability negotiation, bounded payloads, timeouts, cancellation and explicit provider health. No renderer or speech provider may receive unrestricted access to AEGIS memory, credentials or tool execution.

## 7. Human-centred behaviour

The companion adapts communication to the user while preserving the official AEGIS values.

Required behaviours:
- distinguish requests for solutions, advice, brainstorming, encouragement and simply being heard;
- ask a brief clarifying question when intent is genuinely uncertain;
- avoid turning every emotional disclosure into a task list;
- be warm, patient, candid and appropriately humorous;
- challenge respectfully when it helps the user;
- avoid flattery, guilt, jealousy, possessiveness, exclusivity or pressure to keep interacting;
- encourage appropriate human relationships and professional support where relevant;
- be transparent that it is AI and never claim human feelings, experiences or consciousness.

Personalisation is user-controlled, inspectable, correctable, exportable and deletable. Do not infer sensitive traits to customise the companion. Do not use emotional state to target purchases, manipulate behaviour or increase engagement.

## 8. Memory and privacy

The companion does not own a private shadow memory. It uses AEGIS governed memory services and the active user's permissions.

- Store durable preferences only under established memory consent and retention policy.
- Keep transient session context separate from durable memory.
- Attach provenance and source references to remembered facts.
- Respect per-profile and per-session memory scopes.
- Never train shared/community knowledge from private conversations by default.
- Camera, microphone, biometrics and screen inputs require explicit purpose-specific policy; avoid biometric identification and unnecessary retention.
- Provide visible indicators and controls for capture, transcript retention and memory use.
- Ensure profile deletion does not delete unrelated user data, and user deletion/export workflows cover companion data.

## 9. Sentinel and safety invariants

Sentinel remains independent and authoritative. The companion cannot:
- grant itself device, account, memory or tool permissions;
- initiate external actions merely because a persona requested them;
- bypass confirmation for consequential actions;
- access another user's or installation's private context;
- modify constitutional protections, policy enforcement or audit records;
- impersonate a human or conceal its AI nature.

High-impact actions are explained and require the established approval path. Users can pause the companion, revoke capture permissions, end sessions and disable proactive presence immediately. Protected actions remain auditable without storing unnecessary raw conversation or media.

## 10. Free, open and replaceable implementation

The companion is subject to the AEGIS free/open-source constitution and dependency policy:
- no mandatory paid avatar, voice, model, streaming or hosting service;
- no subscription, token purchase or proprietary hosted API required for core use;
- prefer open standards, self-hostable components and locally runnable options;
- verify code, model, voice, face, animation, dataset and asset licences independently;
- quarantine unknown or incompatible licences;
- allow a low-resource 2D/static fallback and user-supplied licensed assets;
- make external commercial providers optional adapters, disabled by default, never essential.

Always-free means no charge to use AEGIS software, core capabilities or community ecosystem. It cannot eliminate real-world electricity, hardware, internet or optional hosting costs. The architecture must not turn those costs into a mandatory paid AEGIS service.

## 11. Data and event design

Persist configuration and metadata, not continuous raw media by default.

Potential records, subject to schema design:
- companion_profiles — owner, profile ID, display name, status and timestamps;
- companion_persona_versions — persona ID, version, policy-compatible configuration and provenance;
- companion_appearance_refs — licensed asset references and hashes, not arbitrary executable content;
- companion_voice_preferences — provider-neutral voice selection and consent metadata;
- companion_sessions — owner, profile, state, start/end and retention policy;
- companion_session_events — append-only bounded lifecycle and approval events;
- companion_permissions — references to Sentinel grants, never an independent permission store.

Do not persist raw microphone/camera streams in D1. Media transport and optional storage need a separate threat model, encryption, retention controls and explicit consent. Do not add tables until schema, access model, deletion behaviour and migration tests are agreed.

## 12. Delivery sequence

1. **Contracts and threat model:** persona/profile schemas, identity separation, state machine, provider interfaces, consent and Sentinel boundaries.
2. **Text-first companion shell:** full-screen responsive UI, official persona, profile switching, accessibility and visible presence states. No live capture required.
3. **Interactive 2D/portrait renderer:** expression cues and gestures behind the renderer interface, with static fallback.
4. **Speech:** pluggable speech input/output, interruption, captions and voice controls; local/self-hosted path first.
5. **User customisation:** user-created profiles, appearance/voice settings, export/reset/delete.
6. **Perception and shared workspace:** consented image/document/screen understanding, with purpose-specific Sentinel permissions.
7. **Advanced human presentation:** real-time 3D, lip synchronisation and richer animation where device capability permits.
8. **Federated companion ecosystem:** portable profiles and signed/licensed asset packs; no private conversation or identity sharing without explicit approval.

Do not begin with expensive photorealistic streaming. Prove identity, safety, responsive shell and provider interfaces first; then improve fidelity without locking AEGIS to one vendor.

## 13. Acceptance criteria

The companion architecture is not complete until tests and user-facing checks demonstrate:
- official and custom profiles share AEGIS intelligence without sharing permissions;
- switching appearance/voice does not change user identity, memory ownership or Sentinel policy;
- no microphone, camera or screen capture begins without visible, revocable consent;
- the user can interrupt speech and immediately pause/end the session;
- text/static fallback remains usable without GPU, paid APIs or a networked avatar provider;
- companion state indicators accurately reflect capture and output state;
- custom profile data can be exported and deleted;
- private session data is not silently contributed to community learning;
- a compromised renderer cannot access secrets, memory stores or tool execution;
- no paid service is required for the core companion experience;
- accessibility, mobile performance, failure and recovery paths are tested.

## 14. Current implementation status

The first companion foundation and a dedicated companion-led Home experience are now present on the active AEGIS branch:

- `functions/lib/companion-contracts.mjs` defines a versioned, provider-neutral companion profile contract and a pure presence-state transition function.
- `tests/companion-contracts.test.mjs` covers official identity reservation, custom profile validation, prohibited authority fields, explicit external-voice opt-in, consent-gated listening, interruption, pause and disconnect behaviour.
- `index.html` now opens the signed-in experience on a dedicated Home dashboard. The companion presentation stage is the centrepiece of the Home view; conversation is a separate focused workspace.
- The Home dashboard has working navigation shortcuts to Conversation, Project Spaces, Memory, Knowledge Forge, Approvals and Security. The experience is responsive and uses the existing dependency-light HTML/CSS/JavaScript shell.
- `tests/companion-first-ui.test.mjs` now specifies the companion-led Home route, navigation targets, separation of the conversation workspace and responsive layout.
- GitHub Actions run 43954785649 completed successfully after these changes, including the full Node.js/Miniflare suite and isolated capability, runtime and Forge D1 safeguards.
- Cloudflare Pages preview for commit `4d37eed7ebbb609cff7b5e2541cfb182a651e095` deployed successfully at `https://a673ccea.aegis-6yk.pages.dev`.

This is a real interface improvement, not a completed lifelike companion. The current visual avatar remains a clearly disclosed static placeholder. Profile persistence, profile switching/customisation UI, real 2D/3D rendering, speech input/output, live perception and authenticated browser verification remain unimplemented. The Preview environment still needs its own secure authentication configuration before the signed-in workspace can be tested against live authenticated services. No credentials should be shared in chat.

The next engineering task is to connect profile selection and presence events to the existing authenticated session without creating a second identity, memory store or permission system. Sentinel remains the sole authority for protected operations and capture consent.


## 13. Implementation checkpoint — 16 November 2026

The current signed-in Home experience now includes a first, deliberately bounded companion-profile selector:

- The reserved official AEGIS profile is available as the default.
- A user can create a named custom presentation profile and switch between profiles during the current browser page session.
- Custom profiles change only the displayed companion label/presentation selection. They do not create another user identity, memory store, tool authority, permissions or Sentinel policy.
- The UI explicitly says custom profiles are session-only. Account persistence is not connected and must not be implied.
- No microphone, camera, speech, live avatar rendering or 3D runtime is activated by this selector.
- Profile selection and creation are covered by the companion-first UI regression tests.

**Verification:** GitHub Actions run 43967151754 completed successfully on implementation commit `f178c12a982092a7ae41d7df9874833ca74ed60d`. The Node.js test step and the full isolated D1, runtime/Queue and Forge migration/safeguard workflow passed.

**Remaining before this becomes a complete profile feature:** authenticated owner-scoped profile APIs and storage, schema/migration and deletion/export design, profile editing (appearance, interaction and accessibility), cross-device sync, and browser QA using a configured authenticated session. The static companion presentation remains a placeholder; real 2D/3D rendering and speech are separate later milestones.
