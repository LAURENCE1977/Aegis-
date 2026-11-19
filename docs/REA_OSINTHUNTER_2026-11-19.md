# REA — OsintHunter (letox4) for AEGIS

**Assessment date:** 19 November 2026  
**Disposition:** **Selective native adaptation / reference only**  
**Adoption status:** Not integrated; no upstream code copied, installed or executed  
**AEGIS branch:** `feature/composio-audit-lineage-verified`  
**AEGIS base inspected:** `cdf31b1c0313c056fc96924093e1f0eae622f22a`

## 1. Identity, provenance and licence

Canonical candidate: https://github.com/letox4/OsintHunter  
Inspected immutable upstream main revision: `96f7adf9fed19eb79a0723b3b7cfcb4f6985f468`  
Default branch: `main`  
Version observed: `v1.1.0`, released 18 November 2026  
Repository metadata at assessment: public, not archived, Python, 154 stars, 19 forks; last push 18 November 2026.  
Licence: root `LICENSE` inspected; MIT License, copyright 2026 letox4.

The repository describes a local desktop OSINT application with an investigation graph, confidence scoring, alias families, map, timeline, reports, 49 modules and 400+ username sites. It supports optional AI providers including local Ollama and OpenAI-compatible endpoints. Optional API integrations exist; the README says the core works without API keys. No mandatory paid provider is required by the documented quick start.

A same-name repository also exists under another owner. This assessment is specifically for `letox4/OsintHunter`; do not silently substitute another project.

MIT permits reuse subject to preserving the copyright and permission notice in copies or substantial portions. This is a licence finding for the inspected repository root only; any separately bundled third-party assets, site lists, libraries, datasets or copied code require their own provenance/licence review.

## 2. Inspection scope and architecture

Pinned tree inspected at `96f7adf9fed19eb79a0723b3b7cfcb4f6985f468`. Read the README, root tree, requirements, licence and relevant source files including:

- `app/main.py`, `app/__main__.py`, `app/config.py`
- `app/engine.py`, `app/modules/base.py`, `app/models.py`
- `app/db.py`, `app/analysis.py`, `app/util.py`
- `app/modules/username.py`, `email.py`, `people.py`, `domain.py`, `ip.py`, `web.py`, `documents.py`, `enrich.py`, `misc.py`
- `requirements.txt`, `web/app.js`, `web/index.html`, `web/style.css`

This is a source-level targeted review, not a complete line-by-line audit, execution review or security certification.

### Data flow

`user-supplied clue → FastAPI input routes → entity type detection/normalisation → SQLite case/entity/edge store → registered modules → external public-source HTTP/DNS lookups → Context.add/enrich → graph edges and attributes → heuristic confidence analysis / optional AI verification → graph, timeline, map and HTML/PDF export`

The application runs as a local Python/FastAPI service on `127.0.0.1:8787`. It uses a registry of modular collectors, a shared asynchronous HTTP client, a SQLite database, and a browser UI with Cytoscape/Leaflet assets. Scan jobs support progress events and cancellation; the engine bounds scan depth to three. SQLite schema migrations, batched writes and import validation are present.

## 3. Useful mechanisms for AEGIS

| Mechanism | Value | AEGIS decision |
|---|---|---|
| Typed entities and relationship graph | Connects observations across sources | Reuse the modelling pattern; map onto AEGIS canonical Knowledge/Memories, not a second graph database |
| Evidence-linked confidence explanations | Shows which signals influenced a result | Rebuild natively as evidence-weighted reasoning with source, time, directness, independence, contradiction and uncertainty |
| Alias-family candidate generation | Finds related identifiers beyond exact matches | Optional, scoped candidate-generation skill; never silently launch broad identity searches |
| Timeline and temporal ordering | Reconstructs when observations/events occurred | Extend AEGIS temporal evidence and event history |
| Modular collector registry | Makes source adapters replaceable | Reuse the capability pattern behind AEGIS manifests and Sentinel |
| Local-first SQLite workflow | Demonstrates useful offline/local operation | Retain local-first principle; do not add another canonical store |
| Cancellation and partial results | Better long-running job control | Compare with AEGIS durable run/cancellation contracts; do not replace them |
| Exportable reports | Makes evidence review portable | Build AEGIS-owned reports with citations, provenance and uncertainty |

The strongest idea is not the OSINT catalogue. It is the explicit chain from an initial clue, through attributed observations and relationships, to a reviewable explanation.

## 4. Security, privacy and correctness findings

These are source-review observations and risks to verify, not claims of an exploited vulnerability.

### Positive controls observed

- Entrypoint binds Uvicorn to `127.0.0.1`.
- FastAPI TrustedHost middleware allows only `127.0.0.1` and `localhost`.
- State-changing API routes require a per-process session token checked with constant-time comparison.
- Import size is capped at 25 MiB and imported entity/edge counts at 50,000; values and relationship references are validated.
- Image upload size is capped at 40 MiB.
- API keys use OS keyring where available and DPAPI on supported Windows configurations.
- Scan depth is bounded and the engine supports cancellation.

### Risks / required tests before any adaptation

1. **Potential SSRF / egress boundary:** the shared HTTP client enables redirects. The web-page module fetches `ctx.value` directly, and avatar hashing fetches discovered avatar URLs. The inspected paths do not establish a comprehensive private-address denylist plus redirect-by-redirect DNS/IP validation. Test loopback, RFC1918, link-local, IPv6 local ranges, DNS rebinding and redirects to internal services. Native AEGIS implementation must use an egress broker with explicit host/scheme policy and revalidate every redirect.
2. **Local database at rest:** investigation cases and collected personal data are stored in SQLite. The application code inspected does not encrypt the database itself. AEGIS must keep owner-scoped data encrypted at rest where applicable, with retention, deletion and export controls.
3. **Credential fallback:** keyring/DPAPI are preferred, but the settings implementation explicitly supports plaintext JSON fallback if neither secure backend is available or encryption fails. AEGIS must fail closed for secrets; never silently persist credentials in plaintext.
4. **Identity confidence is heuristic:** scores use names, shared attributes, links, profile existence, image hashes and optional AI verdicts. The code caps automatic scores below analyst confirmation, which is a useful distinction, but no calibration dataset or test evidence was found in the inspected tree. A shared image, email, domain or location can be non-unique. Never expose such a score as a probability or verified identity.
5. **Image similarity is not face identity:** the inspected photo comparison uses perceptual hashing. Similar images are not proof that two accounts belong to the same person.
6. **Sensitive data surface:** modules can collect emails, phone information, breach signals, profile details, EXIF/GPS metadata, crypto-wallet information and location traces. AEGIS must not make these default companion features. Require clear user purpose, lawful/authorised scope, data minimisation, explicit activation and retention limits.
7. **File parser resource exhaustion:** PDF and Office metadata/text parsing handles user uploads. The 40 MiB image cap does not establish decompressed archive, page-count, pixel-count, parser CPU or memory limits for all document formats. Test malformed files and decompression/resource bombs in isolation.
8. **Dependency reproducibility:** `requirements.txt` uses minimum-version constraints rather than a fully locked, hash-verified dependency set. Resolve and audit transitive dependencies before any reuse.
9. **Verification maturity:** the inspected recursive tree contains no visible test directory or GitHub Actions workflow. This is not proof that no tests exist elsewhere, but no automated test/CI evidence was found in the reviewed repository surface. Recent releases and commits show active development, but maintenance maturity remains unproven.

## 5. AEGIS ownership and integration boundary

**AEGIS owns:** canonical evidence records, provenance, temporal validity, memory/task state, user identity, policy, approvals, audit and user experience.

**Sentinel owns:** identity and exact-scope authorisation, risk decisions, rate limits, approvals, revocation and audit authority.

**Vault owns:** protected credentials and secret references.

**Forge owns:** source intake, pinned provenance, evaluation, comparison and verification records.

OsintHunter or any derived worker must never own canonical AEGIS memory, grant permissions, set its own trust level, write directly to the canonical store, receive Vault secrets, or bypass Sentinel.

Do not import the complete OSINT application or its 49 collectors into the core. Do not automatically pivot from a discovered person, email, phone, address or account. Do not enable breach, phone, EXIF/GPS or financial-identifier collection in the general companion experience.

### Recommended native capability

Build a generic **Evidence & Relationship Intelligence** capability in AEGIS:

- typed, owner-scoped evidence and entity references;
- immutable source/provenance records and observation timestamps;
- explicit relationship types and direction;
- confidence explanations with independent-source weighting and contradiction handling;
- temporal history, supersession, correction and retraction;
- human confirmation kept separate from machine inference;
- bounded, cancellable, read-only source adapters with visible egress;
- evidence-backed reports and graph/timeline views.

Reuse existing AEGIS Knowledge Forge and memory contracts. Do not create a second memory database or graph authority.

## 6. REA score

Scores are 0–5; weighted total follows the AEGIS REA standard. Scores rank the candidate for selective native adaptation, not wholesale adoption.

| Dimension | Score | Weighted points | Rationale |
|---|---:|---:|---|
| Demonstrable capability value (20) | 5 | 20 | Strong graph, evidence and investigation workflow patterns |
| AEGIS architecture fit (15) | 4 | 12 | Mechanisms fit, but its application/data model must not become canonical |
| Security, privacy, controllability (15) | 2 | 6 | Useful local controls, but egress, secret fallback and sensitive data risks remain |
| Runtime footprint / device fit (15) | 3 | 9 | Python/FastAPI/SQLite desktop service; not a direct fit for AEGIS edge runtime |
| Complexity / dependency reduction (10) | 3 | 6 | Reusable concepts; adopting the full stack adds a parallel subsystem |
| Maintenance and tests (10) | 2 | 4 | Active recent commits/releases; no visible automated test suite/CI in reviewed tree |
| Free/self-hosted viability (10) | 5 | 10 | MIT, local operation and no mandatory API key |
| Portability / replaceability (5) | 3 | 3 | Modular Python collectors, but desktop/runtime and source-specific dependencies |
| **Total** |  | **70/100** | **Selective adaptation only** |

No hard gate is passed for wholesale adoption: the application has not been isolated, its egress controls are insufficiently evidenced for AEGIS use, and the security/maintenance verification is incomplete. The MIT licence does pass the initial root-licence check for eligible reuse with notices.

## 7. Prototype proposal and acceptance tests

A small AEGIS-native evidence graph/confidence prototype may be proposed only after checking existing Knowledge Forge contracts for overlap.

Acceptance tests should include:

- provenance retained for every fact and relationship;
- independent sources increase confidence differently from duplicated/copied sources;
- contradictory evidence lowers or bounds confidence and remains visible;
- no inferred identity is labelled confirmed without explicit human confirmation;
- stale evidence and superseded claims are represented temporally;
- missing provenance never receives a favourable confidence score;
- arbitrary URLs, redirects, private IPs, DNS rebinding and unsupported schemes are denied by the egress boundary;
- cancellation, timeouts, malformed responses and partial results are deterministic and auditable;
- no external code is executed and no provider credential enters prompts or worker input;
- export, deletion, retention and owner isolation are tested.

No prototype or source-code integration is authorised by this assessment. Any behaviour change must follow the AEGIS TDD procedure, begin with failing regression tests, run the focused and full suites, and remain on a reviewable draft branch. No merge, production migration or deployment without explicit approval.

## 8. Evidence links

- Repository: https://github.com/letox4/OsintHunter
- Pinned revision: https://github.com/letox4/OsintHunter/tree/96f7adf9fed19eb79a0723b3b7cfcb4f6985f468
- README: https://github.com/letox4/OsintHunter/blob/96f7adf9fed19eb79a0723b3b7cfcb4f6985f468/README.md
- Licence: https://github.com/letox4/OsintHunter/blob/96f7adf9fed19eb79a0723b3b7cfcb4f6985f468/LICENSE
- AEGIS REA standard: https://github.com/LAURENCE1977/Aegis-/blob/feature/composio-audit-lineage-verified/docs/AEGIS_REVERSE_ENGINEERING_STANDARD.md
- AEGIS capability roadmap: https://github.com/LAURENCE1977/Aegis-/blob/feature/composio-audit-lineage-verified/docs/AEGIS_CAPABILITY_ROADMAP.md
