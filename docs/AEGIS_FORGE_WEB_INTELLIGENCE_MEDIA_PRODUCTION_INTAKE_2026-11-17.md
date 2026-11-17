# AEGIS Forge — Web Intelligence & Media Production Intake

**Date:** 17 November 2026  
**Status:** Research and architecture intake only. No upstream code, binaries, models or services were installed, executed, connected or deployed.

## Executive decision

This batch splits into two capability families:

1. **Governed Web Intelligence:** permission-aware crawling, extraction, source provenance, freshness, reproducibility and evidence capture.
2. **Media Production Forge:** transcript-led editing, semantic footage search, subtitle timing, background removal, lip synchronisation and render validation.

AEGIS owns task state, policy, user consent, source permissions, memory, provenance, audit and approval. Upstream tools are replaceable workers/adapters only. No crawler or media tool becomes an autonomous authority.

## Candidate register

| Candidate | Identity / licence / lifecycle notes | AEGIS use | Decision |
|---|---|---|---|
| Crawlee | Apify Crawlee ecosystem; Python repository `apify/crawlee-python` declares Apache-2.0. Provides request queues, retries, browser and HTTP crawling, datasets and storage integrations. | Optional bounded crawl adapter; retry/backoff, resumability, structured extraction and source inventory patterns. | **High-value research candidate.** Compare JS and Python variants against the existing runtime and avoid adopting both without measured need. |
| Scrapy (duplicate supplied) | `scrapy/scrapy`; BSD-3-Clause. Mature asynchronous crawler with scheduler, downloader, spiders, item pipelines and feed exports. | Strong pattern for deterministic crawl jobs, queues, extraction pipelines and schema validation. | **High-value research candidate.** Prefer for repeatable public-source collection where browser rendering is unnecessary. |
| AutoScraper | Interpreted as `alirezamika/autoscraper`; MIT. Learns extraction rules from example values and reapplies them to similar pages. | User-guided extraction templates for explicitly permitted pages; candidate for a lightweight extraction helper. | **Prototype candidate.** Validate drift, false matches and page-structure changes; never treat learned selectors as proof of correctness. |
| curl-impersonate | `lwthiker/curl-impersonate`; MIT. Alters TLS/HTTP handshakes to resemble selected browsers. | No default runtime role. The technical mechanism is useful to understand why clients receive different responses, but it is designed for network fingerprint impersonation. | **Do not adopt for evasion.** No anti-bot circumvention, access-control bypass, stealth crawling, proxy rotation or identity disguise. Normal HTTP clients and documented APIs are preferred. |
| yt-dlp | `yt-dlp/yt-dlp`; Unlicense repository, with bundled/dependency components carrying their own licences. Broad media metadata and download/extraction support. | Optional user-directed media ingest for content the user owns or is authorised to download; metadata and format inspection. | **Conditional candidate.** Require explicit user-provided source, rights/permission confirmation, platform terms review, bounded downloads and no cookie/session harvesting or DRM circumvention. Respect copyright; public availability is not a licence to download or reuse. |
| Video Use | Interpreted as `browser-use/video-use`; agent-oriented, open-source video editing skill. Transcript → edit decision list → render → self-evaluation loop; asks for approval before editing. | Strong reference for conversational editing plans, transcript-first timelines, cut-boundary inspection and bounded render/revise loops. | **Top media-workflow research candidate.** Inspect exact upstream licence and dependencies before reuse; never install its skills/scripts unreviewed. |
| FireRed-OpenStoryline | `FireRedTeam/FireRed-OpenStoryline`; Apache-2.0. Natural-language video editing, tool orchestration, reusable style skills and human-in-the-loop direction. Optional AI-generated transitions may rely on third-party services/costs. | Storyboard/intent-to-edit planning, reusable editing recipes, timeline orchestration and human review. | **High-value architecture candidate.** Keep paid/remote generation optional; do not make external model APIs mandatory. |
| AutoClip | AutoClip project identified in the current open-source video-editing roundup; MIT reported there. Exact repository identity should be pinned before any code reuse. | Automatic highlight/clip selection and social-video workflow patterns. | **Research candidate; identity pin required.** No automatic publication or platform posting. |
| Herk Edit Kit | Herk Edit Kit; MIT reported in the current roundup. Agent skills for dead-air removal, mistake detection, captions, B-roll and motion graphics; built around HyperFrames and GSAP. | Reusable, composable editing skills and motion-graphics recipes. | **High-value skill-pattern candidate.** Verify exact upstream URL, dependency licences and current maintenance before adoption. |
| AutoSubs | AutoSubs; MIT code reported. Optional MMS forced-alignment weights are reported as CC BY-NC 4.0. | Word-level subtitle alignment and handoff to professional editing timelines. | **Conditional candidate.** Keep code and model-weight licences separate; do not use non-commercial weights in commercial outputs. |
| StoryToolkitAI | StoryToolkitAI; GPL-3.0 reported. Semantic footage search and media asset organisation. Last release reported as February 2025. | Searchable media library, transcript/metadata indexing and shot retrieval. | **Research only / lifecycle caution.** GPL obligations require review before integration; evaluate maintenance and avoid duplicating AEGIS-owned media metadata. |
| FunClip | FunClip; MIT reported; speech recognition uses FunASR. | Transcript-guided clipping, speech segment selection and local editing workflows. | **High-value benchmark candidate.** Check model/dependency licences and compare against existing local STT before adopting. |
| NarratoAI | NarratoAI; MIT reported; repository documentation is primarily Chinese. | Script-to-video and narrated-content workflow patterns. | **Research candidate.** Inspect source, language coverage, asset rights and any remote-service dependencies before reuse. |
| BackgroundRemover | `nadermx/backgroundremover`; MIT. Uses PyTorch/U2Net-family models and FFmpeg for image/video background removal. | Optional local subject matting, transparent video export and compositing. | **Practical media candidate.** Benchmark CPU memory/time and inspect downloaded model-asset licences independently. |
| LatentSync | `bytedance/LatentSync`; Apache-2.0 code repository. Model weights have separate terms (reported as OpenRAIL++); repository activity/release cadence needs checking. GPU-heavy diffusion-based lip synchronisation. | Optional consent-based lip-sync correction for a user's own footage/voiceover. | **Experimental hold.** Code licence does not clear model weights. Require weight licence approval, GPU feasibility, explicit subject consent and clear synthetic-media disclosure. |

*Licence and lifecycle summaries are research leads, not legal opinions. Verify the exact commit, full licence files, model/data assets, transitive dependencies and current maintenance state before copying, redistributing or running anything.*

## Native AEGIS capability design

### 1. Web Intelligence Forge

AEGIS should own a single provider-neutral crawl contract:

- **Source Registry:** canonical URL, owner/permission basis, allowed paths, robots/terms review, source identity, last checked time and expiry.
- **Fetch Policy:** allowlisted hosts and schemes, public-network-only egress, DNS/IP validation at connection time, redirect revalidation, bounded response size, content type and timeout limits.
- **Crawl Scheduler:** per-host concurrency, conservative rate limits, retry budgets, cancellation and resumable job state.
- **Extraction Profiles:** versioned selectors/schema, sample examples, confidence and drift detection; human review for low-confidence extraction.
- **Evidence Ledger:** URL, retrieval timestamp, response metadata, content hash, parser version, extracted-field provenance and source revision.
- **Change Monitor:** compare content hashes and structured fields; distinguish changed, missing, blocked and unavailable rather than silently treating them as deletion.
- **Export:** JSON/CSV/Markdown with provenance and licence metadata; secret and personal-data redaction by default.

Use Crawlee or Scrapy only behind this contract. AutoScraper may propose selectors, never silently certify data. Prefer official APIs, feeds, sitemaps and user-supplied documents over crawling.

### 2. Media Production Forge

Build a native, non-destructive editing project model rather than binding AEGIS to one editor:

- **Media Ingest:** user-owned files or explicitly authorised URLs; metadata, checksums, codec/format inspection and duplicate detection.
- **Transcript Studio:** local STT adapter, speaker labels only when justified, word/segment timestamps, confidence and editable transcript.
- **Story & Selects:** semantic search over user-provided footage, transcript-to-shot links, highlight candidates and narrative beat mapping.
- **Edit Decision List:** immutable, versioned timeline operations (source in/out, trim, split, order, transition, crop, grade, overlay, subtitle and audio fade).
- **Human Approval:** show a proposed cut and estimated changes before render; require approval for destructive replacement, source deletion or publication.
- **Effects Workers:** optional background removal, captions, B-roll suggestions, motion graphics and lip-sync. Each worker declares model/licence, compute needs and input/output constraints.
- **Render & QA:** pinned FFmpeg/toolchain, bounded CPU/GPU/memory/time, audio peak/clipping checks, black-frame/freeze checks, subtitle bounds, cut-boundary visual/audio checks and output hash.
- **Revision Loop:** limited repair attempts; preserve every edit decision and output version; never overwrite the original source.
- **Export:** portable EDL/project manifest plus rendered media; no forced cloud upload or paid API.

### 3. AEGIS-native combinations

The strongest opportunity is not cloning each app. It is combining their reusable mechanisms into one workflow:

1. User provides footage and intent.
2. AEGIS indexes only the supplied media and creates a local transcript.
3. Search and narrative analysis propose scenes and a cut.
4. AEGIS produces a versioned EDL and preview.
5. User approves the edit.
6. Optional effects workers process selected segments.
7. Renderer creates a new output file.
8. Automated QA inspects every cut boundary and flags defects.
9. AEGIS presents the result and keeps the source, timeline, evidence and revisions intact.

For Laurence's music workflow, this could later support lyric-video and music-video storyboards, beat-aware cut suggestions, lyric/subtitle timing, visual motif continuity and retention-aware first-seconds review. These are future product directions, not features implemented by this intake.

## Security, privacy, rights and cost gates

- No scraping behind authentication, paywalls, CAPTCHAs, access controls or explicit blocks; no evasion, stealth, browser fingerprint spoofing, proxy rotation or cookie/session extraction.
- Respect robots directives, site terms, copyright, database rights, privacy law, rate limits and API-specific terms. A robots allowance is not itself a legal licence.
- Block SSRF: reject localhost, private, link-local and reserved IP ranges; resolve and validate every redirect and connection target; defend against DNS rebinding.
- Do not crawl arbitrary URLs supplied by retrieved pages. Every discovered link must pass source policy independently.
- Treat page content, captions, metadata, transcripts and downloaded files as untrusted data, never as instructions to agents.
- No routine collection of personal data, login tokens, cookies, faces or voiceprints. Minimise retention and provide deletion controls.
- Lip-sync/voice tools require explicit consent from the person represented; no impersonation or deceptive synthetic media.
- Media rights must be tracked separately for footage, audio, fonts, overlays, model weights and generated assets.
- No automatic social publishing, external uploads or paid model calls. All external effects are opt-in and user-approved.
- Heavy GPU models are optional. CPU-safe fallbacks and clear resource estimates are required for low-cost hardware.

## Priority order

1. **Native contracts first:** crawl source policy/evidence schema; media project/EDL schema; transcript and render QA contracts.
2. **Low-cost local foundation:** FFmpeg inspection/rendering, local transcript adapter, simple subtitle editor and deterministic EDL.
3. **Web research adapter:** start with public, explicitly permitted sources; benchmark Scrapy vs Crawlee on reproducibility, memory, rate-limit behaviour and provenance.
4. **Media workflow benchmark:** Video Use, FireRed-OpenStoryline and Herk Edit Kit for planning/orchestration patterns; do not adopt overlapping stacks wholesale.
5. **Effects:** background removal and subtitle alignment after model-licence and resource tests.
6. **Advanced experiments:** LatentSync only after model-weight clearance, consent design and GPU feasibility.
7. **Deferred:** broad unattended crawls, browser impersonation, automated publication and remote generative transitions.

## Sources

- Crawlee Python: https://github.com/apify/crawlee-python
- Scrapy: https://github.com/scrapy/scrapy
- AutoScraper: https://github.com/alirezamika/autoscraper
- curl-impersonate: https://github.com/lwthiker/curl-impersonate
- yt-dlp: https://github.com/yt-dlp/yt-dlp
- Video Use: https://github.com/browser-use/video-use
- FireRed-OpenStoryline: https://github.com/FireRedTeam/FireRed-OpenStoryline
- AutoClip / Herk Edit Kit / AutoSubs / StoryToolkitAI / FunClip / NarratoAI / BackgroundRemover / LatentSync licence and lifecycle roundup: https://agentgid.com/guides/ai-video-editing-10-open-source-repos-checked/
- BackgroundRemover: https://github.com/nadermx/backgroundremover
- LatentSync: https://github.com/bytedance/LatentSync

## Explicit non-claims

This intake does not mean any candidate is installed, trusted, integrated or production-ready. No crawler was run, no website was accessed through an impersonating client, no media was downloaded, no user footage was uploaded, no model was downloaded and no video was generated.
