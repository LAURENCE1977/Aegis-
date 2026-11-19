# Agent runtime and local inference ecosystem review — 2026-11-19

**Purpose:** Record current upstream evidence for possible AEGIS/ODIN capability adaptations. This is a source-review note, not an integration or endorsement.

## Candidate findings

| Upstream | Current evidence | Useful AEGIS pattern | Constraints and disposition |
|---|---|---|---|
| [Open Interpreter](https://github.com/openinterpreter/openinterpreter) | Current repository is a Rust reimplementation/fork of the Codex harness, updated 2026-11-15; Apache-2.0. It documents OpenAI-compatible providers, selectable harnesses, ACP, MCP, shared `.agents/skills` and `AGENTS.md`, local state, and sandbox/approval controls. | High-value architecture reference for provider-neutral coding-agent harnesses, ACP interoperability, portable skill directories and explicit sandbox/approval contracts. | Do not embed its command-execution runtime in the hosted AEGIS worker. Review the sandbox and approval implementation separately before any code reuse. Original Python project is now a community-maintained fork, so do not confuse it with the current Rust repository. |
| [LocalAI](https://github.com/mudler/LocalAI) | Active Go project; MIT; OpenAI- and Anthropic-compatible APIs, local model backends, MCP, chat/files/projects, speech and multimodal capabilities. Repository metadata showed active updates on 2026-11-19. | Strong candidate for a future optional self-hosted inference adapter. Preserve AEGIS's existing OpenAI-compatible provider contract and add LocalAI as a separately configured endpoint, rather than making it a required dependency. Useful patterns include backend capability discovery and local model lifecycle management. | Not a free cloud inference service: compute, storage, electricity and model downloads remain the operator's responsibility. Current desktop app is documented for macOS/Linux, and local server hosting is not suitable for direct execution on the user's iPad Air. Treat as a future mini-PC/Linux-host option; test memory/CPU/GPU requirements and endpoint authentication before enabling. Model weights, backends and add-ons can have their own licences. |
| [Scrapy](https://github.com/scrapy/scrapy) | Mature Python crawler; BSD-3-Clause; current upstream README describes structured web crawling and Python 3.11+. | Useful reference or optional isolated ingestion worker for approved public-source research, source metadata extraction and repeatable crawling pipelines. Keep source URL, retrieval time, content digest, licence/terms status and provenance with every record. | Do not add it to the Cloudflare request path or execute arbitrary spider code. A crawler needs explicit domain allowlists, robots/terms policy, request budgets, SSRF protections, bounded downloads and human review. A Python worker is a separate deployment/runtime decision. |
| [OpenHands Agent Canvas](https://github.com/OpenHands/OpenHands) | Current repository describes a self-hosted developer control centre supporting multiple local/remote/cloud agent backends and ACP-compatible agents; MIT. README explicitly warns that running without a sandbox gives the agent full filesystem access. | Useful reference for a unified multi-backend agent workspace, ACP adapters, durable automation scheduling and separating the control surface from execution backends. | Do not adopt its full stack or grant filesystem access. Docker/VM isolation, secrets handling, session authentication and backend hardening would need independent verification. Prefer extracting interface/adapter concepts over introducing a second orchestrator. |

## AEGIS/ODIN decisions

1. Keep AEGIS as the canonical project and integrate ODIN's intended capabilities into the existing workspace; do not create a parallel product or duplicate orchestration core.
2. Keep the provider gateway vendor-neutral. LocalAI should be a future optional OpenAI-compatible endpoint, not a mandatory install and not a reason to change the existing Cloudflare Workers AI default.
3. Use ACP/MCP and shared skill conventions as interoperability boundaries. AEGIS Sentinel remains the only authority for grants, approvals and execution; upstream agent frameworks do not inherit AEGIS permissions.
4. Keep all code execution in an isolated, explicitly authorised worker. No shell, filesystem, crawler, browser or external-network capability is enabled merely because an upstream project supports it.
5. Keep the browser/PWA usable without local inference. The user's iPad Air and iPhone remain clients; heavy local inference belongs on a separately provisioned host, if chosen later.
6. No source code, package, binary, model, backend, add-on or external service was installed or copied as part of this review.

## Verification still required before implementation

- Inspect exact upstream sandbox, permission, protocol and provider adapter code at a pinned commit.
- Confirm transitive dependency and model/backend licensing separately from repository-level licences.
- Threat-model local endpoint authentication, network exposure, SSRF, file access, resource exhaustion and supply-chain updates.
- Prototype the LocalAI endpoint only behind the existing provider interface and explicit operator configuration.
- Prototype crawler ingestion only in an isolated worker with strict egress and per-domain policy.


## Review of the user's own GitHub repositories

The connected GitHub account exposed nine owned repositories in the current inventory. Four were selected for relevance to browser control, agent orchestration and reusable skills. This was a read-only review; no code was copied or installed.

### [auto-browser](https://github.com/LAURENCE1977/auto-browser) — best direct browser-tool candidate, with significant isolation caveats

- The repository has an MIT licence file. Its README describes a Playwright browser controller exposed through REST/MCP, human takeover, saved auth profiles, and an isolated browser-container mode.
- The implementation has useful separations: controller API, browser-node service, approval store, auth policy, per-session browser profiles, and tests. The session path calls `browser.new_context()` per session; stored auth state is copied into the context rather than shared by reference.
- The security posture is not something to inherit blindly. The published `docker-compose.isolation.yml` mounts `/var/run/docker.sock` into the controller. The controller then creates per-session browser containers through that daemon. The current `session_isolation.py` container launch applies memory/PID/optional CPU limits, but the reviewed launch arguments do not set a read-only root filesystem, drop Linux capabilities, set `no-new-privileges`, or specify a non-root user. The browser-node Dockerfile also does not set a `USER`, so the image's browser processes run as the image's default root user. This is a substantial host-trust boundary: compromise of the controller with Docker-socket access can become host-level control. It is not equivalent to a hardened, unprivileged sandbox.
- The repository's own `SECURITY.md` records two published advisories: raw CDP `Runtime.evaluate` exposure and an unauthenticated Codespaces API overlay (reported fixed in 1.6.1), plus safety controls that reported success while not functioning (fixed in 1.5.1/1.5.3). The August 2026 execution audit documents several silent no-op controls and gaps in the then-shipped Docker test runner. The current version file reports 1.7.0; fixes and regression tests exist, but these historical failures make independent end-to-end verification mandatory.
- The default isolation mode in config is `shared_browser_node`; `docker_ephemeral` is optional. The repo's own isolation audit acknowledges shared browser-process and takeover-surface risks in shared mode.
- **AEGIS decision:** reuse the API/MCP adapter boundary, per-session state model, explicit human-takeover workflow, and test ideas as references. Do not embed the controller or connect its Docker socket to the AEGIS Cloudflare worker. Any future browser execution must run in a separately hardened worker/host with a narrow broker API, short-lived scoped credentials, network egress controls, and AEGIS Sentinel approvals. Do not advertise the upstream container mode as a secure sandbox until the host-level Docker trust and container hardening are addressed.

### [G0DM0D3](https://github.com/LAURENCE1977/G0DM0D3) — useful evaluation ideas, not production code to transplant

- The repository has an AGPL-3.0 licence. Its README describes model comparison/racing, OpenAI-compatible/local provider support, prompt-variation experiments and a separate API/data-publishing path.
- Potential learning value: model-evaluation harnesses, comparative scoring and controlled adversarial prompt test cases.
- The README describes optional telemetry and dataset publishing, including a path that should not be assumed to scrub sensitive content. Keep real user prompts, secrets and private workspace data out of that path.
- **AEGIS decision:** study the evaluation concepts and write independent tests. Do not copy or link AGPL code into the AEGIS service without a deliberate licence/compliance review. Do not use model-vote scores as a security or approval decision.

### [openclaw](https://github.com/LAURENCE1977/openclaw) — architecture reference only pending licence/provenance checks

- The README describes a large self-hosted assistant gateway with channel/provider adapters, plugins and tools; it also warns that host-side tool execution needs sandboxing.
- GitHub repository metadata reports the licence as `NOASSERTION`, even though the README claims MIT and a LICENSE file exists. The repository is a fork; confirm the exact upstream revision, all notices and the full dependency licence inventory before any reuse.
- **AEGIS decision:** study control-plane/provider/channel separation and untrusted-message handling. Do not import the runtime or its host execution model; AEGIS Sentinel must remain the single permission and approval authority.

### [charlieautomatesskills](https://github.com/LAURENCE1977/charlieautomatesskills) — selectively useful workflow templates

- The README describes collections of agent skill/command instructions for planning, project workflows, worktrees, Remotion and LinkedIn automation.
- The repository has no root LICENSE file detectable through GitHub's licence endpoint. Treat its content as all-rights-reserved until the owner adds/clarifies a licence. Review each skill's scripts, tool permissions and outbound data flows before use.
- **AEGIS decision:** use as inspiration for independently authored task-planning and verification workflows. Do not copy or install the collection globally; exclude outbound social automation from unattended execution.

## Updated integration priority from this review

1. **Browser tools:** design an AEGIS-native broker contract first. Browser sessions are isolated execution resources; all navigation, downloads, uploads, authenticated actions and takeover requests go through Sentinel capability checks and auditable approvals. No Docker socket in the Cloudflare control plane.
2. **Model evaluation:** build a provider-neutral, data-minimising evaluation harness using AEGIS's own fixtures. Treat external model outputs as untrusted evidence, not policy decisions.
3. **Agent skills:** establish a signed/allowlisted skill manifest with source, licence, hash, permissions, network requirements, review status and human approval before execution. Keep user data local to the workspace unless explicitly authorised.
4. **OpenClaw-like gateway patterns:** only adapt narrow interfaces; avoid a second orchestration core or competing permission model.
