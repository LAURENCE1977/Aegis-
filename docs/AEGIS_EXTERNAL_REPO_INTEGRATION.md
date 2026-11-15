# AEGIS external repository integration audit

**Reviewed:** 15 November 2026  
**Method:** Connected GitHub repositories, branches, licences, selected source files, architecture/security documents, AEGIS pull requests and CI were inspected through Composio. This is a selective reuse assessment, not blanket approval to import code.

## Decision summary

| Source | Revision / provenance | Licence | Decision |
|---|---|---|---|
| [LAURENCE1977/openclaw](https://github.com/LAURENCE1977/openclaw) | `c7d55ff617fb81b80679b199dead0089ec574911`; fork of `openclaw/openclaw` | Local `LICENSE` is MIT; GitHub fork metadata says `NOASSERTION`, upstream parent is MIT | Selectively adapt agent lifecycle, gateway/session boundaries, per-client capability checks, idempotency and tool-adapter patterns. Do not vendor the approximately 4.8 GB repository or import its runtime wholesale. Preserve upstream attribution. |
| [LAURENCE1977/auto-browser](https://github.com/LAURENCE1977/auto-browser) | `aa99c42bbb4e522f3d1e689ead1cf5407823aea4`; fork of `LvcidPsyche/auto-browser` | MIT confirmed | Strong browser-execution candidate. Its visual/structured/action planes, per-session isolation, human takeover, approval queue, signed Witness receipts, durable checkpoints and host allowlists complement AEGIS. Keep it as a separate MCP service, not the AEGIS policy authority. |
| [LAURENCE1977/G0DM0D3](https://github.com/LAURENCE1977/G0DM0D3) | `f6301765fb90eb7b336bdf365319cd2fe44b1187`; fork of `elder-plinius/G0DM0D3` | AGPL-3.0 confirmed | Architecture reference only. Do not copy or merge its code into AEGIS unless the project deliberately accepts AGPL obligations. Its local-model/OpenAI-compatible endpoint ideas may inform a separately licensed AEGIS Local Companion. |
| [LAURENCE1977/charlieautomatesskills](https://github.com/LAURENCE1977/charlieautomatesskills) | `70bf76759fbf5818be3bb1d5d1110a444157115e`; fork of `edpodelma/charlieautomatesskills` | No GitHub licence metadata and no root `LICENSE` file found | Do not copy skill source until rights are clarified. Workflow ideas can be independently reimplemented as AEGIS-native, versioned skills with provenance, tests and no implicit permissions. |
| [LAURENCE1977/storie-audio-lab-store-checker](https://github.com/LAURENCE1977/storie-audio-lab-store-checker) | Current `main` inspected 15 November 2026 | No repository licence, README, package manifest or tests found | Specialist music-tool candidate, but not a maintainable source project as-is: it contains a single compiled React 18.3.1 HTML artifact. It performs offline Web Audio analysis; no fetch/API calls or hard-coded credentials were detected. Rebuild it as a tested AEGIS music module rather than importing the minified bundle. Its claim that platforms skip quiet uploads is not a reliable general rule and must be corrected; distinguish playback loudness normalization from upload acceptance. |

## What each source contributes

### OpenClaw — agent runtime reference

Useful ideas include session-aware gateways, lifecycle ownership, dependency injection, capability separation, idempotent operation handling and explicit handling of timeouts/retries. AEGIS should reproduce only the patterns it needs in its existing Worker/D1/Queue architecture. The fork is very large; wholesale vendoring would add unnecessary runtime and maintenance weight.

### Auto Browser — separate browser execution service

The repository documents a local MCP endpoint at `http://127.0.0.1:8000/mcp`, along with visual, structured and action-oriented browser surfaces, per-session isolation, approval/human takeover, signed Witness receipts, durable checkpoints and production-hardening controls. That local endpoint is not directly reachable from a Cloudflare Worker. AEGIS needs either a local companion process or a securely authenticated remote endpoint before it can connect. Never expose a browser/noVNC control surface publicly without an access boundary. Browser navigation, clicks and typing are actions, not read-only source retrieval; writes and consequential actions must require explicit approval. No CAPTCHA bypass, stealth, proxy hopping or evasion.

### G0DM0D3 — local inference reference

Use its local-model endpoint concepts as design input only. A Cloudflare Worker cannot reach a user's localhost model server. Local inference belongs behind a separately deployed AEGIS Local Companion with an authenticated, narrow bridge and explicit model/provider configuration.

### Charlie Automates Skills — workflow reference

The skill collection may help identify useful development workflows, but the repository has no clear licence metadata or root licence file. Do not import its source. Independently author AEGIS-native skills with version, provenance, inputs, outputs, allowed capability IDs, evaluation tests and review state. A skill definition never grants a tool permission.

### Existing music lab — specialist module candidate

The repository is a single-file compiled React 18.3.1 artifact rather than a source-controlled React project. The app uses offline Web Audio analysis and supports common audio formats, but it has no package manifest, source modules, test suite or documented licence. Reconstruct it into maintainable modules with objective DSP tests. Correct the misleading claim that streaming platforms skip quiet uploads before any reuse; loudness normalization and upload acceptance are different concerns.

## Keep the AEGIS architecture boundaries clear

- **Agent Reach** is the read-only source-reach layer already specified in `AEGIS_AGENT_REACH_ADOPTION.md`: named source actions, fixed server-owned adapters, provenance and bounded retrieval.
- **Auto Browser** is a separate browser-execution plane. Do not confuse browser actions with read-only source retrieval.
- **Composio** was used here as a development-time GitHub connector to inspect repositories, branches, pull requests and CI and to commit fixes to existing feature branches. Composio is not currently connected to the AEGIS runtime. If added later, it must be an optional adapter behind the AEGIS capability registry and Sentinel; it must never become the source of AEGIS permissions.
- **OpenClaw** informs agent runtime/session architecture; **G0DM0D3** informs local inference; **Charlie skills** inform workflow design; the audio-lab artifact informs a future music-specialist module.

The current AEGIS MCP bridge is an inbound, read-only server surface. The MCP Forge catalogue validates source/licence/runtime/action metadata but is not yet a persistent outbound connector manager or MCP client. The agent capability bridge and D1 grant primitives are not yet connected to a trusted adapter executor; the durable agent queue remains plan-only. The current model provider supports hosted Workers AI and Alibaba Qwen, not a local OpenAI-compatible endpoint.

## Implementation sequence

1. Complete the existing stack in dependency order: PR #26 Free-Tier Ledger, PR #27 Native Memory, then PR #29 Durable Agent Orchestration. Keep the drafts until each fresh diff and CI run is reviewed.
2. Provision and bind non-production D1, apply the shared migrations once and validate real Queue/Cron recovery before enabling durable runtime behavior.
3. Finish owner-scoped connection metadata, encrypted secret-vault references, revocation and a concrete append-only invocation-audit writer. Never store raw credentials in D1, agent context or logs.
4. Implement a server-owned outbound MCP/adapter router behind Sentinel with exact-resource grants, approval consumption, hostname allowlists, DNS/private-address and redirect checks, deadlines, response-size limits, rate limits and idempotency.
5. Start with mock-server contract tests and public read-only source adapters from the Agent Reach plan. Add Auto Browser only after a secure reachable endpoint exists; begin with observation and require explicit approval for browser actions. Consider Composio as a replaceable provider only after the same controls exist.
6. Build local-model support through a separate AEGIS Local Companion, not by allowing a Cloudflare Worker to reach arbitrary localhost endpoints.
7. Rebuild the music tool from maintainable source with validated DSP/loudness guidance and regression tests.

No AGPL or unlicensed third-party source was copied into AEGIS during this review. No external runtime adapter was installed or enabled.

## Verified AEGIS branch snapshot — 15 November 2026

| PR | Branch relationship | Verified CI | Cloudflare Pages preview | State |
|---|---|---|---|---|
| [#27 Native Memory](https://github.com/LAURENCE1977/Aegis-/pull/27) | `feature/native-memory-substrate` on `feature/free-tier-ledger`; head `e7d30fba0e7ca9c61327f32301b1aef71b19ba47` | Node.js 22: **297 passed, 0 failed** | [Preview](https://6d86236b.aegis-6yk.pages.dev) · [Branch preview](https://feature-native-memory-substr.aegis-6yk.pages.dev) | Open, draft; stacked on PR #26 |
| [#29 Durable Agent Orchestration](https://github.com/LAURENCE1977/Aegis-/pull/29) | `feature/durable-agent-orchestrator-rebased` on `feature/native-memory-substrate`; head `1b5942a85c769444df22b703456ececea937ab05` | Node.js 22: **318 passed, 0 failed** | [Preview](https://1e3dab8c.aegis-6yk.pages.dev) · [Branch preview](https://feature-durable-agent-orches-mggu.aegis-6yk.pages.dev) | Open, draft; retargeted to current PR #27 head at review time |

Feature-branch regression fixes include Project Brief priority-preserving truncation and expiry filtering, a corrected durable-agent recovery test fixture, and corrected capability-bridge input scoping/control-character validation. These CI totals are repository tests plus Pages preview builds; they do not prove live D1/Queue execution. Neither PR was merged. No production code, production data, secrets, permissions or infrastructure were changed by this audit.
