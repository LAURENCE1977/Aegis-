# REA — Tree-sitter parser for Forge code intelligence

Date: 17 November 2026  
Status: source-level first-pass REA complete; runtime prototype required before dependency adoption  
Decision: **prototype/adapt; do not add to the production dependency graph yet**

## Candidate repositories and immutable revisions

| Component | Repository | Reviewed revision | Licence evidence |
|---|---|---|---|
| Parser runtime and web/WASM binding | https://github.com/tree-sitter/tree-sitter | d63dc4a67b7995a7069654cf3d05c8493be8d509 | Root LICENSE is MIT; lib/binding_web/package.json identifies web-tree-sitter 0.28.0 as MIT |
| JavaScript/JSX grammar | https://github.com/tree-sitter/tree-sitter-javascript | 58404d8cf191d69f2674a8fd507bd5776f46cb11 | LICENSE is MIT; package version 0.25.0 |
| TypeScript/TSX grammar | https://github.com/tree-sitter/tree-sitter-typescript | 75b3874edb2dc714fb1fd77a32013d0f8699989f | LICENSE is MIT; package version 0.23.2 |

All three licence files were inspected at the pinned revisions. Preserve the relevant copyright and permission notices if code or substantial portions are redistributed. Record package integrity hashes when an artifact is selected for an implementation prototype.

## What it provides

Tree-sitter is an incremental concrete-syntax-tree parser designed to remain useful when source contains syntax errors. The official web binding supports JavaScript/WASM usage and loading language grammars as individual WASM files. Its documentation explicitly describes precompiled WASM module use in environments such as Cloudflare Workers and Vercel Edge Functions.

The JavaScript grammar supports JavaScript and JSX. The TypeScript grammar supplies TypeScript and TSX grammars and declares a dependency on the JavaScript grammar package. This is a better foundation than the current regex-based import scanner for distinguishing actual syntax nodes from import-like text inside comments and strings.

## AEGIS fit

High-value, narrow fit for Forge's read-only code intelligence:
- Parse import declarations, export declarations, literal and non-literal dynamic imports, CommonJS calls, syntax errors and source positions from syntax nodes rather than regular expressions.
- Add future symbol/reference extraction only after separate query design and tests.
- Retain the existing bounded repository inspector, immutable tree SHA, per-file blob SHA checks, byte limits and no-execution boundary.
- Parser output is evidence, not an instruction and not an authority. It cannot grant tools, permissions or knowledge acceptance.

## Risks and constraints

- MIT licensing is compatible with AEGIS's open-source direction, subject to preserving notices.
- WASM adds binary assets and runtime memory/CPU cost. The actual compressed and deployed sizes, cold-start cost, parsing time and memory peak have not yet been measured in AEGIS.
- Cloudflare's general WASM support does not by itself prove that the exact Workers/Pages bundler configuration, selected binding version and grammar artifacts will package and run correctly in this repository. That must be demonstrated in an isolated test.
- Tree-sitter grammar support is not identical to complete language/compiler semantics. Parsing success does not prove type correctness, safe behaviour or buildability.
- Grammar and runtime versions must be pinned together and updated through Forge provenance and regression tests; never download a moving master artifact at runtime.
- Avoid native Node bindings in the Pages/Workers production path until separately proven compatible. Prefer the official WASM binding.
- The current source inspector lists at most 100 supported files and can mark the listing truncated. Any report must state selection coverage and never imply a whole-repository audit.

## Proposed prototype gate

1. Add a separately isolated parser adapter behind the existing Forge analysis contract.
2. Pin exact web-tree-sitter, JavaScript grammar and TypeScript grammar artifacts, including SHA-256 integrity values and MIT notices.
3. Parse a test corpus covering imports/re-exports, aliases, multiline syntax, comments, strings, JSX, TSX, dynamic imports, CommonJS, malformed syntax and adversarially large files.
4. Extract only import/export relationships in the first parser-backed release; do not add call graphs or semantic claims yet.
5. Verify the exact runtime target in Miniflare/Cloudflare Workers and a browser, including asset loading, WASM instantiation, cold start, execution time, memory and failure behaviour.
6. Enforce file count, per-file bytes, aggregate bytes, parse time and output-size budgets. Abort cleanly on parser failure; retain explicit incomplete/unsupported status.
7. Compare the parser graph against hand-reviewed fixtures and the existing heuristic scanner. The parser must improve precision without silently dropping unsupported syntax.
8. Keep a fallback status, not a misleading success, when a grammar or WASM asset is unavailable.
9. Only then decide whether to vendor the WASM artifacts or bundle them as pinned dependencies.

## Hard boundaries

- Never execute, evaluate, install or build inspected repository source.
- Never fetch grammars dynamically from a user-supplied URL or a moving branch.
- Never allow parser output to modify Sentinel grants, permissions, approvals, provenance records or agent policy.
- Never treat syntax trees as proof of licence compatibility, security or runtime behaviour.
- No paid API, hosted model or subscription is required for Tree-sitter itself.

## Evidence reviewed

- https://github.com/tree-sitter/tree-sitter
- https://github.com/tree-sitter/tree-sitter/tree/d63dc4a67b7995a7069654cf3d05c8493be8d509/lib/binding_web
- https://github.com/tree-sitter/tree-sitter-javascript/tree/58404d8cf191d69f2674a8fd507bd5776f46cb11
- https://github.com/tree-sitter/tree-sitter-typescript/tree/75b3874edb2dc714fb1fd77a32013d0f8699989f
- https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md

No source code, package, grammar or WASM binary has been copied, installed or executed as part of this REA.


## Prototype progress — 17 November 2026

The isolated prototype now exists at `scripts/forge-tree-sitter-prototype.mjs`, with regression coverage in `tests/forge-tree-sitter-prototype.test.mjs`.

Implemented:
- JavaScript, JSX, TypeScript and TSX grammar selection using pinned test dependencies.
- Static imports, re-exports, literal dynamic imports and literal CommonJS `require()` extraction.
- Syntax-error reporting per file without attempting to repair or execute source.
- One-based source line/column coordinates on every extracted relationship; end coordinates are exclusive.
- Deterministic relationship ordering.
- Input boundaries: at most 50 files, 32 KiB per file, 1 MiB aggregate source, supported extensions only, relative normalized paths only, and duplicate path rejection.
- Parser trees are released in a `finally` block.

Verification:
- The source-location regression was first run without implementation and failed in the Node.js test stage as expected (run 44073893286).
- The implementation then passed the Node.js and Cloudflare runtime integration test stage in run 44074021649.
- At the time of this update, the remaining isolated D1 and Forge verification stages in run 44074021649 are still running; do not describe the full workflow as passed until its terminal conclusion is successful.

Still not implemented:
- Production Forge API integration or user-facing architecture graph.
- Symbol declarations/references, call graphs, type resolution or package-manager dependency resolution.
- Browser visual/accessibility verification, Workers/Pages production WASM packaging, and measured bundle/cold-start/memory/parse-time benchmarks.

The prototype is experimental and is not wired into the production Forge analysis route. It remains read-only and must not be treated as a whole-repository audit.
