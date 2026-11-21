# AEGIS INFINITY Mass Audit — Supplementary Findings

Reviewed: 2026-11-21. This supplements docs/AEGIS_MASS_EXPERIMENTAL_AUDIT.md and docs/AEGIS_MASS_SANDBOX_FINDINGS.md.

## ANOLISA Linux sandbox: additional call-path review

Inspected:
- src/agent-sec-core/linux-sandbox/README.md
- src/agent-sec-core/linux-sandbox/src/policy.rs
- src/agent-sec-core/linux-sandbox/src/bwrap_args.rs
- src/agent-sec-core/linux-sandbox/src/seccomp.rs
- src/agent-sec-core/linux-sandbox/src/runtime.rs
- src/agent-sec-core/linux-sandbox/src/cli.rs
- strict_runtime.rs and bwrap_seccomp.rs tests

Source-backed positive controls:
- Filesystem policy defaults to Restricted with root read-only; write access is granted through explicit entries.
- NetworkSandboxPolicy defaults to Restricted.
- CLI maps Restricted to Bubblewrap network namespace isolation, Enabled to full network access, and proxy-routed mode to proxy-only network namespace.
- Seccomp blocks ptrace and io_uring syscalls; restricted network mode denies network-related syscalls while allowing AF_UNIX sockets for local IPC.
- no_new_privs is set when the relevant seccomp restrictions are installed.
- Bubblewrap builds a filesystem view with read-only defaults and explicit writable roots; it uses fresh user and PID namespaces in the relevant command construction paths.
- The runtime uses a parent-death signal and checks inherited file descriptors before spawning the child.
- A dedicated strict runtime test suite exists, along with filesystem/network/seccomp tests.

Important qualification:
- BwrapOptions::default() itself specifies FullAccess networking. The inspected normal CLI path does not simply rely on that default: it derives BwrapNetworkMode from the explicit NetworkSandboxPolicy and constructs BwrapOptions with that value. This is a good example of why the actual call path must be traced instead of judging one helper in isolation.
- strict_runtime.rs tests are gated behind ASC_SANDBOX_INTEGRATION; without that environment variable the test returns without exercising the runtime. bwrap tests can also skip when host prerequisites are unavailable. CI evidence must show the dedicated Linux integration job actually ran these tests rather than merely compiling or skipping them.
- README demonstration commands are project documentation, not independent evidence of successful execution in our environment.
- This review did not execute the crate, fuzz it, or attempt sandbox escapes.

**Updated verdict:** ANOLISA's Linux sandbox is the strongest technical reference found so far for AEGIS's real runner. Before adopting, inspect the complete mount/path validation and seccomp filter, pin its commit, run its dedicated Linux integration suite in an isolated CI runner, and perform independent adversarial tests. Do not import the full monorepo.

## Additional previously supplied or researched candidates to retain

### Agent and engineering workflow
- OpenHarness (previously assumed as autonomous-ai/openharness) — remote agent workspace/daemon candidate; pin exact repository identity before review.
- Harness.io — CI/CD governance and release-control reference; distinct from OpenHarness.
- Mercury Agent — previously evaluated agent framework candidate; use existing AEGIS research PR/source register.
- Addy Osmani agent skills — workflow/engineering guidance, not a runtime sandbox.
- Agent S — computer-use integration candidate, previously evaluated in PR #125.
- Xiryn — local-first multi-agent runtime candidate, previously evaluated in PR #18.
- mcptoon — MCP/cross-agent tool management candidate, previously evaluated in PR #20.
- CoreDeck — optional Android QA candidate, previously evaluated in PR #15.
- T3 Code — optional text-to-CAD/code design candidate, previously evaluated in PR #110.
- DevToys — developer utility reference, previously evaluated in PR #19.
- Composio and NetSuite SuiteSkills — integration/tool orchestration candidates; preserve existing audit lineage and Sentinel preflight work.
- Hedwig — user-supplied repository name; exact owner/repository still needs confirmation.
- Rediiwm — spelling/identity unresolved; do not guess.

### Additional memory and Hermes UI projects
- nesquena/hermes-webui — browser/mobile-friendly Hermes workspace UI.
- JPeetz/Hermes-Studio — self-hosted agent crew/workflow/approval dashboard.
- humanitylabs-org/HermesUI — Hermes WebUI-oriented frontend.
- These are separate projects; don't conflate them with outsourc-e/hermes-workspace. Inspect each source independently before adopting.

### Additional research, search and document systems
- Tracer-Cloud/OpenSRE — AI SRE incident/CI investigation.
- swapnildahiphale/OpenSRE — separate incident-memory/knowledge-graph project.
- AJakif/Rag-chatbot — simple RAG example, lower priority than RAG-Anything and FutureSmart.
- Vercel AI SDK / AI SDK UI — provider-neutral model/tool/streaming reference; framework and Cloudflare compatibility must be checked.
- Dev.to, Stack Overflow and Frontend Mentor — research/benchmark sources, not installable AEGIS runtime dependencies.
- v0 — UI prototyping tool; not a runtime dependency.
- Blackbox AI — external coding-agent platform; requires security/API/cost review.
- BLA (previously assumed qybaihe/bla) — niche binary hardening candidate; exact identity and need to revalidate.

### Generic capability requests, not repository identities
- Autonomous AI agent
- RAG chatbot
- Multimodal content generator
- AI document intelligence and analysis
- Market research agent
- Generative AI pipeline
- Google AI Pro subscription

These are requirements/categories. They should be evaluated against specific projects and AEGIS's own acceptance criteria, not recorded as if each were a repository.

## Current mass-audit boundary

This audit currently combines:
1. historical desk research and repository discovery;
2. source-level inspection of selected high-priority repositories;
3. AEGIS branch/PR and code-path inspection.

It does **not** yet include:
- full pinned-commit inspection of every candidate;
- licence-text legal review of every candidate;
- complete SBOM/dependency/advisory analysis for every candidate;
- executing any candidate's build, tests, agents, scanners or tools;
- a live AEGIS sandbox runner or escape-resistance certification.

The next source inspection target is ANOLISA's path canonicalisation/mount preparation and seccomp filter completeness, followed by OpenBot's Kubernetes agent-sandbox provider and LoopForge's effective runtime profile/resource limits.
