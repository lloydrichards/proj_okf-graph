import { expect, it } from "@effect/vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../index.ts", import.meta.url));

const writeNote = (bundle: string, id: string, body = "", metadata = "") =>
  writeFileSync(
    join(bundle, `${id}.md`),
    `---\ntype: Note\n${metadata}---\n\n${body}\n`,
  );

const runPath = (bundle: string, from = "start", to = "finish") => {
  const result = spawnSync(
    "bun",
    [entry, "graph", "path", "--json", bundle, from, to],
    {
      encoding: "utf-8",
    },
  );
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  const output: {
    from: string;
    to: string;
    path: ReadonlyArray<{ id: string }>;
  } = JSON.parse(result.stdout);
  return { ...output, path: output.path.map(({ id }) => id) };
};

it("breaks shortest-path ties by concept ID when authored links are reversed", () => {
  const bundle = mkdtempSync(join(tmpdir(), "okf-path-ties-"));
  try {
    writeNote(bundle, "aardvark", "[beta](/beta.md)");
    writeNote(bundle, "alpha", "[finish](/finish.md)");
    writeNote(bundle, "beta", "[finish](/finish.md)");
    writeNote(bundle, "finish");
    const expected = {
      from: "start",
      to: "finish",
      path: ["start", "alpha", "finish"],
    };

    writeNote(
      bundle,
      "start",
      "[aardvark](/aardvark.md) [alpha](/alpha.md) [beta](/beta.md)",
    );
    expect(runPath(bundle)).toEqual(expected);

    writeNote(
      bundle,
      "start",
      "[aardvark](/aardvark.md) [beta](/beta.md) [alpha](/alpha.md)",
    );
    expect(runPath(bundle)).toEqual(expected);
  } finally {
    rmSync(bundle, { recursive: true, force: true });
  }
});

it("finds a path through a citation without an authored link", () => {
  const bundle = mkdtempSync(join(tmpdir(), "okf-path-citation-"));
  try {
    writeNote(
      bundle,
      "start",
      "",
      "sources:\n  - id: finish-source\n    resource: ./finish.md\n",
    );
    writeNote(bundle, "finish");

    expect(runPath(bundle)).toEqual({
      from: "start",
      to: "finish",
      path: ["start", "finish"],
    });
  } finally {
    rmSync(bundle, { recursive: true, force: true });
  }
});
