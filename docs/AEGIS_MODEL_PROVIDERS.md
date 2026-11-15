# AEGIS Model Provider Boundary

Status: implemented as an optional server-side adapter; Workers AI remains the default. No Qwen credentials, account, billing plan or paid API route have been configured.

## Supported providers

### Workers AI (default)

- Selected when `AEGIS_MODEL_PROVIDER` is absent or set to `workers-ai`.
- Uses the existing Cloudflare Workers AI binding and the current Llama instruct model.
- No change to existing default behaviour.

### Alibaba Cloud Model Studio / Qwen (optional)

- Select only by explicitly setting `AEGIS_MODEL_PROVIDER=alibaba-qwen` in the server environment.
- Required server-side bindings/secrets:
  - `AEGIS_QWEN_API_KEY`: secret API key. Configure as an encrypted Cloudflare secret; never put it in source, browser code or chat.
  - `AEGIS_QWEN_WORKSPACE_ID`: workspace-specific Model Studio identifier.
  - `AEGIS_QWEN_REGION`: one of `ap-southeast-1`, `us-east-1`, `cn-beijing`, `cn-hongkong`, `eu-central-1`, `ap-northeast-1`.
  - `AEGIS_QWEN_MODEL`: optional model ID; default is `qwen3.8-flash`.
- AEGIS constructs the hostname from the validated workspace ID and a fixed region allowlist. There is no arbitrary base-URL field, preventing an endpoint setting from becoming an SSRF primitive.
- Uses the official OpenAI-compatible streaming Chat Completions API and passes only bounded, already-prepared AEGIS messages.
- Provider request has a 60-second timeout, fixed 1,024 output-token cap, redirect rejection and generic error handling. The streaming UI also enforces its existing 12,000-character response cap.
- No automatic fallback from a failed Qwen request to another provider. The selected provider is explicit, so prompts are not silently rerouted.
- Model Studio usage may be chargeable. Check current regional quotas, pricing, data-processing terms and workspace before enabling. AEGIS does not infer that Qwen API access is free from a model name or open-weight release.

## Data and safety

- Enabling Qwen sends the prepared prompt, recent bounded chat history and any retrieved AEGIS memory context to Alibaba Cloud Model Studio in the selected region.
- Do not enable it until the owner explicitly chooses the provider and reviews the region, cost and privacy implications.
- Never send session cookies, secrets, API keys, hidden environment values or raw browser credentials to the model.
- Provider output is untrusted text. It does not gain tool permissions, memory write access, browser access or execution rights.
- Frontend tool calls remain disabled. Any future action must pass AEGIS capability policy, Sentinel, exact-operation approval, audit and a constrained adapter.
- The Qwen adapter is not a local/offline model. It does not install model weights on the Chromebook or mobile devices.

## Verification

- Unit tests cover the default Workers AI path, explicit Qwen endpoint construction, missing secrets, invalid workspace/region/model identifiers, unsupported providers and provider error redaction.
- Integration is exercised through the existing authenticated AG-UI SSE endpoint.
- Current CI evidence is recorded in the pull request and master blueprint. The provider remains inactive until the server environment is explicitly configured.
