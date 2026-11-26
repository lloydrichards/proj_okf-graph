# Coding taste

Use this guide when generating or reviewing TypeScript for the OKF packages and the `okf-graph` CLI. It covers the code that reads, validates, analyzes, and presents OKF bundles. Use the [OKF builder skill](skills/okf-builder/SKILL.md) when generating bundle content.

These conventions build on [Stack Effect's TASTE guide](https://github.com/lloydrichards/stack-effect/blob/fee7fd1385ac2df14da2d32e71054f34ed926748/.agents/TASTE.md). The examples here use this repo where possible.

## Validate at the boundary

Put defaults, ranges, and rules that can be decided from the input in Schema. Use built-in checks for individual fields and `.check(Schema.makeFilter(...))` for relationships between fields. Decode once at the boundary that accepts the input. Keep checks that need the supplied graph, filesystem, or another external resource in the operation that has access to it.

For example, [the proposed PageRank options schema](https://github.com/lloydrichards/proj_okf-graph/blob/5e006dd/packages/graph-goodies/src/Centrality.ts) puts the default next to the accepted range.

```ts
alpha: Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThan(1),
).pipe(Schema.withDecodingDefault(Effect.succeed(0.85))),
```

PageRank checks whether a restart node exists when it looks up the node's slot in the supplied graph. [MarkovPolicy](../packages/domain/src/Evaluation.ts) also uses Schema for numeric constraints. See [Effect's Schema migration guide](https://github.com/Effect-TS/effect/blob/main/migration/schema.md) for defaults and field-specific errors from filters.

Use tagged unions when a mode changes the fields that are required or valid. Match exhaustively where behavior branches, for example with `Match.valueTags`. Use a struct for independent options. [OkfSourceInput](../packages/domain/src/Okf.ts) gives local, Git, and GitHub tree sources distinct shapes so each case carries the fields its resolver needs.

## Keep calculations separate from service ownership

Write calculations over supplied data as module functions. Return a plain value from a total calculation. Use `Effect.fnUntraced` with an explicit `Effect.fn.Return<A, E>` for a public generator with expected failures. Import local pure modules as namespaces when the namespace makes the call's owner clear.

Introduce a service when code owns a dependency or lifecycle, such as bundle loading or shared state. Use `Context.Service` with a primary `static readonly layer`. Resolve reusable dependencies during Layer construction and close over them. Wire private collaborators where they are owned. Let the CLI or tests choose platform implementations. Use `Layer.provideMerge` when consumers also need the provided service. Expose `Scope` when the caller owns the lifetime.

[EvaluationService](../packages/okf/src/services/EvaluationService.ts) resolves `OkfService` during construction and passes the resulting data to its analysis functions. The [CLI entry point](../apps/okf-graph/src/index.ts) chooses the Bun platform Layer. See [Effect's service guide](https://github.com/Effect-TS/effect/blob/main/migration/services.md) for primary Layer naming and explicit wiring.

## Keep failures specific

Use `Schema.TaggedError` for expected domain failures. Carry structured details that callers can act on, such as an unknown node ID. Return a valid empty or negative answer through the success channel. For a route query, an unknown endpoint can fail with a typed error, while a known endpoint with no route can return `Option.none()`. Translate errors into terminal or JSON output at the CLI boundary.

Wrap the smallest foreign call that can throw or reject with `Effect.try` or `Effect.tryPromise`. Map the expected failure where you can name the operation and preserve useful context. Keep later processing outside the catch boundary. [MarkdownService](../packages/okf/src/services/MarkdownService.ts) wraps the Markdown parser call before traversing the AST. [Effect's creating-effects examples](https://github.com/Effect-TS/effect/blob/main/ai-docs/src/01_effect/01_basics/10_creating-effects.ts)

Prefer Effect primitives when they supply a useful contract, such as `FileSystem` for injectable I/O or `Schema.fromJsonString` for parsing and validating a JSON input. Use native APIs for straightforward operations such as formatting a report with `JSON.stringify(payload, null, 2)` at the CLI boundary.

## Make traces useful

Use stable `Owner.operation` span names for public service operations. Give a private step a span when timing that step separately helps diagnose I/O. Use `Effect.fnUntraced` for pure Effect functions and per-item helpers by default. The [archive importer](../packages/okf/src/services/GitHubTreeLive.ts) names the import span and runs each entry inside it without a separate span. Treat a span rename as observable to anyone filtering traces. [Effect's guidance on Effect.fn](https://github.com/Effect-TS/effect/blob/main/LLMS.md#using-effectfn-and-effectfnuntraced)

## Make data flow and ordering visible

Use `map`, `filter`, and other collection expressions for straightforward transformations. Keep mutation local when an algorithm needs a worklist, a visited set, or a numeric buffer. Keep caller-owned inputs intact. [Effect Graph](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Graph.ts) illustrates immutable graph inputs with local traversal state.

Use a named `Order` and a stable tie-breaker when callers observe the order or when a tie decides the result. Preserve authored order where it carries meaning. Leave the order unspecified when callers have no reason to depend on it.

The [navigation report](../packages/okf/src/evaluation/NavigationEvaluation.ts) ranks by descending probability and breaks ties by ascending concept ID. [Effect Order](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Order.ts)

```ts
const probabilityDescending = Order.combine(
  Order.flip(
    Order.mapInput(Order.Number, (item: Probability) => item.probability),
  ),
  Order.mapInput(Order.String, (item: Probability) => item.conceptId),
);
```

Treat four inputs as a review prompt. Group values that already describe one domain object. Name options when a number, boolean, or pair of same-typed arguments would be hard to interpret at the call site. Keep positional arguments when their roles are clear. For instance, Effect's `Graph.dijkstra` takes a graph and a query with named `source`, `target`, and `cost` fields.

## Document the public contract

Open each public module with its purpose. Give each public export a short summary. Add **Details** for behavior the types leave implicit, such as tie-breaking, sparse node IDs, or what happens at the iteration limit. Add **Example** when a real call helps. Use private comments for constraints the code cannot show. Omit upstream release and navigation tags such as `@since`, `@category`, and `@stability`.

```ts
/** Estimated visit probability by graph node ID. IDs may be sparse. */
readonly scores: ReadonlyMap<Graph.NodeIndex, number>;
```

## Verify generated changes

Use these rules to review surrounding code for concrete improvements. Check observable behavior and public compatibility when applying a rule changes either. Keep fixes focused enough that a reviewer can verify the result.

[PR validation](../.github/workflows/pr-validation.yml) runs the build, Oxfmt, Oxlint, workspace tests, TypeScript checks, and a CLI smoke check. The [shared TypeScript config](../packages/config-typescript/base.json) also reports selected Effect diagnostics as warnings or suggestions. Review decisions that depend on intent, such as whether ordering is authored or whether a service owns a dependency.
