# OsintHunter — AEGIS research assessment

**Review date:** 18 November 2026  
**Repository:** https://github.com/letox4/OsintHunter  
**Reviewed ref:** `main`, latest observed commit `ec4cdc00eeeb7b9fea3f806a5b280e004aed329e`  
**Release observed:** `v1.0.0` (21 October 2026)  
**Declared licence:** MIT

## Decision

**Accept for architectural study; do not import or execute the application as an AEGIS dependency.**

OsintHunter is a substantial, self-hosted desktop OSINT application. Its strongest transferable ideas are case-centred investigation graphs, typed entities and relationships, alias-family discovery, evidence-explained confidence signals, analyst verdict feedback, chronology/timelines, exportable reports, modular source adapters and optional local-model analysis.

The useful AEGIS opportunity is not to turn AEGIS into a people-search or bulk-enumeration product. It is to strengthen AEGIS's general-purpose **Evidence Graph / Investigation Workspace**: connect claims, sources, artefacts, events, entities and decisions while preserving provenance, uncertainty, owner scope and human review.

## What the repository contains

The README advertises 49 modules and username checks across 400+ sites, with inputs including usernames, emails, phones, names, domains, IP addresses and Chile-specific identifiers. The application is Python 3.11+, FastAPI, SQLite and a browser UI; it offers a Windows executable and a source-based local run. Optional AI uses a local Ollama or OpenAI-compatible endpoint. The project declares MIT and has a v1.0.0 release.

Source areas sampled:
- `app/main.py`: HTTP API, case/entity/edge operations, scanning, import/export, settings and image upload.
- `app/engine.py`: asynchronous job engine, module registry, bounded per-module timeout and concurrent batch execution.
- `app/modules/base.py`: simple plug-in/module contract and registry.
- `app/modules/username.py`, `email.py`, `domain.py`, `web.py`, `people.py`, `ip.py`, `documents.py`, `deep.py`: source-specific enrichment.
- `app/analysis.py`: image perceptual hashes, identity heuristics, explainable score reasons and optional LLM review.
- `app/db.py`: local SQLite case, entity, edge and run persistence.
- `app/config.py`: local settings and API-key storage.
- `web/app.js`, `web/index.html`, `web/style.css`: browser interface.

Repository metadata at review time showed 153 stars, 19 forks, one open issue and a 21 October 2026 latest push. The README and release describe a useful v1.0.0 product, but repository-level tests and a CI workflow were not visible in the root listing reviewed. These are observations at the reviewed ref, not a guarantee about later changes.

## High-value mechanisms to study and rebuild natively

| Mechanism | AEGIS use | Adaptation rule |
|---|---|---|
| Typed case graph | Evidence, research, projects, incidents, tasks and people/organisation references | AEGIS-owned versioned node/edge contracts; never use a graph edge as proof by itself |
| Source-linked findings | Guardian, Knowledge Forge and research | Every claim stores source identity, retrieval time, source revision, excerpt/artefact digest, limitations and reviewer state |
| Alias-family heuristics | Entity resolution and duplicate detection | Candidate suggestions only; explain each transformation and require corroboration |
| Confidence explanations | Evidence triage | Use calibrated signal weights and uncertainty labels; never present heuristic scores as probabilities or identity proof |
| Human verdict feedback | Review and correction workflows | Store analyst decision separately from source evidence; preserve history and allow correction/retraction |
| Timeline | Incident chronology, project history and research trails | Event time, observation time and ingestion time must remain distinct |
| Report export | Auditable case briefs and research handovers | Deterministic export with provenance, uncertainty, redaction and source citations |
| Modular source adapters | Optional integrations and research sources | AEGIS capability manifests + Sentinel; narrow scopes, explicit consent and rate budgets |
| Local AI summarisation | Private local synthesis | Provider-neutral adapter; disclose exactly what leaves the device when a remote provider is selected |

The best architectural pattern is the separation between a source/module registry and the engine that schedules work. AEGIS should borrow the declarative adapter idea, not the authority model: a module can describe what it can do, but it cannot grant itself access or decide its own scope.

## Security, privacy and correctness findings

These are static source-review findings, not exploit demonstrations or a full security audit.

1. **Arbitrary URL fetch / SSRF risk.** `app/modules/web.py` fetches the supplied URL directly. `app/engine.py` creates an HTTP client with redirects enabled and no visible destination-IP allowlist or redirect revalidation. `app/analysis.py` also fetches avatar URLs obtained from source data. This creates a credible server-side request forgery boundary if a user-controlled URL or imported/source-derived avatar points to loopback, private, link-local or cloud-metadata addresses, including through redirects or DNS rebinding. Do not reproduce this fetch design in AEGIS.
2. **Local trust boundary.** `app/__main__.py` binds to `127.0.0.1`, which is a sensible desktop default. The FastAPI routes sampled do not show user authentication. Treat the app as a single-user local desktop tool, not a network service; exposing it through a tunnel, LAN bind or reverse proxy would change the threat model substantially.
3. **Plaintext local secrets.** `app/config.py` persists API keys in `settings.json`. The API masks keys in its public response, but local-at-rest storage is not encrypted by the application. AEGIS must use its own Vault/OS-keystore policy and must never copy provider secrets into task envelopes, evidence or logs.
4. **Sensitive account enumeration.** `app/modules/email.py` probes many third-party account-registration/login endpoints. That can reveal whether a person has accounts on particular services and can create privacy, terms-of-service and abuse concerns. It is not an acceptable default capability for a general-purpose assistant. Any future AEGIS self-footprint audit must be explicitly user-owned, opt-in, narrowly scoped and transparent.
5. **Identity scoring can overstate certainty.** `app/analysis.py` assigns heuristic points for shared names, images, account links and shared attributes. It does explain reasons and reserves 100 for an analyst-confirmed account, which is a good human-review signal. Nevertheless, correlated evidence, recycled avatars, common names, stale data and incorrect upstream matches can inflate scores. AEGIS must show independent evidence, provenance, counter-evidence and uncertainty; a score must never assert that two accounts belong to the same person.
6. **Remote AI data transfer.** `ai_verify` sends case roots, names, locations and account attributes to the configured OpenAI-compatible endpoint. A local Ollama endpoint can keep processing local, but remote endpoints receive sensitive investigation context. AEGIS must provide a per-run data-egress preview and explicit approval for remote processing.
7. **Network and rate-limit behaviour.** The README describes retries when platforms/WAFs rate-limit requests. AEGIS must not imitate evasive retries, access-control circumvention, proxy rotation or scraping that conflicts with source terms. Respect source policy, user scope, budgets and stop signals.
8. **Import and evidence trust.** Imported graph data and source responses must be treated as untrusted input. AEGIS must validate schema, size, URLs and identifiers, escape UI rendering, and keep imported assertions distinct from verified evidence.

The default local bind is a useful containment measure, but it does not solve SSRF, plaintext-secret storage, sensitive enumeration or remote-provider disclosure.

## AEGIS decision register

- **Accepted for study:** graph model, declarative source adapters, provenance-first findings, explainable signal presentation, alias candidate generation, analyst review, timelines and deterministic report exports.
- **Native implementation preferred:** versioned evidence graph, source and claim contracts, graph query/indexing, event chronology, confidence/uncertainty model, redaction and export.
- **Optional future adapters only:** public-domain/DNS/WHOIS lookups, repository metadata, user-authorised digital-footprint checks and threat-intelligence enrichment, each behind Sentinel and a specific scope.
- **Not adopted:** bulk social-profile scraping, cross-service email account enumeration, face/photo identity matching as proof, phone/plate/RUT profiling, automated personal dossiers, evasion-oriented retry behaviour or arbitrary URL fetches.
- **No code or dependencies imported.** No executable, binary, model, service or upstream tool was installed or run as part of this review.

## Suggested implementation sequence

1. Extend the existing evidence and context contracts with graph-compatible, typed source references and relationship assertions; do not create a second evidence store.
2. Add a native, owner-scoped graph projection over authoritative AEGIS records. Keep the source records canonical; the graph is an index/view, not a parallel truth database.
3. Represent relationships as claims with source, observation time, confidence rationale, limitations and review state. Support conflicting claims and retraction.
4. Add deterministic timeline and report projections with privacy-aware redaction.
5. Add only low-risk, explicitly scoped read-only source adapters after Sentinel worker execution is complete and SSRF-safe egress policy is enforced.
6. Evaluate alias suggestions and confidence ranking against synthetic/consented datasets in Eval Forge. Measure false positives and calibration before exposing identity-related conclusions.

## Acceptance tests before any source adapter ships

- URL and redirect policy blocks loopback, private, link-local, multicast, reserved and metadata destinations; validates every redirect and protects against DNS rebinding.
- Imported and fetched content cannot become instructions, capabilities or permissions.
- Every graph assertion is traceable to immutable source/evidence references and preserves owner/project boundaries.
- Duplicate, stale, conflicting and retracted sources remain distinguishable.
- Confidence output is explainable, calibrated on a representative evaluation set and never described as a probability without calibration evidence.
- Remote AI use previews the exact data categories and destination, and requires explicit approval.
- All source calls enforce per-capability budgets, timeouts, cancellation, terms/policy constraints and append-only audit receipts.

## References

- [OsintHunter repository](https://github.com/letox4/OsintHunter)
- [README and feature claims](https://github.com/letox4/OsintHunter/blob/main/README.md)
- [MIT licence](https://github.com/letox4/OsintHunter/blob/main/LICENSE)
- [URL fetch module](https://github.com/letox4/OsintHunter/blob/main/app/modules/web.py)
- [Runtime HTTP client and job engine](https://github.com/letox4/OsintHunter/blob/main/app/engine.py)
- [Identity analysis and AI transfer](https://github.com/letox4/OsintHunter/blob/main/app/analysis.py)
- [Settings and local key storage](https://github.com/letox4/OsintHunter/blob/main/app/config.py)
- [Email account checks](https://github.com/letox4/OsintHunter/blob/main/app/modules/email.py)
