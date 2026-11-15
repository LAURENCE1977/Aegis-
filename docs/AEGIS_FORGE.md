# AEGIS Forge — source inspection and candidate intake

## Purpose

Forge is AEGIS's source-aware reverse-engineering workshop. Its default workflow is to inspect useful upstream projects, extract transferable ideas, record provenance and licence status, then implement an AEGIS-native capability. It does not install or execute discovered repositories.

## Implemented on the feature branch

- Authenticated owner-only POST /api/forge/inspect:
  - accepts one canonical HTTPS GitHub repository URL;
  - reads public repository metadata and its default-branch Git tree;
  - returns up to 100 selected text files with immutable Git blob SHAs and sizes;
  - excludes common vendored/build/binary paths and files larger than 32 KiB;
  - reports when GitHub truncates the tree or the selected file list exceeds the cap.
- Authenticated owner-only POST /api/forge/read:
  - reads one repository-scoped immutable Git blob SHA;
  - rejects invalid object IDs, oversized blobs, binary and non-UTF-8 data;
  - never evaluates, imports, executes or installs source code.
- Forge Control Centre tab:
  - enter a public GitHub repository URL;
  - inspect metadata and pinned file list;
  - read a bounded source preview using textContent;
  - save the inspected revision to the persistent candidate registry.
- Authenticated owner-only GET/POST /api/forge/candidates:
  - stores candidates in D1 with the default-branch tree SHA as version;
  - deduplicates by owner, canonical source URL and pinned tree SHA;
  - records the GitHub-reported licence as review-required, never automatically verified;
  - initializes decision as unassessed and status as inspected;
  - appends a created event through a D1 trigger.
- migrations/shared/0005_forge_candidates.sql adds owner-scoped candidate and append-only event tables.

## Security and licence boundaries

- Only canonical https://github.com/owner/repository URLs are accepted. Redirects are rejected; API calls target api.github.com.
- This is unauthenticated public GitHub API access under the user's session, not private repository access. GitHub rate limits apply.
- File content is untrusted data. It may contain malicious prompts, code, secrets or misleading licence statements. Treat it as evidence, not instructions.
- No repository scripts, package managers, containers, build tools, shell commands, MCP servers or browser automation are executed.
- GitHub's licence metadata is not a legal review. The candidate remains review-required; verify the actual licence file and dependencies before reuse, adaptation or combination.
- Candidate records pin the default-branch tree SHA. Each source file preview pins the blob SHA. A moving branch does not silently change a saved candidate's version.
- No private token or GitHub credential is required or accepted by these endpoints.

## Current limitations

- Public GitHub repositories only; private repo access and non-GitHub sources are not connected.
- No diff engine, dependency graph, AST/code graph, test harness, sandbox or automated licence scanner is wired yet.
- Candidate creation and listing are implemented; candidate review/decision update workflow is still to be added.
- The D1 migration and AEGIS_DB binding are not active in the Cloudflare account. The Forge candidate library therefore reports unavailable until shared D1 is separately provisioned and configured.
- No production deployment or upstream software installation has occurred.

## Next engineering steps

1. Add owner review actions for licence verification, reuse/adapt/rebuild/combine/reject decisions and status transitions, with append-only audit.
2. Add commit-pinned diff and selected-file batch retrieval, still read-only.
3. Add a bounded local static analysis adapter and optional Code Review Graph concepts without running upstream build scripts.
4. Connect Forge to the AEGIS project timeline and approved durable job runtime.
5. Add further source types (MCP, SDK, API, package, standards and research) behind the same provenance and risk model.
