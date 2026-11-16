"""Run the writing, published-validator, and rotation-cleanup scenarios in fresh sessions."""

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import difflib
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import time

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parents[1]
SKILLS = APP / "src/skills"
SCENARIOS = {"okf": 1, "okf-validate": 1, "okf-dream": 3}


def snapshot(root):
    return {p.relative_to(root): p.read_bytes() for p in root.rglob("*") if p.is_file()}


def save_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def trial(skill, number, target, model, effort):
    dest = target / f"{skill}-{number}"
    dest.mkdir()
    work = dest / "workspace"
    cases = json.loads((SKILLS / skill / "evals/evals.json").read_text())["evals"]
    case = next(c for c in cases if c["id"] == SCENARIOS[skill])
    shutil.copytree(ROOT / case["files"][0], work)
    if skill == "okf-validate":
        with (work / "bundle/worker-guide.md").open("a") as guide:
            guide.write("\nSee the [playbook](./missing-playbook.md).\n")
    for name in SCENARIOS:
        installed = work / ".agents/skills" / name
        installed.mkdir(parents=True)
        shutil.copyfile(SKILLS / name / "SKILL.md", installed / "SKILL.md")

    if skill != "okf-validate":
        (work / "check-okf").write_text('#!/bin/sh\nexec bun ' +
            shlex.quote(str(APP / "dist/index.js")) + ' validate bundle --json\n')
        (work / "check-okf").chmod(0o755)

    before = snapshot(work)
    prompt = ("Work in the current repository. Choose among the three installed skills under "
              ".agents/skills using their descriptions and follow the applicable one. "
              "Report what you checked and the outcome. ")
    if skill != "okf-validate":
        prompt += "The repository bundle check is ./check-okf. "
    prompt += case["prompt"]
    (dest / "prompt.txt").write_text(prompt)
    env = os.environ.copy()
    tmp = dest / "tmp"
    tmp.mkdir()
    env.update(TMPDIR=str(tmp), npm_config_cache=str(tmp / "npm"), npm_config_fetch_retries="0")
    args = ["codex", "exec", "--ephemeral", "--ignore-user-config", "--skip-git-repo-check",
            "--sandbox", "workspace-write", "--model", model, "-c", f'model_reasoning_effort="{effort}"',
            "--add-dir", str(tmp), "--json", "-"]
    if skill == "okf-validate":
        args[2:2] = ["-c", "sandbox_workspace_write.network_access=true"]
    start = time.monotonic()
    with (dest / "trace.jsonl").open("w") as out, (dest / "stderr.log").open("w") as err:
        proc = subprocess.run(args, cwd=work, env=env, input=prompt, text=True, stdout=out, stderr=err)
    seconds = round(time.monotonic() - start, 2)
    events = [json.loads(line) for line in (dest / "trace.jsonl").read_text().splitlines() if line.strip()]
    counts = Counter()
    usage = Counter()
    transcript = []
    turns = 0
    for e in events:
        if e["type"] == "turn.completed":
            usage.update(e["usage"])
            turns += 1
        if e["type"] == "item.completed":
            item = e["item"]
            transcript.append(item)
            counts[item["type"]] += 1
    after = snapshot(work)
    changed = []
    with (dest / "changes.diff").open("w") as diff:
        for p in sorted(before.keys() | after.keys()):
            if before.get(p) != after.get(p):
                changed.append(str(p))
                old, new = (d.get(p, b"").decode(errors="replace").splitlines(True) for d in (before, after))
                diff.writelines(difflib.unified_diff(old, new, f"a/{p}", f"b/{p}"))
    results = dict(skill=skill, scenario=case["id"], replicate=number, model=model, effort=effort,
                   elapsed_seconds=seconds, exit_code=proc.returncode, completed_turns=turns,
                   items=counts, usage=usage, changed_files=changed,
                   failed_commands=sum(i.get("exit_code") not in (None, 0) for i in transcript),
                   command_output_bytes=sum(len(i.get("aggregated_output", "").encode()) for i in transcript))
    save_json(dest / "metrics.json", results)
    print(dest.name, "finished", proc.returncode, "completed turns", turns, flush=True)
    return proc.returncode == 0 and turns > 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="new directory outside the repository")
    parser.add_argument("--model", required=True)
    parser.add_argument("--effort", default="medium")
    parser.add_argument("--replicates", type=int, default=2)
    parser.add_argument("--skill", choices=SCENARIOS, help="run only this scenario")
    parser.add_argument("--jobs", type=int, default=3)
    args = parser.parse_args()
    target = args.output.resolve()
    if target.is_relative_to(ROOT) or args.replicates < 1 or args.jobs < 1:
        parser.error("Use a directory outside the checkout and positive replicate and job counts")
    if not (APP / "dist/index.js").is_file():
        parser.error("Build okf-graph before running trials")
    target.mkdir(parents=True)
    save_json(target / "manifest.json", dict(
        codex=subprocess.check_output(["codex", "--version"], text=True).strip(),
        revision=subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        model=args.model, effort=args.effort, skill_sha256={
            s: hashlib.sha256((SKILLS / s / "SKILL.md").read_bytes()).hexdigest() for s in SCENARIOS}))
    with ThreadPoolExecutor(args.jobs) as pool:
        jobs = [pool.submit(trial, s, n, target, args.model, args.effort)
                for n in range(1, args.replicates + 1) for s in ([args.skill] if args.skill else SCENARIOS)]
        return 0 if all([job.result() for job in jobs]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
