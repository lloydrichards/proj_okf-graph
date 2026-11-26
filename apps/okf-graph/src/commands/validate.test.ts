import { expect, it } from "@effect/vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../index.ts", import.meta.url));

const validateJson = (bundle: string, exitStatus: number) => {
  const result = spawnSync("bun", [entry, "validate", "--json", bundle], {
    encoding: "utf-8",
  });

  expect(result.status).toBe(exitStatus);
  expect(result.stderr).toBe("");
  return JSON.parse(result.stdout);
};

it("returns one JSON value and exits 1 for an invalid bundle", () => {
  const bundle = mkdtempSync(join(tmpdir(), "okf-validate-invalid-"));
  try {
    writeFileSync(join(bundle, "concept.md"), "# Missing type\n");

    expect(validateJson(bundle, 1)).toMatchObject({
      bundle,
      valid: false,
      issues: [expect.objectContaining({ severity: "error" })],
    });
  } finally {
    rmSync(bundle, { recursive: true, force: true });
  }
});

it("returns one JSON value and exits 1 for a missing bundle", () => {
  const parent = mkdtempSync(join(tmpdir(), "okf-validate-missing-"));
  try {
    const bundle = join(parent, "absent");

    expect(validateJson(bundle, 1)).toEqual({
      error: "BundleNotFound",
      bundlePath: bundle,
      message: `Bundle not found: ${bundle}`,
    });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

it("returns one JSON value and exits 0 for a bundle with warnings", () => {
  const bundle = mkdtempSync(join(tmpdir(), "okf-validate-warning-"));
  try {
    writeFileSync(
      join(bundle, "concept.md"),
      "---\ntype: Note\n---\n\nSee [missing](/missing.md).\n",
    );

    expect(validateJson(bundle, 0)).toMatchObject({
      bundle,
      valid: true,
      issues: [expect.objectContaining({ severity: "warning" })],
    });
  } finally {
    rmSync(bundle, { recursive: true, force: true });
  }
});
