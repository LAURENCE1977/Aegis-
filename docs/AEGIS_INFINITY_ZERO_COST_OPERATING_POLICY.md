# AEGIS INFINITY — Infinity Zero Cost Operating Policy

**Status:** proposed architecture policy; documentation only  
**Implementation status:** not implemented or enforced by the runtime  
**Parent work:** Experimental Lab provider contract (draft PR #162)

## 1. Objective

AEGIS INFINITY should deliver the greatest practical capability at **zero direct user spend**. A paid model or metered service must never be a hidden prerequisite for core platform operation.

The objective is not to claim that computation is literally free. Local hardware, electricity, storage, bandwidth, maintenance and free-tier services can all have costs or limits. AEGIS must disclose those realities and avoid shifting costs to the user without consent.

## 2. Cost classes

Every capability/provider route must be classified before it is selected:

| Class | Meaning | Default treatment |
|---|---|---|
| Deterministic/local software | Rules, parsers, indexing, cached results, local workflows and built-in analysis | Preferred where quality is sufficient |
| User-owned local compute | Models or services running on hardware the user controls | Preferred when available and suitable; disclose device/resource demands |
| No-charge hosted allowance | A provider's genuinely no-charge tier, subject to quotas, eligibility, retention and terms | Optional; verify current terms and limits, never assume permanence |
| Metered/paid service | API usage, subscriptions, paid inference, paid tools or infrastructure | Disabled unless the user explicitly authorises the specific spend |
| Unknown cost | Price, quota, billing behaviour or terms cannot be verified | Treat as paid/unsafe; do not invoke automatically |

“Open source”, “open weights”, “free download” and “free trial” do not mean that hosted inference or operation is free.

## 3. Default routing policy

1. Try a deterministic capability first when it can meet the task's quality and safety requirements.
2. Otherwise consider an available, user-owned local model or service, subject to hardware suitability and explicit setup.
3. Then consider a verified no-charge hosted allowance, respecting its current terms, quotas, privacy conditions and availability.
4. If no suitable no-cost route exists, explain the limitation and offer a lower-cost alternative or ask whether the user wants to authorise a paid route.
5. Never silently fall through from a free route to a paid route.

The router must preserve task quality and safety. It must not choose a weaker model for a high-impact task merely to claim zero cost; it should stop, explain the limitation and request human direction.

## 4. Explicit spend authorisation

Paid routes remain disabled by default. Before any paid request, AEGIS must present:

- provider and model/service;
- why a no-cost route is insufficient;
- estimated cost or a clearly stated inability to estimate it;
- applicable usage unit, billing uncertainty and any recurring commitment;
- requested maximum spend or one-time scope;
- the exact task and data that would be sent.

Authorisation must be affirmative, scoped, time-bounded and recorded. Silence, prior general consent, a provider's default setting, agent recommendation or an upstream tool response is not authorisation. AEGIS must fail closed if price or authorisation cannot be established.

No recurring subscription, credit purchase, cloud resource, paid upgrade or spend cap increase may be initiated by an agent without a separate explicit approval.

## 5. Infinity Zero operating mode

The intended user-facing mode is **Infinity Zero**:

- paid inference and metered services disabled by default;
- local and deterministic routes preferred;
- verified no-charge allowances optional and quota-aware;
- cache and memory reuse to avoid duplicate computation;
- task routing to the smallest adequate model;
- clear indication of degraded, offline, quota-exhausted or unavailable capability;
- no hidden paid fallback;
- explicit user approval required to leave zero-spend mode.

The mode is a policy target, not a claim that these controls already exist in the current runtime.

## 6. Token and compute efficiency

AEGIS should reduce unnecessary model calls through:

- deterministic parsing, validation, filtering and transformation;
- retrieval of relevant stored evidence instead of repeatedly resending context;
- semantic and exact-result caching with provenance, freshness and invalidation rules;
- compact task-specific context and bounded outputs;
- specialist small models for narrow tasks where validated;
- batching and deduplication where they do not compromise isolation or correctness;
- model escalation only when a measurable quality need justifies it.

Cache hits must not be treated as fresh verification. Security advisories, prices, licences, provider terms and other time-sensitive facts require freshness checks.

## 7. Device and privacy constraints

Do not assume that a phone or tablet can safely host a large model. Device routes must account for RAM, thermal limits, battery, storage, supported runtimes and user experience. A mobile device may remain a control surface while inference runs on an optional user-owned computer or server.

No local model, remote provider or memory service may receive sensitive workspace data merely because it is available. Data minimisation, provider disclosure, user consent and existing AEGIS security boundaries still apply.

## 8. Sentinel and trust boundaries

Cost policy does not weaken Sentinel or human approval. Sentinel remains independent. Agents cannot approve their own provider access, spend, data disclosure, sandbox execution or consequential action.

Provider responses, model-generated cost estimates, tool metadata, free-tier advertisements and external documentation are untrusted inputs. A provider cannot certify its own pricing, isolation, security or compliance. Verify claims against authoritative terms and independent evidence.

## 9. Required observability

For every routed task, the future implementation should record a privacy-conscious decision record containing:

- route class and provider identity;
- reason the route was selected;
- whether the route was local, no-charge allowance or paid;
- known quota/limit status and freshness of that information;
- estimated and, where available, actual spend;
- authorisation reference for any paid use;
- fallback/degradation reason;
- data-sharing classification and applicable consent.

Do not log secrets, raw prompts or private content merely to produce cost telemetry.

## 10. Acceptance criteria for implementation

Infinity Zero is not complete until tests and runtime evidence demonstrate that:

1. paid routes are denied when no valid scoped authorisation exists;
2. quota exhaustion cannot silently trigger a paid fallback;
3. unknown or stale pricing is treated as unknown, not free;
4. local and deterministic routes remain usable without API keys;
5. no-cost provider failures produce an honest degraded response;
6. cost limits are enforced at the server-side boundary, not only in the UI;
7. agent, MCP and workflow paths cannot bypass the same policy;
8. paid authorisation is bound to provider, task, scope, limit and expiry;
9. audit records are append-only and do not expose secrets;
10. regression and adversarial tests cover prompt injection, provider spoofing, malformed prices, retries, race conditions and fallback paths.

## 11. Non-goals and honest limitations

- No promise of unlimited free hosted inference.
- No assumption that a free tier will remain available or retain the same limits.
- No automatic installation of models, runtimes or third-party tools.
- No automatic purchase, subscription, cloud provisioning or secret configuration.
- No weakening of security, privacy, model quality or Sentinel controls to meet a zero-cost target.

**Guiding rule:** AEGIS should be free to operate wherever it reasonably can; when it cannot, it must say so plainly and wait for the user's decision rather than spend silently.
