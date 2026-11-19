# Forge Tree-sitter namespace member analysis

Date: 17 November 2026

Status: isolated prototype implementation; namespace-member test suite passed in full GitHub Actions workflow 44092856965 on commit d58d128f90c81761d4e5236161833090cca09d35. Not integrated into production Forge.

## Contract

The namespace-member adapter extends the existing bounded Tree-sitter report without changing the base parser contract. It returns:

- `namespaceMemberEdges`: a source file, target module, imported namespace, member name, usage kind (call or member), source location and target declaration location.
- `unresolvedNamespaceMembers`: a namespace member whose target module is resolved but whose directly declared export is missing or ambiguous.

Only direct dot-member expressions with identifier objects and identifier/property-identifier properties are considered. Computed property access, dynamic dispatch and namespace star re-export forwarding are not resolved.

## Shadowing behaviour

Before linking a member to an imported namespace, the adapter checks supported local bindings in the use site's lexical scope chain. A visible local declaration with the same identifier suppresses the namespace edge. The first pass covers:

- Variable declarators using the existing bounded `var` versus lexical declaration scope rules.
- Function and class declarations.
- Simple identifier parameters, including supported function and arrow-function parameter lists.
- Simple catch-clause identifier bindings.

Complex destructuring, parameter-property forms and complete ECMAScript/TypeScript binding semantics remain unsupported. Unsupported cases must not be described as complete namespace resolution.

## Safety and scope

- Reuses the bounded base analyser and its exact selected source bundle.
- Parses source as text only; never imports, evaluates, builds or executes it.
- No package installation, network access, production route or permission changes.
- Evidence is structural and source-level; it does not prove runtime binding, type correctness or successful compilation.
- The prototype is not wired into production Forge.

## TDD evidence

- Test-only commit `fe890a831c6446404e2b18dea53c7a51c8f7f650` produced RED in workflow [44092360347](https://github.com/LAURENCE1977/Aegis-/actions/runs/44092360347); the initial namespace-member contract tests failed because the result contract was absent.
- The first implementation run exposed a sort-key defect: edge records use `source`, while unresolved records use `path`. The failing stack was in the deterministic evidence comparator.
- The comparator was corrected to sort both record shapes by their canonical source path.
- Added a regression ensuring a function parameter named like an imported namespace suppresses the false member edge inside that function while preserving the real namespace reference outside it.
- Test-only commit `d58d128f90c81761d4e5236161833090cca09d35` was verified by full workflow [44092856965](https://github.com/LAURENCE1977/Aegis-/actions/runs/44092856965), which completed successfully.
- Implementation commit: `e0e656a7f2fe5c249d14124c35f48fd392d8af10`.

## Remaining limitations

- Namespace shadowing is not a complete language-semantic resolver; destructuring and complex binding patterns remain unresolved.
- Namespace member resolution currently targets direct exports only. Multi-hop re-export/barrel forwarding and export-star conflict semantics are not resolved.
- Computed member access, dynamic dispatch, TypeScript type-only namespace semantics and package/path alias resolution are not covered.
- The adapter reparses the bounded selected bundle after the base analyser; performance and memory costs have not been benchmarked.

Do not promote or integrate this adapter until broader binding and barrel-forwarding cases are covered, deterministic graph serialization is complete, and Workers/WASM runtime and resource benchmarks have been measured.
