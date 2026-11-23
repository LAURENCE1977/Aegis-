# AEGIS UI, design and AI-build tooling research intake

Date: 2026-11-23
Status: research only; no dependencies installed and no production changes.

## Recommended stack direction

Keep the existing AEGIS runtime and deployment architecture. Evaluate one coherent base rather than mixing several competing component systems:

1. **shadcn/ui** as the default React component foundation where a React frontend is appropriate. It distributes editable source components and supports composition/customisation rather than locking the app into a closed component package.
2. **Kibo UI** as a selective layer for complex product components (for example tables, file dropzones, editors and AI-chat primitives). It is designed to extend shadcn/ui, not replace it. Review dependencies, data ownership and state APIs component-by-component.
3. **Cult UI** as a selective interaction/animation registry on top of the base. Prefer only components that materially improve the AEGIS experience; audit focus management, keyboard interaction and reduced-motion behaviour before adoption.
4. **21st.dev** as a discovery/catalogue and optional registry/MCP workflow, not a runtime dependency. Review each third-party component's source, licence, dependencies, accessibility and provenance before copying it.
5. **Chimera UI** as an alternative React + Tailwind component system to compare against shadcn, not an additional layer to install alongside it. It uses Radix primitives and semantic theme tokens; test its current maintenance, compatibility and licensing before any adoption.
6. **Libraries.dev** as optional visual-effect packages and agent skill. The site describes React 18+ packages for border beams, thinking orbs, gooey effects, metal and image effects, with MIT-licensed npm packages. Effects should be used sparingly and must not obscure operational state, accessibility or mobile performance.

## Design-to-code workflow

**Google Stitch + official Stitch skills** are a strong candidate for the design workflow:
- google-labs-code/stitch-skills provides design generation/editing, code-to-design, design-system extraction/management, static HTML extraction, upload, React component and React Native conversion workflows, plus shadcn guidance.
- Use Stitch to explore screens and derive a DESIGN.md; treat generated code as a proposal that must be reviewed and tested against the existing AEGIS codebase.
- Do not allow design-generation skills to overwrite production files or deploy without the normal branch, test and approval process.

Official references:
- https://github.com/google-labs-code/stitch-skills
- https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/
- https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/

## Google AI Studio and domains

Google AI Studio Build can publish full-stack apps through Cloud Run. Its documented custom URL option is a globally unique subdomain under ai.studio (for example name.ai.studio), not evidence that an arbitrary existing root domain such as an AEGIS/Krystal domain can be attached directly.

If a branded AEGIS custom domain is required, keep DNS and routing under the existing Cloudflare/Krystal-controlled architecture and use an explicitly supported custom-domain host/origin. Do not change nameservers, DNS, email or production routing to test AI Studio. Treat AI Studio as a prototype/design/build environment until auth, secrets, data residency, billing, deployment and domain ownership are reviewed.

Reference:
- https://ai.google.dev/gemini-api/docs/aistudio-deploying
- https://codelabs.developers.google.com/codelabs/cloud-run/launch-your-to-do-web-app-with-ai

## Android phone-agent and evaluation candidates

### Open-AutoGLM — execution candidate, isolated adapter only

Repository: https://github.com/zai-org/Open-AutoGLM
- Apache-2.0 licensed, open phone-agent framework.
- Uses screenshots and a vision-language model to interpret the phone UI, plan steps and execute Android actions through ADB; also supports HarmonyOS through HDC and documents iOS support separately.
- Includes sensitive-operation confirmation and manual takeover for login/verification scenarios.
- Model service is a separate dependency: AutoGLM-Phone model variants can be served locally or accessed through a compatible provider. The README documents a multilingual model variant and API configuration.
- This is a plausible adapter behind a dedicated phone-control broker, not something to embed directly into the AEGIS control plane.

**Security boundary:** do not expose ADB over the public internet or enable unattended wireless ADB. Keep device pairing local and explicit; use a narrowly scoped broker with per-device identity, allowlisted actions, visible user approval for sensitive actions, session timeouts, audit records and an immediate stop control. Block payments, credential entry, account changes, messages/posts and other external side effects unless the user explicitly approves each operation. Never forward screen contents, notifications or personal data to a model provider without an explicit data-handling decision. Treat model output and screen text as untrusted input.

### AndroidWorld — test bench, not an execution engine

Repository: https://github.com/google-research/android_world
- Apache-2.0 licensed research environment and benchmark, published at ICLR 2025.
- Runs agents against a live Android emulator and provides 116 programmatic tasks across 20 apps, with dynamic task parameters and state-based success checks.
- Supports plugging in a custom agent, making it useful for regression and reliability evaluation of an AEGIS phone-agent adapter.
- It is not a production phone-control service and should run in a disposable emulator/test environment, not against the owner's daily handset or production accounts.
- Docker support is described as experimental; verify the current setup and dependency pins before adopting it.

### GLM-Phone — identity needs confirmation

No distinct repository or product named exactly **GLM-Phone** was verified in this intake. The likely related name is **AutoGLM-Phone**, the vision-language model used by Open-AutoGLM. Do not treat these names as interchangeable until the user confirms the intended link. Model hosting/provider, model licence, data retention and inference location must be reviewed independently of the agent framework's Apache-2.0 code licence.

Official references:
- https://github.com/zai-org/Open-AutoGLM
- https://github.com/zai-org/Open-AutoGLM/blob/main/README_en.md
- https://github.com/google-research/android_world
- https://proceedings.iclr.cc/paper_files/paper/2025/hash/01a83bc2f2732a58e6aa731e659e7101-Abstract-Conference.html

## Candidate fit and cautions

| Candidate | Fit | Recommendation |
| --- | --- | --- |
| shadcn/ui | Base component architecture | Preferred foundation to evaluate first |
| Kibo UI | Complex app components | Selective add-on |
| Cult UI | Distinct interactions and animation | Selective add-on; accessibility review |
| 21st.dev | Component discovery and registry | Research/catalogue only until components are vetted |
| Chimera UI (chimera-ui.com) | Alternative React/Tailwind system | Compare, do not stack with shadcn by default |
| Libraries.dev | Agent-oriented React effects and skills | Optional polish; measure bundle/performance |
| Google Stitch skills | Design-to-code workflow | Pilot on a non-production screen |
| Google AI Studio | Prototype and Cloud Run publishing | Separate prototype lane; custom URL is under ai.studio |
| Open-AutoGLM | Android/HarmonyOS phone-agent execution | Strong candidate for isolated adapter; security review first |
| AndroidWorld | Emulator-based agent evaluation | Strong candidate for isolated CI/test harness |
| AutoGLM-Phone / "GLM-Phone" | Vision-language model for phone UI | Confirm exact intended model/repository and provider terms |

## Ambiguous names requiring exact identity

The request also included **Word os** and **gglm**. Search results did not identify a single reliable, clearly intended product or repository for either term. **GLM-Phone** also needs confirmation as a distinct name; AutoGLM-Phone is the likely related model. Do not guess, install or add a dependency until the exact URL or spelling is supplied.

## Adoption gates

- Confirm the actual AEGIS frontend framework and build pipeline before choosing React-only packages.
- Check repository activity, release cadence, issue health, licence and transitive dependencies.
- Pin versions and review diffs; no automatic unbounded registry imports.
- Enforce keyboard access, screen-reader semantics, reduced motion, mobile layout and sensible performance budgets.
- Keep design tools, generated code and live AEGIS runtime credentials separate.
- Keep Android device access behind an explicit local broker; no public ADB listener or unrestricted device-control endpoint.
- Run phone-agent evaluation only in disposable emulators with synthetic accounts and data.
- No packages installed, secrets added, DNS modified, devices paired, or production deployments performed by this research note.