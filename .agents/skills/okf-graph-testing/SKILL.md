---
name: okf-graph-testing
description: Design, review, or consolidate tests for OKF Graph packages and the CLI. Use when choosing what a regression test should prove, which public entry point to exercise, or how to preserve coverage when moving tests.
---

# OKF Graph test design

Identify the caller, the observable behavior, and the regression the test would catch. Use the smallest public entry point that exposes that behavior. See [package design](../okf-graph-design/SKILL.md#verify-the-consumer) for API boundaries and [TASTE.md](../../TASTE.md) for Effect conventions.

## Choose the owner and entry point

| Behavior                                               | Where to test it                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Graph calculation, option validation, or typed failure | The package that owns the exported operation, using its public subpath. |
| Bundle loading, parsing, or validation                 | The OKF package, through the service or module the caller uses.         |
| CLI flags, exit status, output, or command wiring      | The app, through the command or built executable as appropriate.        |

Import public APIs through their supported entry points. Tests must not import internal exports. Keep test-only helpers private. Use `test/` for new library packages and follow the established layout in existing workspaces. Add CLI coverage for a CLI promise, such as the JSON envelope or exit status, and keep the underlying validation cases with the library.

## Pick the runner and fixtures

- Import test helpers and assertions from `@effect/vitest`. Use `it` for plain assertions, `it.effect` for Effect test bodies, and `it.live` when live Effect runtime behavior matters.
- Run the real operation under test. Supply controlled dependencies at its platform boundary. Use `@effect-vfs/memory` for bundle fixtures when it supports the filesystem behavior under test. Use a scoped temporary directory for host filesystem behavior or when a separate CLI process needs to read the files. [Effect FileSystem source](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/FileSystem.ts)
- Share setup and stateless Layers. Give each test fresh mutable state, such as a memory volume or directory, unless sharing that state is the behavior under test. Use a per-test Layer when the fixture lives in a service instance. [Effect Vitest README](https://github.com/Effect-TS/effect/blob/main/packages/vitest/README.md)
- Use `TestClock` for Effect-controlled timeouts, delays, and retries. Keep real time for tests that need live behavior. Use readiness signals to coordinate concurrent work.
- Assert observable results. For expected failures, assert the error tag and the fields that identify the failure. Pin order, exact text, or interaction counts when callers depend on them.

## Use exact examples and properties

Use a small, hand-checked fixture for a known result or regression. Add a property test when an invariant should hold across varied inputs. Use Effect's arbitrary support, such as `Schema.toArbitrary`, or pass a schema directly to `it.effect.prop`. For graph tests, generate a valid input description and construct the graph through its public constructors. [Effect testing examples](https://github.com/Effect-TS/effect/blob/main/ai-docs/src/09_testing/10_effect-tests.ts)

For example, a two-node PageRank fixture can pin the expected scores. A property across non-empty graphs can check that the scores sum to one. A ranking can conserve probability while still assigning the wrong scores.

## Preserve coverage when changing tests

- Consolidate shared setup or use named table rows when cases have the same assertion shape. Remove a case only when a retained case catches the same regression. When unclear, run the retained test against the broken behavior and confirm it fails at the intended assertion.
- When moving tests, carry over meaningful inputs and assertions. Run the affected suites and verify discovery through the workspace's test task and the root CI path. Check runner exclusions when changing directories.
- Use the workspace's existing test script, such as `bun run --cwd packages/okf test`. The [PR validation workflow](../../../.github/workflows/pr-validation.yml) runs the root test and type-check tasks. When changing a CLI contract, build and exercise the affected command through its built entry point.
