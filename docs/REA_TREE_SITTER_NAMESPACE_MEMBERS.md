# Forge Tree-sitter namespace member analysis

Date: 17 November 2026

Status: isolated prototype implementation; latest verification pending.

## Contract

The namespace-member adapter extends the existing bounded Tree-sitter report without changing the base parser contract. It returns:

- namespaceMemberEdges: a source file, target module, imported namespace, member name, usage kind (call or member), source location and target declaration location.
- unresolvedNamespaceMembers: a namespace member whose target module is resolved but whose directly declared export is missing or ambiguous.

Only direct dot-member expressions with identifier objects and identifier/property-identifier properties are considered. Computed property access, dynamic dispatch and namespace star re-export forwarding are not resolved.

## Shadowing behaviour

Before linking a member to an imported namespace, the adapter checks supported local bindings in the use site's lexical scope chain. A visible local declaration with the same identifier suppresses the namespace edge. The first pass covers:
- variable declarators using the existing bounded var versus lexical declaration scope rules;
- function and class declarations;
- simple identifier parameters;
- simple catch-clause identifier bindings.

Complex destructuring, parameter-property forms and complete ECMAScript/TypeScript binding semantics remain unsupported. Unsupported cases must not be described as complete namespace resolution.

## Safety and scope

- Reuses the bounded base analyser and its exact selected source bundle.
- Parses source as text only; never imports, evaluates, builds or executes it.
- No package installation, network access, production route or permission changes.
- Evidence is structural and source-level; it does not prove runtime binding, type correctness or successful compilation.
- The prototype is not wired into production Forge.

## TDD evidence

- Test-only commit fe890a831c6446404e2b18dea53c7a51c8f7f650 produced RED in workflow 44092360347; all three namespace-member tests failed because the result contract was absent.
- The first implementation run exposed a sort-key defect: edge records use source, while unresolved records use path. The failing stack was in the deterministic evidence comparator.
- The comparator was corrected to sort both record shapes by their canonical source path.
- Latest implementation commit at the time of writing: e0e656a7f2fe5c249d14124c35f48fd392d8af10.
- A full GREEN CI result has not yet been observed. Do not promote or integrate this adapter until the complete workflow passes and the unsupported binding cases are covered or explicitly bounded.
