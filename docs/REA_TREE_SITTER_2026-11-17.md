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
- General symbol-reference resolution, arrow-function variable call ownership, type resolution or package-manager dependency resolution.
- Browser visual/accessibility verification, Workers/Pages production WASM packaging, and measured bundle/cold-start/memory/parse-time benchmarks.

### Local direct-call extraction — implementation added, CI verification pending

The isolated prototype now additionally emits a deterministic `calls` collection for direct identifier calls whose callee is a function declaration in the same file. Each edge includes the caller, callee, file path and one-based call-site coordinates.

Conservative exclusions:
- Member calls such as `service.finish()`.
- Unresolved identifiers and calls to functions not declared in that file.
- Call sites without a named enclosing function declaration.
- No cross-file, alias, dynamic dispatch, type-aware or general call-graph claims.

The regression test first failed as intended on commit `a1eb0b0f953958a66a37acb49120f508f3aedc28` because `result.calls` was not present. The implementation was added in commits `7541fa63ed86a30d77376047c893b252be7ea449` and `6dedbf130e86b3f8d59f77d23103883643102f96`. CI then exposed a fixture issue: the test used literal backslash-n text rather than actual line breaks, so its source-location expectation was invalid. The fixture was corrected in `38cf6fad55b975fc532cf093cefbb1e678e9f41c`. Full PR workflow run `44076185636` passed on that commit, including all 15 stages: the 683-test Node.js suite, Cloudflare/Miniflare integration, isolated capability/runtime/Forge D1 migrations and safeguards. The direct-call test now verifies `start() -> finish()` at line 2, column 3 and excludes unresolved/member calls.

### Arrow-function caller ownership — implemented and verified

The prototype now also identifies the caller when a direct call is nested inside a named arrow function or named function expression assigned to a variable (for example, `const start = () => finish()`). The nearest enclosing supported function is used, so nested function bodies are attributed to their nearest owner. Anonymous callbacks and unsupported ownership shapes remain omitted rather than guessed.

The regression test was added first and failed as intended because the call edge had no caller. Its fixture was corrected to contain actual line breaks, then the implementation was committed in `f94ac07c5eb456c52ef0699584603a308048274d`. Push workflow run `44077462518` passed all 15 stages, including 684 Node.js tests (683 passed, zero failed, one skipped), Cloudflare/Miniflare runtime checks and isolated capability/runtime/Forge D1 verification. The matching PR workflow was still completing at the time of this documentation update.


The prototype is experimental and is not wired into the production Forge analysis route. It remains read-only and must not be treated as a whole-repository audit.


### Lexical call resolution and declaration lineage — implemented and verified

The call extractor no longer treats every function name in a file as globally visible. It now records declarations against their nearest supported lexical scope and resolves each direct identifier call by walking the call site's enclosing scope chain from nearest to outermost.

Supported scope boundaries currently include program, statement blocks, switch bodies, catch clauses and loop statement scopes. Function-scoped `var` function variables are assigned to the nearest supported function/program scope; `const` and `let` function variables use the nearest lexical scope. This is a deliberately bounded first pass, not a complete ECMAScript binding or TypeScript type resolver.

Each emitted edge now includes:
- `path`, `caller`, `callee` and call-site `location`;
- `calleeLocation`, pointing to the resolved declaration in the same source file;
- `calleeKind`, distinguishing a function declaration from a function-valued variable.

Scope identity is compared using the syntax node's type and source-index range rather than JavaScript wrapper-object identity. This matters because separate Tree-sitter node wrappers for the same underlying syntax node are not guaranteed to be reference-equal.

Conservative behaviour:
- A name declared only in an unrelated nested scope does not resolve at an outer call site.
- A nested call resolves to the nearest visible same-name declaration.
- An outer call is not redirected to a declaration that exists only in a nested block.
- Ambiguous duplicate declarations in the same scope are omitted rather than guessed.
- Member calls, unresolved identifiers, cross-file calls, aliases, dynamic dispatch, type-directed resolution and unsupported binding constructs remain outside this call-edge contract.

TDD evidence:
- Added regression coverage for unrelated nested declarations, nearest shadowed declarations, outer-vs-inner target identity and source declaration locations.
- The first red run confirmed the global-name-set false positive: a call in an unrelated function incorrectly resolved to a function declared only in another nested scope (run 44078955277; Node test stage failed as expected).
- A follow-up red run asserted declaration identity and reproduced the same limitation for all three lexical-scope scenarios (run 44079094226).
- The initial scope implementation exposed a Tree-sitter wrapper identity issue: separate node wrappers did not compare equal by object reference. The implementation was corrected to use stable syntax-node identity from node type and source-index range.
- Green push workflow run 44079312226 passed all 15 workflow stages: Node.js/Cloudflare tests, capability/runtime/Forge isolated D1 migrations and integrity checks, durable run cancellation/events, Queue integration, licence gates, immutable source identity, Knowledge Library review lifecycle and append-only events.

The prototype remains isolated from production Forge routes. These edges are source-level structural evidence only; they are not proof of runtime execution, type correctness, safe behaviour or complete call-graph coverage.


### Evidence-based local module dependency edges — implemented and verified

The prototype now resolves literal module specifiers against the exact bounded source bundle supplied to `parseModuleImports`. It emits a separate `moduleEdges` collection and a separate `unresolvedImports` collection; it does not conflate module dependencies with function-call edges.

Resolution behaviour:
- Relative specifiers beginning with `./` or `../` are normalised relative to the importing file.
- Exact file paths are considered first. Extensionless specifiers consider the supported JS/JSX/MJS/CJS/TS/TSX extensions and corresponding `index` files.
- A local edge is emitted only when exactly one candidate exists in the supplied bundle.
- Multiple candidates produce `ambiguous-local-target`; no candidate produces `missing-local-target`.
- Paths that escape the supplied bundle root produce `outside-source-bundle`.
- Bare/package specifiers are reported as `external-package`; they are not represented as local edges.
- Each edge retains source path, target path, import kind, original specifier and source location. Output ordering is deterministic.

TDD evidence:
- Added tests first for static imports, re-exports, extensionless resolution, ambiguity, missing targets, external packages and source-bundle traversal.
- Initial red workflow run 44081742013 failed at the new tests because the `moduleEdges` and `unresolvedImports` outputs did not yet exist.
- The first implementation passed the Node.js/Cloudflare integration stage but exposed one incorrect expected ordering in the unresolved-import fixture; the implementation's deterministic ordering was correct. The fixture was corrected and the full workflow rerun.
- Push workflow run 44081977338 passed all 15 substantive stages, including Node.js/Cloudflare tests, capability/runtime/Forge isolated D1 checks, durable agent-run cancellation/events, Queue integration, Forge licence gates, immutable source identity and Knowledge Library review lifecycle.
- Matching PR workflow run 44081982505 also passed.

Scope and limitations:
- This is a bounded source-bundle graph, not a complete package-manager or TypeScript module resolver.
- It does not read package.json aliases, tsconfig paths, package exports, node_modules, symlinks, generated files or files outside the supplied bundle.
- A resolved file edge proves only that one literal specifier maps to one supplied path under this resolver's rules. It does not prove the module loads, builds, executes or is safe.
- Symbol-level import binding and export identity resolution are the next separate step; do not infer that imported names are correctly bound merely because a file edge exists.
- The prototype remains isolated from production Forge routes and has no authority over Sentinel, permissions or execution.


### Import-to-export symbol identity — implemented and verified

The prototype now makes a second, distinct pass after local module resolution. It extracts default and named import bindings (including named aliases) and matches them against directly declared exported symbols in the resolved target file.

Outputs:
- `symbolEdges`: importer path, target path, imported/exported name, local binding name, import kind, import-site location and target declaration location.
- `unresolvedSymbolImports`: missing or ambiguous export names, retained separately rather than converted into guessed edges.

Supported first-pass cases:
- Named imports, including aliases such as `import { run as start }`.
- Default imports matched to declarations marked as default exports.
- Directly declared exported functions, classes, variables and TypeScript interface/type/enum declarations already represented by the symbol extractor.

Conservative exclusions:
- Namespace imports are not expanded into per-symbol edges.
- Re-export lists and barrel-file forwarding are not followed as symbol aliases yet.
- CommonJS destructuring, dynamic imports, import-equals, package exports, path aliases and type-driven resolution are not treated as proven symbol bindings.
- An import with no matching direct export becomes `missing-export`; duplicate matching declarations become `ambiguous-export`.
- File-level module edges and symbol-level edges remain separate evidence classes.

TDD evidence:
- Added tests first for named imports, aliases, default imports, declaration locations and missing exports.
- Initial red workflow run 44082446924 failed at the new tests because `symbolEdges` and `unresolvedSymbolImports` did not yet exist.
- Implemented import-binding extraction from Tree-sitter import-clause/import-specifier nodes and matched those bindings to exported symbol declarations in resolved target files.
- Push workflow run 44082589942 and matching PR workflow run 44082599328 both passed all 15 substantive workflow stages, including Node.js/Cloudflare tests, capability/runtime/Forge isolated D1 verification, durable run/Queue integration, licence gates, immutable source identity and Knowledge Library review lifecycle.

This is source-level declaration matching, not proof of runtime binding or successful compilation. The parser remains isolated from production Forge routes.


### Function-scoped `var` call resolution — corrected and verified

A regression test now covers a function-valued `var` declared inside a nested block and called later from the enclosing function. JavaScript hoists the binding to the nearest function scope, so a block-only lookup would incorrectly leave the call unresolved.

The first fixture used a literal escaped newline sequence and was corrected before accepting the test evidence. With real line breaks, the red run reproduced the intended failure: the call to `finish` was not resolved (run 44083360686). The resolver was then corrected so its scope walk includes supported function-scope nodes as well as lexical block/program scopes.

Verification:
- Push workflow 44083450125 passed all substantive stages.
- Matching PR workflow 44083457668 passed.
- The new regression asserts the call-site line and the actual `var` declaration line, ensuring the edge is tied to the declaration rather than just the identifier spelling.

This remains a bounded approximation of JavaScript lexical binding. Complex destructuring, eval/with, hoisting interactions beyond the tested cases, TypeScript namespaces and other unsupported binding forms must remain unresolved rather than guessed.


### Explicit named re-export lineage — implemented and verified

The prototype now extracts explicit named re-exports from source files and resolves their immediate source declaration when that declaration is present in the selected source bundle.

Each resolved edge records:
- Re-exporting module (source) and directly referenced module (target).
- Original exported name (imported) and public alias (exported).
- Re-export source coordinates and the original declaration coordinates.

Unresolved cases are retained in unresolvedReExports with a reason rather than guessed. Star/namespace re-exports are explicitly marked unsupported by this pass. Re-export edges are not flattened into direct consumer-to-origin symbol edges; multi-hop barrel forwarding and export-star conflict resolution remain future work.

TDD evidence:
- Added a consumer-facing regression test before implementation. The first run failed in the Node.js test stage on commit 53b5aa4b7dfe8dfd5d08ffb21db1712a5ac9d0ee (workflow 44087327369), establishing the missing re-export result.
- Implemented syntax extraction and direct declaration resolution in commits 06f95e38d9009c46930bb17c8467eff892f442b3 and 808ad678e263a52ddf75d77481c5d043320dfdda.
- Full workflow 44087455235 passed on 808ad678e263a52ddf75d77481c5d043320dfdda, including Node.js tests, Cloudflare/Miniflare integration and all isolated capability, runtime and Forge D1 safeguards.

The parser remains an isolated prototype: no production Forge route integration, no source execution, no dynamic package resolution, and no production WASM adoption.


### Namespace import bindings — implemented and verified

The prototype now records namespace imports as explicit module-level bindings, including source file, module specifier, local namespace name, kind and source location.

Namespace imports are intentionally not expanded into guessed per-symbol edges. Their presence is represented separately in namespaceBindings until member-level resolution can account for namespace aliases, shadowing and module export semantics.

TDD evidence:
- Added a regression test first; the test-only commit d586804856dd4743022ce4c567776d4699704d42 failed in the Node.js test stage (workflow 44087716655), as namespaceBindings was not yet exposed.
- Implemented namespace binding extraction in commit 82235458bfeed53c55977c7a92e119eb4246146e.
- Full workflow 44087835272 passed on that commit, including Node.js tests, Cloudflare/Miniflare integration and all isolated D1/Forge safeguards.

Remaining limitations: namespace member calls, namespace re-export aliases, shadowing-aware member resolution and cross-file symbol identity are not implemented.


### Local module dependency cycles — implemented and verified

The prototype now computes strongly connected components over resolved local module edges and emits moduleCycles as deterministic, sorted file-path groups.

- Multi-file circular dependencies are reported as one strongly connected component.
- Self-imports are reported as single-file cycles.
- External packages and unresolved/ambiguous local imports do not create graph edges and therefore cannot create fabricated cycles.
- The analysis is bounded by the existing maximum of 50 selected source files.

TDD evidence:
- Added a regression test first; the test-only commit cd27c5c5624574763be03f8ac087131df569cfb8 failed in the Node.js test stage (workflow 44088091061).
- Implemented deterministic strongly connected component detection in commit eee7b35b44511b74438d219ea263669b338c0942.
- Full workflow 44088216093 passed on that commit, including Node.js tests, Cloudflare/Miniflare integration and isolated D1/Forge safeguards.

This is a local selected-bundle graph, not a whole-repository dependency audit. Dynamic imports are represented only when their module specifier is a string literal and resolves within the supplied bundle.
