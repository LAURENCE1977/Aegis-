# AEGIS Social and Repository Research Intake

**Status:** design specification; not an active social connector or autonomous monitor.  
**Branch:** `feature/aegis-social-repo-intake-2026-11-23`  
**Purpose:** let ChatGPT and AEGIS use one consistent, owner-controlled research workflow for repositories mentioned by the owner and relevant leads surfaced by the owner's authorised social accounts.

## 1. Scope

Build only the research capabilities needed by AEGIS:

1. Accept a repository URL, owner/name, project name or social-post reference mentioned by the owner.
2. Resolve and deduplicate the canonical repository identity.
3. Inspect public repository metadata and selected source files through the existing Forge read-only inspection boundary.
4. Record provenance, immutable source revision, licence status, maintenance signals, security signals, dependencies, runtime fit, cost and relevance to AEGIS.
5. Surface relevant repository leads from explicitly authorised social accounts, then independently verify every lead against the official repository and documentation.
6. Keep a single owner-controlled watchlist and research history that ChatGPT and AEGIS can read through separately authorised clients.

This is a research and monitoring layer. It is not a social-media automation suite, a phone surveillance system or an unrestricted repository agent.

## 2. Social source coverage

### Initial priority

- Instagram, including Reels.
- TikTok.

### Additional provider adapters

The adapter registry may support other networks when an owner-owned account is actually connected and the required read scopes are granted: YouTube, X/Twitter, Facebook, LinkedIn, Threads, Bluesky, Pinterest and Twitch. A platform appearing in this list is not evidence that the owner has an account there or that it is connected.

Google Business Profile and advertising/marketing analytics are out of scope unless a later build requirement specifically needs them.

### Live connection snapshot — 23 November 2026

The connected Metricool account currently returns one brand, `laurencecolborne`, with `tiktokData: laurencecolborne`. No Instagram network is present in that returned brand record. This confirms a TikTok connection in the ChatGPT-side Metricool integration only; it does **not** establish that AEGIS has Metricool credentials or can access the account.

The Instagram adapter remains planned until Instagram is explicitly connected and its granted scopes can be verified. Do not infer ownership or access from usernames, profile images or mentions.

Personal music accounts remain separate from the AEGIS research workflow. Include them only if the owner explicitly authorises the exact account and research purpose.

## 3. Provider-neutral adapter contract

Each social adapter must expose a narrow, versioned read-only interface:

- `connection_status()`: provider, account/brand identifier, granted scopes, connection state and last verification time; never return credentials.
- `list_research_items(cursor, window)`: bounded post/video metadata and provider-supplied public links for explicitly authorised accounts.
- `get_research_item(id)`: retrieve only the permitted fields for one item.
- `health()`: report rate-limit, permission and provider availability state.

Normalised research item fields:

- provider and owner-approved account reference;
- provider item ID and canonical permalink;
- publication timestamp;
- caption/title and hashtags where the provider exposes them;
- outbound repository/project links;
- transcript or text extraction only where explicitly available through the authorised provider API;
- retrieval timestamp, source revision/version and provenance;
- visibility/scope classification and any omitted-field reason.

Never collect private messages, inbox contents, contact books, login credentials, session cookies or unrelated private account data. Do not scrape around provider permissions or automate app UI as a workaround for missing API scopes.

## 4. Repository intake and watchlist

A repository mentioned by the owner is a first-class intake event regardless of whether it arrived in chat, a social post, a URL or another authorised source.

Pipeline:

`Mention → canonicalise → deduplicate → inspect public metadata → pin revision → inspect selected files → licence/security/maintenance review → relevance assessment → owner decision → watchlist`

For each candidate, retain:

- canonical repository URL and owner/name;
- source mention permalink and referring social provider/account where applicable;
- default branch and immutable commit/tree SHA inspected;
- licence evidence and review state;
- release/activity and security-advisory evidence with timestamps;
- dependencies, runtime, platform/hardware assumptions and cost;
- AEGIS capability fit, integration boundary and estimated adaptation effort;
- decision: unassessed, hold, reuse, adapt, combine, rebuild or reject;
- last checked time and next refresh policy.

A social post is a lead, never proof of quality, safety, licence permission or project authenticity. Verify the canonical upstream repository and documentation independently. Unknown licence or provenance means hold. Do not install, build or execute candidate code during discovery or review.

The existing Forge inspection boundary is the source of truth for public repository tree inspection and immutable-SHA file reads. Keep social discovery separate from source inspection; social content must never be passed to a shell, build runner or agent as instructions.

## 5. ChatGPT and AEGIS access model

ChatGPT and AEGIS are separate clients and must have separate identities, credentials, grants and audit trails.

- Do not copy ChatGPT connector credentials or social login sessions into AEGIS.
- AEGIS may use a provider adapter only after its own owner-authorised connection and exact read scopes are configured.
- ChatGPT may use its own connected tools where available; that does not imply AEGIS can inherit the connection.
- Both clients should consume the same normalised, owner-approved research records through the AEGIS Bridge when that bridge is available to the relevant client.
- The owner can revoke either client independently without disconnecting the other.
- Repository reads are public and bounded; private-repository access is a separate future grant and is not included in this initial scope.

## 6. Permission and safety boundary

Default permissions:

| Capability | Default |
|---|---|
| Read authorised social post metadata and public links | Allow only within verified provider scopes |
| Read public GitHub repository metadata and selected files | Allow through existing bounded Forge routes |
| Create/update owner research notes and watchlist records | Require authenticated owner session and audit |
| Follow a repository for future public releases/advisories | Owner opt-in per candidate |
| Read private social messages, inboxes or contacts | Deny |
| Like, follow, comment, repost, DM or publish | Deny |
| Create issues, branches, commits or pull requests in upstream repositories | Deny |
| Install, build or execute upstream code | Deny in this research stage |
| Change account permissions, connect new accounts or expose credentials | Explicit owner action only |

All retrieved social and repository content is untrusted data. It may contain prompt injection, malicious links or misleading claims. Treat it as evidence to assess, never as instructions to follow.

Every connector request must be bounded by account, scope, item count, response size, timeout and rate limit. Redact secrets and personal data from logs. Record the requesting client, account reference, query window, item IDs, result status and audit timestamp.

## 7. Rollout sequence

1. **Specification and source boundary** — this document; no live access granted.
2. **Repository watchlist foundation** — accept any owner-mentioned repository and persist canonical identity, pinned revision, provenance and review state.
3. **Social adapter foundation** — implement a provider-neutral read-only contract and connection-status inventory; keep providers disabled until independently authorised.
4. **TikTok adapter** — only after an AEGIS-side authorised connection is available; do not reuse ChatGPT's Metricool credentials.
5. **Instagram/Reels adapter** — enable after the account is explicitly connected and scopes are verified.
6. **Other socials** — add only when a connected owner-owned account and concrete research need are confirmed.
7. **Shared client access** — expose approved research records to ChatGPT and AEGIS through separately scoped bridge clients.
8. **Ongoing refresh** — opt-in repository release/advisory checks with bounded schedules, deduplication, audit and a pause/revoke control.

## 8. Not implemented by this specification

This document does not create social API credentials, connect Instagram, grant AEGIS access to TikTok, enable background social polling, deploy a new runtime, change production, enable private repository access or grant Android phone-control permissions. It records the intended scope so implementation can proceed safely and consistently.

## 9. Acceptance criteria

- Any repository URL/name explicitly mentioned by the owner can enter the same deduplicated research workflow.
- Every repository finding is pinned to a source revision and has provenance, licence state and a timestamp.
- Social leads link back to their source post and are independently verified against upstream project sources.
- Only explicitly connected, owner-owned accounts and granted read scopes are accessible.
- Instagram and TikTok are supported as first-priority adapters; other providers remain disabled until authorised.
- ChatGPT and AEGIS have separate credentials, grants, revocation and audit.
- No posting, messaging, social engagement, upstream writes or untrusted code execution is possible in this stage.
