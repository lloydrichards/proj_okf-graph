import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const entry = fileURLToPath(new URL("../index.ts", import.meta.url));
const source = fileURLToPath(
  new URL("../skills/okf/SKILL.md", import.meta.url),
);

const run = (cwd: string, ...args: ReadonlyArray<string>) =>
  spawnSync("bun", [entry, "skill", ...args], { cwd, encoding: "utf-8" });

describe("skill command", () => {
  it("prints and installs the same Markdown without replacing a local edit", () => {
    const repository = mkdtempSync(join(tmpdir(), "okf-skill-"));
    const destination = join(repository, ".agents/skills/okf/SKILL.md");
    const markdown = readFileSync(source, "utf-8");

    try {
      const read = run(repository, "read");
      expect(read.status).toBe(0);
      expect(read.stdout).toBe(markdown);
      expect(read.stderr).toBe("");

      const write = run(tmpdir(), "write", "--path", repository);
      expect(write.status).toBe(0);
      expect(readFileSync(destination, "utf-8")).toBe(markdown);

      writeFileSync(destination, "local edit\n");
      const conflict = run(repository, "write");
      expect(conflict.status).toBe(1);
      expect(readFileSync(destination, "utf-8")).toBe("local edit\n");

      const replace = run(repository, "write", "--force");
      expect(replace.status).toBe(0);
      expect(readFileSync(destination, "utf-8")).toBe(markdown);
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it("rejects symlinks in the install path", () => {
    const repository = mkdtempSync(join(tmpdir(), "okf-skill-links-"));
    const outside = mkdtempSync(join(tmpdir(), "okf-skill-outside-"));

    try {
      mkdirSync(join(repository, ".agents/skills"), { recursive: true });
      symlinkSync(outside, join(repository, ".agents/skills/okf"));

      const directoryLink = run(repository, "write");
      expect(directoryLink.status).toBe(1);
      expect(directoryLink.stderr).toContain("Skill path contains a symlink");
      expect(() => readFileSync(join(outside, "SKILL.md"))).toThrow();

      unlinkSync(join(repository, ".agents/skills/okf"));
      mkdirSync(join(repository, ".agents/skills/okf"));
      const externalFile = join(outside, "external.md");
      writeFileSync(externalFile, "keep me\n");
      symlinkSync(
        externalFile,
        join(repository, ".agents/skills/okf/SKILL.md"),
      );

      const fileLink = run(repository, "write", "--force");
      expect(fileLink.status).toBe(1);
      expect(readFileSync(externalFile, "utf-8")).toBe("keep me\n");
    } finally {
      rmSync(repository, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
