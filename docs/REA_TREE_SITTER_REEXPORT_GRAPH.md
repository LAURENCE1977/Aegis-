# Forge Tree-sitter multi-hop named re-export graph

Date: 17 November 2026

Status: isolated adapter added; verification pending. Not integrated into production Forge.

## Purpose

The base Tree-sitter prototype resolves a named re-export when its target directly declares the exported symbol. A common barrel pattern needs more: a module re-exports an alias from another barrel, which itself forwards the name to the original declaration.

The adapter in `scripts/forge-tree-sitter-reexport-graph.mjs` builds on the base parser's direct `reExportEdges`, `unresolvedReExports` and `symbols` evidence. It follows explicit named aliases across the selected source bundle and emits:

- `reExportLineage`: the starting public export, ultimate declaration path/name, complete ordered edge chain and declaration location.
- `unresolvedReExportLineage`: cyclic, ambiguous or missing chains with the partial evidence chain and reason.

It deliberately leaves consumer imports as their existing importer-to-barrel relationships. It does not rewrite them into direct consumer-to-origin symbol edges.

## Boundaries

- Only explicit named re-export records from the base parser are considered.
- Only files already present in the bounded selected source bundle are considered.
- No package manager, tsconfig alias, external package, dynamic export or source execution.
- Star exports, namespace re-exports, default re-export corner cases and full ECMAScript/TypeScript export semantics remain unsupported.
- Cycles are detected through visited source/export-name pairs.
- Ambiguous forwarding is retained as unresolved, never guessed.

## Tests

Test-first commit: `c47a2bb118e7ba40e8a55a7bd3a3f43b2145b684` added multi-hop alias and cyclic barrel expectations before the implementation file existed.

Implementation commit: `550396e99b6de956d6c9841105979de18086040b`.

Test refinement commit: `b1883f8b0f133b6a01974f26df99ec50419d3ee5` records both intermediate and outer public aliases in deterministic order.

The GitHub connector has not returned workflow/status records for these commits yet. Do not describe this adapter as CI-verified until a full successful workflow is observed. The implementation and tests require runtime verification before promotion.

## Safety

The adapter consumes the base parser's bounded structural report. It does not execute inspected source, change permissions, update provenance, install dependencies or connect external services.
