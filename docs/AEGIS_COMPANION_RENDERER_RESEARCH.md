# AEGIS Companion Renderer Research

Research date: 19 November 2026  
Scope: read-only GitHub review through the connected GitHub account. Repository metadata, source README/package manifests and licence files were inspected. No third-party code or model assets were copied into AEGIS.

## Decision

Do not adopt an entire avatar application or ship third-party sample characters. Build an AEGIS-owned, provider-neutral renderer adapter and treat renderers, lip-sync extractors, VRM/GLB models and animation packs as separate replaceable components.

The Companion Profile and interaction-preference system remains architecturally separate from the renderer. A first dependency-free procedural WebGL2 prototype is now integrated on this branch; imported VRM/GLB/VRMA assets, rigged human fidelity and voice-synchronised animation remain separate future milestones.

## Candidate review

### 1. payner35/avatarz — strongest browser lip-sync reference

Repository: https://github.com/payner35/avatarz  
Code licence: MIT. Package: avatarz 0.1.0.

Useful findings:
- Browser-only renderer driven by an existing Web Audio AudioNode; it does not need to know which TTS or voice provider produced the audio.
- Three.js and @pixiv/three-vrm support VRM; optional Gaussian-splat renderer, ONNX Runtime Web and MediaPipe modules.
- Separates audio tap, extractor, face-life animation and renderer behind small interfaces.
- Uses timestamped audio/frame alignment and measures lip-sync delay rather than assuming zero latency.

Risks and limits:
- The neural lip-sync model download is about 101 MB. The README reports roughly 500 ms audible delay for the neural extractor and about 100 ms for the classifier fallback.
- The sample heads are described as low-resolution captures.
- The author's current measurements are on an M-series Mac in Chrome; Safari, Firefox and phones are explicitly untested.
- Code is MIT, but third-party pieces retain their own licences: the lip-sync model is Apache-2.0, the splat renderer MIT, MediaPipe Apache-2.0, and the sample VRM uses VRM Public License 1.0. The sample splat bundles' own upstream licence is not stated; the README says they are fetched for development and not shipped.

Assessment: use as a design reference for the audio-node contract, timestamped lip-sync, and renderer separation. Do not import its sample heads or model bundle. Do not make it the default renderer until mobile-browser performance, memory use, model size and latency have been independently tested.

### 2. ARPAHLS/avatar — useful local-agent and VRMA reference

Repository: https://github.com/ARPAHLS/avatar  
Software licence: MIT. Latest documented app version: 0.8.0.

Useful findings:
- Uses VRM models and VRMA animation clips.
- Its desktop-only local agent bus is opt-in, loopback-only (127.0.0.1), token-protected by default, and shares the same command dispatcher as the UI.
- The token is encrypted with the operating-system keychain where available; it is memory-only if no keychain exists.
- It exposes explicit state discovery and distinguishes a command being accepted from an animation actually finishing.
- Its audio documentation says lip-sync analysis stays local and does not upload audio.

Limits and provenance:
- The main product is an Electron desktop overlay. Its browser build is for development/contributors and does not include the local agent bus or desktop audio loopback.
- The MIT licence covers software, not bundled media. The repository documents separate VRM and VRMA terms, including VRM Public License 1.0 and pixiv/VRoid animation credits and restrictions. Its Windows installer has a separate EULA.

Assessment: borrow security and interaction principles only: loopback binding, opt-in activation, token protection, a shared allowlisted command layer, explicit state discovery, and accepted-versus-completed operation states. Do not import the Electron shell or bundled media into the web-first AEGIS runtime.

### 3. mctouch/webgpu-avatar-client — GPU pipeline reference, not a fit for the default stack

Repository: https://github.com/mctouch/webgpu-avatar-client  
Code licence: MIT.

Useful findings:
- Documents a WebGPU renderer with a WebGL2 fallback and ARKit-compatible facial blendshape weights.
- Separates the browser renderer from speech/AI backend clients.

Limits:
- Its full voice pipeline requires NVIDIA Audio2Face-3D NIM, NVIDIA Riva, Envoy gRPC-Web proxying and a separate ASR/LLM backend.
- The README says to use Chrome Canary with WebGPU flags because Chrome Stable does not support the required features in that project.
- The backend is not included.

Assessment: useful for understanding blendshape transport and WebGPU/WebGL2 fallback boundaries. Do not adopt its NVIDIA service topology as an AEGIS requirement; that would undermine provider neutrality and the local/free-first path.

### 4. livliv-dev/player — lightweight fallback candidate

Repository: https://github.com/livliv-dev/player  
Package: @livliv-dev/player 0.5.1. Code licence: Apache-2.0.

Useful findings:
- The core is a dependency-free WebGL2 2.5D character player, reported at about 30 KB gzipped.
- It supports mouth animation, expressions, actions, optional webcam tracking, and separate adapters for LivLiv, PNGTuber and VRM bodies.
- Three.js and @pixiv/three-vrm are optional peer dependencies for its VRM body adapter.

Limits:
- Its primary lightweight mode is 2.5D, not the lifelike 3D target.
- The 25 featured character assets have their own separate licence, not the Apache-2.0 code licence. The README imposes creator-credit and usage restrictions; do not redistribute those characters in AEGIS.

Assessment: retain as a possible low-power fallback or API-design reference, subject to an independent package and asset audit. It is not a replacement for a true 3D VRM/GLB renderer.

### 5. M3-org/CharacterStudio — external asset-authoring reference

Repository: https://github.com/M3-org/CharacterStudio  
Code licence: MIT. Package: @m3-org/characterstudio 0.5.0.

Useful findings:
- Browser-based glTF/VRM authoring, animation, export and optimisation.
- Documents mesh merging and texture atlasing to reduce draw calls.

Limits:
- Requires a separate loot-assets checkout for its default assets.
- Its README instructs installation with legacy peer-dependency handling.
- Its package manifest includes a broad dependency set, including React, Three.js, Web3/Solana/Metaplex packages and related tooling.

Assessment: consider it as a separate asset-authoring tool for a developer workstation, not as a runtime dependency in the AEGIS web app. Audit its dependency tree and the separate asset pack before any use.

### 6. ekza-space/ekza-studio — do not reuse pending licence clarification

Repository: https://github.com/ekza-space/ekza-studio  
GitHub licence metadata: Other / NOASSERTION.

Assessment: no code reuse until the actual licence terms are clarified and approved.

### 7. pixiv/three-vrm — preferred VRM loader candidate

Repository: https://github.com/pixiv/three-vrm  
Package: `@pixiv/three-vrm`  
Reviewed release: `v3.5.5` (MIT; stable npm `latest` at review time). The upstream release page also exposes `v3.6.0-beta.0`; do not use the beta for the first AEGIS integration.

Verified from the tagged package manifest and upstream README:
- ESM package with built-in TypeScript declarations and a `VRMLoaderPlugin` for Three.js `GLTFLoader`.
- Three.js is a peer dependency (`>=0.137`); the package is split into modular VRM core, MToon materials, spring-bone, node-constraint and compatibility packages.
- The documented browser flow loads VRM through GLTFLoader and reads the resulting VRM object from `gltf.userData.vrm`.
- The core package is MIT-licensed. This does not license a user's imported model, textures, animation clips or bundled sample assets.

Assessment: this is the strongest directly maintained VRM loader candidate for AEGIS's browser-first avatar milestone. Keep it optional and lazy-loaded behind an AEGIS adapter; retain the current AEGIS-owned WebGL2 prototype as the no-dependency fallback. Pin the stable release and its full dependency graph, test bundle size and mobile memory/thermal behaviour, and confirm Three.js compatibility before enabling it. Do not adopt sample models or animation assets as product defaults.

VRMA is a separate package/feature surface and must receive its own version, licence, dependency and asset review. A VRM loader alone does not provide a complete AEGIS avatar: facial-expression mapping, viseme translation, animation state, resource ownership/disposal and audio synchronisation remain AEGIS adapter responsibilities.

Evidence:
- Tagged upstream package manifest: https://github.com/pixiv/three-vrm/blob/v3.5.5/packages/three-vrm/package.json
- Tagged upstream licence: https://github.com/pixiv/three-vrm/blob/v3.5.5/LICENSE
- Upstream browser integration guide: https://github.com/pixiv/three-vrm/blob/v3.5.5/README.md
- Stable package metadata and current npm tag: https://www.npmjs.com/package/@pixiv/three-vrm

## AEGIS implementation direction

The AEGIS-owned renderer boundary should:

1. Support optional GLB/VRM models and VRMA animation clips without tying AEGIS intelligence, memory, Sentinel or tool permissions to a renderer.
2. Keep the renderer separate from audio extraction, speech generation and provider routing.
3. Drive lip-sync from an existing local audio node or explicitly timestamped viseme frames. Raw audio must not be uploaded by default.
4. Detect real runtime capabilities, then choose WebGPU, WebGL2, a lightweight 2.5D fallback, or voice-only presentation. Do not rely solely on user-agent strings.
5. Require a model/animation provenance manifest before an asset is accepted: source URL, cryptographic hash, format, licence identifier and terms URL, creator/credit, commercial-use and redistribution flags, blendshape profile, and declared performance budget.
6. Dispose GPU resources, workers, audio taps and event listeners when the companion is hidden, the model changes, or the user leaves the session.
7. Keep renderer code incapable of issuing tools, changing permissions, authorising actions or bypassing Sentinel.

Proposed adapter surface (to be implemented and tested separately):

- init(canvas, options)
- loadModel(assetManifest)
- setState(id)
- setExpression(id, weight)
- setVisemes(timestamp, weights)
- playAnimation(id, mode)
- resize(width, height, pixelRatio)
- suspend() / resume()
- dispose()

## Next verification gates

Before selecting a production renderer:
- Benchmark iOS Safari, Android Chrome and desktop Chrome, including devices without WebGPU.
- Measure model download size, first-render time, median/p95 frame time, memory, thermal/battery impact and lip-sync delay.
- Test offline and slow-network behaviour, reduced-motion preferences, resize/orientation changes, repeated model swaps and full disposal.
- Verify every model, animation and texture licence independently; a repository's MIT/Apache code licence does not grant rights to its sample assets.

No renderer dependency, third-party model or animation pack is adopted by this research note.


## Implementation status — 19 November 2026

The first AEGIS-owned asset-provenance gate is now implemented in `companion/renderer.mjs`:

- `validateCompanionAssetManifest` validates the versioned `aegis.companion-asset/1.0` metadata contract for GLB/VRM model assets and VRMA animation assets.
- Metadata includes SHA-256 syntax, byte length (maximum 50 MiB), upload/HTTPS provenance, licence identifier and HTTPS terms, creator, commercial-use and redistribution declarations, blendshape profile, and bounded texture/draw-call budgets.
- The validator returns a minimal immutable projection and drops unknown fields. It does not fetch remote URLs, execute files, prove licence ownership or scan content for malware.
- `verifyCompanionAssetDigest` uses Web Crypto to calculate SHA-256 over the actual uploaded Blob/File bytes. It checks file shape and the 50 MiB limit before reading, then fails closed on missing crypto, read errors, byte-length mismatch and digest mismatch.
- `createCompanionRenderer.loadModel(assetManifest, file, cryptoApi)` now validates the manifest, requires an actual Blob/File-like upload, checks the uploaded size against the manifest, and verifies the actual SHA-256 before it can return the intentionally disabled external-loader status. The optional crypto argument exists for deterministic tests; production defaults to browser Web Crypto.
- Regression coverage exercises absent uploads, matching bytes, same-length tampered bytes, invalid metadata, and the helper's failure cases. A test-first CI run exposed a missing-file versus size-mismatch diagnostic distinction; the contract was corrected before the passing rerun.
- The upstream `@pixiv/three-vrm` v3.5.5 candidate is MIT-licensed and has a Three.js peer dependency plus modular VRM packages. It remains a research recommendation only: AEGIS currently has no root package manifest, so introducing Three.js would be a new runtime dependency and requires bundle, mobile memory/thermal, compatibility and disposal benchmarks first. See the preferred-candidate review above.

Verification: workflow [44589027079](https://github.com/LAURENCE1977/Aegis-/actions/runs/44589027079) passed on code head `0e5d6bd55847ac822d631908c961a511ae92e876`: **1,036 Node tests, 1,035 passed, 0 failed, 1 skipped**, plus one Cloudflare runtime integration test and all isolated capability, runtime/Queue, Forge, Eval Forge, Learning Forge and Companion Profile D1 checks.

The external loader remains deliberately disabled pending dependency pinning, parser-level format validation, model resource budgets, resource disposal, external-resource isolation and real iOS/Android/desktop performance tests. The procedural WebGL2 renderer and accessible CSS fallback remain the active presentation path.
