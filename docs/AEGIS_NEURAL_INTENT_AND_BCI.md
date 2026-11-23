# AEGIS NEURAL — Intent Engine and Non-invasive BCI Research

**Status:** Initial architecture and research decision. The software intent-proposal engine is implemented in source with tests. No EEG device is connected, no raw neural signal is collected, and no classifier or medical capability is claimed.

## 1. Objective

AEGIS NEURAL is a provider-neutral interaction layer for expressing user intent through voice, touch, gaze, accessibility switches and (optionally) non-invasive EEG.

It is not a brain-reading product and it does not infer permission. The same intent contract is used regardless of input modality:

`input observation → validation → intent proposal → ODIN planning → Sentinel policy → approved capability`

An intent proposal is not an instruction to execute. It is never an approval, capability grant, authentication factor or proof of identity.

## 2. Software track

### Implemented first slice

`workers/runtime/intent-engine.mjs` exports:
- `normaliseIntentObservation`: strict allowlist for voice, touch, gaze, switch and EEG; explicit consent; bounded confidence and signal quality; strict fields; timestamp validation.
- `createIntentProposal`: freshness checks, cross-modal agreement, confidence threshold and an explicit ambiguous outcome.
- EEG confidence ceiling of 0.65 in this initial experimental policy, so EEG alone cannot meet the default 0.75 proposal threshold.
- Every result is marked `proposal-only`, `authorised: false`, `execution: none` and `requiresExplicitConfirmation: true`.
- EEG observations carry only bounded metadata (sample window and channel count); raw samples are not accepted by this contract.

This is a pure module. It is not yet wired into the UI, voice pipeline, ODIN runtime or Sentinel invocation route.

### Next software steps

1. Add a voice/text intent adapter that uses existing user-authorised input and outputs only allowlisted labels.
2. Add touch, keyboard and accessibility-switch adapters using explicit UI events.
3. Add a consent and session-state model for any live capture, with visible capture indicators and immediate stop.
4. Add an owner-visible intent preview before ODIN plans a task.
5. Keep all protected actions behind existing Sentinel approvals; confidence never substitutes for approval.
6. Evaluate false activations, missed intents, calibration and accessibility outcomes before changing thresholds.

## 3. Non-invasive EEG research track

### Candidate integration layer: BrainFlow

BrainFlow is the leading initial software adapter candidate because it offers a board-agnostic acquisition and signal-processing API, includes synthetic and playback boards for development without hardware, documents Android support, and lists multiple EEG devices including OpenBCI, Muse, BrainBit, Neurosity and others. Its documentation identifies the project as MIT-licensed.

- Documentation: https://brainflow.readthedocs.io/en/stable/
- Supported boards: https://brainflow.readthedocs.io/en/stable/SupportedBoards.html
- Android installation: https://brainflow.readthedocs.io/en/stable/Examples.html
- Licence: https://github.com/brainflow-dev/brainflow/blob/master/LICENSE

BrainFlow is a candidate adapter, not a dependency yet. First build against synthetic/playback data and review its release, platform and licence details at the exact version before adding any package.

### Hardware reference: OpenBCI

OpenBCI's documentation describes the Cyton as an 8-channel biosensing amplifier with 250 Hz sampling, and the Ganglion as a 4-channel unit with 200 Hz sampling. Its hardware is designed to work with third-party software that has a compatible driver.

- Hardware FAQ: https://docs.openbci.com/FAQ/HardFAQ/
- Software interface documentation: https://docs.openbci.com/Software/OpenBCISoftware/GUIDocs/

This is a research reference, not a purchase recommendation. EEG requires correct electrodes, fit, signal quality and safe use. A low-cost headset does not automatically provide reliable control.

### Intended initial experiments

- Start with simulated and recorded public/demo data; do not connect a person or device yet.
- Limit the first classification task to a small set of deliberate, trained choices such as select / cancel / pause.
- Use a per-session calibration and a neutral/no-control state.
- Detect poor contact, motion artefact, missing channels and stale samples; return unknown rather than guessing.
- Measure per-user accuracy, false activations, missed activations, latency and calibration time.
- Compare against touch, switch and voice baselines.
- Never infer free-form thoughts, beliefs, emotions, consent or hidden intentions.

EEG signal interpretation is noisy and highly user- and setup-dependent. A classifier confidence score is not a validated probability unless calibrated on appropriate held-out data. Do not use the prototype for diagnosis, treatment, safety-critical control or medical claims.

## 4. Data protection and consent

Neural-derived data is especially sensitive. Default policy:
- no capture until the user explicitly starts a named session;
- visible recording/streaming indicator and one-tap stop;
- no raw EEG upload to AEGIS cloud services;
- process locally where practical;
- do not retain raw signal windows by default;
- store only a minimal, short-lived intent event if the user has enabled the feature;
- never use EEG as login, identity verification or permission approval;
- no sharing, model training, analytics or secondary use by default;
- provide export and deletion controls before any persistent storage is introduced.

Any future real-user research must have a clear protocol, informed consent, security review and appropriate ethics/regulatory advice. This engineering prototype is not a medical device.

## 5. Security invariants

- Input adapters cannot call tools or invoke capabilities.
- Classifier output is untrusted input and must be schema-validated.
- Unknown, stale, conflicting or low-quality observations remain ambiguous.
- EEG confidence is capped at 0.65 in the initial experimental policy.
- No input signal can create or consume a Sentinel approval.
- Only the authenticated user can confirm an intent proposal.
- Confirmation of an intent does not itself approve a protected operation; the existing Sentinel approval path remains separate.
- Raw signals, credentials and private session material must not appear in logs or audit payloads.

## 6. Delivery stages

| Stage | Deliverable | Gate |
|---|---|---|
| 1 | Pure multimodal intent contract | Unit tests and fail-closed cases |
| 2 | Voice/touch/switch adapters | Explicit capture state and user preview |
| 3 | BrainFlow synthetic/playback adapter | No hardware and no raw signal retention |
| 4 | Offline EEG feature experiment | Reproducible benchmark and user-specific calibration |
| 5 | Optional hardware pilot | Separate explicit decision, privacy review and safe setup |
| 6 | Sentinel-governed action integration | Exact intent confirmation and separate capability approval |

## 7. Research evidence

- BrainFlow documentation describes a unified acquisition and signal-processing API, synthetic/playback boards and supported EEG devices: https://brainflow.readthedocs.io/en/stable/
- OpenBCI hardware documentation describes Cyton and Ganglion channel counts and sampling rates: https://docs.openbci.com/FAQ/HardFAQ/
- These vendor/project sources establish documented interfaces and specifications, not independent proof of accuracy or suitability for AEGIS.

**Current decision:** proceed with the software intent engine and a hardware-independent EEG research adapter contract in parallel. Do not buy hardware, add a paid service, connect a headset, store raw neural data or enable device actions as part of this milestone.
