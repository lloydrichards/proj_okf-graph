import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "@effect/vitest";

const entry = fileURLToPath(new URL("../index.ts", import.meta.url));

type Invoke = (
  from: string,
  to: string,
  ...options: string[]
) => SpawnSyncReturns<string>;

function withBundle(
  check: (invoke: Invoke) => void,
  prefix: readonly string[] = ["graph", "impact"],
): void {
  const root = mkdtempSync(join(tmpdir(), "okf-impact-"));
  try {
    for (const [id, body] of Object.entries({
      start: "[right](right.md) [left](left.md)",
      left: '[goal](goal.md "first") [same goal](goal.md#details "second")',
      right: "[goal](goal.md)",
      goal: "A destination.",
      isolated: "No links.",
      "-3": "[goal](goal.md)",
      dash: "[-3](-3.md)",
      flags: "[middle](--middle.md)",
      "--middle": "[goal](goal.md)",
    })) {
      writeFileSync(
        join(root, `${id}.md`),
        `---\ntype: Concept\n${id === "start" ? "sources: [{resource: goal.md}]\n" : ""}---\n\n${body}\n`,
      );
    }
    check((from, to, ...options) =>
      spawnSync("bun", [entry, ...prefix, root, from, to, ...options], {
        encoding: "utf8",
      }),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

it("removes every occurrence of the directed pair and selects shortest paths by ID", () => {
  withBundle((invoke) => {
    const result = invoke(
      "start",
      "goal",
      "--without-link",
      "left",
      "goal",
      "--json",
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      before: { path: ["start", "left", "goal"] },
      after: { path: ["start", "right", "goal"] },
      removedLinkCount: 2,
    });
  });
});

it("removes an intermediate concept and distinguishes blocked from already unreachable routes", () => {
  withBundle((invoke) => {
    const blocked = invoke("left", "goal", "--without-link", "left", "goal");
    expect(blocked.status).toBe(0);
    expect(blocked.stdout).toContain("Edit blocks the route.");
    expect(blocked.stdout).toContain("Before: left → goal");

    const surviving = invoke(
      "start",
      "goal",
      "--without-concept",
      "left",
      "--json",
    );
    expect(surviving.status).toBe(0);
    expect(JSON.parse(surviving.stdout)).toEqual({
      before: { path: ["start", "left", "goal"] },
      after: { path: ["start", "right", "goal"] },
    });

    const unreachable = invoke(
      "goal",
      "isolated",
      "--without-concept",
      "left",
      "--json",
    );
    expect(unreachable.status).toBe(0);
    expect(JSON.parse(unreachable.stdout)).toEqual({
      before: { path: null },
      after: { path: null },
    });
    expect(
      invoke("goal", "isolated", "--without-concept", "left").stdout,
    ).toContain("Destination was already unreachable.");
  });
});

it("rejects an unknown concept, nonexistent directed link, or endpoints that cannot be removed", () => {
  withBundle((invoke) => {
    for (const [from, to, options, expected] of [
      [
        "absent",
        "goal",
        ["--without-concept", "left"],
        "Unknown concept ID: absent",
      ],
      [
        "start",
        "goal",
        ["--without-link", "goal", "left"],
        "No authored link from goal to left",
      ],
      [
        "start",
        "start",
        ["--without-concept", "left"],
        "Choose two distinct concepts",
      ],
      [
        "start",
        "goal",
        ["--without-concept", "start"],
        "start because it is the start",
      ],
      [
        "start",
        "goal",
        ["--without-concept", "goal"],
        "goal because it is the destination",
      ],
    ] as const) {
      const result = invoke(from, to, ...options, "--json");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(expected);
    }
  });
});

it("requires exactly one complete edit", () => {
  withBundle((invoke) => {
    for (const options of [
      [],
      ["--without-link", "left"],
      ["--link-target", "goal", "--without-concept", "left"],
      [
        "--without-link",
        "left",
        "--link-target",
        "goal",
        "--link-target",
        "right",
      ],
      ["--without-link", "left", "goal", "--without-concept", "right"],
      ["--without-link", "left", "goal", "--without-link", "right", "goal"],
      ["--without-concept", "left", "--without-concept", "right"],
    ]) {
      const result = invoke("start", "goal", ...options, "--json");
      expect(result.status).toBe(1);
    }
  });
});

it.each([
  [["--log-level", "none", "graph", "impact"]],
  [["graph", "--log-level=none", "impact"]],
])("accepts global log options and dashed link IDs (%j)", (prefix) => {
  withBundle((invoke) => {
    const result = invoke(
      "dash",
      "goal",
      "--without-link",
      "dash",
      "-3",
      "--json",
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      before: { path: ["dash", "-3", "goal"] },
      after: { path: null },
      removedLinkCount: 1,
    });
  }, prefix);
});

it("runs wizard-style arguments and accepts flag-like source and target IDs", () => {
  withBundle((invoke) => {
    const source = invoke(
      "flags",
      "goal",
      "--without-link=--middle",
      "--link-target",
      "goal",
      "--json",
    );
    expect(source.status).toBe(0);
    expect(JSON.parse(source.stdout)).toMatchObject({
      after: { path: null },
      removedLinkCount: 1,
    });
    const target = invoke(
      "flags",
      "goal",
      "--without-link",
      "flags",
      "--link-target=--middle",
      "--json",
    );
    expect(target.status).toBe(0);
    expect(JSON.parse(target.stdout)).toMatchObject({
      after: { path: null },
      removedLinkCount: 1,
    });
  });
});

it.each([
  [["--link-target", "goal", "--without-link", "left"]],
  [["--link-target=goal", "--without-link", "left"]],
  [["--without-link", "left", "--link-target", "goal"]],
])("accepts explicit link flags before positional arguments (%j)", (flags) => {
  withBundle(
    (invoke) => {
      const result = invoke("start", "goal", "--json");
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        before: { path: ["start", "left", "goal"] },
        after: { path: ["start", "right", "goal"] },
        removedLinkCount: 2,
      });
    },
    ["graph", "impact", ...flags],
  );
});
