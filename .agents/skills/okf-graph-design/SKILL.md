---
name: okf-graph-design
description: Design or review package boundaries, public exports, shared contracts, and Effect service ownership in the OKF Graph repository. Use when adding or moving a package or module, changing how callers import or provide it, or deciding where reusable graph and OKF-specific behavior belong.
---

# OKF Graph package and service design

Start with the current owner and the callers that need the change. Read the applicable repository instructions, the package manifest, and the entry point used by those callers. Use [TASTE.md](../../TASTE.md) for TypeScript and Effect conventions.

## Choose the entry point

- Give new packages explicit, concept-named subpaths in `package.json`. Group operations by the question they answer, such as `Centrality.pageRank`. Keep implementation paths out of the public export map. If a wildcard could expose `internal/`, block it with `"./internal/*": null`.
- Preserve established root imports. [The OKF package](../../../packages/okf/package.json) has a root service API, while [the domain package](../../../packages/domain/package.json) has concept subpaths. Use the existing entry point when it serves the caller. Add a subpath when callers need a distinct API.
- Export supported operations, option and result types, and errors callers need to handle. Count use through type inference as part of the contract. Keep helpers private when their only importer would be a test.
- Keep implementation beside its public contract until a distinct responsibility or a second caller justifies extraction. Use `src/internal/` for private modules behind that surface. Keep public signatures and docs with the concept. Avoid runtime cycles between the public module and its internals. [Effect Graph source](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Graph.ts)

## Place contracts and behavior with their owner

- Keep reusable schemas, errors, types, and helpers with the concept they describe. Use Schema for runtime validation, encoding, decoding, or schema generation. Schema also fits option defaults and validation that would otherwise require manual checks. Use readonly TypeScript types for in-memory results when callers only need the shape.
- Review the Schema value and decoded type as separate public declarations. Document accepted data, defaults, and encoding on the Schema. Document what the decoded value represents on the type. Follow the [public contract guidance in TASTE.md](../../TASTE.md#document-the-public-contract).
- Keep dependency direction from domain-specific code toward reusable operations. Put OKF projections and result mapping in `@repo/okf`. Keep Graph Goodies generic over Effect Graph. If two modules need each other at runtime, review who owns the policy before extracting a shared module.
- Keep CLI flags, presentation, output files, and CLI response shapes in the app. Shared packages return reusable data. The [eval command](../../../apps/okf-graph/src/commands/eval.ts) chooses how to present a report returned by the library.

## Decide who owns the service lifetime

Use module functions for calculations over supplied data. Introduce a service when it owns a dependency or lifecycle. Resolve reusable dependencies when building its primary `.layer`. Let the CLI or tests choose platform implementations, and keep private collaborators in the service's wiring.

When an operation returns finished data, scope temporary resources inside the service. Expose `Scope` when the caller needs to keep using a live resource and controls its lifetime. Document when the resource closes. [Effect Scope source](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Scope.ts)

## Verify the consumer

1. Inspect the export map, its target, and a real consumer of the entry point. For a new workspace package, check workspace discovery and that the relevant root tasks select it.
2. Verify the public contract through the real entry point. Tests must not import internal exports. Use the [testing skill](../okf-graph-testing/SKILL.md) for test placement and coverage.
3. When the change reaches the CLI, build it and run the affected command from the built entry point. The [PR validation workflow](../../../.github/workflows/pr-validation.yml) checks startup with `--help`. Exercise the changed path as well.
