# AEGIS

Your personal AI workspace — open-source, mobile-first, and designed to run on your own hosting.

AEGIS is an evolving project. The current repository is an early Cloudflare Pages prototype; the larger autonomous assistant, voice, AEGIS Forge coding system, durable memory and Connections Hub are planned capabilities, not yet implemented.

## Current prototype

- Mobile-friendly chat interface for iPhone, iPad and Chromebook browsers
- Cloudflare Pages Functions API
- Cloudflare Workers AI binding for the current chat model
- Optional Cloudflare KV binding for simple notes
- Password sign-in with signed, expiring, HttpOnly browser sessions

## Security setup

**Do not expose a deployment until both secrets are configured.** The API fails closed when authentication is missing.

In the Cloudflare dashboard, open the AEGIS Pages project and add these as encrypted secrets for the production environment (and separately for Preview if you use it):

1. `AEGIS_PASSWORD` — a unique password of at least 12 characters.
2. `AEGIS_SESSION_SECRET` — a cryptographically random secret of at least 32 characters. Do not reuse your AEGIS password.

Redeploy after adding or changing secrets. The browser session lasts 12 hours and is stored in a Secure, HttpOnly, SameSite=Strict, host-only cookie. The chat and memory APIs reject requests without a valid session. Never put either secret in `index.html`, browser storage, GitHub, or a public environment variable.

If the login screen says security setup is unfinished, configure both secrets before using AEGIS.

## Data and provider notes

The source code is open for inspection and modification. Hosting, storage, and model inference may have separate provider limits or costs. Requests sent to an external AI provider are processed under that provider's terms; open-source application code does not by itself make model inference private or free.

## Development

The current prototype is intentionally small and does not yet contain the AEGIS Forge, autonomous task runner, voice engine, provider router, or native Connections Hub. These will be added as independently testable capabilities.

Run the session security tests with:

```sh
node --test tests/auth.test.mjs
```
