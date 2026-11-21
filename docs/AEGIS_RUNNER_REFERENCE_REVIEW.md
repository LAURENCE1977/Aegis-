# AEGIS INFINITY — Runner Reference Review

**Reviewed:** 2026-11-21  
**Purpose:** Convert the Experimental Lab policy contract into a testable implementation plan.  
**Status:** Source-level reference review only. No upstream code was installed, built or executed.

## 1. Pinned source reviewed

Repository: https://github.com/agentic-os-org/ANOLISA  
Licence metadata at reviewed commit: Apache-2.0  
Default branch: `main`  
Pinned commit: `727126202fe2a5baaca3fbf13c25721d3457e1f9`  
Commit URL: https://github.com/agentic-os-org/ANOLISA/commit/727126202fe2a5baaca3fbf13c25721d3457e1f9

Inspected files at that exact commit:

| File | Blob SHA | Review focus |
|---|---|---|
| `src/agent-sec-core/linux-sandbox/src/policy.rs` | `bbce66572fb56c02a0d398f26722b6a29b14c181` | Default filesystem/network policy |
| `src/agent-sec-core/linux-sandbox/src/bwrap_args.rs` | `a7acd4007aa19f0a05a0ae50acbb7e9b06bb0302` | Bubblewrap mount and namespace arguments |
| `src/agent-sec-core/linux-sandbox/src/seccomp.rs` | `9d72799c7ae4df902306144774479868180ff3bf` | no_new_privs and syscall restrictions |
| `src/agent-sec-core/linux-sandbox/src/runtime.rs` | `2db513f7938511da3bd5d3ad5f307f2609eace54` | Pinned path identity, mount preparation and execution lifecycle |
| `src/agent-sec-core/linux-sandbox/src/cli.rs` | `15333a7861f80fa879778a94d4431726ccae03dc` | Policy-to-Bubblewrap call path |
| `src/agent-sec-core/linux-sandbox/tests/suite/strict_runtime.rs` | `cb5eee28efec5ed762f311e9331ce910dbc19ab2` | Real filesystem/network isolation test cases |
| `src/agent-sec-core/v2/crates/asc-sandbox-types/src/lib.rs` | `1b9b406aa04e8c7e48a03e85763e289b2f4577c7` | ExecutionSpec and PathFact contract |
| `.github/workflows/ci.yaml` | `58104780f765254a59a606f04390cf61be742fdf` | Dedicated Linux integration CI job |

## 2. Positive controls supported by source

- Filesystem policy defaults to restricted; the default root entry is read-only.
- Network policy defaults to restricted.
- The CLI derives Bubblewrap network mode from the explicit policy: restricted becomes an isolated network namespace; enabled networking remains full access; managed proxy routing uses a separate proxy-only mode.
- Bubblewrap builds an explicit filesystem view, enters fresh user and PID namespaces, and can isolate networking. The ordinary CLI path supplies an explicit network mode rather than relying on `BwrapOptions::default()`.
- Path preparation records canonical path, device and inode identity. The runtime rechecks identity before mounting and rejects special filesystem objects.
- Parent paths are opened component-by-component with `openat`, `O_NOFOLLOW` and directory constraints to reduce symlink redirection. The installed mount plan is then independently verified using `openat2` with `RESOLVE_NO_SYMLINKS`, mount-root checks and read-only checks.
- The strict seccomp baseline sets `PR_SET_NO_NEW_PRIVS`; denies ptrace/process-memory access, mount and namespace-changing syscalls, BPF/perf, io_uring and keyring operations; constrains socket families/types; and blocks `clone3` so libc can fall back to inspectable `clone` flags.
- The strict helper clears the target environment before applying the explicit environment, drops setup capabilities before target-controlled code runs, marks itself non-dumpable, closes unlisted file descriptors and reports installation/start/exit as separate status events.
- The helper waits for the target as PID 1 in its isolated PID namespace; helper exit causes remaining descendants to be reaped by namespace teardown.

These are source observations, not proof that AEGIS has reproduced or independently validated the boundary.

## 3. Important qualifications and gaps

1. **Resource limits are not present in the inspected ExecutionSpec.** The reviewed contract has launch details, permissions, path facts and mount aliases, but no CPU quota, memory ceiling, PID ceiling, disk/output quota or wall-clock deadline. AEGIS must enforce these separately at the VM/hypervisor and guest cgroup/process layers.
2. **Bubblewrap's helper default is permissive.** `BwrapOptions::default()` sets full network access. The reviewed normal CLI path explicitly derives the mode from policy; AEGIS must preserve this explicit-policy construction and must never call a permissive default path accidentally.
3. **Network isolation is not a full VM boundary.** It is defense in depth inside a Linux guest. AEGIS should place hostile workloads in disposable VMs/microVMs with no host credentials, no host mounts and no shared writable state.
4. **The strict runtime tests are gated.** Tests return early unless `ASC_SANDBOX_INTEGRATION` is set. The pinned CI workflow does explicitly set it and includes a dedicated Ubuntu 24.04 job that installs Bubblewrap, runs strict runtime tests as non-root and root, builds a static helper, and runs CLI/authorization lifecycle suites. This is good CI design evidence; it is not a test run performed by AEGIS.
5. **The CI job changes a host user-namespace AppArmor sysctl.** That is a runner prerequisite, not something AEGIS should copy into production hosts without a separate host-hardening review.
6. **No escape-resistance certification is implied.** AEGIS still needs independent adversarial tests, including kernel/runtime version matrix, mount and path races, inherited-FD attacks, namespace abuse, DNS/SSRF attempts, archive bombs, fork bombs and teardown failures.
7. **Licence metadata is not a complete legal review.** Apache-2.0 metadata is recorded at the pinned commit; review the full licence and all copied dependency/component licences before reusing code.

## 4. AEGIS implementation direction

Use ANOLISA as a technical reference, not as a dependency or security authority. Do not import its monorepo wholesale.

Recommended architecture:

- **Control plane outside the guest:** AEGIS Forge, experiment registry, evidence ledger, review inbox and Sentinel remain outside the disposable execution environment.
- **Approval envelope:** human review and Sentinel independently authorize the exact source commit, image digest, profile digest, command/test plan, network policy and resource budget. Any change invalidates the approval.
- **Disposable VM/microVM:** create from a clean, immutable image; one experiment per instance; no production credentials, host home, Docker socket, SSH agent, browser profile or host namespace sharing.
- **Guest defence in depth:** non-root workload identity; read-only pinned source; isolated temporary workspace; Bubblewrap or equivalent namespaces/mounts; seccomp; dropped capabilities; no-new-privileges; closed inherited FDs.
- **Hard resource enforcement:** hypervisor CPU/memory limits plus guest cgroup CPU, memory, pids and I/O limits; bounded disk/output volume; watchdog wall-clock timeout. Fail closed if any limit cannot be installed or verified.
- **Network:** disabled at VM boundary by default. If a test needs network, require a new explicit approval and route through a narrowly allowlisted egress proxy; block metadata IPs, private ranges and DNS rebinding paths.
- **Evidence return:** signed execution receipt containing source/image/profile digests, runner version, start/end times, enforced limits, network mode, exit status, logs and output hashes. Outputs remain quarantined and are not executable by the control plane.
- **Teardown:** destroy the VM and ephemeral disks, verify deletion, retain only bounded evidence, and record cleanup failures as a failed experiment.
- **No authority escalation:** an agent may propose a test plan; it cannot grant itself execution, approve its own result, broaden network access or merge/deploy. Sentinel remains independent.

## 5. Proposed build sequence

| Stage | Deliverable | Gate |
|---|---|---|
| R0 | Runner interface and immutable execution-envelope contract | Unit tests for exact fields, canonical digests, bounds and fail-closed defaults |
| R1 | Disposable VM provider adapter (create, inspect, cancel, destroy) | Provider contract tests; no workload execution |
| R2 | Guest bootstrap with signed one-use job envelope | Verify signature, replay protection, image/profile digests and no secret inheritance |
| R3 | Guest enforcement for filesystem, seccomp, network and resource limits | Adversarial integration tests in disposable CI VMs |
| R4 | Bounded evidence/output return and cleanup attestation | Tests for timeout, crash, cancellation, oversized output and cleanup failure |
| R5 | Human review + Sentinel authorization binding | Exact digest binding; negative tests for self-approval, replay and stale approval |
| R6 | First harmless synthetic workload | Independent review of evidence and teardown before any third-party repository is eligible |

Do not start at R6. Do not enable arbitrary repository execution until R0–R5 pass their gates.

## 6. Current disposition

**ANOLISA: retain as the strongest source-level Linux sandbox reference in this audit.** Its source demonstrates meaningful filesystem, namespace, seccomp and path-identity controls, and its CI contains an explicit real-isolation test job. It does not supply AEGIS's complete VM boundary, resource budget contract, evidence governance or Sentinel authority model.

**AEGIS status remains unchanged:** PR #159 is a policy contract; PR #160 is audit documentation. Neither creates a live runner. No third-party code has been installed or executed.
