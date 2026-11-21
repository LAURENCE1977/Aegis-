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


## Pinned source inspection record

The next inspection stage records a bounded, metadata-only selection of source files against a full immutable 40-character commit SHA. The pure `createPinnedSourceInspection` contract rejects branch names, mismatched repository identities, unsafe paths, duplicate paths, unsupported extensions, malformed blob IDs, oversized files and aggregate selections above 256 KiB. It caps a selection at 20 files and freezes the resulting record.

The record explicitly labels source content as external and untrusted, instructs consumers never to follow instructions embedded in inspected content, and keeps fetch, network, build, install, execution and configuration mutation disabled. Sentinel approval remains mandatory; the record does not grant or imply execution authority.

This contract is a validation and evidence boundary, not yet an automated commit/tree fetcher or a vulnerability scanner. Existing Forge inspection/read endpoints remain owner-authenticated and read-only. Any later source retrieval must resolve the commit and tree first, then verify every requested path/blob pair against that pinned tree before reading the blob.
