# AEGIS Sentinel public GitHub discovery

## Route

`POST /api/sentinel/github-discover` accepts exactly one JSON field:

```json
{ "sourceUrl": "https://github.com/OWNER/REPOSITORY" }
```

The owner session and same-origin request are required. The server parses the URL, removes an optional `.git` suffix, canonicalizes it and derives the exact resource identity `github:public:OWNER/REPOSITORY`. The request cannot supply a different resource ID, API endpoint, adapter name or extra fields.

## Permission and rate limit

The owner must create an active grant for capability `aegis-github-public-discovery`, action `discover`, and the exact derived resource. The required scope is derived from the trusted registry: `github:public-metadata:read`.

Sentinel reserves one atomic D1 minute-bucket slot for the principal/capability/action before audit or external fetch. The manifest limit is 30 requests per minute. Exhaustion returns 429; D1 rate-limit failure returns 503 and fails closed.

## Egress and response

The adapter calls only `https://api.github.com/repos/{owner}/{repository}`, rejects redirects, applies a five-second timeout and limits the streamed response to 64 KiB. It returns a bounded public metadata object. Private repositories are rejected. It does not fetch file contents, run code, install packages, clone repositories or access credentials.

## Audit

The invocation ID is returned to the owner and is the same ID used by the policy-allowed, authorized and succeeded/failed audit events. Input digests and secrets are not returned.

## Safety

This is a narrowly fixed metadata adapter, not a general GitHub tool or repository agent. No remote database, token or production deployment is configured by the code change.
