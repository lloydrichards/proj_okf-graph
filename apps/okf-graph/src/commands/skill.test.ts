import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "@effect/vitest";

const entry = fileURLToPath(new URL("../index.ts", import.meta.url));
const skillMarkdown = (name: string) =>
  readFileSync(new URL(`../skills/${name}/SKILL.md`, import.meta.url), "utf-8");

const run = (cwd: string, ...args: ReadonlyArray<string>) =>
  spawnSync("bun", [entry, "skill", ...args], { cwd, encoding: "utf-8" });

describe("skill command", () => {
  const names = ["okf", "okf-validate", "okf-dream"];

  it("prints and installs every bundled skill when the name is omitted", () => {
    const repository = mkdtempSync(join(tmpdir(), "okf-skill-"));
    try {
      const read = run(repository, "read");
      expect(read.status).toBe(0);
      expect(read.stdout).toBe(names.map(skillMarkdown).join("\n"));
      expect(read.stderr).toBe("");

      const write = run(tmpdir(), "write", "--path", repository);
      expect(write.status).toBe(0);
      for (const name of names) {
        const destination = join(
          repository,
          ".agents/skills",
          name,
          "SKILL.md",
        );
        expect(readFileSync(destination, "utf-8")).toBe(skillMarkdown(name));
      }
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it("checks the whole selection for conflicts before installing, unless forced", () => {
    const repository = mkdtempSync(join(tmpdir(), "okf-skill-conflict-"));
    const skills = join(repository, ".agents/skills");
    const edited = join(skills, "okf-dream", "SKILL.md");

    try {
      mkdirSync(join(skills, "okf-dream"), { recursive: true });
      writeFileSync(edited, "local edit\n");

      const conflict = run(repository, "write");
      expect(conflict.status).toBe(1);
      expect(conflict.stderr).toContain(edited);
      expect(readdirSync(skills)).toEqual(["okf-dream"]);
      expect(readFileSync(edited, "utf-8")).toBe("local edit\n");

      expect(run(repository, "write", "--force").status).toBe(0);
      for (const name of names) {
        expect(readFileSync(join(skills, name, "SKILL.md"), "utf-8")).toBe(
          skillMarkdown(name),
        );
      }
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it.each(names)("reads and installs only %s when named", (name) => {
    const repository = mkdtempSync(join(tmpdir(), "okf-skill-selection-"));
    const skills = join(repository, ".agents/skills");
    try {
      const read = run(repository, "read", name);
      expect(read.status).toBe(0);
      expect(read.stdout).toBe(skillMarkdown(name));
      expect(run(repository, "write", name).status).toBe(0);
      expect(readdirSync(skills)).toEqual([name]);
      expect(readFileSync(join(skills, name, "SKILL.md"), "utf-8")).toBe(
        skillMarkdown(name),
      );
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it("rejects unknown names before creating an installation directory", () => {
    const repository = mkdtempSync(join(tmpdir(), "okf-skill-unknown-"));
    try {
      for (const action of ["read", "write"]) {
        const result = run(repository, action, "../unknown");
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("okf-validate");
      }
      expect(existsSync(join(repository, ".agents"))).toBe(false);
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it("rejects symlinks in the install path", () => {
    const repository = mkdtempSync(join(tmpdir(), "okf-skill-links-"));
    const outside = mkdtempSync(join(tmpdir(), "okf-skill-outside-"));

    try {
      mkdirSync(join(repository, ".agents/skills"), { recursive: true });
      symlinkSync(outside, join(repository, ".agents/skills/okf-dream"));

      const directoryLink = run(repository, "write");
      expect(directoryLink.status).toBe(1);
      expect(directoryLink.stderr).toContain("Skill path contains a symlink");
      expect(existsSync(join(outside, "SKILL.md"))).toBe(false);
      expect(readdirSync(join(repository, ".agents/skills"))).toEqual([
        "okf-dream",
      ]);

      unlinkSync(join(repository, ".agents/skills/okf-dream"));
      mkdirSync(join(repository, ".agents/skills/okf-dream"));
      const externalFile = join(outside, "external.md");
      writeFileSync(externalFile, "keep me\n");
      symlinkSync(
        externalFile,
        join(repository, ".agents/skills/okf-dream/SKILL.md"),
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
