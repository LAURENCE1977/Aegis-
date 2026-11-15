# AEGIS Forge — source inspection and candidate intake

## Purpose

Forge is AEGIS's source-aware reverse-engineering workshop. Its default workflow is to inspect useful upstream projects, extract transferable ideas, record provenance and licence status, then implement an AEGIS-native capability. It does not install or execute discovered repositories. Every candidate follows the [reverse-engineering report template](FORGE_REVERSE_ENGINEERING_TEMPLATE.md), which records pinned evidence, licence boundaries, security, portability, native adaptation and tests.

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
- Authenticated owner-only PATCH /api/forge/candidates/:id records licence review, engineering decision and lifecycle status.
- The owner must explicitly confirm inspection of the actual upstream licence and relevant dependency licences before selecting verified in the UI.
- Reuse/adapt/combine decisions require verified licence review; approval also requires a non-empty positive engineering decision. Database triggers enforce these gates independently of the UI.
- Source identity and pinned metadata are immutable after candidate creation. Review and status changes append audit events.
- migrations/shared/0005_forge_candidates.sql adds owner-scoped candidate and append-only event tables.
- migrations/shared/0006_forge_candidate_review.sql enforces immutable source identity, licence/approval gates and append-only review/status events.

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
- Candidate creation, listing and owner review/decision updates are implemented. The Forge candidate review panel is still feature-branch code until D1 is configured.
- The D1 migration and AEGIS_DB binding are not active in the Cloudflare account. The Forge candidate library therefore reports unavailable until shared D1 is separately provisioned and configured.
- The Forge implementation is feature-branch code and was not included in production. Two unrelated Markdown-only commits on main triggered a successful Pages redeploy; see the master blueprint audit. No upstream software was installed.

## Next engineering steps

1. Add source diff, dependency evidence and a repeatable reverse-engineering report to each reviewed candidate.
2. Add commit-pinned diff and selected-file batch retrieval, still read-only.
3. Add a bounded local static analysis adapter and optional Code Review Graph concepts without running upstream build scripts.
4. Connect Forge to the AEGIS project timeline and approved durable job runtime.
5. Add further source types (MCP, SDK, API, package, standards and research) behind the same provenance and risk model.
