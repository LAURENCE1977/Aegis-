# Repository Adaptation Review Template

Use this for every external GitHub repository considered for AEGIS. This is a learning and decision record, not permission to install or execute source code.

## 1. Source identity

- Repository URL:
- Owner / project:
- Default branch:
- Exact commit or release inspected:
- Date inspected:
- Repository visibility / archived status:
- README URL:
- Licence file and SPDX identifier:
- Third-party / vendored licence notes:

## 2. README claims versus code evidence

| Claim or capability | README location | Code/test evidence | Verified? | Caveat |
|---|---|---|---|---|
| | | | | |

Read the README first, then inspect the implementation, tests, configuration, dependency manifests, CI and security documentation. Treat the README as a map, not proof.

## 3. Architecture and interfaces

- Main runtime and language:
- Process/service boundaries:
- Public APIs, protocols and schemas:
- Data model and persistence:
- Provider / model abstraction:
- Tool or plugin system:
- Streaming, retries, cancellation and lifecycle:
- Extension points:
- Hard-coded assumptions or lock-in:

## 4. Security and trust

- Authentication and authorisation:
- Permission model and default behaviour:
- Secret storage and redaction:
- Network exposure, SSRF and redirect behaviour:
- Code execution / shell / file access:
- Browser, device, microphone, camera or screen permissions:
- Audit, revocation and human approval:
- Untrusted input / prompt-injection boundaries:
- Known advisories or suspicious dependencies:

Do not run untrusted code in the AEGIS control plane. Do not grant an imported project permissions merely because it is popular or has a permissive licence.

## 5. Quality and maintenance

- Test framework and exact commands:
- CI workflows and current status:
- Unit / integration / end-to-end coverage:
- Failure-path and security tests:
- Release cadence and latest release:
- Maintainer activity and issue response:
- Dependency count, pinning and supply-chain posture:
- Known open bugs and limitations:

## 6. Runtime, hardware and economics

- Supported OS, CPU, GPU and memory:
- Cloud / local / hybrid requirements:
- Storage, network and bandwidth:
- Latency and throughput evidence:
- Cash cost, token cost, compute cost and power cost (keep units separate):
- Free-tier quotas, reset windows and paid fallbacks:
- Operational burden and host availability:

## 7. AEGIS fit

Choose one: **reuse / adapt / rebuild / combine / reject / hold**.

- Candidate AEGIS seam: provider adapter, skill, tool, workflow, UI, host agent, test adapter or reference only.
- What AEGIS can learn without importing code:
- What code, if any, is worth adapting:
- Licence and attribution obligations:
- What must remain AEGIS-native:
- What conflicts with Infinity Zero:
- What conflicts with Sentinel or least privilege:
- Device/browser/Cloudflare compatibility:
- Complexity added versus capability gained:

## 8. Evidence and experiments

- Claims supported by primary sources:
- Claims supported only by project marketing or community reports:
- Contradictory evidence:
- Confidence: high / medium / low:
- Smallest safe prototype:
- Deterministic tests required before implementation:
- Benchmark baseline and success criteria:
- Rollback / disable strategy:

## 9. Decision record

- Decision:
- Rationale:
- Explicitly not doing:
- Prerequisites:
- Revisit trigger:
- Reviewer / approval state:

## Rules of use

1. Pin the exact source version; branches and READMEs can change.
2. Separate what the project claims from what its code and tests demonstrate.
3. Read licence files and check bundled dependencies before reuse.
4. Prefer learning a pattern and rebuilding it behind AEGIS interfaces over importing a large framework.
5. Measure correctness, quality, latency, resource use, cost and operational complexity.
6. Preserve source links, attribution, limitations and retrieval date.
7. Keep unknown licences, unclear provenance, unsafe permissions or missing evidence at **hold**.
