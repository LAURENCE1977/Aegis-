# AEGIS MCP Forge Catalogue

## Scope

The first MCP Forge slice is a metadata-only, in-memory catalogue. It validates and searches candidate server records. It does not fetch repository content, install packages, launch stdio processes, connect to remote servers, execute tools, store credentials or grant permissions.

## Record contract

Each record carries:
- stable AEGIS identifier, display name and bounded description;
- HTTPS source URL and pinned 40/64-character Git commit SHA;
- declared licence identifier and independent licence-review state;
- transport (stdio, Streamable HTTP or SSE), runtime (local-process, container, remote) and authentication mode;
- explicit egress host allowlist;
- per-action description, effect, risk, required scopes and approval policy;
- admission status limited to candidate, reviewed or blocked.

Write, execute, high-risk and critical-risk actions must declare human-always approval. The catalogue cannot set a record to approved; admission is a separate future workflow. MCP annotations and directory entries never grant authority.

## Security boundary

- Metadata is untrusted and bounded; no remote URLs are fetched by this module.
- Source URLs must use HTTPS without embedded credentials.
- Revisions must be pinned commit SHAs, not moving branch names.
- Egress hosts must be explicit DNS hostnames; wildcards, localhost and IP literals are rejected.
- Secret values are never accepted; only secret-reference identifiers are allowed.
- Returned records are defensive copies.
- No execution method exists on the catalogue API.

## Next steps

1. Add persistent D1 storage and owner-authenticated read-only catalogue APIs.
2. Add source inspection as a separate isolated ingestion job, with SSRF and prompt-injection controls.
3. Add licence, maintenance, advisory, dependency and provenance evidence.
4. Add sandboxed conformance tests and risk assessment.
5. Add owner approval and version-pinned admission.
6. Route all actual tool calls through Sentinel and exact-operation approval.

Until those stages exist, every entry remains descriptive metadata only.
