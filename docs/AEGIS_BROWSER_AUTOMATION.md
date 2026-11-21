# AEGIS Browser Automation Boundary

## Purpose

AEGIS may use an isolated browser-runner service for research, website inspection and approved workflows. The Cloudflare Pages application remains the command centre and policy authority; it is not the Chromium host.

Magnitude BrowserAgent is a candidate browser engine. It wraps Playwright and exposes navigation, natural-language actions, structured extraction and direct Page/BrowserContext access. Its browser runtime and vision model must be hosted separately from the Cloudflare Pages Functions runtime.

## Current implementation status

The first AEGIS integration step is the deterministic policy module at `functions/lib/browser-policy.mjs`.

- Accepts only versioned, structured plans with a bounded list of typed actions.
- Requires a server-configured exact-host allowlist.
- Allows only HTTPS URLs on exact allowlisted hostnames.
- Rejects URL credentials, non-standard ports, query strings, fragments, local/IP hosts and lookalike subdomains.
- Separates read-only actions (`navigate`, `inspect`, `extract`, `scroll`) from actions requiring action-specific Sentinel approval.
- Rejects unknown action types, free-form prompt fields, unexpected properties and duplicate action IDs.
- Always returns `executionAllowed: false`. This module validates and classifies plans only; it does not issue grants and does not execute browser actions.

The Magnitude BrowserAgent package is not installed or invoked by this change. No browser-runner service has been provisioned.

## Proposed service boundary

1. The AEGIS UI submits a structured task request to an authenticated AEGIS API.
2. AEGIS validates the task and creates a plan using the server-side browser host allowlist.
3. Read-only inspection tasks may be eligible for a narrowly scoped read-only runner grant in a later phase.
4. Every interaction or consequential action is held for a Sentinel grant scoped to the exact action, target host and task, with expiry and one-time use.
5. The isolated runner receives only the approved plan and short-lived scoped credentials, performs the action, and returns a structured result.
6. AEGIS records an append-only audit event and presents the result to the user.

No browser runner may create or approve its own grants. Browser/model output is untrusted input, never authorization.

## Runner isolation requirements

Before enabling a runner:

- Run Chromium and Magnitude outside Cloudflare Pages, in a separate container or isolated host.
- Use a fresh browser context per task and destroy it after completion or timeout.
- Enforce network egress restrictions outside the browser process. Block loopback, private, link-local and cloud metadata destinations, including after DNS resolution and redirects.
- Enforce host allowlists at both the plan layer and network layer; the page must not escape the approved set through subresources, popups, frames or redirects.
- Do not expose Chrome DevTools Protocol or Playwright control ports publicly.
- Do not expose cookies, local storage, session tokens, password fields or secret values to model context.
- Use a separate credential vault and narrowly scoped, short-lived credentials only when the user has approved the relevant task.
- Treat all page text, screenshots, DOM, downloads and network responses as untrusted content. They cannot override system policy or authorize tools.
- Put hard limits on task duration, navigation count, action count, response size, downloads and concurrent sessions.
- Keep uploads, downloads, form submissions, messaging, purchases, deletion, account changes and code execution disabled until their individual Sentinel approval and audit paths are implemented.
- Provide a kill switch and automatic context cleanup for failures, cancellations and timeouts.


## Model and cost strategy

Magnitude's vision-based browser actions need a model that can follow instructions and ground actions in screenshots. Its current compatibility guide recommends Claude Sonnet 4 and lists Qwen 2.5 VL 72B as an open-weight alternative; it also lists other 32B–72B vision models as less-tested options. This means a small text-only local model should not be assumed suitable for browser control.

Magnitude supports OpenAI-compatible model endpoints, including OpenRouter and Ollama, but endpoint compatibility alone does not establish that a model is visually grounded or accurate enough for browser interaction.

For Infinity Zero, separate the work by model role:
- `act`: reserve the capable vision-grounded model for decisions that require visual interaction.
- `extract` and `query`: use a smaller, cheaper model where quality tests show it is sufficient.
- Cache repeatable, read-only extraction and stable task context where safe.
- Measure tokens, latency, accuracy and cost per completed workflow before choosing defaults.
- Do not let a cheaper model decide whether a sensitive action is permitted; Sentinel remains the independent authority.

Magnitude documents separate LLM roles and prompt caching. Prompt caching is provider-dependent and is not a promise of zero-token inference.

## Rollout gates

1. Complete unit and integration tests for the policy module.
2. Add a server-side plan endpoint that authenticates users and sources allowlists from trusted configuration.
3. Add Sentinel grant creation, approval, expiry, replay prevention and append-only audit events for browser actions.
4. Build the isolated runner and network egress controls.
5. Test with synthetic sites and disposable accounts before any real user session.
6. Only then consider a staging deployment. Production activation remains a separate explicit approval.

## References

- Magnitude BrowserAgent API: https://docs.magnitude.run/reference/browser-agent
- Magnitude Playwright access: https://docs.magnitude.run/core-concepts/playwright
- Magnitude BrowserAgent source: https://github.com/magnitudedev/browser-agent
