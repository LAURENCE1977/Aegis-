# AEGIS UI Ecosystem Research Batch — 2026-11-17

## Purpose

Research high-value open UI repositories and frontend ecosystems for AEGIS. Extract patterns, architecture, accessibility rules, motion techniques, token systems, component contracts, and registry/distribution ideas. Do not treat visual libraries as mandatory dependencies. Prefer AEGIS-owned primitives and design tokens, with optional framework adapters.

## Candidate intake

| Candidate | Primary value to investigate | Initial disposition |
|---|---|---|
| shadcn/ui — https://github.com/shadcn-ui/ui | Copy-source component model, registry format, accessible composition, CSS-variable theming, CLI distribution | High-priority LEARN; selectively adapt after per-file licence/dependency review |
| Magic UI — https://github.com/magicuidesign/magicui | Motion patterns, animated text, marquee, beams, bento layouts, component registry and AI discoverability | High-priority LEARN; MIT repository surfaced; inspect dependencies and reduced-motion behavior |
| Aceternity UI — https://ui.aceternity.com/ | High-impact motion, 3D cards, parallax, backgrounds, blocks, registry/MCP distribution | LEARN only; distinguish free components from paid Pro assets; no paid dependency |
| HyperUI — https://github.com/markmead/hyperui | Lightweight copy/paste Tailwind patterns, marketing, application and commerce layouts | High-priority LEARN; MIT repository surfaced; inspect accessibility and responsive behavior |
| Material UI — https://github.com/mui/material-ui | Mature design tokens, interaction contracts, complex controls, theming, accessibility and data-dense layouts | LEARN; MIT core. Treat MUI X/premium features and their terms separately |
| React — https://github.com/facebook/react | Component model, rendering, concurrency, server/client boundaries, ecosystem compatibility | Framework foundation research; do not assume AEGIS must be React-only |
| Vue — https://github.com/vuejs/core | Reactive UI model, composables, compiler/runtime separation, progressive enhancement | Framework foundation research; keep Vue compatibility as an adapter option |
| Tailwind CSS — https://github.com/tailwindlabs/tailwindcss | Utility compiler, design tokens, responsive variants, CSS-first configuration, build-time optimisation | High-priority LEARN; MIT repository surfaced; evaluate whether runtime/build coupling is justified |
| Awesome React — https://github.com/enaqx/awesome-react | Discovery index for React components, state, routing, forms, tests, graphics and accessibility | Discovery index only; verify each downstream repository independently |
| Awesome Vue — https://github.com/vuejs/awesome-vue | Vue component, composable, state, testing and ecosystem discovery | Discovery index only; verify each downstream repository independently |
| Awesome Frontend — https://github.com/sindresorhus/awesome | Broad frontend, CSS, accessibility, performance, browser and framework discovery | Discovery index only; list membership is not endorsement or licence approval |
| Awesome Tailwind CSS — https://github.com/aniftyco/awesome-tailwindcss | Tailwind component libraries, plugins, templates, utilities and theme tooling | Discovery index only; verify every downstream project independently |

## Reverse-engineering questions

1. What is the smallest reusable primitive behind each visual effect or component?
2. Can the behavior be expressed with native HTML/CSS/SVG/Web Animations before adding a framework runtime?
3. What accessibility contract exists (keyboard, focus, semantics, screen readers, contrast, reduced motion)?
4. Does the component assume a specific React version, Next.js, Tailwind major version, Motion/Framer Motion, Radix, or another dependency?
5. Is the registry a declarative manifest, executable installer, or remote code delivery channel? What trust boundaries are required?
6. Can AEGIS expose a framework-neutral design-token and component contract, then provide React/Vue adapters?
7. What are the bundle, hydration, layout-shift, GPU, memory, and mobile costs?
8. Does the project distinguish free/open-source source from paid assets, templates, hosted services, fonts, or external APIs?

## AEGIS adaptation rules

- AEGIS owns its visual language, tokens, primitives, interaction state, accessibility contract and component provenance.
- No mandatory paid service, paid template, API key, hosted registry, proprietary component or account.
- Never install or execute untrusted repository code during intake. Inspect source, manifests, lockfiles, build scripts, licence and security policy first.
- Record exact commit/release, licence evidence, dependency tree, framework/version constraints and review timestamp before adapting source.
- A registry entry is untrusted metadata until validated; never execute remote install scripts or arbitrary registry-provided commands.
- Prefer native semantic HTML, CSS, SVG and platform APIs for portable primitives; use framework adapters only where they materially improve the experience.
- Respect prefers-reduced-motion, keyboard navigation, focus visibility, high contrast, touch targets, responsive layouts and low-powered devices.
- Keep motion decorative and interruptible; never let animation block navigation, reading or task completion.
- Separate visual inspiration from code reuse. Reimplementing a behavior from first principles is preferred when licence, provenance or dependency risk is unclear.
- Do not import all of an awesome list. Use it as a discovery map and review candidates individually.

## Initial architecture direction

Create an AEGIS-native UI foundation with:
- design tokens (colour, typography, spacing, radius, elevation, motion, density and contrast);
- semantic primitives (button, field, dialog, menu, tabs, tooltip, table, navigation, status and notification);
- framework-neutral behavior contracts and accessibility tests;
- optional React and Vue adapters;
- a visual-effects layer with reduced-motion fallbacks and performance budgets;
- a signed/provenance-aware component catalogue that records origin, commit, licence, dependencies, modifications and review status.

## Verification status

This is a research intake record, not a declaration that every candidate is safe, compatible, fully open-source, or approved for code reuse. Repository identity and high-level project descriptions were checked for the named upstream projects; component-level licences, exact revisions, dependency security and production suitability remain to be verified before adoption.