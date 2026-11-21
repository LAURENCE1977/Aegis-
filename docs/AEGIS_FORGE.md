# AEGIS Forge — safe repository inspection

## Purpose

Forge is AEGIS's source-aware reverse-engineering workshop. It inspects public GitHub repositories and reads selected source files by immutable Git blob SHA. It does not install, build, run, import or execute inspected code.

## API

- `POST /api/forge/inspect`: owner-authenticated, same-origin JSON request containing one canonical public GitHub repository URL. Returns repository metadata, the default branch tree SHA, a bounded list of inspectable file paths/blob SHAs/sizes and a truncation indicator.
- `POST /api/forge/read`: owner-authenticated, same-origin JSON request containing the repository URL and a pinned blob SHA. Returns the bounded UTF-8 text content for that blob.

## Safety controls

- Only HTTPS `github.com` repository URLs are accepted; private repositories are rejected.
- All outbound requests use the fixed `https://api.github.com` origin, reject redirects and use a 15-second timeout.
- GitHub JSON responses are bounded to 4 MiB.
- Inspection returns at most 100 selected text files, each no larger than 32 KiB.
- Common vendored/build directories, minified bundles, source maps and binary/non-UTF-8 blobs are excluded.
- Blob reads are pinned by SHA, repository-scoped, size-checked and decoded with fatal UTF-8.
- Request bodies are streamed and bounded before any GitHub request.
- Retrieved repository content is untrusted data. It is never executed, treated as instructions or granted permissions.

## Current limitations

This slice does not persist candidates, perform licence review, scan dependencies/advisories, create build artifacts or run tests against upstream repositories. Those are separate Forge stages. No external repository is installed or connected.


## Candidate review lifecycle

An inspected repository can be saved as an owner-scoped Forge candidate, pinned to the default-branch tree SHA. Candidate creation always starts with `decision: unassessed` and `licence.review: review-required`; GitHub's SPDX metadata is a hint, not legal clearance. The owner must attest to reviewing the actual licence text, provide an HTTPS evidence URL and a review note before choosing reuse/adapt/combine or marking a candidate approved. D1 triggers enforce the licence gate, immutable source identity and append-only candidate events. Candidate review does not install or execute the repository.


## Evidence-bound capability analysis

- `POST /api/forge/analyse` accepts exactly one canonical public GitHub `sourceUrl`, after owner authentication and same-origin validation.
- It reuses the existing Forge tree inspection and immutable blob reader. It does not create a second fetcher or accept arbitrary URLs.
- It reads at most 20 selected files, bounded by the existing 32 KiB per-file limit and 256 KiB aggregate analysis limit.
- Every blob response must match the SHA and byte size recorded in the inspected tree; a mismatch fails closed.
- The deterministic analyser emits only fixed capability IDs, matched terms and path/blob evidence references. It does not return source excerpts.
- The response reports available, selected and skipped file counts and propagates the tree truncation signal. It never claims complete coverage when the sample is incomplete.
- Findings are lexical candidate signals, not security verdicts or proof of implementation quality. Readiness remains unassessed; no code is executed, installed, built or authorised.
