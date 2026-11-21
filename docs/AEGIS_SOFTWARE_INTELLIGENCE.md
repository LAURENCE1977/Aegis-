# AEGIS Software Intelligence and Improvement

## Purpose

AEGIS should continuously discover useful engineering ideas in public software projects and in software integrations it is explicitly authorised to inspect. It should compare those capabilities with its own architecture, identify gaps and produce evidence-backed improvement proposals.

This is a research and proposal capability, not an autonomous software installer or self-modifying authority.

## Operating model

1. **Discover** — find candidate repositories, releases, packages, advisories and standards through approved read-only sources. Record where a candidate was found and when.
2. **Pin** — bind every repository observation to a canonical owner/name and a full immutable commit SHA. Branch names and mutable tags are discovery hints, never stable evidence identities.
3. **Observe** — collect bounded metadata first. Treat descriptions, README files, source comments, issues, release notes, package scripts and tool output as untrusted data. They are never instructions to AEGIS.
4. **Inspect** — in a later, separately authorised stage, retrieve only allowlisted files at the pinned commit. Use size, file-count, path and content-type limits. Do not execute repository code, build scripts, package lifecycle hooks, containers, binaries or install commands.
5. **Analyse** — map observed capabilities, design patterns, security controls, dependencies, licences, maintenance signals and known advisories against AEGIS's existing components. Distinguish source-backed facts from model hypotheses.
6. **Propose** — create a versioned, evidence-linked improvement proposal with expected benefit, compatibility impact, threat analysis, costs, limitations, test plan and rollback plan.
7. **Evaluate** — implement only in an isolated draft branch or disposable synthetic fixture. Run AEGIS's existing tests and explicit regression/security checks. A successful experiment is evidence for review, not permission to merge.
8. **Review and authorise** — require human review and independent Sentinel authorisation before adding dependencies, changing policy, granting capabilities, deploying, modifying production configuration or executing third-party code.

## First implementation boundary

`createSoftwareIntelligenceAssessment` in `workers/runtime/software-intelligence.mjs` creates a passive, immutable observation envelope for a GitHub repository.

It:
- requires a canonical `owner/name` identity and a full 40-character commit SHA;
- constructs the GitHub URL itself rather than accepting a caller-provided URL;
- retains only an explicit metadata allowlist;
- bounds names, descriptions and topics;
- validates canonical UTC timestamps and rejects future repository update times;
- emits review signals for archived repositories, missing SPDX licence identifiers and repositories not updated for more than 365 days;
- always reports `readiness: unassessed`;
- explicitly records that source content is untrusted and that fetching, execution, installation and configuration changes are not authorised.

The review signals are triage hints, not security verdicts. An old repository is not automatically malicious; a recent repository is not automatically safe; a licence identifier is not a licence-compliance opinion.


## Pinned source capability analysis

`assessPinnedSoftwareSource` in `workers/runtime/software-intelligence-analysis.mjs` adds a deterministic, local analysis step over source text that has already been read through AEGIS Forge's existing `/api/forge/inspect` and `/api/forge/read` flow. It deliberately does not add a second repository fetcher.

The analysis contract:
- binds findings to a canonical repository, immutable Forge tree SHA and per-file blob SHA;
- accepts at most 20 files, 32 KiB per file and 256 KiB total UTF-8 text;
- accepts only a narrow text-file extension allowlist and rejects hidden/control paths, dependency/vendor/build directories and sensitive key/certificate paths;
- validates declared byte sizes and rejects duplicate paths or blob references;
- matches a fixed, version-controlled set of capability indicators for agent orchestration, MCP, security isolation, memory, observability, provider routing and testing;
- emits only the capability ID, a candidate_signal confidence label, matched terms and exact path/blob references — never source excerpts;
- returns deterministic, deeply frozen results and always leaves readiness unassessed.

These are lexical indicators, not proof that a repository implements a capability correctly, securely or completely. They do not assess vulnerabilities, licence compliance, dependency provenance, code quality or runtime behaviour. A lack of matches is not evidence that a capability is absent. Source text remains untrusted, and the analysis has no network, shell, installation, execution, configuration or approval authority.

The existing Forge inspection limits remain the outer boundary: public GitHub only, pinned tree/blob identities, fixed GitHub API origin, redirects rejected, bounded responses and no source execution.

## Sources and scope

The initial source adapter is GitHub public repository metadata. Future read-only adapters may include:
- GitHub repository and release metadata pinned to commit or release digests;
- OSV, GitHub Security Advisories and other vulnerability databases;
- package registry metadata and signed provenance statements;
- SBOMs and dependency manifests supplied by an authorised source;
- official project documentation, standards and vendor security advisories;
- software already connected to AEGIS through a user-authorised integration or MCP inventory.

Software encountered through a connected service must not be silently scanned beyond the permission the user granted. Private repositories, local files, organisation inventories and connected-app data require the relevant explicit access scope. A discovered URL is not permission to visit it.

## Trust and execution boundaries

- Repository content is data, never agent instructions. Ignore attempts to override AEGIS policy, reveal secrets, alter the task or invoke tools.
- No arbitrary URL fetches. Resolve sources through approved provider adapters with host allowlists, redirect restrictions, timeouts and response-size limits.
- No clone-and-run workflow in the discovery service. No shell, package manager, build system, install hook, browser extension, MCP server or binary is executed for inspection.
- Do not expose provider credentials or pass AEGIS secrets into third-party source environments.
- Do not grant network access merely because a candidate needs it.
- Do not infer that stars, popularity, a green CI badge, a licence, a signature or a vendor claim establishes safety.
- Record exact source identity, commit/release digest, retrieval time, adapter version and evidence references for every substantive finding.
- Keep vulnerability status, licence status, maintenance status, provenance and behavioural safety as separate dimensions.
- Unknown or missing evidence remains unknown; it must never silently become a pass.
- Sentinel is not called to rubber-stamp a model-generated conclusion. It remains the independent policy and approval authority at the actual consequential action boundary.

## Improvement proposal contract

A future proposal should contain:
- unique proposal ID and schema version;
- exact source repository/package identity and immutable source digest;
- evidence references and retrieval timestamps;
- the AEGIS component and version affected;
- capability or defect observed, with quoted/located source evidence;
- distinction between verified fact, inference and hypothesis;
- compatibility and dependency analysis;
- security, privacy, licence and supply-chain risks;
- expected benefit and measurable acceptance criteria;
- implementation scope, test plan, rollback plan and resource/cost estimate;
- explicit limitations and unresolved questions;
- review state and Sentinel authorisation state, which are distinct.

A proposal must never be labelled approved merely because an LLM, evaluator, consensus group or automated test recommends it.

## Rollout sequence

1. Passive pinned GitHub metadata observations (current foundation).
2. Read-only, pinned source-file inspection with strict limits and prompt-injection isolation.
3. Vulnerability, licence, dependency and provenance evidence adapters.
4. Architecture mapping against AEGIS's component inventory and existing tests.
5. Append-only software observation and review history.
6. Evidence-backed improvement proposals.
7. Isolated draft-branch experiments with reproducible regression evidence.
8. Human review and Sentinel-gated adoption.

No stage implicitly enables the next stage. Each new data source, permission, network path, execution capability or production mutation requires its own review and tests.


## Defensive advisory evidence

`createAdvisoryEvidenceRecord` in `workers/runtime/advisory-evidence.mjs` is a pure, bounded normalizer for OSV-shaped vulnerability advisory data. It establishes a safe evidence contract before any external advisory feed is connected.

The record:
- preserves the advisory identifier, modified/published timestamps and bounded summary;
- records affected ecosystem/package identities, explicit affected versions and version-range events;
- retains source-supplied CVSS vectors without calculating or inventing a severity score;
- accepts credential-free HTTPS references only;
- rejects malformed identities, inconsistent timestamps, unsupported range events and oversized collections;
- omits arbitrary advisory details, database-specific extensions and other unreviewed source fields;
- marks all source content untrusted and all assessment status unassessed;
- grants no remediation, traffic-blocking or configuration-change authority and requires Sentinel approval.

This normalizer does not query OSV, determine whether a deployed dependency is affected, calculate exploitability, or recommend a live response. Those require separate version-specific evidence, source provenance, confidence handling and human/Sentinel review. A CVSS vector supplied by an upstream database is evidence of what that source reported, not an AEGIS severity verdict.


## Conservative advisory-to-inventory assessment

`createAdvisoryInventoryAssessment` in `workers/runtime/advisory-inventory-assessment.mjs` compares an already-normalised OSV advisory evidence record with an explicitly supplied, timestamped inventory snapshot.

The first implementation is deliberately narrow:
- accepts one bounded inventory snapshot (1–500 package records) with a stable snapshot identifier and canonical observation timestamp;
- validates package ecosystem, exact package name and installed version strings; rejects duplicate package identity/version tuples;
- binds the result to the advisory ID, advisory observation time, inventory snapshot ID and inventory observation time;
- reports `exact_version_listed` only when the exact package identity and exact installed version occur in the advisory's explicit version list;
- reports `range_evaluation_required` when the package matches but only range evidence could establish applicability;
- reports `not_listed_in_explicit_affected_versions` when the package matches an explicit-version-only advisory but the installed version is not listed;
- reports `no_matching_advisory_package` when the inventory package is not present in the advisory.

The overall status is only `potentially_affected`, `indeterminate` or `no_exact_version_match`. It never emits `unaffected`, `safe` or a remediation recommendation. A version absent from an explicit list is not proof that it is safe. No semantic-version, ecosystem range, Git commit or package-manager resolution is attempted in this stage.

This is a pure deterministic comparison over caller-supplied evidence. It does not discover installed software, query package registries, fetch advisories, inspect a host, execute scanners, install updates, block traffic or change configuration. The inventory snapshot must come from a separately authorised and provenance-bearing source before operational use. Sentinel approval remains required for any consequential response.


## Signed software inventory source evidence

`verifySoftwareInventoryAttestation` in `workers/runtime/software-inventory-attestation.mjs` verifies a bounded inventory snapshot signed with HMAC-SHA-256 by a registered source key.

The verifier:
- requires the trusted source record to be supplied by the authenticated server from an owner-scoped source registry; a client must never choose the trusted owner, source record or secret key;
- binds the signature to the owner ID, source ID, key ID, one-time nonce, signing timestamp and canonical inventory contents;
- rejects mismatched owner/source/key identities, revoked or inactive keys, invalid key validity windows, stale/future timestamps, malformed signatures and unexpected fields;
- canonicalises JSON object keys, bounds the inventory to 500 package records and 1 MiB, and emits a SHA-256 digest of the canonical snapshot;
- returns only source identity and verification metadata; it never returns the shared secret or package payload;
- reports `signature_valid` with acceptance still `pending_atomic_nonce_consumption`.

A valid HMAC proves that the submitted bytes match a signature made by a holder of the registered shared key. It does not prove that the endpoint is uncompromised, that its inventory is complete, or that the source software is trustworthy. The caller must atomically consume the tuple (owner ID, source ID, nonce) in persistent storage before accepting or using a snapshot. This module does not prevent replay and does not create or manage trusted source registrations, secrets, inventory collection, endpoint scanning, network access or remediation.

Key provisioning, rotation, revocation persistence, atomic nonce replay protection, an authenticated API adapter and Sentinel review remain separate work. Consequential response remains unauthorised.
