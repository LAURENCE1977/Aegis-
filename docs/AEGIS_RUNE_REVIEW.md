# AEGIS source review: Rune PTY runner

Reviewed: 16 November 2026  
Repository: https://github.com/CorvidLabs/rune  
Reviewed main commit: `252702cf4d355076b9a4d2533e1d506aad3b0f02`  
Licence: MIT

The connected GitHub account has no repository named Rune among its nine listed repositories. Two public projects named Rune were found; this review covers CorvidLabs/rune because it is the one that provides persistent PTY sessions and human attach/takeover. `morinokami/rune` is a separate TypeScript CLI framework and is not the same project.

This is a source review, not a penetration test. No Rune code was copied or executed.

## Executive decision

**Rune is a strong reference for an optional AEGIS terminal-session worker, but it is not a sandbox, a remote execution service, or an AEGIS task queue.**

Its best contribution is the persistent PTY lifecycle: start a long-running CLI/TUI process once, send bounded input in later calls, read only new output using transcript cursors, and let a human attach to the same session without terminating it. That complements AEGIS durable tasks and human approval.

Do not run it inside the AEGIS Cloudflare Worker, expose its CLI directly as a model tool, or run it in the same secret-bearing process as AEGIS.

## Useful patterns

### 1. Persistent sessions and human takeover

`rune session start/send/read/list/stop/archive/attach` manages a persistent child process behind a detached supervisor. Sessions are namespaced by the working-directory project identity. `attach` gives a human the live PTY; Ctrl-] detaches without stopping the child, so automation can resume.

**AEGIS use:** a dedicated terminal worker can support long-running coding agents, test runners and TUIs. AEGIS owns the durable task, identity, grants, approvals and audit; Rune owns only the local PTY process and transcript mechanics. Human takeover must be exposed through an authenticated AEGIS operator path, never by publishing Rune's local control socket.

### 2. Bounded, incremental output

Rune supports JSON/NDJSON, transcript cursors, bounded output, tail/screen views, transcript rotation and hard log ceilings. This is useful for reducing repeated context and token use.

**AEGIS use:** fetch only output after the last acknowledged cursor, enforce a separate maximum output budget, and return a structured task result rather than repeatedly replaying the full terminal transcript.

### 3. Process supervision

The supervisor tracks process identity (including process start time to avoid PID-reuse mistakes), manages a PTY, detects exited/orphaned children and terminates the process group on stop/timeout. The repository includes adversarial/orphan harnesses and regression tests for output truncation and transcript behavior.

**AEGIS use:** keep this process lifecycle behind the worker adapter. AEGIS should still maintain its own durable task state and reconcile worker state after interruption or restart.

### 4. Argument handling

The current code has an explicit argv path and regression coverage for shell metacharacters in one-element argument arrays. The safe integration path is an argument array, never a caller-supplied shell command string.

**AEGIS use:** expose fixed command IDs mapped to reviewed executable-plus-argv templates. Do not accept arbitrary command strings, shell fragments, executable paths or working directories from the model.

## Security and reliability blockers

### A. Child processes inherit the worker's environment

The inspected PTY/supervisor spawn paths pass a small environment override (for example, PAGER/GIT_PAGER) but do not use an environment-clearing option such as `unsetenv_others: true`. Under Ruby's process-spawn semantics, unspecified variables are inherited from the parent.

That is normal for a local CLI, but dangerous for an AEGIS service: if Rune runs in a process containing `COMPOSIO_API_KEY`, vault keys, database credentials or provider secrets, a child agent or arbitrary command may inherit them.

**AEGIS decision:** run Rune in a separate, unprivileged worker with a deliberately constructed environment allowlist. Never start it in the AEGIS API process or pass secrets as command-line arguments. Prefer a per-task container with only the minimum workspace and network access.

### B. Rune does not sandbox commands

`rune run` and `rune session start -- COMMAND` are general local process runners. The caller chooses the command. The project does not provide an OS sandbox, per-command allowlist, multi-tenant identity boundary, filesystem jail or network egress policy.

Sessions are namespaced by project directory, not by AEGIS principal. The local UNIX control socket is protected by filesystem permissions; it is not a remote authentication protocol.

**AEGIS decision:** Sentinel must authorise a fixed command ID, exact workspace and exact task/session. The worker must enforce the command allowlist again. Use a dedicated OS identity or per-session container, a read-only base filesystem, bounded writable workspace, CPU/memory/PID/time limits, and network egress controls. Treat a Rune session as full authority of its worker identity.

### C. Session directory permission hardening can fail open

`lib/rune/session/store.rb` defines private directory/file modes, but the directory-creation path rescues `SystemCallError` from `File.chmod` and continues. On a filesystem or mount where chmod fails, the code can proceed without proving that the session directories are owner-only. The inspected session spec covers normal modes, symlinks and path handling, but does not appear to inject a chmod failure and assert that creation stops.

**AEGIS decision:** do not copy this behavior. Treat failure to establish private directory/socket permissions as fatal; verify effective modes after creation and add an injected-permission-failure regression test.

### D. PTY settle detection has a documented false-completion case

The authoritative sessions documentation says `--settle-ms` can return `settled: true` after a line editor redraws the submitted input, before the actual answer arrives. It documents this with `irb` and `python3 -q` reproductions. The reply does not distinguish this from a real answer.

**AEGIS decision:** never treat `settled: true` alone as task completion. Prefer explicit `--wait-for-regex`/sentinel completion markers, inspect the transcript cursor and process state, and use a bounded second verification read for interactive TUIs.

### E. Transcripts are local files, not encrypted secrets storage

Rune uses private file modes and bounded/rotated transcripts, but the transcript content is stored as local files. PTY output can contain passwords, access tokens, source code or private data. Commands may also appear in session metadata.

**AEGIS decision:** do not send secrets through PTY input or command arguments. Keep secrets in a separate secret broker; redact output before returning it to AEGIS; encrypt retained transcripts/artifacts at rest; apply retention and deletion policy per principal.

### F. Provenance enforcement is explicitly disabled

The repository's `.trust.toml` sets `[provenance].mode = "off"` and records why manual release signing was disabled. The project is MIT-licensed, but its current configuration does not provide an enforced provenance gate for releases.

**AEGIS decision:** pin the exact commit, verify the repository owner and MIT notice, and independently verify any downloaded binary/image. Do not rely on Rune's release process as a supply-chain attestation.

## Recommended AEGIS integration

Use Rune only behind a narrow terminal-worker adapter on a separate trusted host:

```text
AEGIS agent / UI
      |
      v
Sentinel (principal, exact workspace, command ID, approval, budget, audit)
      |
      v
Terminal Worker Adapter (mTLS, short-lived per-task token)
      |
      v
Dedicated unprivileged Rune worker/container
      |
      v
Fixed executable + argv templates
      |
      v
PTY supervisor and bounded transcript
```

The worker API should accept a command ID from a fixed registry, a workspace ID already authorised by AEGIS, bounded stdin and a time/output budget. It should not accept arbitrary shell text, env maps, filesystem paths or network destinations. The worker returns a structured state, output delta, cursor and effect receipt; AEGIS records the authoritative audit event.

Human takeover should use a short-lived, single-session operator token. The local UNIX socket must remain local to the worker and never be exposed directly to the network.

## Reuse map

| Rune component | AEGIS treatment |
|---|---|
| Persistent PTY supervisor | Adapt as a worker implementation or reference |
| Session attach/detach | Adapt for human takeover behind AEGIS auth |
| Transcript cursor and bounded output | Adopt the interface pattern |
| Process-group cleanup and PID-start-time checks | Adopt the reliability requirements |
| Safe argv handling | Adopt; reject shell strings from agent input |
| Project-path session namespacing | Do not treat as multi-user authorization |
| Local file permission model | Strengthen; fail closed on chmod/socket permission errors |
| Child environment behavior | Replace with a strict allowlisted environment |
| General arbitrary command execution | Never expose directly to the model |
| PTY settle heuristic | Do not use as sole completion signal |
| Local provenance configuration | Independently pin and verify release provenance |

## When it is worth integrating

Rune becomes useful when AEGIS has a trusted Linux execution host (for example, a dedicated mini PC or isolated worker machine) and needs persistent CLI/TUI agents with human takeover. It is not needed for ordinary AEGIS web/API operations, and it should not replace the existing durable task queue or Sentinel.

For the current iPad/iPhone-first AEGIS setup, keep this as a future local-worker capability. The Cloudflare/browser-facing AEGIS app should communicate with a separate authenticated worker rather than trying to run Ruby PTYs inside its request runtime.

## Decision

**Keep CorvidLabs/rune as the preferred PTY-session reference, not an immediate dependency.** Before production use, isolate it, scrub the child environment, add command IDs and argv allowlists, fail closed on permission errors, harden transcript retention, and replace settle-only completion with explicit task completion evidence.
