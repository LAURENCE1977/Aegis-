# AEGIS REA — Browser, Presentation and Business Capability Batch

Reviewed: 17 November 2026

Status: research record only. No candidate package, browser, agent, model, API, credential or hosted service has been installed, connected or activated. All upstream content is untrusted reference material. AEGIS retains identity, memory, reasoning, policy, Sentinel, durable job state and audit.

## Camofox Browser

Source:
- https://github.com/jo-inc/camofox-browser
- https://github.com/jo-inc/camofox-browser/blob/master/LICENSE
- https://github.com/jo-inc/camofox-browser/blob/master/README.md

Initial source evidence:
- Repository describes a stealth/headless browser server for AI agents, based on Camoufox (a Firefox fork) and exposes browser automation through a server interface.
- Root licence is MIT (verify the exact pinned commit and all transitive/browser-engine licences before any reuse).
- README describes isolated browser contexts/session groups, inactivity expiry, tab lifecycle management and a security model with centralised process environment access.
- Its advertised anti-detection and Cloudflare/bot-detection bypass positioning creates a material policy and compliance risk. AEGIS must not use stealth features to evade access controls, rate limits, bot protections, CAPTCHAs, account restrictions or website terms.

AEGIS decision: **study/adapt patterns; do not adopt as a trusted browser authority**.

Potential reusable ideas:
- Explicit browser session and tab identity.
- Per-task isolated contexts and deterministic session expiry.
- Structured page snapshots and bounded extraction.
- Browser-worker process separated from AEGIS control plane.
- Auditable navigation/action receipts and owner-visible session takeover.

Required AEGIS boundary:
- Sentinel authorises every action against an exact task, origin, resource and operation.
- Fixed egress allowlist, DNS/IP resolution checks, redirect revalidation, SSRF protection, request/time/response budgets and download quarantine.
- No raw CDP, arbitrary JavaScript evaluation, cookie/token extraction or ambient host filesystem access exposed to an agent.
- Treat page content, accessibility trees, screenshots and downloads as untrusted evidence, never instructions.
- Do not persist authenticated sessions by default. If an owner explicitly enables persistence, encrypt session material in the Vault, scope it to the owner and task, apply expiry and provide revocation.
- Respect site terms, robots policies, access controls and applicable privacy/data-protection law. Prefer documented APIs and permitted retrieval over scraping.

## Presentation Intelligence

### SlidePoise

Sources:
- https://github.com/henryhyw/slidepoise
- https://slidepoise.github.io/

Initial source evidence:
- Repository reports MIT licensing.
- Agentic pipeline: audience/purpose/source-based content plan; visual reference selection; image-guided slide design; reconstruction into editable PowerPoint objects; render-and-review loop.
- Describes semantic reconstruction of charts, tables, text and shapes, with chart data retained and editable.
- Local toolchain includes Python/OpenCV/Pillow/NumPy/python-pptx and Node/PptxGenJS/JSZip; it expects an agent able to run local commands and inspect images.

AEGIS decision: **high-value architecture reference; prototype only after runtime and toolchain fit are measured**.

Potential AEGIS-native capabilities:
- Evidence-linked slide plans and claims.
- Editable PPTX generation rather than flattened slide images.
- Semantic chart/table reconstruction with links to original data.
- Rendered-slide visual QA and correction loop.
- Reusable style profiles and asset libraries with attribution/provenance.

Constraints:
- Do not make image-generation APIs, Codex, a paid model or a local desktop runtime mandatory.
- Separate the content/evidence compiler from replaceable rendering and design engines.
- Keep user-supplied brand assets and reference decks scoped to their owner/project and honour their licences.
- Do not use image generation as a substitute for editable charts, tables, text or source data.

### Presenton

Sources:
- https://github.com/presenton/presenton
- https://github.com/presenton/presenton/blob/main/README.md

Initial source evidence:
- Repository describes an open-source presentation generator/API with editable PPTX, PDF and PNG output, prompt/document input, design/template import and self-hosted deployment.
- Repository reports Apache-2.0 licensing. Verify exact revision, dependency licences and optional provider terms before reuse.
- Supports a choice of hosted model providers and local model interfaces; local operation still depends on hardware and model availability.

AEGIS decision: **high-priority optional rendering/editor reference; no mandatory dependency**.

Potential reusable ideas:
- Document-to-presentation intake.
- Editable deck export and user-controlled template application.
- A local/self-hosted deployment profile.
- Presentation generation API contract and editor workflow.

Constraints:
- Verify whether fully local generation works without remote fonts, assets, telemetry or provider calls.
- Do not store provider API keys in presentation documents, browser state or generated files.
- AEGIS must retain a provider-neutral content plan and a canonical editable output format.

### Presentation Studio target architecture

Build one AEGIS-owned Presentation Intelligence capability with replaceable renderers:
1. Collect user brief, audience, objective, style and source materials.
2. Extract facts and claims with citations and provenance.
3. Build a slide-by-slide narrative plan and data map.
4. Generate editable slide objects and charts from verified data.
5. Render and inspect each slide for overflow, contrast, readability, layout and factual consistency.
6. Preserve source references, assets, fonts and licence notices.
7. Let the owner revise, approve and export PPTX/PDF/HTML.

A generated deck is a presentation of evidence, not evidence itself. No unsupported claim or invented figure may be introduced to improve visual storytelling.

## Business intelligence, prospecting and sales automation

User-supplied labels requiring exact project/product identification:
- AI Data Analyst Agent
- Agentic RAG
- "Geni SaaS product" (identity unresolved; clarify exact spelling/URL before attributing capabilities)
- LLM fine-tuning
- LeadHunt
- Google Maps leads scraper
- LeadForge
- Open Prospector
- Harvey
- Twenty CRM
- Quote Agent
- Lead Gen Agent
- Speed-to-Lead Agent
- Follow-up Agent
- Backend Operations
- Proposal Agent
- Marketing Agent

Do not conflate similarly named tools or invent repository identities. Obtain exact URLs/owners for LeadHunt, LeadForge, Open Prospector and Geni SaaS before licence or code review.

### AEGIS-native capability composition

Prefer one governed Business Operations workspace with specialist workflows over a fleet of independent agents:

- **Data Analyst:** schema-aware data profiling, deterministic SQL/DuckDB/Pandas calculations, anomaly detection, charting and reproducible reports. The model explains computed results; it does not invent calculations.
- **Agentic RAG:** source-aware retrieval, query planning, evidence comparison, citation checking, conflict detection and explicit uncertainty.
- **Prospect Research:** discover organisations from permitted sources; capture source URL, timestamp, terms, collection purpose and confidence; deduplicate and qualify with explainable criteria.
- **CRM:** people, organisations, opportunities, consent/preferences, interactions, notes, tasks and lifecycle. Keep owner/project tenancy and export/delete controls.
- **Speed-to-Lead:** classify incoming enquiries, prioritise and alert; draft a response. Sending requires appropriate owner authority.
- **Follow-up:** task reminders and draft follow-ups based on actual interaction history; enforce suppression and contact preferences.
- **Quotes:** calculate from approved price lists, taxes, discounts and terms using deterministic rules; require approval for price/contract exceptions.
- **Proposals:** assemble editable documents from approved templates, source-backed facts and validated quote data.
- **Marketing:** plan and draft content, segment audiences using permitted data, check claims and produce performance analysis; outbound publication requires approval.
- **Backend Operations:** synchronise authorised records, reconcile discrepancies, maintain audit and report workflow health. No silent destructive changes.

### Candidate: Twenty CRM

Source:
- https://github.com/twentyhq/twenty

Initial review direction:
- Treat as a CRM data-model, UI and workflow reference.
- Verify exact current licence for the pinned revision and each component before copying or embedding; do not assume all components share one licence.
- Evaluate tenancy, schema extensibility, API, import/export, data deletion, automation, audit and deployment footprint.
- Prefer a provider-neutral CRM adapter or a small AEGIS-native relationship model over making a third-party CRM the authority for identity or permissions.

### Google Maps and lead collection

A "Google Maps leads scraper" is not an approved AEGIS implementation target. Google Maps Platform terms restrict scraping and extraction of Maps content. Do not build stealth scraping or bypass bot protections.

Safer alternatives to evaluate:
- Official Google Maps Platform APIs, subject to current product terms, billing and storage restrictions.
- Business websites and public registers where collection and reuse are permitted.
- Licensed business-data providers with documented provenance, purpose and deletion terms.
- Owner-supplied CRM/contact lists with explicit source and lawful-basis metadata.

UK privacy/marketing safeguards:
- Publicly visible business contact details may still be personal data.
- Apply UK GDPR and PECR as appropriate; record purpose, lawful basis, source, retention and objections.
- Maintain suppression/do-not-contact lists and communication preferences.
- Do not assume a generic legitimate-interests label authorises every B2B message.
- Require human approval for outbound campaigns and provide deletion/correction workflows.

## LLM fine-tuning

Research separately from inference and retrieval. Evaluate local fine-tuning toolchains such as Unsloth, Axolotl and LLaMA-Factory only after:
- The base model's licence and fine-tune redistribution terms are verified.
- Training data rights, consent, provenance and sensitive-data controls are established.
- A held-out evaluation set and baseline are defined.
- Hardware, time, storage and energy costs are measured.
- Fine-tuning demonstrates a measurable improvement over prompt design, retrieval, tool use or model routing.

No model should be fine-tuned on private user or project data by default. Training is an opt-in, separately scoped workflow with deletion and dataset lineage.

## Implementation order

1. Finish the current Forge parser REA and correctness work; keep it isolated until full tests, Workers/WASM compatibility and performance budgets pass.
2. Build the evidence/provenance foundation for agentic RAG and data analysis.
3. Define the provider-neutral browser worker contract and Sentinel enforcement before any Camofox trial.
4. Prototype presentation generation behind a renderer adapter; compare SlidePoise and Presenton on editable output, local operation, quality and resource use.
5. Design the native Business Operations data model and workflows; evaluate Twenty as a replaceable CRM adapter.
6. Research named lead/prospecting products only after exact identities are supplied.
7. Evaluate fine-tuning only when measured task gaps justify it.

## Global acceptance gates

- Pinned source revision, inspected licence and dependency inventory.
- Reproducible tests and benchmark baseline.
- No execution of untrusted source in the control plane.
- Explicit task, resource and egress boundaries.
- Sentinel approval for every external-impact action.
- Owner-visible audit receipts, cancellation and rollback.
- No mandatory paid APIs, hosted services or subscriptions.
- No merge, production deployment, account connection or external communication without explicit owner approval.
