# AEGIS Universal Device and 3D Companion Architecture

**Status:** Proposed core product requirement; architecture baseline for implementation planning  
**Scope:** AEGIS core, companion experience, web client, native adapters, local runtime, packaging and future platform ports  
**Principles:** Open source first, privacy by default, capability-based adaptation, graceful degradation, one shared identity and intelligence core.

## 1. Product requirement

AEGIS must be designed as one device-independent assistant and companion experience that can adapt its presentation and available capabilities to the device on which it is running.

The companion is a first-class experience layer over the shared AEGIS intelligence core. It is not a separate chatbot, a collection of unrelated platform-specific assistants, or a 3D-only interface.

The same user identity, companion identity, preferences, permissions, conversation continuity and authorised memory should follow the user across supported devices. Users must be able to choose a full-screen lifelike companion, a compact assistant, a conventional accessible interface, voice-first interaction, or combinations of these.

No device should be excluded from essential AEGIS functions merely because it cannot render advanced 3D.

## 2. Architecture: shared core, adaptive clients

Separate the product into stable contracts and replaceable presentation/runtime adapters:

1. **AEGIS Intelligence Core:** orchestration, model routing, policy, memory, skills, tools, permissions and user preferences. Device-independent.
2. **Companion Identity and Behaviour:** avatar identity, appearance, voice selection, animation state, expression mapping, interaction style and user customisation. Persist portable descriptors, not engine-specific scene files as the source of truth.
3. **Experience Shell:** responsive interface, navigation, accessibility, input handling and user-controlled display modes.
4. **3D Presentation Runtime:** rendering, animation, lighting, camera, lip-sync and optional scene/environment support. Replaceable by capability tier.
5. **Device Capability Broker:** reports supported capabilities, resource budgets, permission state and current operating constraints to the experience shell. It must not become a covert device inventory or fingerprinting service.
6. **Platform Adapters:** browser/PWA, Windows, macOS, Linux, iOS/iPadOS, Android, XR and approved console/TV adapters.
7. **Sync and Continuity:** securely synchronises user-authorised state and companion configuration across devices, with offline queues and conflict handling.

Use versioned, documented interfaces between these layers. A platform adapter must not fork or redefine the intelligence core.

## 3. Device discovery and adaptation

On first launch, AEGIS should run a brief, transparent capability assessment. Reassess when the device, browser, permissions, power state, display, network or available resources materially change.

Detect only what is necessary, through supported platform APIs and browser feature detection. Prefer capability checks over user-agent or device-model assumptions.

Potential signals, where available and permitted:

- Operating system family and supported API level.
- Browser engine and supported web platform features.
- CPU concurrency and coarse performance measurements.
- Available memory estimates and memory-pressure signals where exposed.
- GPU/rendering backend, supported WebGL/WebGPU features and practical frame-time tests.
- Screen size, pixel density, orientation, refresh rate where exposed, touch, pointer, keyboard and gamepad inputs.
- Camera, microphone, speakers, spatial audio and sensor availability, only after the relevant permission and user action.
- Battery/power-saving state and thermal/resource pressure where the OS exposes them.
- Network quality and offline availability.
- XR session support and supported interaction modes.

Do not collect serial numbers, hardware identifiers, installed-app inventories, file listings, browsing history or unrelated personal data. Do not attempt privileged scans from a browser. Native diagnostics must be opt-in, scoped, visible and revocable.

The assessment should produce a capability profile, not a permanent label about the user's device. Reassess dynamically and allow the user to override the selected experience tier.

## 4. Progressive experience tiers

The following are initial product tiers, not fixed hardware promises. Final thresholds must be established by real-device benchmarks and published compatibility tests.

| Tier | Experience | Expected behaviour |
|---|---|---|
| 0 – Essential | Accessible 2D and text | Core chat, settings, memory controls, tools and account continuity; no 3D requirement |
| 1 – Lightweight | Voice and lightweight avatar | Basic 2D/2.5D or low-poly companion, simple expressions and limited animation |
| 2 – Standard 3D | Interactive lifelike companion | Rigged 3D avatar, facial expressions, gestures, lip-sync, dynamic lighting within a measured budget |
| 3 – Advanced 3D | High-fidelity companion and scene | Higher-resolution assets, advanced shaders, richer animation, spatial audio and optional environments |
| 4 – Immersive | AR/VR/spatial computing | Supported WebXR or native spatial experiences, tracked input and spatial presentation where the device and platform allow it |

AEGIS should select the highest stable tier that meets performance, accessibility, battery and thermal budgets—not simply the highest tier the GPU claims to support.

If rendering performance degrades, automatically reduce effects, resolution, animation complexity or avatar detail. If necessary, move to 2D/voice without losing the conversation or task state. Explain significant mode changes and let the user choose whether to retry.

## 5. Rendering and 3D asset strategy

Adopt a progressive rendering strategy:

- WebGL2-compatible rendering as a broad web fallback where supported.
- WebGPU as an optional accelerated path when available and validated; never make it a universal prerequisite.
- A shared portable avatar/asset pipeline, favouring open formats such as glTF/GLB for runtime delivery.
- Investigate VRM as an optional avatar interchange format, subject to licence, facial-rig, accessibility and pipeline review.
- Keep source meshes, textures, rig metadata, animation clips, expression definitions and voice/lip-sync mapping independent from any one engine.
- Use level-of-detail models, texture variants, compressed textures, mesh optimisation, animation LOD and lazy loading.
- Provide low-bandwidth and low-memory asset variants.
- Treat Apple USDZ/RealityKit and other native spatial formats as platform-specific export/adaptation targets, not the canonical source of companion identity.
- Separate rendering from inference: the avatar must remain responsive even when AI inference is remote or temporarily unavailable.

Shortlist **Babylon.js and Three.js** for a measured proof-of-concept rather than selecting an engine by popularity. Babylon.js is a particularly strong first candidate because its official specifications describe WebGL 2 and WebGPU support, native hosts and a broad scene/animation feature set; its repository is Apache-2.0. Three.js is also a serious candidate: its WebGPURenderer can fall back to WebGL 2, but its documentation currently describes that renderer as still experimental. Benchmark bundle size, mobile thermals, avatar rigging, facial animation, accessibility integration, WebXR, asset pipeline, native reuse and licence obligations on actual target devices before deciding. Evaluate native engines/frameworks only where they provide clear platform value and can preserve the shared asset and behaviour contracts.

## 6. Natural, lifelike interaction

The companion should support a coherent state model across 2D and 3D:

- Idle, listening, thinking, speaking, interrupted, attentive, unavailable and user-configured states.
- Speech-to-text and text-to-speech independent of avatar rendering.
- Viseme/phoneme-driven lip-sync where the speech engine exposes suitable timing data; graceful approximate lip-sync otherwise.
- Facial expression and gesture controls driven by explicit interaction context, not by unsupported claims about reading a user's emotions.
- Eye gaze and head movement as optional animation, with reduced-motion and sensory-accessibility settings.
- User-controlled avatar appearance, clothing, voice, animation intensity, background and privacy settings.
- A clear distinction between generated animation and any real sensor-derived data.
- No requirement for a photorealistic human avatar to use AEGIS; offer stylised, abstract, non-human and no-avatar modes.

The companion must not impersonate a real person or imply that an animated expression proves an internal feeling.

## 7. Cross-platform delivery strategy

Use a web-first, installable Progressive Web App (PWA) as the broad-access baseline, with native shells/adapters where deeper operating-system integration is required.

- **Windows:** PWA/browser first; optional native adapter for notifications, files, local model/runtime integration and OS services using supported Windows APIs.
- **macOS:** PWA/browser first; optional native adapter for menu bar, notifications, permissions, local inference and system integration.
- **Linux:** browser/PWA baseline; optional packages and local service integration for supported distributions.
- **iPhone/iPad:** responsive web/PWA baseline; native iOS/iPadOS adapter only for capabilities that require native APIs or materially improve reliability.
- **Android phones/tablets/foldables/Chromebooks:** responsive PWA baseline; optional native adapter; adapt to window size, fold posture, touch, stylus, keyboard and external displays.
- **XR headsets/spatial computers:** WebXR when supported; native platform adapter where required for a high-quality spatial experience.
- **Smart TVs:** remote-control-friendly, low-resource web experience where browser support is viable; do not promise installability or background behaviour.
- **Game consoles:** investigate browser-based access and official developer pathways separately. Console app distribution, APIs, browser capabilities and certification are platform-controlled. Treat Xbox as a possible research target, not a guarantee; PlayStation and Nintendo require separate feasibility and access reviews. Never rely on jailbreaking, exploits or unsupported sideloading.

A shared backend and account model should allow users to move between devices. Local platform integrations must be optional modules with explicit permissions.

## 8. Minimum requirements and support contract

Do not publish arbitrary CPU/RAM/GPU numbers before benchmarks. Define minimum requirements by capability and supported platform version.

At minimum, a supported Tier 0 client needs:
- A supported modern browser or approved native shell.
- JavaScript and secure HTTPS access.
- Enough memory to load the essential client.
- A usable display and at least one supported input method.
- Network access for remote services; offline functionality limited to cached/local features.

Advanced 3D requires a compatible graphics API, adequate memory, a supported rendering implementation and successful runtime performance checks. WebGPU must remain optional because browser and platform availability varies. XR requires explicit device/browser support and user permission.

Publish three separate statuses:
1. **Supported:** tested against the current compatibility matrix.
2. **Degraded:** essential experience works, but selected capabilities are unavailable or reduced.
3. **Unsupported:** essential security or runtime requirements are not met; provide a clear reason and safe alternatives.

Never block basic text/voice assistance solely because advanced graphics are unavailable.

## 9. Performance, battery and thermal governance

Create a device adaptation controller that continuously observes permitted performance signals:

- Target smoothness appropriate to the active tier; avoid forcing high frame rates on battery-constrained devices.
- Monitor frame-time stability, memory pressure, asset load time, audio latency and interaction responsiveness.
- Reduce render resolution, shadows, particles, post-processing, animation frequency and model complexity in a defined order.
- Pause non-essential animation when the companion is not visible.
- Respect OS power-saving and reduced-motion settings.
- Avoid background GPU work and unnecessary wake locks.
- Keep speech and core interaction available when 3D rendering is paused.
- Expose a user-visible performance mode: automatic, battery saver, balanced and quality.

## 10. Security and privacy boundaries

- Capability discovery is local-first and data-minimised.
- Ask separately for camera, microphone, location, sensors, files, screen capture and device-control permissions.
- Explain why a permission is needed, what data is used, whether it leaves the device, and how to revoke it.
- Never use capability profiles as covert fingerprinting identifiers.
- Never scan files, installed applications or connected devices without a distinct user-authorised feature and clear scope.
- Local model downloads and native helpers must be signed/verified and updateable.
- Platform adapters run with least privilege and cannot bypass AEGIS permission policy.
- Provide diagnostics export only after preview and explicit user confirmation.

## 11. Updates and future-proofing

The capability broker, rendering adapters, asset pipeline, platform integrations and companion interface must be modular and versioned.

Support:
- Independent security updates and capability-module updates.
- Backward-compatible API contracts and migrations.
- Signed release manifests, integrity checks and rollback.
- Feature flags and staged rollout.
- Compatibility telemetry only when explicitly opted in and privacy-preserving.
- Local diagnostics and reproducible benchmark suites.
- A plugin/adapter registry with licence, provenance, permissions, maintenance and security review.

A new platform must be addable through an adapter and conformance suite, not by rewriting the intelligence core.

## 12. Proposed implementation sequence

1. Record the universal-device requirement and interfaces; do not destabilise current agent/runtime work.
2. Define a versioned capability-profile schema and privacy contract.
3. Build a small device-assessment prototype that reports only permitted features and produces no persistent fingerprint.
4. Establish the Tier 0 responsive shell and a Tier 1 companion placeholder.
5. Benchmark candidate web renderers and asset formats on low-, mid- and high-tier hardware.
6. Build the shared avatar identity, rig, expression and animation contract.
7. Add WebGL2 fallback and optional WebGPU acceleration.
8. Add adaptive quality control, reduced-motion and battery-aware behaviour.
9. Add native adapters incrementally, beginning with the platforms supported by the project and available test hardware.
10. Prototype WebXR and spatial experiences.
11. Investigate console/TV pathways and publish feasibility per platform.
12. Add a real-device compatibility matrix and automated regression tests before declaring each platform supported.

## 13. Acceptance criteria

- The same account and companion identity can be used across at least two distinct device classes.
- Tier 0 remains usable when GPU APIs, 3D assets or voice services are unavailable.
- The client chooses rendering features through capability detection, not hard-coded device names.
- Unsupported WebGPU/WebXR paths fall back safely.
- Performance degradation does not lose chat, task or companion state.
- Users can inspect and change their experience tier.
- Permission prompts are contextual, minimal and revocable.
- No persistent hardware fingerprint is required for adaptation.
- 3D assets can be reused across supported runtimes without making a single engine the source of truth.
- Each platform's support status is backed by a published test matrix.
- Platform-specific restrictions are documented honestly; no universal compatibility claims without evidence.

## 14. Cooperative multi-device experience (future capability)

Explore an optional, user-paired AEGIS device group in which each device contributes only the capabilities the user explicitly authorises. For example, a television or desktop could present the companion, a phone could act as a microphone or touch controller, and a tablet could show a shared workspace. A capable home PC could optionally render a high-fidelity avatar for a low-powered client on the same trusted network.

Requirements:
- Pair devices through a clear, authenticated, revocable flow; never silently discover or join nearby devices.
- Show which device is providing each capability and let the user stop sharing immediately.
- Encrypt device-to-device traffic and authenticate every peer; do not trust the local network by default.
- Keep the core assistant usable if any peer disconnects.
- Make remote rendering an optional self-hosted capability, not a mandatory paid cloud dependency.
- Avoid relaying raw camera or microphone streams unless the user explicitly starts and can visibly stop that session.
- Define latency, bandwidth, battery and privacy budgets before enabling real-time audio/video or remote rendering.
- Support handoff of an active conversation or task between devices without duplicating agent authority or creating conflicting actions.

This could make AEGIS feel like one companion that can move between a desk, pocket, living-room screen and headset, while remaining safe and useful when devices are offline or unavailable.

## 15. Research references

- MDN, WebGPU API and feature detection: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
- Babylon.js official engine specifications: https://www.babylonjs.com/specifications/
- Babylon.js official WebGPU support and WebGL fallback: https://doc.babylonjs.com/setup/support/webGPU/
- Babylon.js repository and Apache-2.0 licence: https://github.com/BabylonJS/Babylon.js
- Three.js WebGPURenderer and WebGL 2 fallback: https://threejs.org/manual/pages/webgpurenderer
- MDN, WebXR Device API and compatibility caveats: https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API
- W3C, WebXR Device API specification: https://www.w3.org/TR/webxr/
- web.dev, Progressive Web Apps and platform installability: https://web.dev/learn/pwa/progressive-web-apps/
- MDN, PWA offline/background operation: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
- Android Developers, adaptive app quality: https://developer.android.com/docs/quality-guidelines/adaptive-app-quality
- Microsoft, Windows App SDK: https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/
- Microsoft, version-adaptive apps: https://learn.microsoft.com/en-us/windows/apps/develop/testing/version-adaptive-apps
- Apple, visionOS development: https://developer.apple.com/documentation/visionos
- Apple, RealityKit: https://developer.apple.com/documentation/realitykit
- Microsoft, Xbox app development options: https://learn.microsoft.com/en-us/windows/uwp/apps-for-xbox/development-options

These references establish possible platform capabilities, not a promise that every feature is available on every device or browser. Verify current compatibility and licensing during implementation.
