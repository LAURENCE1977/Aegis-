# AEGIS Private LLM Architecture

**Status:** Architecture proposal and staged evaluation only.
**Parent:** PR #194 — AI workspace and retrieval evaluation.
**Scope:** Private inference, model gateway, model lifecycle and future fine-tuning.
**Not authorised:** provisioning compute, downloading model weights, installing packages, exposing endpoints, changing Cloudflare/Oracle resources, adding secrets, or routing production traffic.

## 1. Objective

Give AEGIS a model-serving capability that can run open-weight models on infrastructure under AEGIS operational control. Keep external model providers optional and policy-gated.

"Private" is an operational property, not a model label. A deployment qualifies only when AEGIS can demonstrate control over:
- where model weights and inference execute;
- where prompts, completions, embeddings and files travel;
- network egress, telemetry and logs;
- identity, authentication, authorization and audit;
- retention, backups, deletion and incident response;
- the model's licence and permitted use.

Open weights do not automatically mean unrestricted commercial use, no telemetry, or safe handling of sensitive data.

## 2. Proposed logical architecture

```text
AEGIS Control Centre / approved clients
                  |
          AEGIS identity + policy
                  |
       AEGIS model access gateway
       (auth, scopes, quotas, audit)
                  |
       LiteLLM or equivalent gateway
          /                    \
 Private inference pool      External providers
 (default for private data)  (explicit policy only)
       |
  Model runtime
  - vLLM: GPU serving / concurrency
  - llama.cpp: quantized GGUF / CPU-GPU
  - Ollama: simple development / small deployment
       |
  Approved open-weight model artifacts

Separate offline/controlled lifecycle:
model registry -> evaluation -> optional fine-tuning
               -> security/licence review -> signed release
```

The gateway is not a new permission authority. AEGIS identity, Sentinel grants, owner approvals, rate limits and audit remain authoritative. The model runtime must not be directly reachable from browsers or the public internet.

## 3. Runtime choices

| Component | Intended role | Initial decision |
|---|---|---|
| vLLM | High-throughput GPU inference with an OpenAI-compatible API | Preferred candidate for a confirmed production GPU host |
| llama.cpp | Quantized GGUF models, CPU or mixed CPU/GPU, small private deployments | Preferred low-resource and hardware-discovery baseline |
| Ollama | Simple local model management and development endpoint | Convenient isolated development option; not automatically the production serving layer |
| LiteLLM | Unified model gateway, provider routing and policy integration point | Evaluate as the adapter behind AEGIS controls; test auth, budgets and logging settings |
| BentoML | Packaging and serving custom ML services | Later option if custom packaging/workflows justify it |
| NVIDIA Triton | General multi-framework GPU inference serving | Later option when measured workloads and NVIDIA hardware justify its operational complexity |
| LoRAX | Multi-LoRA adapter serving | Later specialist option only if multiple fine-tuned adapters become necessary |

Do not install all runtimes. Select one runtime after hardware inventory and workload tests. Do not expose an OpenAI-compatible endpoint without authentication and network restrictions.

## 4. Model lifecycle and training tools

- **Unsloth:** candidate for efficient LoRA/QLoRA fine-tuning and local model experimentation.
- **LLaMA-Factory:** candidate training/fine-tuning workflow; compare its model, dataset, evaluation and deployment support against the exact chosen model.
- **Hugging Face Transformers:** reference path for model loading, evaluation and compatibility.
- **Triton kernels / inference optimizations:** performance implementation details, not a reason to select a model or host before benchmarking.

Fine-tuning is not the first step. Start with an approved base model, a strong system prompt, retrieval where current factual knowledge is required, and a repeatable evaluation set. Fine-tune only when a measurable behavior gap remains and a lawful, consented, de-identified training dataset exists.

Never train on user health data, private conversations, credentials or repository secrets by default. Training data requires provenance, purpose limitation, retention and deletion policy, and a documented lawful basis.

## 5. Model selection strategy

Do not pick a model by popularity or parameter count alone. Compare candidate open-weight instruction models against:
- model licence and use restrictions;
- language quality, reasoning and tool-call reliability;
- context length and actual memory use;
- quantized quality and hardware compatibility;
- prompt-injection robustness and refusal behavior;
- latency, throughput and concurrent-session capacity;
- structured output reliability;
- vision/audio requirements, if any;
- release cadence, provenance and security response.

Use hardware-dependent tiers only as an initial shortlist:
- CPU or small GPU: compact quantized models (roughly 3B–8B class) for simple private tasks.
- Adequate GPU: mid-sized models (roughly 14B–32B class) for stronger general tasks.
- Large multi-GPU host: larger models (70B class and above) only after capacity, throughput and cost are demonstrated.

These are broad planning categories, not claims that the current Oracle environment can run them. No Oracle instance, GPU type, VRAM, tenancy quota or network topology has been verified. Do not order or provision hardware based on these tiers.

## 6. Data classification and routing

| Data class | Default route |
|---|---|
| Public information | Approved private model or external provider according to policy |
| Internal AEGIS code and operational docs | Private model by default; external provider only after explicit policy approval |
| Personal or account data | Private inference only, with least-privilege retrieval and retention controls |
| Health Vision images, notes or identifiable health data | Excluded from this initial LLM pilot; separate privacy, clinical safety and legal approval required |
| Secrets, tokens, passwords and private keys | Never send to model prompts, embeddings, logs or training datasets |

External provider fallback must be explicit and visible to the policy layer. If private inference is unavailable, sensitive requests should fail closed or return a clear unavailable response, not silently fall back to a hosted model.

## 7. Security baseline

- Bind model servers to private interfaces; deny public ingress.
- Require authenticated service-to-service access and TLS across network boundaries.
- Use separate service identities, short-lived credentials where possible, least-privilege scopes and secret rotation.
- Apply egress allowlists; disable or explicitly configure telemetry and external artifact fetches.
- Pin container images, runtime versions, model revisions and tokenizer revisions.
- Verify model artifact provenance and hashes; scan dependencies and images.
- Keep prompts and completions out of ordinary logs. Log metadata needed for audit without recording sensitive payloads.
- Set request size, context, concurrency, token, time and cost limits.
- Treat model output as untrusted. Tool calls must be validated and authorised independently by AEGIS.
- Never allow the model to mint grants, change permissions, access secrets or execute arbitrary shell commands.
- Provide a kill switch, rollback to prior approved model revision and incident procedure.

## 8. Integration with the current AEGIS work

- **PR #192 Integration Sandbox:** model endpoints become metadata-only candidates until owner admission, verified security evidence, exact grants and Sentinel policy gates are satisfied.
- **PR #193 Health Vision Stage 1:** remains isolated and non-diagnostic. This proposal does not connect health images or notes to any LLM.
- **PR #194 AI Workspace/Retrieval:** LibreChat may be an optional client; LlamaIndex may call the private model gateway for embeddings/generation only after adapter review; SereneDB remains an optional rebuildable retrieval index. None bypasses AEGIS policy.
- **Cloudflare:** retain the existing UI/API boundary. Do not try to host GPU inference inside a Pages/Workers runtime.
- **Oracle Cloud:** possible future private compute location, but only after the actual tenancy, existing instances, region assignment, GPU availability, quotas, network and cost are verified. Do not create an instance for this evaluation.

## 9. Staged implementation plan

1. **Inventory (read-only):** identify existing approved provider gateway, model keys by secret name only (never reveal values), current routing, available host(s), CPU/RAM/GPU/VRAM, storage, egress and network controls.
2. **Local synthetic smoke test:** run a small quantized model on a developer-controlled machine or existing approved host, with synthetic prompts only. No new paid resources.
3. **Gateway proof:** route requests through the AEGIS policy boundary and LiteLLM test endpoint; verify authentication, model allowlisting, rate limits, fallback behavior and redacted logs.
4. **Security tests:** attempt unauthenticated access, cross-tenant retrieval, prompt injection, tool escalation, egress and payload leakage. Require negative tests to pass.
5. **Quality/operations benchmark:** compare task accuracy, tool-call correctness, latency, throughput, memory, failure recovery and cost on a fixed synthetic evaluation set.
6. **Controlled pilot proposal:** present exact model, licence, host, capacity, data boundary, risks, rollback and operating cost for owner approval.
7. **Optional fine-tuning:** only after a measured need and approved dataset; keep training and inference artifacts versioned and reproducible.

## 10. Acceptance criteria

A private model endpoint is not admitted until all are evidenced:
- model weights and all inference processing stay inside the approved boundary;
- no unapproved external egress or silent provider fallback;
- authentication, least-privilege identity, TLS and private network binding;
- Sentinel and AEGIS authorization checks cannot be bypassed by prompts or tool calls;
- sensitive payloads are absent from ordinary logs and telemetry;
- model/licence/dependency provenance and artifact hashes are recorded;
- fixed evaluation tests pass for quality, safety and tool-call behavior;
- resource limits, overload handling, health checks and rollback are tested;
- operational owner, patching, monitoring, backups and incident runbook are documented.

## 11. Explicit non-goals

This proposal does not provision Oracle compute or GPU capacity, change Cloudflare, install model runtimes, download model weights, fine-tune models, add API keys, connect production tools, route Health Vision data, enable autonomous shell execution, or replace external providers immediately.

## Official references checked (22 November 2026)

- vLLM docs: https://docs.vllm.ai/en/latest/
- llama.cpp: https://github.com/ggml-org/llama.cpp
- Ollama docs: https://docs.ollama.com/
- LiteLLM docs: https://docs.litellm.ai/
- Unsloth docs: https://unsloth.ai/docs
- LLaMA-Factory: https://github.com/hiyouga/LLaMA-Factory
- BentoML docs: https://docs.bentoml.com/
- NVIDIA Triton docs: https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/
- LoRAX: https://github.com/predibase/lorax


## 12. Desktop and local workbench candidates

Jan and text-generation-webui are useful additions to the evaluation, but they should not be confused with the production AEGIS inference service.

| Tool | Best role in AEGIS evaluation | Strengths | Boundary / decision |
|---|---|---|---|
| Jan Desktop | First local operator client and small-model smoke-test candidate | Desktop UI; local llama.cpp/MLX model execution; documented OpenAI-compatible local API; can connect to compatible gateways | **Recommended first desktop evaluation**, subject to a compatible host and hardware. Keep the API bound to 127.0.0.1 for a personal test. Jan can also connect to cloud providers, so select and verify the local model route explicitly. |
| text-generation-webui (oobabooga/textgen) | Optional advanced local model workbench | Multiple inference backends, model/adapter experimentation, UI and compatible API; supports tool-calling and extensions | **Secondary specialist evaluation**, not the default AEGIS production server. Its extension and tool surface increases review burden. Pin a release/commit and inspect the licence and dependencies before any trial. |
| llama.cpp / llama-server | Minimal local inference engine | Direct GGUF runtime and API without requiring a full chat workbench | Preferred low-resource engine baseline where the host supports it. |
| vLLM | Controlled production serving candidate | Dedicated model serving and concurrency features | Prefer only after a suitable GPU host and workload are verified. |

### Jan-specific checks

Jan's documentation describes a local API server with an OpenAI-compatible interface. The documented default is 127.0.0.1:1337; its configuration can bind to 0.0.0.0 for LAN access, and API-key authentication can be disabled if left empty. For the AEGIS test, keep loopback binding, set authentication if any other local process can reach it, and do not enable LAN exposure or server-side tool execution. Verbose request/response logging must be reviewed and disabled or suitably redacted before any sensitive test. Jan's local server can also be configured with remote providers; a Jan UI alone is not proof that a request stayed local.

### text-generation-webui-specific checks

The current oobabooga textgen project documents a desktop/local model application with multiple backends and OpenAI/Anthropic-compatible APIs. Its API options include network listening, API keys and a public Cloudflare URL option. AEGIS must not use the public-URL/tunnel option for this pilot. Keep the service loopback-only, require an API key, do not enable admin/model-management endpoints for clients, and leave arbitrary extensions or tool execution disabled until each capability has been separately reviewed. Treat the extension ecosystem, model loaders and Python dependencies as additional supply-chain and attack surface.

### Proposed evaluation decision

1. Use Jan as the simplest human-operated local client for a synthetic prompt smoke test, if a suitable Windows, macOS or Linux host is available. Do not assume the Chromebook can host a useful model; first establish its supported Linux environment, RAM, CPU and storage without installing anything.
2. Compare one small GGUF model against llama.cpp directly using the same synthetic prompt set. Record model revision/hash, quantization, memory use, latency and output quality.
3. Only add text-generation-webui if the evaluation needs its extra backend, extension, vision or adapter experimentation. Do not deploy Jan or text-generation-webui as a public AEGIS service.
4. For AEGIS integration, connect a client only to a test gateway endpoint. AEGIS authentication, Sentinel authorization, audit, quotas and data classification must remain in front of every model runtime. A desktop API key is not a substitute for AEGIS identity or policy.
5. Do not use personal, account, repository-secret or Health Vision data in either workbench. Synthetic data only.

## 13. First pilot: definition of done

The first pilot is a **local-only, synthetic-data model smoke test**, not a Cloudflare or Oracle deployment.

- A host is identified and its CPU, RAM, GPU/VRAM, free storage and operating system are recorded.
- One small, licence-reviewed GGUF instruction model is selected; its exact repository revision and artifact hash are recorded.
- Jan or llama.cpp is selected as the single initial runtime; do not install multiple runtimes just to compare them.
- The model endpoint listens on loopback only and is not exposed through a tunnel, router port-forward, public URL or LAN binding.
- A fixed synthetic test set checks basic instruction following, structured output, refusal behavior and prompt-injection handling.
- Request/response logging is inspected for accidental payload retention; secrets and real user data are never included.
- The test records cold-start time, warm latency, peak RAM/VRAM, model load failures and observed output quality.
- Results are written up with limitations and a stop/rollback note before any AEGIS gateway integration is proposed.

**Stop conditions:** no suitable host, unclear model licence/provenance, unexpected outbound traffic, unauthenticated non-loopback access, sensitive payload logging, unstable runtime, or any request to connect production tools/health data. If any stop condition occurs, do not proceed to the gateway stage.

## Additional official references checked (22 November 2026)

- Jan local API server: https://docs.jan.ai/desktop/api-server
- Jan API reference: https://docs.jan.ai/desktop/api-preference
- Jan custom endpoints: https://docs.jan.ai/desktop/remote-models/custom-endpoint
- Jan model management: https://docs.jan.ai/desktop/manage-models
- oobabooga textgen repository: https://github.com/oobabooga/textgen
- textgen API documentation: https://github.com/oobabooga/textgen/wiki/12-%E2%80%90-OpenAI-API


## 14. Jan Desktop configuration hardening (current documentation check)

The current Jan Desktop documentation adds several operational details that must be included in any local pilot checklist:

- A local model must be loaded and selected as the default Local API Server model before the server can start.
- The documented default endpoint is `http://127.0.0.1:1337/v1`; keep the host at `127.0.0.1`. Do not change it to `0.0.0.0` or expose it through a tunnel, router port-forward or public URL.
- Configure a non-empty API key even for a loopback pilot. An empty key disables authentication.
- Turn **Verbose Server Logs off** before testing anything other than synthetic prompts; the setting is documented as enabled by default and can record request/response details.
- Turn **CORS off** when the API is used only by local non-browser clients. It is documented as enabled by default.
- Keep **Execute Tools on Server** disabled. Tool execution must remain client-dispatched and, for any later AEGIS integration, independently checked by AEGIS policy and Sentinel.
- Jan can route requests to configured remote/custom providers as well as its local model. A Jan interface or running API server is therefore not proof of local-only inference; verify the selected model/provider and test network behavior before describing a request as private.
- Jan's local API documents OpenAI-compatible chat completions and an Anthropic-compatible messages endpoint. Compatibility does not establish equivalent support for every tool, vision, audio or structured-output feature; test only the capabilities actually needed.

**Pilot configuration acceptance:** loopback binding; non-empty API key; verbose logs off; CORS off unless a reviewed browser client requires it; server-side tool execution off; local model explicitly selected; synthetic test prompts only; no external provider selected. Re-check these settings after Jan updates because defaults and behavior may change.

**Source check (22 November 2026):** Jan Local API Server documentation and API reference:
- https://docs.jan.ai/desktop/api-server
- https://docs.jan.ai/desktop/api-preference
- https://docs.jan.ai/desktop/quickstart
