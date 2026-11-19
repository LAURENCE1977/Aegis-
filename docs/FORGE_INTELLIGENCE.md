# AEGIS Forge & Engineering Intelligence

## Purpose

Forge turns useful open-source software, MCP servers, APIs, SDKs, packages, frameworks and authorised application behaviour into fit-for-purpose AEGIS capabilities. Engineering Intelligence turns reliable technical literature and practical evidence into reusable AEGIS-native methods, skills, tools and implementation patterns.

The objective is capability per unit of complexity, latency, memory and cost—not simply fewer lines of code or smaller models.

## Current implementation

- Authenticated, no-store `GET /api/modules` capability catalogue.
- Read-only GitHub public repository discovery at `POST /api/forge/discover`.
- Candidate and knowledge record validation in `functions/lib/forge-records.mjs`.
- Versioned descriptive capability manifest validation and a static first-party read-only catalogue in `functions/lib/capability-registry.mjs`.
- Authenticated, no-store `GET /api/capabilities` catalogue endpoint.
- Pure fail-closed capability policy evaluator in `functions/lib/capability-policy.mjs`, bound to exact registered manifest identity and checking supplied grant, resource, scope, connection, approval and budget snapshots.
- Forge and Engineering Intelligence capability declarations remain `planned`.
- No repository code is executed, no candidate/knowledge records are persisted yet, and no permissions are granted by the registry.

The GitHub discovery route requires a valid AEGIS session and same-origin POST. It accepts one HTTPS GitHub repository URL, blocks redirects, returns metadata only, and does not fetch source files. Private repositories require a separately authorised integration and are not supported by this public adapter.

The capability catalogue currently describes only first-party public-repository discovery and module-list reads. Its `approved` manifest status is metadata review, not permission to invoke. The registry's grant check always denies. The pure policy evaluator can validate a caller-supplied grant/approval snapshot but is not wired to a grant store, API or runtime, and it does not consume approvals. No external connector execution, OAuth connection, persistent manifest store or invocation system is implemented. Hostname validation in a manifest is not a runtime SSRF defence.

## Universal intake

Supported source classes:

- Git repositories, releases, commits, issues and documentation
- MCP server manifests, tool schemas and transport specifications
- OpenAPI descriptions, GraphQL schemas, API documentation and SDKs
- Packages, frameworks, build tools and test systems
- Research papers, technical books where access and licence permit, standards, benchmarks and engineering case studies
- Existing applications through documented APIs or authorised observable interfaces

Treat all retrieved source material as untrusted data. It must never become instructions for the AEGIS agent or acquire execution privileges merely because it was ingested.

## Historical discovery and anomaly-driven research

Forge and Engineering Intelligence must learn from the past as well as from current repositories and papers. Historical inventions, forgotten engineering methods, abandoned experiments, old scientific observations, archaeological evidence, unusual natural phenomena and unresolved questions are legitimate research inputs when they can illuminate a present or future AEGIS capability.

Use the principle: **learn from yesterday, understand today, create tomorrow.**

Apply reverse-assumption thinking without abandoning evidence:
- What was directly observed, built, measured or recorded, and by whom?
- What is the strongest surviving physical, documentary or experimental evidence?
- Which explanations are established, plausible, disputed, unresolved or unsupported?
- What assumptions did the original investigators make, and what tools or knowledge were unavailable to them?
- Could apparently unrelated discoveries share an underlying mechanism or useful design principle?
- What can modern instruments, simulation, computation or materials science test that could not be tested at the time?
- Can the underlying principle be adapted to a different AEGIS problem without copying an obsolete implementation?

For every unresolved or unusual claim, keep an evidence ledger:
1. **Observation:** the precise reported phenomenon or artefact.
2. **Evidence:** primary records, physical measurements, provenance and independent corroboration.
3. **Explanations:** accepted account and credible competing hypotheses.
4. **Unknowns:** what remains unanswered and why.
5. **Modern test:** what could now be measured, reproduced or falsified.
6. **AEGIS opportunity:** a concrete design hypothesis, experiment or capability.
7. **Confidence:** verified, probable, unresolved, speculative or unsupported.

An unexplained event is not evidence of a supernatural cause; a gap in current knowledge is not permission to invent an answer. Preserve uncertainty, distinguish primary evidence from retelling, and seek disconfirming evidence. Do not elevate speculative claims into accepted Knowledge Library records. Historical research can inspire a prototype, but only reproducible tests and the normal REA, licence, security and Sentinel gates can promote an implementation.

## Candidate record

Every candidate should be represented with:

- Stable candidate ID and source class
- Canonical source URL, owner/project, version or commit and retrieval date
- Licence identifier, attribution obligations and redistribution constraints
- Maintainer activity, release history and known security advisories
- Main capabilities, interfaces, runtime and deployment requirements
- Dependencies, footprint, hardware assumptions and operational cost
- Evidence quality, tests, benchmarks and known limitations
- Data provenance and a record of what was inspected
- Decision: `reuse`, `adapt`, `rebuild`, `combine` or `reject`
- Decision rationale, confidence, reviewer and status

Unknown licence or provenance is a hold, not permission to copy. Proprietary services may only be accessed through documented APIs or other explicitly authorised interfaces. Respect copyright, licence terms, attribution and third-party obligations; use clean-room implementations where appropriate.

## Knowledge-to-capability pipeline

1. Acquire: discover sources and retain canonical references and version information.
2. Extract: parse relevant concepts, algorithms, architecture patterns, implementation details and evaluation methods.
3. Evaluate: assess evidence quality, recency, reproducibility, applicability, limitations and conflicting findings.
4. Synthesize: create concise, attributed knowledge records with links to supporting sources.
5. Adapt: translate the useful principle into an AEGIS-specific design, skill, tool, model workflow or module proposal.
6. Implement: work in an isolated branch or sandbox; do not execute untrusted source code in the control plane.
7. Verify: run tests, security checks and representative benchmarks against a baseline.
8. Promote: register only reviewed, compatible capabilities. Capability declarations never grant permissions.
9. Maintain: track upstream versions, licence changes, vulnerabilities and regression results.

## Lightweight engineering standard

For each adaptation, record baseline and candidate measurements for task quality, correctness, latency, memory/compute use, dependency count, operational complexity and cost. Prefer the smallest design that meets the quality and safety threshold. Use quantisation, caching, retrieval, batching, model routing, distillation and specialist models only when measurements show a net benefit. Do not claim a percentage improvement without reproducible benchmarks.

## Self-improvement controls

AEGIS may identify weaknesses, research solutions, propose changes and create isolated implementations. It must preserve the current working version, tests and rollback path. Changes to production, permissions, secrets, billing, external communications or destructive data operations require explicit human approval. No self-granting permissions, unrestricted code execution or automatic production promotion.

## Initial capability boundaries

- `source.discover`, `source.inspect`, `source.compare`
- `candidate.evaluate`, `blueprint.create`, `implementation.plan`, `benchmark.compare`
- `knowledge.ingest`, `knowledge.search`, `knowledge.evaluate`, `knowledge.adapt`

These are descriptive planned capabilities only. The module registry intentionally grants no permissions and does not load or execute modules.

## Initial implementation sequence

1. Authenticated source and module registries.
2. Read-only candidate and knowledge record formats.
3. GitHub discovery and metadata inspection adapter.
4. MCP manifest and OpenAPI ingestion adapters.
5. Searchable, attributed knowledge store.
6. Evidence evaluation and conflict tracking.
7. Forge blueprint and benchmark workflow.
8. Sandboxed implementation and review gates.
9. Capability Centre for connection, health, update and disable operations.


## Specialist agent definitions and multi-agent governance

Agent-definition repositories such as [Agency Agents](https://github.com/msitarzewski/agency-agents) are knowledge sources, not execution engines. Forge should inspect individual role files, pin their source commits, record licences and provenance, and adapt only roles that solve a demonstrated AEGIS need.

An AEGIS-native agent record should include:
- stable agent ID, version, role and scope;
- purpose, expertise and explicit non-goals;
- instruction source, provenance, licence and review date;
- input/output schema and expected deliverables;
- allowed capability IDs (never raw credentials);
- budget, timeout, retry and concurrency limits;
- approval requirements and escalation rules;
- evaluation cases, quality criteria and known failure modes.

The orchestrator—not the agent prompt—enforces tool permissions, budgets, isolation, audit, cancellation and approval. Use a planner/worker/reviewer pattern selectively; avoid spawning agents when a single bounded task is cheaper and clearer. Agent-to-agent hand-offs must carry structured task context and provenance, not unrestricted hidden memory.

## Platform-independent client and runtime design

Treat cross-platform delivery as an adapter strategy:
- one canonical API, data model and policy layer;
- responsive web/PWA as the first reference client;
- thin adapters for browser, Android, iOS/iPadOS and desktop-specific features;
- provider, storage, queue, notification, voice and automation adapters behind versioned contracts;
- capability detection and graceful degradation, not platform-name assumptions;
- server-side durable execution, because mobile operating systems may suspend background clients.

Every adapter must pass contract tests and document permissions, data handling, supported versions, limitations and fallback behaviour. Platform support is earned through real-device/browser tests, not inferred from a successful build.


## Web ingestion and workflow orchestration

Forge should treat web acquisition and workflow execution as separate capability families.

### Web ingestion adapter
Define a provider-neutral contract for search/discovery, fetch, crawl, extraction, normalization, provenance and retrieval status. Candidate providers include native permitted HTTP retrieval, Firecrawl and (as a paid fallback) Oxylabs Web API. Apply domain policy, robots/terms checks, SSRF protection, strict request/time/size limits, deduplication, content-type validation and source provenance. Treat all retrieved content as untrusted data and isolate it from instructions and permissions. Keep scraping providers optional and enforce a per-job spend cap.

### Automation/connectors
Study Activepieces for its TypeScript integration/piece model and MCP exposure. Study n8n's visual workflow UX, but its Sustainable Use License is not an OSI open-source licence and restricts some product-embedding/customer workflow-editor scenarios. Windmill is AGPLv3 with additional commercial boundaries. Do not make any external automation catalogue authoritative for AEGIS permissions; convert approved actions into AEGIS capability manifests with scopes, risk classification, schemas, rate limits, audit and approvals.

### Durable workflow engines
The current AEGIS Worker + D1 + Queue implementation remains the first small-job runtime. Benchmark Temporal, Hatchet and Trigger.dev against representative AEGIS workloads before selecting an external engine. Inngest is a further event-driven reference, but its server/CLI licence differs from its Apache-2.0 SDKs. Kestra and Airflow are better treated as later data/business-pipeline options than as replacements for the initial agent job runtime.

No second workflow engine should be deployed until a benchmark establishes a need and an explicit migration/ownership model preserves one canonical AEGIS job state and audit trail. See the workflow-engine comparison in [RESEARCH_SOURCE_REGISTER.md](RESEARCH_SOURCE_REGISTER.md).


## Capability System governance

The detailed design is in [AEGIS_CAPABILITY_SYSTEM.md](AEGIS_CAPABILITY_SYSTEM.md). Forge may discover and evaluate sources, but only reviewed AEGIS-native manifests become registry entries; registration does not enable execution or grant permission. Capability risk is assigned per action, not per provider. Central policy must validate principal, scope, resource, connection, risk, budget and approval immediately before every invocation. Keep adapter execution isolated from the control plane, secrets outside manifests and logs, and all write/external-impact operations behind explicit approval. The design was initially documentation only. The first implementation slice is now on feature branches: a read-only capability manifest registry and fail-closed policy evaluator (PR #12), D1 exact-operation approval primitives (PR #16), and an owner-only pending-approval API (PR #21). The API is not yet deployed or wired to a UI or invocation runtime; no general connector execution is enabled.


## Project Spaces and agent collaboration

Use AEGIS Project Spaces as the durable context and activity layer for projects. Keep job identity/state in the existing durable runtime and all permissions in the capability/Sentinel control plane. Agent Teams should be built as governed definitions and task assignments over these existing primitives, not as a second job engine. Workspace events are receipts/context, never proof that an external side effect occurred.


## Sentinel mediation foundation

`runSentinelInvocation` is the server-side gate between an agent and an adapter. It must remain the only route to capability execution, with current grants, exact resources, approvals, budget and audit checked for each invocation. The current code is a library primitive only; do not expose generic tool execution until persistent policy stores, secret vault, durable audit, payload binding and isolated adapter/egress controls are composed and tested.


## MCP Forge Catalogue — native metadata layer

The native catalogue validates pinned MCP source metadata and action-level effects, risk, scopes and approval policy. It is intentionally metadata-only: no source fetching, package installation, process launch, remote connection or tool execution. Source URLs reject IP literals and local/internal hostnames. Next steps are isolated source ingestion, licence/advisory review, dependency analysis, sandbox conformance and owner-controlled admission. Sentinel remains the only authority for any later invocation.


## Free-Tier Ledger — currentness rule

Free-tier records are evidence, not entitlements. Only a recently verified record may be treated as current; candidates, unknown terms and expired records require review. Check official provider pricing and terms before use, especially billing triggers, overage and commercial-use restrictions. The ledger cannot provision or create accounts.


## Governed capability persistence and token engine

The native stack now has source-level modules for exact-resource capability grants, owner-scoped provider connection metadata, AES-GCM secret vault, append-only invocation audit and a verified provider/model registry with token/context planning. These components do not by themselves connect providers or execute tools. The next integration step is a trusted Sentinel composition root that loads current grants/connections/approvals, derives input digests server-side, records audit and resolves secrets only after authorization.


## Forge repository inspection

AEGIS Forge now has owner-authenticated, read-only endpoints to inspect public GitHub repository trees and read selected text blobs by immutable SHA. Requests and responses are bounded; outbound requests use only the fixed GitHub API origin, reject redirects and have a timeout. Source is never installed or executed and remains untrusted reference data. See [AEGIS Forge](AEGIS_FORGE.md).


## Candidate admission controls

Save inspected repositories as pinned candidates, not approved dependencies. Record the exact tree SHA, provenance, licence identifier and evidence. Treat SPDX metadata as a lead only; the owner must inspect the actual licence and attest with an HTTPS evidence URL and review note before reuse/adapt/combine or approval. Never install or execute a candidate during discovery/review.


## Knowledge Library — persisted owner-reviewed records

AEGIS now has a separate owner-scoped Knowledge Library, distinct from the upstream repository candidate catalogue. It stores evidence-backed reusable knowledge records with a title, domain, knowledge type, summary, evidence level, source URLs/attribution, limitations and applicable AEGIS capabilities.

The lifecycle is deliberately human-gated:

`draft → reviewed → accepted → superseded`

- New records are always inserted as `draft`; clients cannot choose an initial status.
- The owner must add a review note and use the optimistic `expectedUpdatedAt` value to move a draft to `reviewed`.
- Only `high` and `medium` evidence can progress from `reviewed` to `accepted`. Low and experimental findings can be reviewed and retained, but are not eligible for acceptance.
- Accepted records can be superseded without deleting their history.
- Knowledge content, source attribution and limitations become immutable after review. A correction requires a new record.
- Every create/review/accept/supersede transition produces an append-only `forge_knowledge_events` entry. Database triggers enforce initial-draft-only creation, valid status transitions, content immutability and append-only history.
- Search defaults to `accepted` records only. Owner-only status filters can inspect drafts, reviewed and superseded records.
- Source count is capped at 20; limitations at 50; the API body at 96 KiB. Search results are bounded to 100 records.

Owner-only Pages API:
- `GET /api/forge/knowledge?q=...` — bounded search; defaults to accepted records.
- `GET /api/forge/knowledge?status=all` — inspect all owner records.
- `POST /api/forge/knowledge` — create a draft from supplied evidence and metadata.
- `GET /api/forge/knowledge/:id` — read one record.
- `PATCH /api/forge/knowledge/:id` — record an explicit review, acceptance or superseding decision.
- `GET /api/forge/knowledge/:id/events` — read append-only lifecycle history.

Migration: `migrations/forge/0003_knowledge_records.sql`.

The Knowledge Library is currently a persisted API-backed foundation. Its dedicated Forge UI and retrieval of accepted records into Agent Workforce context remain follow-on work. No external source is automatically trusted or ingested, and no record can trigger a tool or deployment.


## Mandatory Reverse Engineering Assessment (REA)

All upstream candidates follow [the AEGIS Reverse Engineering Assessment standard](AEGIS_REVERSE_ENGINEERING_STANDARD.md). It defines source pinning, architecture/data-flow inspection, mechanism extraction, AEGIS ownership mapping, hard gates, weighted evaluation, minimal implementation design, TDD/benchmark proof and the required evidence report. Batch triage is not represented as full reverse engineering. The standard's hard gates override candidate scores.

## Defensive security research intake — 2026-11-17

The following curated repositories have been reviewed as **research indexes**, not as approved software dependencies. Their purpose is to expose candidate tools, workflows and reusable design mechanisms for AEGIS defensive security capabilities.

### Curated source records

| Source | Pinned README blob | Source-repository licence | Initial assessment |
|---|---|---|---|
| [Awesome Incident Response](https://github.com/meirwah/awesome-incident-response) | `3befe12e872e2ec4d921ed483194ab6c87c5b6a6` | Apache-2.0 | DFIR workflow, evidence collection, log/memory analysis, timelines and playbooks |
| [Awesome Malware Analysis](https://github.com/rshipp/awesome-malware-analysis) | `e60bfd63eb9e95be48e1cd2881a65fb053aa5098` | CC-BY-4.0 | Malware analysis lifecycle, static/dynamic analysis, reverse engineering, memory and network analysis |
| [Awesome Threat Intelligence](https://github.com/hslatman/awesome-threat-intelligence) | `a21894710858d3c8ef30b6fafdf88038591c37ca` | Apache-2.0 | Intelligence sources, formats, standards, frameworks and tools; explicitly distinguishes raw sources from analysed intelligence |
| [Awesome Embedded and IoT Security](https://github.com/fkie-cad/awesome-embedded-and-iot-security) | Repository identity verified; README blob not yet pinned | Licence not yet verified | Firmware, hardware interfaces, wireless protocols, device analysis and research |
| [PayloadsAllTheThings](https://github.com/swisskyrepo/PayloadsAllTheThings) | `41fa5e3f9ebba6d5e623c19139c39d4e11cb0ffb` | MIT | Web vulnerability taxonomy, test cases and bypass reference material; offensive content requires strict defensive scoping |

**Licence boundary:** the licence on a curated list applies to that repository's own covered material. It does not grant permission to copy, redistribute, execute or embed every separately linked tool, rule set, sample, payload, dataset, image or third-party document. Each actual candidate and each relevant subdirectory/plugin/rule corpus must receive its own licence and provenance review. In particular, the embedded/IoT list's licence remains unverified and is on hold for copying; its public links may still be used as discovery references.

### First candidate shortlist for individual REA

| Candidate | Why it merits inspection | Known constraints / next checks |
|---|---|---|
| [Dissect](https://github.com/fox-it/dissect) | Modular forensic artefact access across disk and file formats; potential source of parsers and evidence-normalisation patterns | Top-level meta-package is AGPL-3.0-or-later and declares dozens of component dependencies; inspect component-level licences and consider a clean-room/native parser strategy before any reuse |
| [Hayabusa](https://github.com/Yamato-Security/hayabusa) | Fast Windows event-log parsing, Sigma-based hunting and timeline export; useful model for a bounded analysis worker | Main project is AGPL-3.0; its detection rules use separate DRL 1.1. Assess these independently before reuse |
| [Sigma](https://github.com/SigmaHQ/sigma) | Vendor-neutral detection-rule representation and rule taxonomy | Sigma specification is public domain, while SigmaHQ's rule content is DRL 1.1; preserve rule attribution and licence metadata and check other rule repositories independently |
| [Volatility 3](https://github.com/volatilityfoundation/volatility3) | Memory-forensics framework and plugin architecture | Inspect runtime footprint, plugin licences, platform support and safe evidence handling |
| [capa](https://github.com/mandiant/capa) | Static capability identification across PE, ELF, .NET, shellcode and sandbox reports | Main repository and standard capa-rules repository both carry Apache-2.0; retain notices and inspect individual rule provenance/attribution, confidence semantics and false positives |
| [FACT_core](https://github.com/fkie-cad/FACT_core) | Firmware extraction, analysis, search and comparison; a possible specialist IoT worker | GPL-3.0; plugin licences can differ. Upstream describes a minimum 4-core/8-GB setup and recommends 16 cores/64 GB; substantial for ordinary AEGIS hosts |
| [Binwalk](https://github.com/ReFirmLabs/binwalk) | Firmware/container identification, extraction and entropy analysis; useful primitive for a lightweight upload-analysis pipeline | Repository advertises MIT; inspect v3 format support, extraction safety, resource limits and decompression-bomb handling |

The shortlist is a research queue, not a score or adoption decision. Source-level REA, exact commit pinning, dependency review and tests are still required. No candidate is installed, executed or granted access by this intake.

### AEGIS-native capability direction

Build one defensive security intelligence workflow over existing AEGIS ownership boundaries rather than five separate products:

1. **Evidence intake and normalisation:** accept explicitly supplied files, logs, event records, firmware images and intelligence documents; preserve source hashes, timestamps, acquisition method and chain-of-custody metadata.
2. **Static-first inspection:** parse and classify safely before any dynamic analysis. Treat samples, archives, firmware and extracted content as hostile; enforce size, recursion, time and resource limits.
3. **Threat knowledge graph:** connect indicators, vulnerabilities, techniques, software/firmware components, affected assets and incidents with source attribution, observation time, expiry and confidence.
4. **Investigation timeline:** correlate evidence into a traceable sequence while separating observed facts, inferred relationships and analyst hypotheses.
5. **Defensive validation:** turn reviewed vulnerability knowledge into harmless, non-destructive checks against explicitly authorised assets. Payload collections are references, never an execution queue.
6. **Response planning:** produce prioritised recommendations and reversible containment proposals. Sentinel alone authorises any action that changes a host, network, account or service.

### Mandatory safeguards for this domain

- No live malware execution in the AEGIS control plane, user device or ordinary analysis worker.
- Dynamic analysis, if later justified, requires a disposable isolated sandbox with no secrets, restricted egress, resource ceilings, snapshot/rollback and explicit sample-handling approval.
- Do not automatically download malware corpora or execute payloads from curated lists.
- Treat IOC matches as leads, not proof. Record source reliability, observation time, age/expiry, corroboration and false-positive risk; never block solely because one stale feed says so.
- Firmware extraction is untrusted archive processing: defend against path traversal, symlinks, decompression bombs, parser crashes and malicious nested content.
- Host discovery and collection remain opt-in, least-privilege and read-only by default. Preserve original evidence; never remediate automatically.
- Detection rules and signatures retain their own licence, provenance, version and validation status.
- Any external tool is a replaceable worker. AEGIS retains canonical evidence, memory, investigation state, intelligence confidence, policy and audit.

### Research status

- Curated source identity and selected README content inspected: incident response, malware analysis, threat intelligence and PayloadsAllTheThings.
- Embedded/IoT repository identity confirmed, but its README commit and licence still require a separate successful inspection.
- Selected upstream project pages and licences inspected for Hayabusa, FACT_core, capa and Binwalk.
- Initial source-level inspection completed for Dissect, capa, capa-rules, Sigma, Hayabusa, Hayabusa rules and Binwalk README/licence or package metadata surfaces. Sigma's specification is public domain but SigmaHQ's rules are DRL 1.1; capa and its standard rules are Apache-2.0. Pinned inspected README/package blobs: Dissect `b37677ee75af3d2ca062eae094a6374949f657e4`; Dissect package metadata `aeb03728d366a426163fd969c45bce572284abbc`; capa `b75190372c257abfc3822cba33ca58ef2867ce23`; capa licence `d645695673349e3947e8e5ae42332d0ac3164cd7`; Hayabusa `db98b16fa332a575d24fc55762e8b4d9f15bb9a9`; Hayabusa licence `6124431c92e08d215913c110cc1f69336f77394c`; Hayabusa rules `d6c19871a388ab8b96ea30f80f66020631cbfd28`; DRL 1.1 `6475b1511fb96c2d3ac9fd9c1d8340032cc30488`; Binwalk `fb517d90d1fae4cb2ffad1e0347c0843204b6d1b`; Binwalk Cargo metadata `8f42ce8244a98900012ea8d60bbc5fa3b571130c`.
- No code has been copied, installed or executed; no AEGIS security capability is marked implemented. This is still not a complete source-level REA: tests, full dependency trees, security advisories, parser boundaries and performance have not yet been audited.
- Next sequence: inspect Sigma's specification and individual rule corpus, assess a small Dissect parser subset versus a native parser, and benchmark capa/Binwalk as isolated workers against lightweight alternatives. Keep FACT as a high-resource specialist candidate rather than a default dependency.


## Source-level REA — Evidence Intelligence mechanisms (17 Nov 2026)

This is a focused source inspection of selected files at immutable upstream revisions, not a complete REA or adoption approval. It extends the defensive-security intake above.

### Binwalk v3 — signature mapping as a general evidence primitive

Inspected upstream revision: `ReFirmLabs/binwalk@26713972e3f9f52dc37d4a421c4554b0bd9e82ef`.

Pinned inspected blobs:
- `src/lib.rs`: `c5151dd78c5c2a0b1aa03c25f0f29dca5e49a006`
- `src/binwalk.rs`: `1c02eb83a5989a1d687d80def91d68d6eded2d5f`
- `src/extractors/common.rs`: `f3c372c44f449e0780f548d061e763df65a682f6`
- `Cargo.toml`: `8f42ce8244a98900012ea8d60bbc5fa3b571130c`

Mechanisms observed:
- The Rust library exposes a direct `Binwalk::scan(&[u8])` interface and returns typed signature results with offsets and descriptions. The library also separates signature definitions, parsing and extractors.
- Signature setup supports built-in and caller-provided patterns, include/exclude filters and a distinction between short signatures and broader searches.
- The extractor model distinguishes internal functions from external commands and carries output/recursion metadata. The source also models child processes. The path helper describes chroot-like output confinement, but this is not evidence of a complete hostile-input sandbox.
- The inspected Cargo manifest includes a Git-sourced `delink` dependency and a broad set of compression, parsing, threading and plotting crates. Review the lockfile, build features and transitive graph before considering adoption.

AEGIS decision: **native rebuild of the bounded scan/result contract first; optional isolated adapter only if benchmarks show a clear advantage.** Do not enable extraction or external extractor execution in the control plane. AEGIS should initially identify file signatures, offsets, overlaps, embedded-region candidates and entropy summaries without writing extracted content. The inspected public scan interface consumes a byte slice; a bounded upload/read strategy and memory ceiling are required.

Repurposing opportunities:
- Unknown-file and nested-container mapping for user-supplied archives, backups, installers and firmware.
- Digital archaeology: identify appended data, format transitions and unusual regions in opaque files.
- Software/package inventory and compatibility investigations, where a file map is useful even when the subject is not firmware.

Required follow-up: inspect signature parser boundaries, offset arithmetic, recursion, extraction path handling, symlink behaviour, external process invocation, fuzz tests and decompression/resource limits. No safety conclusion is inferred from the presence of a chroot-like helper.

### capa — hierarchical, explainable capability inference

Inspected upstream revision: `mandiant/capa@74114afae97392e1fc08f9ed41acbc88882b645c`.

Pinned inspected blobs:
- `capa/capabilities/common.py`: `c785522d47507583165059603ee44aaf5cdbad37`
- `capa/capabilities/static.py`: `68b5245c2d9087131da21264849017ecbe9474e9`
- `capa/rules/__init__.py`: `86da32ddb5665c86b88699878393f01a834149c6`
- `capa/render/result_document.py`: `d1b8005eb84d5f3a8443b592c295c194c6ab0cda`

Mechanisms observed:
- A feature extractor converts binary observations into typed features; rules match at explicit scopes, including instruction, basic block, function and file for static analysis, and call/thread/process scopes for dynamic traces.
- RuleSet validates uniqueness and dependencies, extracts subscope rules, optimises them, groups rules by scope and builds feature indexes. Rules are topologically ordered so dependent matches can be reused at larger scopes.
- Match results preserve feature locations and captures. The result-document layer uses typed models; several models are frozen and reject unexpected fields. This is a useful model for evidence-linked, schema-validated findings.
- capa's own documentation warns that packing/obfuscation can make static results incomplete or misleading. A rule match is a capability hypothesis supported by features, not proof of malicious intent.

AEGIS decision: **adapt the mechanism, not the full framework by default.** AEGIS can build a small native rule/evidence engine over normalized observations: atomic evidence → scoped features → composable conditions → matched rule → source locations → limitations/confidence. Preserve the exact rule version, rule source, rule author, rule ID, match scope and evidence references. Avoid translating capa scores into a probability unless calibrated against a representative corpus.

Repurposing opportunities:
- Explainable software capability inventory, not just malware classification.
- Identify what a component appears able to do (network access, persistence, file modification, credential-store access) from static metadata or trusted analysis outputs.
- Compare two software versions by capability delta and highlight newly introduced behaviour for review.
- Reuse the hierarchical matching model for non-security AEGIS diagnostics, provided each domain defines its own validated rules and evidence semantics.

Licence: the inspected capa source and standard rule corpus are Apache-2.0 according to their repository metadata; preserve notices and check individual rule provenance. Rule-version compatibility is important: capa's rule documentation requires matching the major version of the engine and rule set.

### Sigma and pySigma — portable event-detection language

Inspected revisions:
- Specification: `SigmaHQ/sigma-specification@ba9251aa834b11a70dbf80836b453dba99c5159e`
- Rule repository: `SigmaHQ/sigma@088855f00b65a19e345b09c1619272b44f92fea4`
- Parser/converter: `SigmaHQ/pySigma@e5221881d5f3d69033b34882fad83864d80db826`

Pinned inspected blobs:
- Specification rule document: `dbda1f850a7cc40697cd6c76e3c63396a113a4ab`
- Specification licence: `f5cac7ae30d4f144c37660e54e1993279c8004ad`
- SigmaHQ rule-repository licence: `f816b6993cc0d9564fd4629823cbaac8bccaff17`
- Example detection rule: `0620e94659500dc0af04b8c6146b1bb406e9567f`
- pySigma rule model: `a9c3cd4781285141a89828c0761d29c03cbc1b98`
- pySigma validator base: `daee62778f9964fc07307fcdd5ab7e9cc096a355`
- pySigma package metadata: `ccd5981cfbe619037efdec837bb67174cbd8820e`

Mechanisms observed:
- Sigma's specification separates log source, detection selections, condition logic, metadata, status, severity level, tags, references and rule relationships. It also defines correlation rules and filters.
- pySigma turns parsed rule dictionaries into typed rule/detection objects and exposes validators with per-rule and whole-collection finalisation. Validation issues have explicit severity and can be accumulated across a rule set.
- pySigma is deliberately vendor-neutral; backends and processing pipelines are separate projects. This is a useful separation between a canonical detection language and target-specific execution/query adapters.

Licence boundary:
- The Sigma specification and logo are public domain.
- The SigmaHQ rule content is licensed under DRL 1.1, not public domain.
- pySigma itself is LGPL-2.1-only. It is not a default AEGIS core dependency; any bundled/linked use requires a separate compatibility and distribution review under the AEGIS free/open-source policy.

AEGIS decision: **use the public specification as a design reference; prototype a minimal AEGIS-native event-rule subset before considering pySigma as an optional isolated adapter.** Do not import the full SigmaHQ rule corpus as though its rules were public domain. Every rule must retain its own source, licence, author, ID, version, status, references and false-positive notes.

Repurposing opportunities:
- One event vocabulary across operating systems and device adapters, with explicit field mappings.
- Rule-based monitoring of AEGIS's own security events and Forge supply-chain events.
- Correlation rules that combine several weak signals into a reviewable finding rather than triggering a high-impact action from one event.
- Rule validation as a quality gate for community-contributed detection knowledge.

### Dissect — universal target abstraction and modular parsers

Inspected upstream revision: `fox-it/dissect.target@91465f3d32d25e99913b8c57f8e993a930db95c4`.

Pinned inspected blobs:
- `dissect/target/target.py`: `51e8086af3a86fa1d9e141f51dfae38fda419f12`
- `dissect/target/plugin.py`: `d0327fe8bac2c38e52713fe0450ab8e8886487d0`
- `pyproject.toml`: `01293bf344c7db7caade651f88e0fed9b44ecfe0`

Mechanisms observed:
- Dissect separates containers, loaders, volumes, filesystems and higher-level artefact plugins. A common Target abstraction lets analysis operate across different underlying evidence formats.
- Its architecture puts single-purpose libraries first, then builds tools over those APIs. Plugins consume a common target interface rather than needing to know whether an artefact came from an E01, VMDK, filesystem or archive.
- The inspected plugin system maintains descriptors/registries and supports exported methods, output types, caching and target compatibility. The implementation also uses dynamic Python module loading; AEGIS must not load untrusted third-party plugins.

Licence and dependency boundary:
- `dissect.target` is AGPL-3.0-or-later. The Dissect meta-package declares many separate parser dependencies; component licences must be checked independently.
- Do not copy Dissect code into AEGIS or make the AGPL meta-package a core dependency without a documented compatibility/distribution decision.

AEGIS decision: **native architecture pattern; selected parsers only after individual licence and security review.** Create a narrow read-only EvidenceTarget contract that can represent a supplied file, archive, disk image, VM image or firmware bundle without requiring the whole Dissect framework. Add format-specific parsers as independently bounded modules. Keep parser discovery static/allowlisted; no runtime plugin import from user content.

Repurposing opportunities:
- A universal "open this evidence source" interface for digital forensics, backups, migration and compatibility analysis.
- Compare two system snapshots or software images through the same logical artefact queries.
- Provide a common query surface over different data containers, including read-only virtualised views that avoid unnecessary extraction or mounting.

### Combined AEGIS design direction

The strongest combined mechanism is a layered evidence pipeline, not four separate products:

`supplied source → immutable evidence identity → format/region map → bounded parsers → normalized observations → scoped rule evaluation → correlated finding → evidence-linked report`

Ownership:
- Forge continues to own upstream source inspection, REA, provenance and candidate admission.
- AEGIS core should own case-scoped evidence identity, investigation state, canonical observations, findings and user-facing reports. Do not repurpose Forge's accepted Knowledge Library as a raw case-evidence store.
- Sentinel remains the only authority for any consequential action. Detection results and parser output are untrusted data and cannot grant permissions or trigger remediation.
- Security rules remain versioned knowledge with source/licence metadata; rule matches link to evidence and never become proof by themselves.

The first implementation slice is now a **metadata-only Evidence Identity Contract v1**. It records immutable source identity (SHA-256, byte length, media type, safe display name, acquisition timestamp, owner and source kind/reference). Parser-run identity and normalized observations remain follow-on contracts; original bytes and storage references are deliberately outside this module.

Acceptance gates before implementation:
1. Inspect current migrations and data ownership to avoid a duplicate evidence ledger.
2. Define exact byte, count, recursion, CPU, memory, wall-clock and output limits for the first supported formats.
3. Write tests first for malformed/truncated files, oversized inputs, nested archives, path traversal, symlink escape, duplicate hashes, parser timeout/failure and partial results.
4. Prove the pipeline with synthetic benign fixtures; do not use live malware samples or execute payloads.
5. Compare a native signature/metadata scanner against an isolated Binwalk scan-only adapter; measure precision, recall on the fixture corpus, latency, peak memory and dependency footprint.
6. Only after the above, decide whether to add a bounded file upload/storage adapter. No production data migration or deployment is implied.

### Current REA limits and next work

- This pass inspected selected source files and package metadata at pinned upstream revisions. It did not run upstream code, install dependencies, inspect every parser/extractor, audit all transitive dependencies, review advisories, fuzz inputs or benchmark runtime behaviour.
- Binwalk extraction security and resource controls remain unverified; scan-only is the only proposed initial use.
- capa rule-engine architecture and output schema were inspected, but its full extractor/parser attack surface and rule corpus were not audited.
- Sigma specification and one example rule were inspected; the full rule corpus, DRL obligations and pySigma backend ecosystem were not audited.
- Dissect target abstraction and plugin loader were inspected; no individual parser has been approved for reuse.
- No source code, rules, package, binary or dataset has been copied, installed or executed. No AEGIS Evidence Intelligence feature is marked implemented.
- Next: inspect current AEGIS persistence migrations and upload constraints; review Binwalk parser/extractor tests and fuzz coverage; inspect capa parser/test boundaries; identify one small Dissect parser with a permissive licence or design a clean-room equivalent; and benchmark only in a disposable, isolated environment.


### Existing AEGIS baseline checked before defining evidence storage

The current Forge implementation already provides two related but distinct data domains:

- `forge_source_provenance` stores owner-scoped, immutable upstream source identity using canonical URL and pinned revision. It is for candidate/source provenance, not uploaded user evidence.
- `forge_knowledge_records` stores owner-reviewed reusable knowledge with attribution, limitations, evidence level and an append-only lifecycle. It is not a case file or raw evidence store.
- `forge_candidate_provenance_links` links candidate records to immutable source provenance.

The existing repository-code intelligence path is also narrower than the proposed Evidence Intake pipeline:
- It re-inspects a public GitHub repository and requires the exact inspected tree SHA.
- Selected file paths and blob SHAs must match the current pinned tree; each returned blob SHA and byte size is checked again.
- The endpoint accepts 1–50 selected JS/TS files, each no larger than 32 KiB. The underlying heuristic analyser has its own 1,000-file, 512-KiB-per-file and 8-MiB aggregate limits, but the endpoint's tighter limits apply to this route.
- It produces a static import relationship report only. It does not execute, install or build source.
- This is a good precedent for immutable source identity, exact-object revalidation and bounded read-only analysis, but it is not a general binary upload, archive parser or evidence custody system.

AEGIS design consequence: do not overload Forge's Knowledge Library or source-provenance tables with case evidence. A future case-scoped evidence domain should reference existing owner/case identity and audit/run lineage where appropriate, while keeping immutable original-source identity separate from parser outputs and analyst conclusions. A dedicated evidence ledger is only proposed; no schema or upload/storage binding has been added in this research pass.

No conclusion about the absence of other repository upload/storage mechanisms is made from these selected paths. The exact Pages/Workers storage configuration and any existing object-storage binding still need a repository-wide inspection before an implementation design is finalised.


### Hostile-input and deserialisation findings

A focused inspection of capa's loader and regression tests surfaced a particularly important reusable security pattern.

Inspected at `mandiant/capa@74114afae97392e1fc08f9ed41acbc88882b645c`:
- `capa/loader.py`: `bfa2a7298347db39a4fd3afc738c1dc2ee27b598`
- `tests/test_loader_segfault.py`: `e4c06edeff859b3d89f4fb8c2b1081814a1f9dd3`
- `capa/rules/__init__.py`: `86da32ddb5665c86b88699878393f01a834149c6`
- `CHANGELOG.md`: `cffabcef551ac3235500c1857e2cd297cc389bb4`

Observed safeguards:
- capa's YAML rule loader selects PyYAML's `CSafeLoader` and falls back to `SafeLoader`, rather than the unsafe general-purpose YAML loader. The changelog records a prior insecure-deserialisation fix in YAML loading.
- Existing Vivisect `.viv` workspaces are ignored by default because loading them uses Python pickle deserialisation. The opt-in environment variable is explicit, and tests create a malicious pickle whose reduction function would mark execution; the regression asserts that the payload does not run by default.
- Tests cover malformed ELF handling, conversion of a parser segmentation violation into a controlled `CorruptFile` error, early rejection of PE files with unrealistic section sizes, and rejection of serialized workspace input.
- The loader also disables a symbolic switch-case analysis stage because it had pathological worst-case performance. This is a useful example of deliberately trading some analysis depth for bounded runtime.

AEGIS requirements derived from this:
1. Never deserialize user-supplied Python pickle or other executable object formats. Do not add a hidden or environment-only bypass to the ordinary evidence path.
2. Parse YAML only with a safe loader; prefer a small, schema-validated JSON/YAML data contract for community rules. Rule content is data, never executable code.
3. Treat parser crashes, invalid offsets, impossible lengths and unsupported architectures as typed partial/failure outcomes, not server crashes.
4. Reject or short-circuit obviously pathological structures before expensive parsing; enforce per-file and aggregate byte, recursion, CPU, memory, wall-clock and output limits.
5. Keep cached analysis state in non-executable, versioned formats with strict schemas and integrity checks. A cache is untrusted input too.
6. Add adversarial fixtures for YAML object-construction tags, pickle payloads, malformed ELF/PE headers, oversized section lengths, truncated archives, nested recursion and parser timeout.
7. No parser result, cached workspace, rule file or extracted string may invoke shell commands, load modules, alter policy or change Sentinel permissions.

Binwalk's inspected fuzzing manifest exists at `ReFirmLabs/binwalk@26713972e3f9f52dc37d4a421c4554b0bd9e82ef`, blob `3e5dd2965b8675e376dc0930ed66c8e4b12a6a60`; it declares an AFL dependency using a wildcard version. This establishes a fuzzing-related project surface, but not the coverage or quality of its fuzz targets. Inspect the actual harnesses and pin the fuzz toolchain before drawing conclusions. Fuzzing is not a substitute for AEGIS-specific bounds and isolation.

This is a design lesson, not a claim that capa or Binwalk is vulnerability-free. No upstream test suite or fuzz campaign was run during this review.


### Evidence Identity Contract v1 — first implementation slice

Implemented on the feature branch:
- `functions/lib/evidence-intake.mjs` exports `createEvidenceDescriptor` and `validateEvidenceDescriptor`.
- `tests/evidence-intake.test.mjs` contains eleven focused tests.
- The descriptor carries schema version, server-derived owner identifier, internally generated UUIDv4, lowercase SHA-256, positive safe-integer byte length, media type, path-free display name, canonical UTC acquisition timestamp and typed source kind.
- Only a repository-blob source may carry a canonical HTTPS reference. Other source kinds must have a null reference.
- Unknown fields are rejected. File bytes, base64 content, local filesystem paths and storage locations are not accepted by the contract.
- The descriptor and nested source object are frozen in memory. Plain-object prototypes and nested source fields are validated before creation. This is not a persistence guarantee; a future database design must enforce immutable identity and append-only custody events separately.
- The focused test was first run before the module existed and failed with the expected module-not-found result; after the implementation, all 11 focused tests passed locally with Node.js 22.

**Not implemented:** upload handling, object storage, D1 persistence, case/investigation records, parser runs, observations, extraction, UI or any scanner. The module is a metadata contract only. The full repository CI result for the implementation commit has not yet been surfaced; do not mark the feature CI-verified until that is confirmed.

Security notes:
- The caller must derive `ownerId` from the authenticated server-side principal. Never trust a client-supplied owner identifier.
- A SHA-256 digest identifies the supplied bytes but does not establish that the content is benign, authentic or trustworthy.
- A display name is metadata only and must never be used as a filesystem path or object-storage key.
- The contract does not impose the eventual upload size limit; that must be set from verified storage/runtime constraints and tested before an upload route is added.


# Unified Open-Source Discovery, REA & Provenance Audit — 2026-11-17

## Audit scope and decision rule

This assessment covers the 19 named candidate repositories (17 numbered entries, with paired repositories under the OSINT and creative-tool entries) plus the four optional human-learning references. It is a source-level triage, not a full legal opinion or complete transitive dependency/SBOM audit. A root licence does not automatically cover model weights, training data, third-party assets, rule corpora, generated content, submodules or independently licensed packages.

**OSI gate:** SPDX identifiers and permissive-looking terms are not by themselves proof of OSI approval. MIT, Apache-2.0, BSD and LGPL are OSI-approved licences; DRL-1.1 is a separately identified rule licence but is not OSI-approved. CC-BY-SA-4.0 is a content licence, not an OSI-approved software licence. A custom non-commercial evaluation licence fails the AEGIS core gate.

**Extraction policy:** prefer independently authored AEGIS-native schemas and algorithms. Reuse only the smallest verified permissively licensed primitive with notices preserved. Content/rule packs with non-OSI licences are not bundled in the core. Unknown licence = hold/reject, never implied permission.

## Important correction: actual AEGIS baseline

The supplied brief describes a more mature baseline than the live branch README and Forge documentation support. At branch head inspected on 17 Nov 2026, AEGIS is still an evolving Cloudflare Pages prototype:
- Pages Functions, Workers AI binding and optional KV are described as the current deployed foundation.
- D1/Queue runtime source exists, but the separate Runtime Worker and its D1/Queue resources are not yet provisioned/deployed.
- AG-UI 1.0 is a bounded, owner-only replay endpoint for terminal run history; it is not yet live specialist execution or general real-time assistant/tool streaming.
- Project Spaces and their activity/context APIs have source-level foundations; production D1 provisioning/deployment is a separate gate.
- Sentinel/grants/approvals and the capability vault are source-level governed foundations; no general external tool execution is enabled.
- Forge supports authenticated public GitHub discovery, bounded tree/blob inspection and a heuristic JS/TS module-relationship report. It does not execute candidates, and the production Forge sandbox/general worker is not implemented.

Therefore the proposed work must be staged against the **verified source baseline**, not assume all named services are live. Keep all runtime work feature-flagged and source-tested until deployment resources and explicit owner approval exist.

## Part A — Forge licence & provenance register

Status meanings:
- **ADAPT** — approved as a design/schema reference; no wholesale import.
- **CONDITIONAL** — useful primitive, but dependency, model, asset or runtime review remains.
- **REFERENCE** — human research only; no runtime or copied content.
- **HOLD / REJECT** — fails the current OSI/provenance/cost gate or cannot be verified.

### 1. Codebase understanding, architecture mapping and agent workflows

#### Egonex-AI/Understand-Anything — ADAPT

- Repository: https://github.com/Egonex-AI/Understand-Anything
- Pin: inspected source commit `b861852dda79273bd9d2e01c3160d42e2df510d2`; graph-guide blob `8ed3927e2a2a6365c93c043cf5866ff9668bce93`; domain-design blob `20c61da0124abb5bd778fbc0c1190325f9c523af`.
- SPDX: `MIT`. Licence: https://github.com/Egonex-AI/Understand-Anything/blob/main/LICENSE
- Smallest primitive: documented graph contract in `understand-anything-plugin/agents/knowledge-graph-guide.md` (version/project/nodes/edges/layers/tour; typed nodes and edges); separate domain graph design in `docs/superpowers/specs/2026-04-01-business-domain-knowledge-design.md`.
- Runtime: PWA Browser + D1 graph metadata; static structural extraction may be Cloudflare/Forge-bounded, deeper AST work belongs on optional local node.
- Dependencies/assets: multi-pass agent pipeline can invoke whichever agent/model runtime is installed; do not make any proprietary model mandatory. Dashboard is read-only JSON visualisation; no licence claim is made for arbitrary analysed repositories.
- AEGIS overlap: enhances Forge's existing repository tree/blob inspection and JS/TS relationship report with a durable graph and domain-level view; does not replace Forge candidate records or Sentinel.
- Security: graph content is untrusted; validate schema, cap node/edge counts, escape labels, never render raw HTML, and pin every source reference to a commit and line range. Incremental graph freshness must be based on content/structural fingerprints, not only branch names.

#### tt-a1i/archify — ADAPT, current branch only

- Repository: https://github.com/tt-a1i/archify
- Pin: inspected `archify/SKILL.md` blob `380de2c1016ee24910d425d74cc0efc91d426be9`, repository-authoring reference blob `38d06a6173042da3557e4d447330a7c3a56ad60c`, root NOTICE blob `b63fbccce2291058a9f4abec9d64b57b527e44d7`. A current full main-branch commit SHA still needs to be frozen before copying any implementation. The release page exposed v2.16.0 at short commit `c826e6c`; do not assume that older release has the current branch's licence/skill contract.
- SPDX: current root project `Apache-2.0`; current Skill frontmatter also says Apache-2.0. Licence: https://github.com/tt-a1i/archify/blob/main/LICENSE
- Licence history: NOTICE says earlier MIT grants remain valid through pre-transition commit `25cf37080fc8b1dbe758a4efc3935b55f3327088`; current branch is Apache-2.0 except files/packages that state otherwise. Preserve NOTICE and third-party notices. No general trademark permission.
- Smallest primitive: typed JSON diagram IR, schema/validator/compiler workflow, and the repository-authoring rule: freeze source identity, trace actual call/data ownership, pin commit and exact line ranges, and label unknowns.
- Runtime: PWA Browser for the viewer; Forge Skill Blueprint for generation. AEGIS should write its own small renderer and source-evidence contract rather than embed the complete Archify application.
- Dependencies/assets: renderer, templates, integrations and third-party packages each need separate review. Do not copy logos/marks or assume the MIT history covers current code.
- AEGIS overlap: enhances the planned Forge visual graph; it is not a replacement for Project Spaces or the existing code analyser.
- Security: diagrams are inert data. Escape text, validate node/edge types, allow only pinned GitHub source links, and do not trust generated topology assertions without source evidence.

#### open-gsd/gsd-core — ADAPT

- Repository: https://github.com/open-gsd/gsd-core
- Pin: release `v1.21.0`, published 13 Nov 2026, release commit short SHA `357508d`; inspected gate taxonomy blob `dd015f2956dc5b97506d2f0849bc73a9d04a943d`, execute workflow blob `60c1fd2a6cc978dde6e88f37c644b2f4254321e2`, context-engineering doc blob `d5852652933d2db564be913c697cf5f3fcafdfdf`.
- SPDX: `MIT`. Licence: https://github.com/open-gsd/gsd-core/blob/main/LICENSE
- Smallest primitive: durable `STATE.md` / `CONTEXT.md` / `PLAN.md` / `SUMMARY.md` artifact discipline, fresh-context specialist delegation, dependency-ordered execution waves, and bounded verification/revision loops.
- Runtime: Cloudflare Worker + D1 state machine; Queue for dispatch when actually provisioned.
- Dependencies/weight: full installer and multi-runtime agent system are unnecessary. Its 200k-token context assumptions are model/runtime-specific and must not be copied as AEGIS guarantees.
- AEGIS overlap: adds durable specialist-run state and context-rot resistance to the existing plan-only agent orchestration; Sentinel remains the sole approval authority.
- Important correction: GSD's inspected canonical gate taxonomy has **four gate types** (pre-flight, revision, escalation, abort), not a verified G0–G6 named sequence. AEGIS may define its own seven lifecycle checkpoints, but must label them as AEGIS design, not quote them as GSD's exact model.
- Security: optimistic state transitions, idempotency, bounded retries, lease/attempt fencing, append-only events, explicit cancellation and human escalation. Agent output is untrusted until verified.

#### bmad-code-org/BMAD-METHOD — CONDITIONAL ADAPT / BLUEPRINT

- Repository: https://github.com/bmad-code-org/BMAD-METHOD
- Pin: stable `v6.12.4`, release commit short SHA `bab9082`; inspected README and root licence at current branch. v7 was described as preview alpha in the inspected README and is not the stable baseline.
- SPDX: `MIT` plus an explicit BMad trademark notice. Licence: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/LICENSE
- Smallest primitive: role separation (analyst, architect, developer, QA/reviewer) and reproducible artifacts (brief, requirements, architecture, implementation plan, test/review report).
- Runtime: Forge Skill Blueprint only.
- Dependencies/assets: do not use BMad names, logos or marks as AEGIS branding; retain MIT/CONTRIBUTORS notices if any code is ever reused. Avoid installing the complete workflow framework.
- AEGIS overlap: complements existing AEGIS skills and specialist planning; does not replace Forge, Sentinel or durable run records.
- Security: agent role separation is not a permission boundary. All actions still require AEGIS capability policy and Sentinel; no skill prompt may grant tool access.

### 2. Knowledge ingestion, RAG, data analysis and web extraction

#### Tencent/WeKnora — BLUEPRINT ONLY

- Repository: https://github.com/Tencent/WeKnora
- Pin: inspected source revision `7d064bc3a259f87634840199f565ec4dd644ba1e`; chunking doc blob `f46f685c891f9747d42da5f4ea4eb6ad6ef8db12`; splitter blob `68ba6776bd97c5caf247fb6e4b12e86c88f29921`; retrieval-fusion blob `b009f1ea9b3dc049a05f4751fb1337a269e5ffac`.
- SPDX: project declares `MIT` except listed third-party components. Licence: https://github.com/Tencent/WeKnora/blob/main/LICENSE
- Smallest primitive: adaptive chunking tier chain (heading → heuristic → legacy recursive fallback), validator and diagnostics; optional parent/child chunks (small child retrieval, larger parent context); weighted Reciprocal Rank Fusion of vector and keyword results; source-linked wiki revision/rollback pattern.
- Runtime: Cloudflare Worker/D1 for metadata, chunk records and keyword search after a D1 FTS5 compatibility test; local node for optional embeddings, large parsing and model work.
- Dependencies/weight: explicitly exclude Docker/Postgres/Neo4j/full service stack, model vendors and external integrations. Audit every listed third-party component before copying any implementation. Do not assume all project code and assets share one licence.
- AEGIS overlap: enhances Project Spaces and the owner-only Knowledge Library; does not replace their scope, activity timeline, accepted/review lifecycle or Forge knowledge provenance.
- Security: preserve exact source offsets, immutable source hash and chunker version; bound document size and chunk count; treat OCR and retrieved prompt-like text as hostile data; do not let retrieval content become system instructions.

#### vaibhav-space/vindex — CONDITIONAL LOCAL-NODE ADAPTER / SCHEMA REFERENCE

- Repository: https://github.com/vaibhav-space/vindex
- Pin: inspected source revision `b500081c200c5d11307cb59495c61fc0c9417ba7`; architecture doc blob `16384e0bb2ca25c208f77928ae603276caca9fe5`; OCR observation schema blob `811fcbfc5fcdaad6888e5ee4836d0f4f01175b89`; caption observation schema blob `d901698f252f36afb7b6e748f5915fb6d89a4504`.
- SPDX: `MIT`. Licence: https://github.com/vaibhav-space/vindex/blob/main/LICENSE
- Smallest primitive: deterministic typed Observation stream with schema version, timestamp, duration, source/extractor, runtime/model identity, confidence and references; output artifacts for timeline, scenes, ASR and OCR.
- Runtime: Local Node Sidecar; PWA only views generated JSON/Markdown artifacts.
- Dependencies/assets: current Python package depends on PyAV, faster-whisper, MLX/MLX-VLM, PaddleOCR/PaddlePaddle, SceneDetect, sentence-transformers and more. Heavy, hardware/platform-specific and not a Cloudflare Worker dependency. Model/weight licences and redistribution terms require a separate inventory; MIT source does not license weights.
- AEGIS overlap: adds a deterministic media knowledge compiler for Project Spaces; does not replace the shared AEGIS intelligence core or memory.
- Security: process only owner-selected media; sandbox decoders, cap duration/resolution/frame rate and disk usage, strip metadata where appropriate, hash inputs/outputs, and mark model-generated captions as inferred rather than observed facts.

#### pgalko/BambooAI — CONDITIONAL BLUEPRINT / ISOLATED LOCAL WORKER

- Repository: https://github.com/pgalko/BambooAI
- Pin: inspected source revision `2153bf8bf86d73afc264468aa2e7a329b60f0a70`; README blob `225384b87d1d04b655d0efcd5aa47bcc954d9538`; package metadata blob `05756dd26ddb9f80e4753cb4ed45e0e306f3421b`; OSS design blob `238c82ee181768057e9c7d85fecaf954da51cdbc`.
- SPDX: `MIT`. Licence: https://github.com/pgalko/BambooAI/blob/main/LICENSE
- Smallest primitive: computational lineage linking numerical claims to code, intermediate results, dataset identity and a generated code map; reproduce a completed analysis in a fresh kernel before accepting the result.
- Runtime: Forge Skill Blueprint; optional isolated Local Node Sidecar for user-approved Python execution.
- Dependencies/weight: large Python/data-science stack; package metadata includes OpenAI, Anthropic, Google, Groq and other clients as well as local Ollama support. A local model path can avoid mandatory paid APIs, but the full application is not lightweight and should not be imported.
- AEGIS overlap: improves Project Space and Forge evidence quality; does not replace AEGIS memory, planning or Sentinel.
- Security: never execute untrusted generated Python inside a Cloudflare Worker or the main AEGIS process. Use disposable least-privilege execution, no secrets, restricted network, CPU/memory/time limits, pinned dependencies and replay verification. Reproducibility does not prove that the method or interpretation is correct.

#### unclecode/crawl4ai — CONDITIONAL LOCAL-NODE ONLY

- Repository: https://github.com/unclecode/crawl4ai
- Pin: release `v0.9.5` (14 Oct 2026); inspected package metadata blob `f93d1068015e75d9ae5ba30e51f96b16dfdf237a`, root licence blob `ade44a7824869fe57a3dfa98ad4b7ffb764c3cb0`.
- SPDX: `Apache-2.0`. Licence: https://github.com/unclecode/crawl4ai/blob/main/LICENSE
- Smallest primitive: local browser-backed extraction to clean Markdown/structured JSON with canonical URL, metadata and capture-time provenance. Do not use the hosted Crawl4AI Cloud API.
- Runtime: Local Node Sidecar (Python process/browser); not Cloudflare Worker/PWA runtime.
- Dependencies/weight: Playwright/Chromium, Patchright, aiohttp, parsing and ranking libraries; substantial download, disk and CPU cost. Apache-2.0 requires retaining applicable copyright, licence and NOTICE attributions. Inspect dependency notices and model downloads.
- AEGIS overlap: adds opt-in local web ingestion to Project Spaces; Forge remains the source-discovery and licence-review system.
- Security: crawler is an SSRF and hostile-content boundary. Block loopback/private/link-local/multicast/reserved IPs including IPv4-mapped IPv6; re-resolve DNS and validate every redirect; block file/data and non-HTTP schemes; deny cloud metadata; isolate browser profile; no inherited cookies, passwords or client certificates; disable downloads; cap pages, depth, bytes, time and concurrency; enforce per-domain rate limits and robots/terms policy. Never crawl arbitrary URLs supplied by retrieved page content.

### 3. Security detection, AppSec and AI hardening

#### GitHubSecurityLab/skills — ADAPT AS FORGE SKILL BLUEPRINT

- Repository: https://github.com/GitHubSecurityLab/skills
- Pin: root README blob `eaa26ca7c063c6f0f851f7ede0a1a9d93d62ae38`; root licence blob `28a50fa22639e32febe14e4ffc7a732b0ba8c90a`. Freeze full commit SHA before any copied file is admitted.
- SPDX: `MIT`. Licence: https://github.com/GitHubSecurityLab/skills/blob/main/LICENSE
- Smallest primitive: threat-model-driven identification of untrusted-input entry points and dangerous sinks; fuzz target selection, harness quality, coverage, crash reproduction and regression-test handoff.
- Runtime: Forge Skill Blueprint; actual fuzzing only in disposable Local Node Sidecar or CI sandbox.
- Dependencies/assets: skills are operational instructions, not trusted AEGIS policy. Review each skill and tool command; do not install wholesale or let it bypass approvals.
- AEGIS overlap: enhances Forge candidate review and security test planning; Sentinel remains the only authority.
- Security: no automatic fuzz campaign against third-party services or unapproved targets. Scope fuzzing to checked-out, owner-authorised code; no production credentials; cap runtime and resource use.

#### Arcanum-Sec/ai-sec-resources — REFERENCE ONLY / HOLD

- Repository: https://github.com/Arcanum-Sec/ai-sec-resources
- Pin: inspected README blob `36044278bc9b4e352cf974f90da75c0a3fead4e5`; no root LICENSE file was found in the checked paths, and no verified OSI licence was established.
- SPDX: **unverified / no licence located**. No direct licence grant can be assumed.
- Smallest primitive: human reading list for prompt injection, agent/MCP attacks, RAG poisoning, security labs, taxonomies and evaluation resources. No copied content or runtime integration.
- Runtime: Reference Blueprint only.
- Dependencies/assets: each linked resource has its own licence and risk profile.
- AEGIS overlap: informs future AI-hardening research only.
- Security: educational references may contain offensive test payloads; do not import them as executable tests or allow arbitrary labs to run against AEGIS.

#### SigmaHQ/sigma — SPECIFICATION ADAPT ONLY; RULE CORPUS EXCLUDED FROM CORE

- Repository: https://github.com/SigmaHQ/sigma
- Pin: inspected root licence blob `f816b6993cc0d9564fd4629823cbaac8bccaff17`; no full current rule-corpus commit pinned in this pass.
- SPDX: mixed content. The Sigma specification and logo are public domain; the SigmaHQ rules are `DRL-1.1`. Licence declaration: https://github.com/SigmaHQ/sigma/blob/master/LICENSE
- Smallest primitive: public-domain Sigma rule specification as a design reference for logsource, detection selections/conditions, metadata, status, severity and correlation. AEGIS can implement a bounded native subset and author its own MIT rules.
- Runtime: Cloudflare Worker/D1 for schema validation and simple event-rule evaluation; Local Node for large event streams.
- Dependencies/assets: pySigma is a separate `LGPL-2.1-only` package; not a core dependency. SigmaHQ rule files are DRL-1.1, not public domain and not OSI-approved; do not bundle them in the core.
- AEGIS overlap: extends Sentinel/Forge security telemetry; does not replace capability grants or human approval.
- Security: event data and rules are untrusted; validate schemas, bound regex and correlation windows, preserve rule identity and never execute a detection result as an action.

#### Neo23x0/signature-base — RULE CORPUS EXCLUDED FROM CORE

- Repository: https://github.com/Neo23x0/signature-base
- Pin: inspected root README blob `150c2dfc45ba8028de300ab6fa3b1c3973d6f3b5` and LICENSE blob `a2486e663132108cffe118790d6195a662a39ab2`; exact current commit not pinned.
- SPDX: `DRL-1.1` for current YARA/IOC corpus except individual rules with explicit alternate licence metadata. Licence: https://github.com/Neo23x0/signature-base/blob/master/LICENSE
- Smallest primitive: none for AEGIS core. Potential optional external user-supplied rule pack only after per-rule licence/provenance review.
- Runtime: Local Node Sidecar only if a separately approved rule pack is supplied.
- Caveats: rules depend on external variables in LOKI/THOR in some cases; old v2.0 release was CC-BY-NC 4.0 and is explicitly unsuitable. Never mix historical versions without licence review.
- AEGIS overlap: may enrich local file triage, not Forge's own trust/approval logic.
- Security: YARA matching is analysis, not proof. Treat matches as leads, record author/rule URI/licence, manage false positives and do not block or quarantine solely on one match.

#### OWASP/CheatSheetSeries — REFERENCE ONLY; NO TEXT IMPORT

- Repository: https://github.com/OWASP/CheatSheetSeries
- Pin: inspected README blob `8c7cb6698d1ad20af9176c0a36caefa6907c21a0`; full commit not pinned.
- Licence: `CC-BY-SA-4.0` (content licence; not an OSI-approved software licence). Project badge identifies the licence; https://creativecommons.org/licenses/by-sa/4.0/
- Smallest primitive: no copied prose/checklists. Use the public security topics as a reading index, then write original AEGIS checks from independently verified standards and source evidence.
- Runtime: Reference Blueprint only.
- Dependencies/assets: Markdown text, images and branding have separate attribution/ShareAlike considerations; do not embed copied text into the MIT AEGIS repository.
- AEGIS overlap: informs original Forge static-review rules.
- Security: reference is not a substitute for testing; checks need explicit applicability, severity, evidence and false-positive guidance.

#### Yamato-Security/hayabusa-rules — RULE CORPUS EXCLUDED FROM CORE

- Repository: https://github.com/Yamato-Security/hayabusa-rules
- Pin: inspected README blob `d6c19871a388ab8b96ea30f80f66020631cbfd28` and `LICENSE.md` blob `6475b1511fb96c2d3ac9fd9c1d8340032cc30488`; exact current commit not pinned.
- SPDX: `DRL-1.1`. Licence: https://github.com/Yamato-Security/hayabusa-rules/blob/main/LICENSE.md
- Smallest primitive: no rule content for AEGIS core. Use the rule format and documentation as reference; author original AEGIS event detections or let an owner supply an external rule pack.
- Runtime: Local Node Sidecar only for a separately approved Windows event-log adapter.
- Dependencies/assets: curated Sigma rules are specifically adapted for Hayabusa/Velociraptor; parser compatibility and per-rule metadata matter.
- AEGIS overlap: adds optional Windows-node event triage, not core Forge policy.
- Security: DRL author attribution must remain visible in rule matches if rules are ever used; rule matches are not proof and must never automatically remediate.

### 4. OSINT / owner self-audit

#### sherlock-project/sherlock — CONDITIONAL MANIFEST ADAPT

- Repository: https://github.com/sherlock-project/sherlock
- Pin: inspected source revision `c588d7c8b476df9f9c84912a05d1430fb8cdcdae`; data manifest blob `d3f44240cc9d6b7fff543d6492e5be066ac06a58`; schema blob `c717cb256420f86dabcfa954779d3fd38b9664fc`.
- SPDX: `MIT`. Licence: https://github.com/sherlock-project/sherlock/blob/master/LICENSE
- Smallest primitive: JSON endpoint manifest plus JSON Schema; each record carries endpoint templates, error classification, optional request method/payload/headers and username format constraints.
- Runtime: Local Node Sidecar by default; PWA can present the user-approved platform checklist. A narrow Worker proxy is not the first choice.
- Dependencies/assets: do not import the Python scraper. Manifest entries describe third-party services; each site's terms, robots/rate limits and endpoint policy remain separate.
- AEGIS overlap: owner-controlled self-audit, not a public-person search or identity-resolution service.
- Security/privacy: require the owner to confirm the exact handle(s) and selected platforms; default to GET/HEAD only; reject POST/PUT and arbitrary headers/bodies; filter adult/NSFW endpoints; per-site rate limit; no proxy rotation, login bypass, CAPTCHA bypass or bulk enumeration; show uncertainty and let the owner review results. The manifest contains NSFW targets and potentially state-changing request options, so never execute it unfiltered.

#### p1ngul1n0/blackbird — HOLD / REJECT UNTIL VERIFIED

- Repository: https://github.com/p1ngul1n0/blackbird
- Pin: no readable README, LICENSE or data manifest could be verified in this pass; GitHub search did not surface a reliable current source.
- SPDX: **unverified**. No licence or rights to reuse data can be assumed.
- Smallest primitive: none until repository identity, exact source revision, manifest path and licence are verified.
- Runtime: none.
- AEGIS overlap/security: no integration. Do not infer it shares Sherlock's MIT licence or manifest structure.

### 5. Creative / media tools

#### storytold/artcraft — OPTIONAL EXTERNAL DESIGN TOOL; NO CORE DEPENDENCY

- Repository: https://github.com/storytold/artcraft
- Pin: latest release surfaced as `v0.41.0`, short commit `c3844ac`; inspected NOTICE blob `c061efac171d45b3c078dae1b6e882aac9cc9570`.
- SPDX: `MIT OR Apache-2.0`. Licences: https://github.com/storytold/artcraft/blob/main/LICENSE-MIT and https://github.com/storytold/artcraft/blob/main/LICENSE-APACHE
- Smallest primitive: no application code required. Optional use as a standalone local scene/character staging workflow; exchange only user-owned/exportable assets in a documented format such as glTF/GLB.
- Runtime: optional Local Node / desktop tool, not an AEGIS runtime dependency.
- Asset caveats: NOTICE excludes Nintendo game sound effects, meme images, some skyboxes, a third-party VMD motion file and Mixamo animation GIFs from the MIT/Apache grant. Font Awesome assets are CC-BY-4.0; fonts have OFL licences; provider logos are trademarks. Exclude all unlicensed/excluded assets from any AEGIS distribution. Review every exported model, texture, rig, motion and audio asset licence.
- AEGIS overlap: optional content-authoring aid for the custom companion/avatar roadmap, not the companion engine or identity store.
- Security: imported 3D files are untrusted; validate glTF resources, cap geometry/texture sizes, reject remote external references by default and strip executable scripts.

#### Blizaine/Maestro — REJECT FROM AEGIS

- Repository: https://github.com/Blizaine/Maestro
- Pin: inspected root licence blob `ea64a4d1edfdcd709261e2a41f78e142dc367f53`; exact full current commit not pinned.
- SPDX: custom `WanGP Non-Commercial Evaluation License 1.1` (not OSI-approved; no standard SPDX licence identifier).
- Smallest primitive: none.
- Runtime: none.
- Caveats: prohibits commercial software use and hosted/API/backend/end-user services without separate commercial licensing; inherits WanGP terms and numerous model/weight licences. High local VRAM and storage demands also conflict with the ordinary-device baseline.
- AEGIS overlap/security: no integration; hard reject regardless of hardware profile.

#### neilsonnn/image-blaster — REJECT

- Repository: https://github.com/neilsonnn/image-blaster
- Pin: README blob `633aa3bf4ea17d4516138132758b07229948df90`; no release and no root LICENSE file located.
- SPDX: **unlicensed / not verified**.
- Smallest primitive: none.
- Runtime: none.
- Caveats: requires Claude plus World Labs and FAL credentials; listed workflows also use ElevenLabs SFX and other model services. This creates mandatory external service/API costs and proprietary dependency risk.
- AEGIS overlap/security: no integration; hard reject until an OSI licence and genuinely local/no-cost provider path exist.

### Optional learning-only references (no runtime integration)

- `The-Art-of-Hacking/h4cker`: human learning/reference only.
- `CarterPerez-dev/Cybersecurity-Projects`: human learning/reference only.
- `iknowjason/Awesome-CloudSec-Labs`: human learning/reference only.
- `globocom/secDevLabs`: human learning/reference only.
- No code, lab, exploit or dataset is admitted to Forge runtime by this classification; each linked project still needs its own authorisation and licence review.

## Part B — Top 5 native adaptation blueprints

### 1. Forge Visual Architecture Mapper

**Combine:** Understand Anything's typed structural/domain graph with Archify's source-backed diagram evidence discipline.

**AEGIS-native contract (initial proposal):**
- `graph_snapshots`: project_space_id, canonical_repo_url, commit_sha, tree_sha, schema_version, generated_at, source_fingerprint, status.
- `graph_nodes`: snapshot_id, stable_node_id, node_type, label, relative_path, start_line, end_line, layer_id, attributes_json, evidence_status.
- `graph_edges`: snapshot_id, source_node_id, target_node_id, edge_type, confidence, evidence_ref_id, attributes_json.
- `graph_sources`: snapshot_id, path, blob_sha, start_line, end_line, source_kind, observed_at.
- `graph_reviews`: snapshot_id, reviewer, decision, limitations, reviewed_at.
- Enforce foreign keys, unique stable IDs per snapshot, bounded JSON, source revision equality and append-only review history. Store bulky graph JSON in object storage only if/when the project provisions an appropriate store; D1 owns metadata and queryable graph rows.

**Pipeline:** pin Git tree → select bounded source slice → deterministic parser/manifest pass → node/edge extraction → validate referential integrity → optional semantic enrichment → reviewer pass → store snapshot → render in PWA.

**Incremental strategy:** hash each selected file and its structural signature (exports, imports, declarations, routes, schema definitions); skip unchanged files; rebuild impacted edges when a signature changes; full rebuild on parser/schema major change. Never mark a graph fresh solely because the branch name is unchanged.

**Visual contract:** source-backed node links must open the exact commit/path/line range. Render domain and structural views separately over the same versioned graph contract. Mark inferred edges separately from parser-observed edges.

**Acceptance tests:** deterministic fixture graph; stable IDs; stale tree rejection; broken references; malicious labels/HTML; oversized node/edge sets; changed file and deleted file incremental updates; source line range accuracy; unknown-edge type rejection. No model call is needed for the structural graph.

### 2. Durable Specialist-Run & Context-Rot Guard

**Combine:** GSD's durable artifacts, fresh-context specialist roles, dependency waves and bounded gates with AEGIS's existing plan-only agent-run records and Sentinel.

**Do not duplicate:** AEGIS already has D1 migration/source for `agent_runs`, step records, run events, idempotency, cancellation, leases/attempt fencing, plan-only orchestration and approval binding. First extend these existing records and migrations; do not create a second scheduler or parallel run ledger.

**State model:** `draft → queued → planning → planned → awaiting_approval → ready → executing → verifying → succeeded`, with terminal `failed / blocked / cancelled / rejected / expired`. Only states supported by an implemented executor should be activated. Current live branch remains plan-only; execution states are design-only.

**Durable artifacts:** goal/CONTEXT, source snapshot, research notes, plan, per-step checkpoint, result/SUMMARY, verification report, decision log and handover brief. Each artifact stores schema version, content digest, creator/specialist, parent artifact, source references, timestamps and sensitivity classification.

**AEGIS G0–G6 proposal (AEGIS-native, not GSD's exact gate names):**
- G0 Intake: objective, scope, owner and idempotency identity are valid.
- G1 Authority: source/resource scope, consent, grants and data sensitivity are checked.
- G2 Evidence: relevant source snapshots and constraints are pinned; unknowns are explicit.
- G3 Plan: dependency graph, acceptance tests, budget and rollback/stop conditions are reviewed.
- G4 Execute: only an enabled, allowlisted worker runs within an isolated resource boundary; high-risk work waits for Sentinel approval.
- G5 Verify: tests, output digests, provenance and independent reviewer checks complete.
- G6 Accept/close: user or authorised policy accepts the result; artifacts and audit lineage are sealed.

These are lifecycle checkpoints, not seven unconditional human prompts. Sentinel alone authorises actions; G0–G6 must never become a second approval authority.

**Reliability:** use optimistic version columns, transactional state changes, idempotency keys, queue outbox, attempt-fenced leases, heartbeat expiry, bounded retries with jitter, cancellation checks before each side effect, immutable event records and resumable checkpoints. Every specialist gets a minimal fresh context assembled from approved artifacts, not the entire chat history.

**Acceptance tests:** duplicate queue delivery; stale worker lease; cancel-vs-start race; context digest mismatch; missing dependency; revision loop cap; escalation; abort preserving state; approval bound to exact plan digest; no execution while feature flag is off.

### 3. Project Space Knowledge Compiler

**Combine:** WeKnora chunking/retrieval and wiki lifecycle, vindex typed deterministic media observations, BambooAI code-to-claim lineage and replay.

**One canonical AEGIS source model:**
- `source_asset`: owner/project-space, canonical URI, media type, byte length, SHA-256, acquisition method/time, licence/rights, sensitivity, immutable status.
- `processing_run`: extractor name/version, config digest, schema version, start/end, resource limits, outcome, parent run.
- `observation`: observation ID/type, source asset ID, source byte range or media timestamp/bounding box, extractor/model identity, confidence, value digest, limitations.
- `chunk`: source asset, exact offsets, heading breadcrumb, parent ID, chunker version, content digest.
- `claim`: statement, claim class (observed / derived / hypothesis), supporting observation IDs, contrary evidence IDs, confidence rationale, reviewer and expiry.
- `wiki_page_revision`: page ID, content digest, source claim IDs, revision parent, status, created by, rollback target.

**Document chunking:** first attempt heading-aware chunks for structured documents; second heuristic semantic-boundary chunks; third legacy recursive split. Validate chunk size, coverage, overlap, tiny-chunk ratio and source reconstruction. Optional parent/child mode uses small retrieval children and a larger parent context. Keep original content offsets exact and heading breadcrumbs separate from the content span.

**Retrieval:** begin with D1 keyword/FTS capability after a compatibility proof. Optional local embedding adapter may be added later. If both channels exist, fuse ranked lists with a bounded RRF algorithm; normalize scores from different retrievers before combined scoring; retain raw scores and channel provenance. No Neo4j, mandatory vector DB or paid embedding model.

**Video:** local sidecar compiles scene/shot, frame, word-level ASR, OCR and optional VLM caption observations into versioned JSON/Markdown. JSON is canonical; Markdown is derived. Do not silently replace observations when a model changes—new extractor versions create new processing runs.

**Analysis lineage:** every numeric or factual report claim links to the exact code/query, source/dataset digest, environment/dependency lock, outputs and a replay/verification result. A fresh isolated replay tests reproducibility but does not certify the analytical method as valid.

**Acceptance tests:** text round-trip/source coverage; heading fallback; OCR garbage; huge documents; schema migration; deterministic repeated video fixtures; timestamp/bounding-box validity; claim with no evidence; contradictory sources; stale wiki page; replay mismatch; prompt-injection text stored as data not instructions.

### 4. Forge Security & AI-Hardening Gate

**Combine:** GitHub Security Lab's threat-model/fuzz workflow, independently authored AppSec controls, Sigma's public specification as a format reference, and AEGIS-native YARA/Sigma-like checks.

**Candidate admission checks:**
1. Identity: canonical repository URL, immutable commit/tree SHA, default branch, release and maintainer history.
2. Licence: actual LICENSE/COPYING plus file-level exceptions, SPDX scan, transitive SBOM, model/asset/rule licence, notices and trademark scan. Unknown/non-OSI content blocks core reuse.
3. Supply chain: lockfile, package lifecycle scripts, binary downloads, git dependencies, mutable tags, vendored code and dependency provenance.
4. Static code: supported-language parse, secrets, unsafe deserialization, shell/process/network sinks, dynamic imports/eval, path traversal, authz and tenant-boundary checks.
5. AI/agent: indirect prompt injection, untrusted skill instructions, tool schema confusion, data exfiltration, memory poisoning, connector privilege escalation and approval bypass.
6. Test evidence: unit/regression tests, fuzz harness coverage, reproducible crash, dependency vulnerability status and bounded sandbox results.
7. Decision: evidence-linked findings with severity, confidence, false-positive notes, fix guidance and explicit owner decision.

**Rules:** public-domain Sigma specification can inform the native parser. Do not bundle SigmaHQ, Signature-Base or Hayabusa DRL rules in the MIT AEGIS core. Do not copy OWASP CC-BY-SA prose. Build first-party MIT rules/checklists from independently verified requirements; accept external user-supplied rule packs only as separately licensed, attributed data, not as core source.

**Security boundary:** Forge analysis is read-only. Never install dependencies, run build scripts, execute candidate binaries, invoke fuzzers against remote services or run repo-provided tests on the Pages Worker. Dynamic/fuzz analysis requires a disposable local/CI sandbox, no secrets, no network by default, explicit scope, resource ceilings and retained logs. Sentinel approval is required for any action that changes resources or contacts a third-party target.

### 5. Owner Self-Audit & Local Web Ingestion

**Owner self-audit:** extract a small, versioned Sherlock-style endpoint manifest and schema. The owner explicitly confirms the usernames and selected public platforms. Default to GET/HEAD, safe platforms only, no NSFW endpoints, no arbitrary request body/headers, no proxy rotation, no login bypass, no mass enumeration. Each result stores timestamp, endpoint manifest version, response classification, evidence URL and uncertainty. A "not found" response is not proof that an account does not exist.

**Blackbird:** no integration until repository, exact commit, manifest and OSI licence are independently verified.

**Web ingestion:** optional Crawl4AI local-node adapter, no Crawl4AI Cloud API. It returns canonical URL, page title, capture time, response status, content hash, Markdown and extraction warnings. Require owner-initiated URLs and a per-project allowlist; protect against SSRF, DNS rebinding, redirects, private IPs, cloud metadata, file URLs, downloads, hostile HTML/JS and oversized pages. Keep browser cookies and credentials out of the crawler profile. Honour robots and site terms. Every imported page remains untrusted source data.

**Acceptance tests:** manifest schema invalid; unsupported method; NSFW exclusion; owner consent missing; duplicate platform; per-origin throttle; redirects to private IP; DNS rebinding; browser download; oversized response; hostile prompt injection; revoked consent; deletion/retention request.

## Part C — Priority execution roadmap

### Priority 1 — Build now on the verified Cloudflare/PWA foundation

1. **Forge Visual Architecture Mapper (first)** — extend the existing bounded JS/TS module relationship analyser into a versioned graph snapshot, with source-pinned evidence and a simple PWA viewer. Keep generation deterministic and model-optional.
2. **Durable Specialist-Run & Context-Rot Guard (second)** — extend the existing plan-only agent-run schema and state machine. First ship durable context artifacts, checkpoint/restart and verification metadata; do not activate specialist execution until the isolated worker and Sentinel approval gates are deployed and tested.
3. **Project Space Knowledge Compiler — text/document slice** — immutable source identity, extraction/offset metadata, heading/heuristic/recursive chunker, schema validation and keyword retrieval. Use D1 only after FTS compatibility and performance tests. No embeddings or video ML required in this phase.
4. **Forge Security & AI-Hardening Gate — metadata/static slice** — licence/provenance, dependency and manifest inspection, existing parser-based source checks, untrusted-content classification and report generation. Keep all candidate analysis read-only.

### Priority 2 — Local Companion Node

1. **vindex-derived media compiler** — local video/audio processing, versioned observations, ASR/OCR/scenes and optional VLM; no model weights bundled until their licences and device requirements are verified.
2. **Crawl4AI local web ingestion** — only after a hardened SSRF/browser isolation design and explicit user opt-in.
3. **Sherlock manifest self-audit** — owner-only, filtered endpoint registry, safe GET/HEAD subset, local execution and per-site rate limits. Blackbird stays excluded.
4. **Optional ArtCraft workflow** — standalone local avatar/scene authoring only; use clean, user-owned exports and exclude all NOTICE-listed third-party assets.
5. **Optional isolated Python analysis worker** — BambooAI-style reproducibility lineage, but no imported BambooAI app and no Python execution in the AEGIS control plane.

### Priority 3 — Reference Blueprint Only

- BMAD role/artifact methodology (stable v6.12.4 only as reference; trademark-safe).
- WeKnora wiki/revision concepts and more advanced retrieval; full stack explicitly excluded.
- BambooAI analysis/reviewer patterns; full app and dependency stack excluded.
- GitHub Security Lab skill patterns pending per-skill review; do not install skills as authority.
- Arcanum AI security resource hub and the four optional cybersecurity learning repositories; human research only.
- Sigma specification as a public-domain format reference; implement an AEGIS-native subset and original rules.

### Reject / Exclude from AEGIS core

- Maestro: non-OSI non-commercial evaluation licence and model/component licence burden.
- image-blaster: no verified OSI licence and paid/proprietary API dependencies.
- Blackbird: licence/repository/manifest not verified.
- OWASP CheatSheetSeries prose/assets: CC-BY-SA-4.0 content licence, not OSI-approved software licence; reference only, no copying into core.
- SigmaHQ, Neo23x0 Signature-Base and Hayabusa rule corpora: DRL-1.1, not OSI-approved; no bundled core rule content. External separately supplied rule packs require explicit licence/attribution handling.
- Any unlicensed model weights, third-party assets, old CC-BY-NC Signature-Base release, or unknown submodule/dependency: reject until rights are verified.

## Provenance pins and audit limitations

- Immutable upstream source revisions and blob hashes are recorded inline above. Where only a release tag, short commit, branch or blob hash was available, it is explicitly marked as insufficient for copying code; obtain a full 40-character commit and re-fetch the exact LICENSE/NOTICE/dependency lock before admission.
- Full transitive SBOM, security advisory review, fuzzing, runtime benchmark and per-asset/model licence review have **not** been completed for these candidates.
- No candidate repository code, binary, rule pack, model weight or dataset has been installed or executed during this audit.
- No AEGIS feature in this register is marked implemented. The roadmap is a design recommendation only; it does not authorise production migrations, deployment, external scanning, execution or PR merge.
