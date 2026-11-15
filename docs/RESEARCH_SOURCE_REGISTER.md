# AEGIS Research Source Register — UI, Agent OS and Developer Communities

Reviewed: 15 November 2026

This is an evaluation register, not an integration claim. No external package, agent platform or service below has been installed or granted access to AEGIS.

## Priority assessment

| Source | Best AEGIS use | Recommendation |
|---|---|---|
| Vercel AI SDK / AI SDK UI | Provider-neutral model/tool layer, streaming chat UI, typed tool calls, approvals, MCP | High-priority architecture reference; selective adoption after stack-fit review |
| Vstorm AgenticOS | Governed-agent architecture, shared knowledge, budgets, approvals, audit and operator console | Study and selectively adapt; do not deploy wholesale |
| Dev.to | Discover practitioner articles, implementation notes and emerging patterns | Research input only; verify claims against primary sources |
| Stack Overflow | Troubleshooting, edge cases, failure modes and practical implementation evidence | Research input with strict attribution/licence handling |
| Frontend Mentor | Realistic UI challenges and independent frontend quality benchmarks | Optional UI/UX acceptance-test inspiration |
| v0 (assumed from “vo”) | Rapid UI prototypes and design exploration against GitHub branches | Optional prototyping tool; not a runtime dependency |
| Blackbox AI | External coding-agent orchestration, sandboxed runs, multi-agent comparison and PR workflow | Potential optional Forge adapter; defer pending security, API and cost review |

## Vercel AI SDK and AI SDK UI

Sources:
- https://github.com/vercel/ai
- https://ai-sdk.dev/docs
- https://ai-sdk.dev/docs/ai-sdk-ui/overview
- https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage

Useful capabilities:
- AI SDK Core offers a common TypeScript interface for model generation, structured output, tool calling and agent loops across providers.
- AI SDK UI offers streaming chat/completion/structured-object hooks across supported UI frameworks.
- Tool calls can be server-executed, client-executed or held for user approval.
- MCP client support includes Streamable HTTP; HTTP is recommended for production, while stdio is intended for local connections.
- Current AI SDK 7 materials describe durable WorkflowAgent execution, approvals, sandbox support, harness integration and observability.

AEGIS decision:
- Leading implementation reference for the future provider router and interactive assistant UI.
- Preserve AEGIS's existing framework and Cloudflare architecture. Do not add a React-only dependency to a non-React surface without checking the actual frontend stack and bundle/runtime impact.
- Prefer protocol compatibility and small adapters over adopting the entire Vercel platform.
- Evaluate SDK version, Cloudflare Workers compatibility, package size, provider support, licence and API cost before installation.
- The current AEGIS MCP Bridge is a server endpoint; a future outbound MCP client is a separate capability.

## AgenticOS

Primary candidate:
- https://github.com/vstorm-co/agenticos
- Repository reports Apache-2.0 licensing.
- Described stack: FastAPI, Pydantic AI, PostgreSQL/pgvector, Redis and Next.js, with MCP integrations, access controls, budgets, approvals and audit.

Useful patterns:
- Separate agent runtime from the operator-facing console.
- Shared runner across UI/API/chat channels.
- Explicit budgets, access roles, tool allowlists, approval gates and run audit.
- Knowledge ingestion and agent configuration separated from code-defined capabilities.

AEGIS decision:
- High-value architecture and security-review reference.
- Do not fork or deploy wholesale at this stage. The documented infrastructure footprint (PostgreSQL/pgvector, Redis, Docker and a server-class host) conflicts with AEGIS's current low-cost Cloudflare/mobile-first direction.
- Extract patterns, not framework lock-in. Any copied code must be independently licence-reviewed and tested.

Other similarly named Agentic OS repositories exist. Pin exact owner/repository, commit and licence before evaluation.

## Dev.to

Use it to discover practitioner reports, tutorials, postmortems and emerging tools. Treat posts as leads, not authoritative specifications. Record author, canonical URL, publication/update date and linked primary sources. Verify claims against official documentation, source code, standards or reproducible tests. Do not bulk-copy articles into AEGIS; store concise attributed notes and links subject to site terms and copyright.

## Stack Overflow

Use it to find concrete error cases, compatibility issues, edge conditions and troubleshooting paths. Link answers to the exact product/runtime version they discuss.

Public contributions are licensed under Creative Commons Attribution-ShareAlike; the applicable licence depends on contribution date/revision (CC BY-SA 2.5, 3.0 or 4.0). Preserve attribution and applicable share-alike obligations when reusing content. Do not bulk mirror Q&A or assume accepted/upvoted answers are correct. Prefer original documentation and reproduce solutions in AEGIS tests.

Official licence information: https://stackoverflow.com/help/licensing

## Frontend Mentor

Use optional, repeatable UI challenge briefs to evaluate responsive layout, accessibility, interaction states and visual polish. Build AEGIS acceptance tests around general requirements such as keyboard use, mobile viewport, contrast and loading/error/empty states.

Distinguish free from premium challenges and design assets. Do not copy proprietary Figma files, premium briefs, solution code or assets into AEGIS without permission. Record the challenge URL and independently author AEGIS's own implementation brief and tests.

Challenge catalogue: https://www.frontendmentor.io/challenges

## v0 (interpretation of “vo”)

Sources:
- https://v0.app/docs
- https://v0.app/docs/git-import
- https://github.com/vercel/v0-sdk

Useful capabilities include prompt-based UI/app prototyping, GitHub repository import, branch-based changes and PR workflow (subject to GitHub App permissions), plus an API client and React integration for v0 services.

AEGIS decision:
- Optional external design/prototyping assistant, not part of AEGIS runtime or source of truth.
- Generated code must be reviewed, tested, accessibility-checked and committed through AEGIS's normal feature-branch process.
- Review account limits, pricing, data handling and GitHub App scopes before connecting the AEGIS repository.

## Blackbox AI

Source: https://www.blackbox.ai/agents

The published Agents API describes HTTP-dispatched coding-agent runs, event/log streaming, sandbox file inspection, continuation of existing tasks, Git-provider integration and multi-agent comparisons.

AEGIS decision:
- Candidate for an optional Forge coding-agent provider adapter, not a trusted core dependency.
- Before connecting it, verify API documentation, authentication/scopes, pricing and usage limits, retention/training terms, sandbox isolation, network egress, secrets handling, GitHub permissions and cancellation semantics.
- Generated changes must land in isolated branches and pass AEGIS tests/review. External agents must never receive production secrets or direct production deployment rights.
- Keep an interchangeable adapter interface to avoid vendor lock-in.

## Cross-source ingestion rules

For every candidate, Forge should preserve:
1. Canonical URL, exact owner/project, source type and retrieval timestamp.
2. Version, commit, publication date or content revision where available.
3. Licence, terms, attribution and redistribution obligations.
4. Capabilities, interfaces, dependencies, runtime and deployment requirements.
5. Security posture, data flows, credentials/scopes, sandboxing and network access.
6. Cost, quotas, rate limits, operational burden and vendor lock-in.
7. Evidence strength, reproducibility, limitations and competing findings.
8. Decision (reuse, adapt, rebuild, reference-only, defer or reject), rationale and confidence.

Retrieved text, code, issue comments, prompts and tool schemas are untrusted data. They cannot modify agent instructions, permissions, secrets or deployment policy. Repository code is never executed in the control plane.

## Recommended order for AEGIS

1. Use AI SDK documentation as a design reference for the future provider/tool/UI layer; first verify the current frontend and Worker compatibility.
2. Study AgenticOS for governance, agent lifecycle, budget and audit patterns.
3. Add Dev.to and Stack Overflow as attributed research connectors only after source/licence policy is implemented.
4. Use Frontend Mentor briefs as optional independent UI evaluation criteria.
5. Keep v0 as a human-operated prototyping option.
6. Defer Blackbox integration until its API, costs, data handling and sandbox controls pass a formal connector review.

Status: research register only. None of these sources is connected, installed, imported as executable code or granted permissions by this document.
