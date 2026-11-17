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
- `tests/evidence-intake.test.mjs` contains nine focused tests.
- The descriptor carries schema version, server-derived owner identifier, internally generated UUIDv4, lowercase SHA-256, positive safe-integer byte length, media type, path-free display name, canonical UTC acquisition timestamp and typed source kind.
- Only a repository-blob source may carry a canonical HTTPS reference. Other source kinds must have a null reference.
- Unknown fields are rejected. File bytes, base64 content, local filesystem paths and storage locations are not accepted by the contract.
- The descriptor and nested source object are frozen in memory. This is not a persistence guarantee; a future database design must enforce immutable identity and append-only custody events separately.
- The focused test was first run before the module existed and failed with the expected module-not-found result; after the implementation, all 9 focused tests passed locally with Node.js 22.

**Not implemented:** upload handling, object storage, D1 persistence, case/investigation records, parser runs, observations, extraction, UI or any scanner. The module is a metadata contract only. The full repository CI result for the implementation commit has not yet been surfaced; do not mark the feature CI-verified until that is confirmed.

Security notes:
- The caller must derive `ownerId` from the authenticated server-side principal. Never trust a client-supplied owner identifier.
- A SHA-256 digest identifies the supplied bytes but does not establish that the content is benign, authentic or trustworthy.
- A display name is metadata only and must never be used as a filesystem path or object-storage key.
- The contract does not impose the eventual upload size limit; that must be set from verified storage/runtime constraints and tested before an upload route is added.
