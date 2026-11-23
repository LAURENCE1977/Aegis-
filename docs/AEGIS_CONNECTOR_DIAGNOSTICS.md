# AEGIS connector diagnostics model

## Status

The first implementation slice is present in \`functions/lib/connector-diagnostics.mjs\` with isolated unit coverage in \`tests/connector-diagnostics.test.mjs\`. It is a pure, server-side status model; it does not yet call provider APIs or expose a browser endpoint.

## Independent provider lanes

The model keeps separate rows for Instagram, Facebook Pages, GitHub, Cloudflare, Composio, Krystal.io and Oracle Cloud. Each row is evaluated independently so a failure in one provider cannot overwrite or block another provider's state.

Instagram accepts only verified \`business\` or \`creator\` account types. Facebook Pages requires a managed \`page\` identity and a verified Page role. The model uses internal capability names, not provider OAuth scope strings; a future provider adapter must map only verified provider grants into these capabilities.

## Status precedence

1. \`provider_unavailable\` or \`configuration_error\` for provider/configuration failures.
2. \`expired_or_revoked\` for revoked or expired authorisation.
3. \`wrong_account_type\` or \`missing_role\` for Meta account prerequisites.
4. \`authorisation_required\` or \`not_connected\` when no usable authorisation exists.
5. \`missing_scope\` when required read capabilities are not all verified.
6. \`active\` only when all provider-specific prerequisites and required read capabilities are verified.

Malformed expiry metadata fails closed as \`configuration_error\`.

## Safe output

- Only fixed provider metadata, bounded account aliases, allowlisted error codes and verified required read capabilities are returned.
- Unknown capabilities are discarded; write capabilities are never surfaced.
- \`readEnabled\` is true only for an active row.
- \`writeEnabled\` is always false.
- Credential-shaped input, raw provider errors, access tokens, refresh tokens, Page tokens, API keys and private keys are never copied into the output.
- The \`client\` field distinguishes ChatGPT-side from AEGIS-side observations. A ChatGPT connection must never be treated as an AEGIS runtime connection.

## API integration still required

The next step is to connect this pure model to AEGIS's owner-scoped connection registry and provider-specific read-only health checks, then expose it through an authenticated no-store endpoint. That endpoint must not infer Instagram account type, Facebook Page role or granted capabilities from a generic Composio \`ACTIVE\` flag. Until the adapter has verified those facts, the connection must not be presented as fully active.

No OAuth flow, credential, DNS, email, OCI resource, social write, Composio execution or production change is enabled by this module.
