# AEGIS product experience and repository research

**Date:** 16 November 2026  
**Purpose:** Record what has actually been inspected in Laurence's repositories and supplied references, and how the findings should influence the AEGIS interface. This is a selective design/architecture review, not a claim that every supplied repository has been fully audited.

## Product direction

AEGIS should feel like a contemporary, human-centred operating environment rather than a chat page with a dark theme. Its primary signed-in surface is a companion-led Home experience, with dedicated workspaces for conversation, projects, memory, Forge, approvals and security.

The 3D companion is a progressive presentation tier, not a prerequisite for a modern product. The base experience must already feel complete and polished with a static or lightweight 2D presentation.

## Laurence's repositories inspected

| Repository | Evidence inspected | Findings and AEGIS use |
|---|---|---|
| [3D-Website-Builder](https://github.com/LAURENCE1977/3D-Website-Builder) | `package.json`, `src/App.tsx`, `src/components/PortfolioPreview.tsx` | React 18, React Three Fiber, drei, Three.js, Framer Motion and Lucide. Strong reference for separating a 3D scene from overlay content, motion-led transitions and reusable visual components. Its root README and LICENSE were not found in this inspection, so do not copy or import its source/assets until provenance and licence are established. |
| [G0DM0D3](https://github.com/LAURENCE1977/G0DM0D3) | `README.md`, `package.json` | Next.js/React interface with Framer Motion, Lucide, multiple model-provider options, local-model support and local conversation history. Root licence is AGPL-3.0. Use as a feature/pattern reference only for now; do not transplant code or dependencies without a deliberate AGPL compatibility decision and third-party notice review. Provider credentials in browser storage are not a pattern to copy into AEGIS. |
| [openclaw](https://github.com/LAURENCE1977/openclaw) | `README.md`, `LICENSE` | MIT. Useful reference for gateway/control-plane separation, channels, companion device nodes, replaceable model providers, user-owned state and tool/skill boundaries. Its README warns that main-session tools can run on the host unless sandboxing is configured. AEGIS must keep Sentinel as its sole policy authority and never inherit ambient host access. |
| [auto-browser](https://github.com/LAURENCE1977/auto-browser) | `README.md`, `LICENSE` | MIT. Useful for operator-visible browser sessions, human takeover, explicit approvals, audit events, receipts and local-first deployment. Any future AEGIS browser adapter must remain behind Sentinel, scoped grants and visible human control. |
| [storied-gecko-09ca7c](https://github.com/LAURENCE1977/storied-gecko-09ca7c) | Installed-repository metadata | Recognised as an owner repository; no source-level UI review completed in this pass. |
| [storie-audio-lab-store-checker](https://github.com/LAURENCE1977/storie-audio-lab-store-checker) | `index.html` opening section | Contains a bundled single-page interface and custom Optimistic/Optimistic Mono font references. Potential reference for typography and a compact single-page deployment, but no code/assets should be reused without a full source and licence review. |
| [storie-audio-lab-3](https://github.com/LAURENCE1977/storie-audio-lab-3) | Repository metadata | Repository was reported empty when the README was requested; no implementation available to reuse. |

## Other user-supplied upstream candidates already recorded in the research register

These are architecture and capability references, not automatically approved dependencies:

- **Agent/workspace and companion UX:** CopilotKit/OpenBot, AnythingLLM, OpenClaw, CowAgent, Hermes Agent, OpenHands, Pi Herdsman.
- **Security and execution boundaries:** Octomind, IronClaw, OpenWorker, Trail-Code, TruffleHog, Harness.
- **Interoperability and gateways:** MCPHub, Goosio, OpenZiti MCP Gateway, uni-mcp-gateway, MCP, AG-UI, A2A.
- **Automation and durable orchestration:** Activepieces, n8n, Kestra, Temporal, Windmill, Trigger.dev, Hatchet, Apache Airflow.
- **Research, discovery and external data:** Firecrawl, Oxylabs, Open Outreach, Public APIs catalogue, Dev.to, Stack Overflow, Frontend Mentor.
- **Identity, storage and ecosystem:** PocketBase, Twenty, Open Dots, Agency Agents, SolidCraft and Google Artemis.

Names such as Scrappy and Huggin were previously supplied but remain unresolved to exact repository identities. Do not guess which project the user meant.

The existing `AEGIS_UPSTREAM_RESEARCH_2026-11-16.md` remains the source of truth for the wider build/adapt/connect/reject register, licence evidence, candidate status and adoption gates. This document only records the subset reviewed for product experience and companion architecture.

## Design principles extracted

1. **Composition over decoration.** Use a clear information hierarchy, meaningful workspace areas, purposeful empty states and visible next actions. Gradients and glow are accents, not the product.
2. **Companion-first, not avatar-only.** The companion is a first-class experience layer over the shared AEGIS core. It must coexist with useful workspaces and never become a separate identity or permissions system.
3. **Progressive presentation.** Begin with polished responsive 2D/2.5D and text. Add Three.js/Babylon.js rendering behind a provider-neutral contract after real-device benchmarks.
4. **Motion with restraint.** Use transitions to clarify state and navigation, not constant animation. Honour reduced-motion and battery-saving settings.
5. **Consistent iconography and typography.** Prefer a coherent icon set and typography scale over mixed Unicode glyphs. Ensure icon-only controls have accessible names.
6. **Responsive by design.** Desktop may use a persistent navigation rail and multi-column workspace; mobile should become a compact, touch-friendly navigation and single-column flow without hiding essential controls.
7. **Local-first and transparent.** Model/provider settings, memory, history and data movement must show where information goes. Do not copy patterns that store API secrets in browser storage.
8. **Human oversight is visible.** Browser/computer operations, external tools and consequential actions must show exact scope, approval status, provenance and cancellation controls.
9. **Keep the core lightweight.** Do not pull entire upstream monorepos or heavyweight UI frameworks into the current AEGIS client without measured benefit. Use small, replaceable adapters and test on Chromebook, iPhone and iPad-class devices.
10. **Licence and provenance before reuse.** Review root and nested licences, dependencies, fonts, avatars, models and assets independently. Preserve notices. Unknown terms mean hold, not permission.

## Current implementation checkpoint

- A dedicated companion-led Home dashboard has been added to `index.html` and is now the default signed-in landing view.
- The companion presentation stage is on Home; Conversation is a separate focused workspace.
- Home shortcuts navigate to Conversation, Project Spaces, Memory, Knowledge Forge, Approvals and Security.
- The client remains dependency-light; no external paid service or new runtime dependency was added.
- The full Node.js/Miniflare and isolated D1/Forge CI run 43954785649 passed after the dashboard implementation.
- The Cloudflare Pages preview for commit `4d37eed7ebbb609cff7b5e2541cfb182a651e095` deployed successfully at https://a673ccea.aegis-6yk.pages.dev.
- The signed-in interface has not yet had authenticated end-to-end browser verification because the Preview environment's authentication secrets are not configured. A client-side visual simulation is not a substitute for an authenticated test.
- The current avatar is still a disclosed static placeholder. No claim is made that a real human avatar, 3D renderer, speech engine or profile customisation is complete.

## Next experience-engineering steps

1. Complete desktop/mobile visual QA of the Home and Conversation layouts, then fix measured defects.
2. Introduce a small shared design-token and component layer; split the monolithic page into maintainable modules only when this can be done without disrupting the secure Pages deployment.
3. Add real dynamic Home data only through existing authenticated AEGIS APIs; avoid invented status metrics.
4. Implement the companion profile selector and presence state using the existing versioned companion contracts.
5. Benchmark a minimal 2D portrait/renderer, then Three.js versus Babylon.js on modest mobile hardware. Keep WebGL/WebGPU optional and Tier 0 fully functional.
6. Review the source and licensing of the owner's 3D Website Builder before reusing any of its avatar assets or implementation.
7. Only after secure Preview authentication is provisioned, verify the real signed-in workflow end to end. Do not ask the user to paste secrets into chat.


## Latest mobile regression and correction

The first client-side visual simulation found that a late desktop grid declaration overrode the earlier mobile breakpoint, causing the signed-in shell to retain its 218px sidebar column at 390px. This was corrected in `index.html` by explicitly collapsing the app shell to one column at the 820px breakpoint and placing the toolbar and content sections in the full-width column.

A regression test now asserts the one-column shell and full-width toolbar/sections at tablet/mobile widths. GitHub Actions run 43955818365 completed successfully after the correction, including Node.js/Miniflare tests and all isolated D1/Forge safeguards. The corrected Pages preview is https://a48f74a1.aegis-6yk.pages.dev (commit `1d9741e4d4d0930d133aff6fc14c58ea36f87031`).

The correction has passed CI. A final visual recheck of the corrected signed-in layout remains pending; the signed-in screen is only being previewed client-side because Preview authentication is not configured. This is not authenticated functional verification.
