# REA: HKUDS/CLI-Anything

**Disposition:** Selective adaptation / reference architecture. Do not install the hub or generated harnesses into the AEGIS control plane.  
**Assessment date:** 2026-11-17  
**Inspected upstream ref:** `main` at `34f519533bc175d2fe287ab8316b0dd99bb9cc43`  
**Canonical source:** https://github.com/HKUDS/CLI-Anything  
**Related hub documentation:** https://github.com/HKUDS/CLI-Anything/blob/main/docs/hub/index.md  
**Inspection depth:** Targeted repository-level triage. README, SECURITY.md, CONTRIBUTING.md, release notes, hub documentation, repository tree and pinned main commit inspected. Not a full source audit: generator internals, each harness backend, transitive dependencies, runtime permissions and all package install hooks were not exhaustively inspected. No upstream code was executed.

## 1. What it does

CLI-Anything is a Python-based methodology and ecosystem for exposing existing software through agent-oriented command-line harnesses. Its documented workflow generates command groups, a Click-based CLI/REPL, machine-readable JSON output, tests and skill documentation. CLI-Hub discovers, installs, updates, uninstalls and launches contributed harnesses and selected public CLIs.

The useful architectural idea is a **typed, self-describing tool boundary** between an agent and an application. A CLI can make an existing application easier for an agent to inspect and operate without requiring the agent to understand the application's GUI.

## 2. Provenance and licence

- The inspected repository identifies itself as Apache-2.0; the upstream tree contains a LICENSE file.
- The inspected main commit is `34f519533bc175d2fe287ab8316b0dd99bb9cc43`.
- Apache-2.0 is generally compatible with adaptation subject to its notice, attribution and licence obligations. Any source reuse requires a file-level review and preservation of applicable notices.
- The licence of CLI-Anything does not automatically establish the licence, terms or redistribution rights of every wrapped application, third-party CLI, model, asset or service.
- CLI-Hub entries may require separately installed desktop applications, external accounts, network access or vendor services. Each candidate must be assessed independently.
- No source code is copied or vendored into AEGIS by this assessment.

## 3. Architecture and data flow (documented design)

`Agent / skill` → `CLI command and structured arguments` → `harness validation` → `application/backend adapter` → `local application, subprocess or external service` → `human-readable or JSON result`.

The project also provides a registry/package-manager layer for discovery and installation, plus generator workflows and agent-specific skill/plugin installers.

This creates two distinct trust surfaces:
1. **Generation and installation:** third-party harness code, package metadata, install scripts and dependencies enter the environment.
2. **Execution:** model-influenced arguments reach a CLI which may launch subprocesses, write files, alter application state or call network services.

The upstream security policy explicitly identifies subprocess argument injection, script injection, XML/SVG injection, path traversal and credential exposure as relevant risks. It recommends argument arrays rather than `shell=True`, allowlist validation, escaping, path normalization and restrictive credential-file permissions. These are useful safeguards, but they are not a substitute for AEGIS's own isolation and authorisation boundary.

## 4. What AEGIS should take from it

**Adopt as design patterns, not as a runtime dependency:**
- Small, task-specific tool harnesses around existing applications.
- Machine-readable, schema-constrained inputs and outputs.
- Discoverable command descriptions and capability metadata.
- Clear separation between tool interface and application backend.
- A standard harness test suite, including real-backend integration tests where feasible.
- Progressive documentation/skills so an agent loads only the instructions relevant to the selected tool.
- Explicit validation and predictable error contracts.

**Do not import wholesale:**
- The CLI-Hub package manager or its registry as AEGIS's authority for installing/executing tools.
- Agent-specific plugin installers as AEGIS's orchestration layer.
- Generated harnesses as trusted code.
- A second agent runtime, task ledger, memory store, permission system or audit system.
- Any harness with unreviewed shell, subprocess, filesystem, credential or network authority.

## 5. AEGIS overlap and integration boundary

AEGIS already owns agent orchestration, tool registry/metadata, capability grants, Sentinel approvals, Vault credential protection, run history, cancellation and audit lineage. CLI-Anything must not duplicate or supersede those systems.

The appropriate boundary is a future **Forge Tool-Harness Adapter**:

1. Forge inspects a candidate harness and pins its source, version and dependency identity.
2. AEGIS registers only a reviewed capability manifest: input schema, output schema, required permissions, filesystem scope, network scope, side-effect class and timeout/resource limits.
3. Sentinel authorises each invocation using the user's grants and the risk policy. Model-generated arguments never confer authority.
4. Execution occurs in a separate, disposable worker/sandbox, never in the Cloudflare control plane. No ambient secrets; Vault provides narrowly scoped credential references only where required.
5. The worker returns bounded structured output and an execution receipt. AEGIS owns canonical run state, cancellation, audit and user-facing results.
6. Installation, updates and capability changes require provenance checks, review, tests and rollback. No autonomous install or self-promotion to production.

For the current Cloudflare Workers/Pages + D1 architecture, a local desktop CLI cannot simply be invoked inside the existing Worker runtime. A separate platform-specific worker/companion would be required for desktop or USB execution. Until that exists, use the patterns to improve tool contracts and Forge source analysis only.

## 6. Hard-gate review

| Gate | Result | Evidence / qualification |
|---|---|---|
| Source identity | Pass | Canonical GitHub repository and immutable inspected commit recorded |
| Licence | Conditional pass | Apache-2.0 at repository level; individual harnesses and wrapped software require separate review |
| Mandatory paid hosted core | No failure evidenced | The core project presents local CLI/hub workflows; individual integrations may still require paid services/accounts |
| Untrusted code isolation | **Not approved for direct use** | Harnesses execute code and may launch subprocesses or access files/network; AEGIS must sandbox independently |
| Sentinel authority | Pass only with adapter boundary | Upstream has no authority over AEGIS grants; all calls must pass Sentinel |
| Platform/resource fit | Partial | Python 3.10+ and target application/runtime dependencies; unsuitable for direct execution in the current Worker control plane |

No hard gate prohibits using its ideas. Direct installation or execution in the AEGIS control plane is rejected.

## 7. Weighted score

Scores are provisional and reflect the limited inspection depth. Unknowns are not treated as favourable evidence.

| Dimension | Score / 5 | Weighted points | Reason |
|---|---:|---:|---|
| Capability value | 4 | 16 / 20 | Broadly useful agent-to-software interface pattern |
| AEGIS architecture fit | 4 | 12 / 15 | Fits Forge adapters, but must remain subordinate to AEGIS contracts |
| Security and controllability | 3 | 9 / 15 | Security guidance exists; execution and supply-chain surface remains substantial |
| Runtime and hardware fit | 3 | 9 / 15 | Lightweight for some local tasks, but Python and upstream applications vary widely |
| Complexity reduction | 3 | 6 / 10 | Can reduce bespoke integrations; hub and harness ecosystem also add maintenance |
| Maintenance and tests | 3 | 6 / 10 | Large contributor ecosystem and documented tests/CI, but inspected main head is dated 2026-09-22; recent maintenance cadence needs further verification |
| Cost/free viability | 5 | 10 / 10 | Core project is open source; individual integrations may incur separate costs |
| Portability | 3 | 3 / 5 | CLI pattern is portable, but wrapped applications and installers are platform-specific |
| **Total** |  | **71 / 100** | **Selective experiment only** |

## 8. Recommended AEGIS action

**Decision: Selective adaptation. No dependency added.**

The smallest useful next step is to define or refine an AEGIS-owned Tool Harness Contract that can describe:
- stable capability ID and pinned implementation identity;
- strict JSON input/output schemas and size limits;
- read/write/execute/network/credential scopes;
- side-effect and risk classification;
- timeout, cancellation and resource limits;
- Sentinel grant requirements and approval mode;
- provenance, version, test evidence and rollback identity.

Then prototype one harmless, read-only harness in an isolated test worker and compare it against the current AEGIS tool registry. Do not start with arbitrary shell, browser, filesystem write or credential-bearing operations.

### Acceptance tests for a future prototype

- Reject unknown commands, arguments, fields and schema versions.
- Reject path traversal, symlink escapes and out-of-scope file access.
- Prove shell metacharacters remain data and are never interpreted by a shell.
- Enforce network allowlists and deny network by default.
- Ensure no secret is present in model context, logs or tool output.
- Deny calls without a matching Sentinel grant; changing model arguments cannot widen grants.
- Enforce timeout, cancellation, output-size and resource limits.
- Preserve append-only run/audit lineage and return a bounded execution receipt.
- Verify rollback to the last known-good harness version.
- Confirm the AEGIS control plane remains responsive when the worker fails or hangs.

## 9. Confidence and next verification

**Confidence:** Medium for the architectural recommendation; low-to-medium for implementation-level security conclusions because no individual harness backend or generator execution path received a full source audit.

Before selecting a real harness, pin its own repository/version and inspect its entrypoint, backend, dependencies, install hooks, tests, file/network access and licence. A small read-only candidate should be selected based on a concrete AEGIS use case, not popularity or registry size.

**Progress accounting:** This assessment is research/documentation only. It does not increase AEGIS feature-completion percentage.
