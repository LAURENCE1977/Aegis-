# AEGIS Free and Open-Source Policy

**Status:** Mandatory architecture and procurement policy  
**Applies to:** AEGIS core, runtime, UI, build tooling, models, integrations, deployment and future extensions.

## 1. Non-negotiable product requirement

The complete AEGIS core must be usable without a paid subscription, paid API key, proprietary hosted service or vendor-specific account. Prefer software that is both genuinely open source and self-hostable. AEGIS must remain useful when every optional commercial provider is disconnected.

"Free to use" means no mandatory licence fee or recurring subscription for the supported self-hosted core. It does not mean compute, electricity, internet access, domains, storage or optional hosted inference can be guaranteed to cost nothing.

## 2. Licence acceptance

- Prefer OSI-approved open-source licences compatible with AEGIS's MIT licence and intended distribution, with a bias toward MIT, Apache-2.0, BSD-2-Clause and BSD-3-Clause.
- Review Apache-2.0 NOTICE/patent terms and all attribution, notice, source-offer and redistribution obligations.
- GPL, AGPL, LGPL, MPL and other reciprocal/copyleft licences require a documented compatibility and distribution review before adoption; do not assume they are prohibited or automatically compatible.
- Reject proprietary, source-available-but-not-open-source, non-commercial, field-of-use-restricted, Commons Clause, SSPL and custom restrictive terms for core dependencies unless the owner explicitly changes this policy after legal review.
- Unknown, missing, conflicting or ambiguous licence: quarantine the candidate; do not copy, bundle, execute or make it a dependency until resolved.
- A repository's licence does not automatically license its dependencies, bundled assets, datasets, model weights or training data.

## 3. Models, APIs and providers

- Core workflows must have a local/self-hosted or otherwise genuinely free fallback where technically feasible.
- Paid model APIs and commercial SaaS integrations are optional adapters, disabled by default, with explicit user opt-in, spend caps and visible cost estimates.
- Never make OpenAI API, Anthropic, Composio, Cloudflare paid features or another paid provider a hard dependency of core functionality. ChatGPT subscription access does not include API credits.
- Distinguish open-source software from open-weight models and from models whose weights/data/licence are not openly redistributable. Record model licence, use restrictions, hardware needs and provenance.
- No agent may activate a paid provider, incur usage charges, upgrade a plan or provision billable resources without explicit owner approval.

## 4. Architecture and portability

- Own AEGIS's core interfaces, orchestration, memory contracts, identity, policy/Sentinel, audit model, task state and provider adapters.
- Use replaceable adapters behind stable interfaces; avoid proprietary SDK types leaking into core domain logic.
- Prefer standards and self-hostable infrastructure. Maintain a documented alternative for each optional vendor integration.
- Do not introduce telemetry, analytics, remote calls or licence checks that are mandatory for core operation.
- Keep core features functional offline or on a local network where practical.

## 5. Supply-chain controls

Every dependency, copied code fragment, model, dataset, plugin and external service must have a recorded source, exact version/commit, licence, attribution obligations, maintenance status, security review and reason for use.

- Maintain a machine-readable software bill of materials (SBOM) for release artefacts.
- Add automated dependency/licence inventory and policy checks to CI; fail closed on unknown or disallowed licences in distributable core artefacts.
- Pin direct dependencies and review transitive dependencies, install scripts, post-install hooks and binary downloads.
- Scan for known vulnerabilities, abandoned packages, typosquatting and unexpected licence changes.
- Keep a third-party notices/attributions file and update it with dependency changes.
- Do not bulk-copy upstream repositories. Reimplement cleanly when licensing or provenance is uncertain.

## 6. Cost and privacy controls

- Default to local processing and user-owned storage where practical.
- Display provider, model, estimated cost, quota and data-egress implications before optional remote execution.
- Enforce per-user and per-agent budgets, rate limits, hard stop limits and audit events.
- No secrets in source control, client bundles, logs or prompts sent to unrelated providers.
- Free-tier claims must be verified against current official terms and must never be treated as permanent capacity guarantees.

## 7. Release gate

A release is not policy-compliant until:
1. all shipped dependencies and assets have verified compatible licences;
2. SBOM and third-party notices are generated;
3. automated licence and vulnerability checks pass;
4. the core works without paid provider credentials;
5. paid adapters are opt-in and budget-gated;
6. setup and self-hosting instructions are available;
7. any unavoidable operating costs and hardware requirements are clearly disclosed.

**Decision rule:** build our own when feasible; otherwise reuse a verified open-source component; otherwise keep the feature optional and behind an adapter. Never quietly convert a free/open-source requirement into a paid dependency.
