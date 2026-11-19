# AEGIS independent reviewer identity boundary

Status: implemented on the AEGIS feature branch; not yet merged into the production branch.

## Purpose

Separate the person who requests or owns a protected change from the principal that records a review or approval decision. The existing owner session remains the owner/control-plane identity. Review mutations now require a separately signed reviewer session.

This is a credential and session boundary, not proof of a person's civil identity. AEGIS cannot prove that two different humans hold the two credentials. For genuine two-person control, the reviewer password and signing secret must be issued to and held by a trusted person other than the owner.

## Required Cloudflare Pages secrets

Keep the existing owner secrets:

- `AEGIS_PASSWORD` — owner password, at least 12 characters.
- `AEGIS_SESSION_SECRET` — owner session-signing secret, at least 32 characters.

Add two new encrypted secrets for the reviewer:

- `AEGIS_REVIEWER_PASSWORD` — separate reviewer password, at least 12 characters.
- `AEGIS_REVIEWER_SESSION_SECRET` — separate reviewer signing secret, at least 32 characters.

Use independently generated values. Do not reuse the owner password or either signing secret. Configure them in the Cloudflare Pages project for the relevant Preview and Production environments. Never paste secret values into chat, source control, issue comments, or build logs.

Until both reviewer secrets are configured, reviewer-only operations fail closed with HTTP 503. There is no owner-session fallback.

## Session and route boundaries

- Owner sign-in remains at `/api/login` and uses `__Host-aegis_session`.
- Reviewer sign-in is at `/api/reviewer-login` and uses `__Host-aegis_reviewer_session`.
- Both cookies are HttpOnly, Secure, SameSite=Strict, host-only, and have a 12-hour lifetime.
- Reviewer tokens are signed with `AEGIS_REVIEWER_SESSION_SECRET` and must contain the fixed `reviewer` principal. Owner tokens cannot be replayed as reviewer tokens.
- Guardian Resource review transitions require the reviewer session. Read-only approval and Guardian catalogue/resource-detail routes accept either the owner or reviewer session. Guardian Resource intake remains owner-only.
- General capability approval decisions and agent-run approval decisions require the reviewer session. Approval requests remain bound to the owner principal and exact operation.
- Agent-run runtime authorisation still requires the owner session, an approval whose decision actor is `reviewer`, and the existing active exact-resource Sentinel grant. Recording a review does not execute a run.
- The reviewer principal has no general owner API access and does not receive capability grants or execution authority.

## Limitations and follow-up

- The Approval panel has a separate reviewer sign-in/sign-out form. The standalone `/reviewer.html` portal lets a reviewer sign in without the owner's login and read the pending approval queue plus owner-scoped Guardian catalogue. It can record reviewer decisions and Guardian review transitions, but cannot create resources, issue owner grants or authorise agent runs. Approval controls in the owner workspace and Guardian review controls are rendered only after the reviewer session is confirmed.
- A single configured reviewer credential is supported. Reviewer account lifecycle, MFA/passkeys, recovery, rotation workflows, multiple named reviewers and external identity-provider integration are not yet implemented.
- Separate credentials only provide real two-person control when credential custody is genuinely separated. Do not describe this as verified independent-human approval until an appropriate identity provider or equivalent control establishes that separation.
- Do not merge or enable production reviewer-only workflows until the reviewer secrets are configured and the reviewer access path is tested in the target environment.

No secrets are committed by this change.
