# Companion model adapter contract

## Current default

The AEGIS companion continues to render its built-in procedural model. No imported model parser, renderer extension or third-party runtime is bundled. If the host does not explicitly inject a model adapter, `loadModel` fails closed with `unsupported-model-adapter`.

## Adapter injection

A host may pass a trusted application-code adapter through the renderer options:

- `formats`: explicit array of manifest formats supported by this adapter.
- `load({ file, manifest })`: asynchronous parser/loader owned by the application build, not by the asset or manifest.

Do not resolve adapter code from a URL, a model file, an untrusted manifest field, or user-provided executable content. Adapter injection is a code-level integration point, not a plugin marketplace or remote-code loading feature.

## Required returned resource

The adapter must return a disposable resource:

- `dispose()`: releases all adapter-owned CPU/GPU/runtime resources.
- `stats.maxTextureDimension`: measured largest texture dimension, as a safe integer.
- `stats.drawCalls`: measured draw-call count, as a non-negative safe integer.

The renderer checks those values against the manifest's bounded `performanceBudget` before it commits the resource. The adapter must report actual parsed-resource measurements; caller-provided or manifest-declared numbers are not evidence of runtime cost.

## Activation sequence

1. Validate the immutable asset manifest and declared byte length.
2. Enforce the 50 MiB upload ceiling.
3. Verify the actual uploaded bytes against SHA-256.
4. Confirm that the injected adapter explicitly supports the declared format.
5. Parse through the trusted injected adapter.
6. Require a disposable resource and measured telemetry.
7. Reject and dispose resources that exceed the manifest budget.
8. Prepare the resource through the transactional lifecycle.
9. Commit only after every preceding check succeeds; the previous model remains active on failure.

Renderer disposal invalidates pending tickets. A candidate arriving after disposal is released and cannot become active.

## Important limits

- SHA-256 confirms byte identity, not that a model is safe, correctly licensed, or free of parser vulnerabilities.
- Licence fields are provenance supplied by the uploader; they are not independently verified by the renderer.
- Performance telemetry is only as reliable as the trusted adapter implementation.
- The current renderer does not render the imported resource. This contract establishes a guarded resource lifecycle; an actual VRM/GLB rendering adapter still needs a separate reviewed implementation, dependency/bundle assessment, WebGL context-loss handling, mobile memory/FPS tests and explicit release review.
- No microphone or camera permissions are requested by this adapter contract.
