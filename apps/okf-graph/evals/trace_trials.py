"""Run the writing, published-validator, and rotation-cleanup scenarios in fresh sessions."""

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext
import difflib
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import tempfile
import time

from registry_outage import outage_seed
from skill_inventory import isolated_skills

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parents[1]
SKILLS = APP / "src/skills"
SCENARIOS = {"okf": 1, "okf-validate": 1, "okf-dream": 3}


def snapshot(root):
    return {p.relative_to(root): p.read_bytes() for p in root.rglob("*") if p.is_file()}


def save_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def full_body_outputs(before, transcript):
    # This is a lower bound: numbered, partial, or split reads need trace review.
    counts = {}
    for name in SCENARIOS:
        entry = Path(".agents/skills") / name / "SKILL.md"
        if entry not in before:
            continue
        body = before[entry].decode().split("\n---\n", 1)[1].strip()
        counts[name] = sum(body in item.get("aggregated_output", "") for item in transcript)
    return counts


def trial(skill, case, number, target, model, effort, discovery, skill_scope, outage=None):
    # Keep the expected skill, grading rubric, and other trials out of the agent's cwd.
    with tempfile.TemporaryDirectory(prefix="skill-trial-", dir=target.parent) as scratch:
        return run_trial(Path(scratch), skill, case, number, target, model, effort, discovery, skill_scope, outage)


def run_trial(box, skill, case, number, target, model, effort, discovery, skill_scope, outage):
    dest = target / f"{skill}-{number}"
    dest.mkdir()
    work = box / "workspace"
    shutil.copytree(ROOT / case["files"][0], work)
    if skill == "okf-validate" and case["id"] == 1:
        with (work / "bundle/index.md").open("a") as index:
            index.write("\nSee the [runbook](./missing-runbook.md).\n")
        with (work / "bundle/worker-guide.md").open("a") as guide:
            guide.write("\nSee the [playbook](./missing-playbook.md).\n")
    installed_names = SCENARIOS
    if skill_scope == "selected":
        installed_names = (skill,)
    elif skill_scope == "none":
        installed_names = ()
    for name in installed_names:
        installed = work / ".agents/skills" / name
        installed.mkdir(parents=True)
        shutil.copyfile(SKILLS / name / "SKILL.md", installed / "SKILL.md")

    if skill != "okf-validate":
        (work / "check-okf").write_text('#!/bin/sh\nexec bun ' +
            shlex.quote(str(APP / "dist/index.js")) + ' validate bundle --json\n')
        (work / "check-okf").chmod(0o755)

    before = snapshot(work)
    prompt = "Work in the current repository. "
    if discovery == "directory":
        prompt += ("Choose among the three installed skills under .agents/skills using their "
                   "descriptions and follow the applicable one. ")
    prompt += "Report what you checked and the outcome. "
    if skill != "okf-validate":
        prompt += "The repository bundle check is ./check-okf. "
    prompt += case["prompt"]
    (dest / "prompt.txt").write_text(prompt)
    env = os.environ.copy()
    tmp = box / "tmp"
    tmp.mkdir()
    env.update(TMPDIR=str(tmp), npm_config_cache=str(tmp / "npm"), npm_config_fetch_retries="0")
    config_flags = []
    if skill == "okf-validate":
        online = outage is None
        config_flags.extend(["-c", "sandbox_workspace_write.network_access=" + str(online).lower()])
        npm_env = {key: env[key] for key in ("TMPDIR", "npm_config_cache", "npm_config_fetch_retries")}
        if outage is not None:
            registry, cache = outage
            shutil.copytree(cache, tmp / "npm")
            npm_env["npm_config_registry"] = registry
            env.update(npm_env)
        settings = ",".join(key + "=" + json.dumps(value) for key, value in npm_env.items())
        config_flags.extend(["-c", "shell_environment_policy.set={" + settings + "}"])
    skill_flags = []
    if skill_scope != "host":
        expected = [work / ".agents/skills" / name / "SKILL.md" for name in installed_names]
        skill_flags, inventory = isolated_skills(work, env, expected)
        save_json(dest / "inventory.json", inventory)
    args = ["codex", "exec", *config_flags, *skill_flags, "--ephemeral", "--ignore-user-config", "--skip-git-repo-check",
            "--sandbox", "workspace-write", "--model", model, "-c", f'model_reasoning_effort="{effort}"',
            "--add-dir", str(tmp), "--json", "-"]
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
                   items=counts, usage=usage, changed_files=changed, full_body_outputs=full_body_outputs(before, transcript),
                   failed_commands=sum(i.get("exit_code") not in (None, 0) for i in transcript),
                   command_output_bytes=sum(len(i.get("aggregated_output", "").encode()) for i in transcript))
    shutil.move(work, dest / "workspace")
    save_json(dest / "metrics.json", results)
    print(dest.name, "finished", proc.returncode, "completed turns", turns, flush=True)
    return proc.returncode == 0 and turns > 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="new directory outside the repository")
    parser.add_argument("--model", required=True)
    parser.add_argument("--effort", default="medium")
    parser.add_argument("--discovery", choices=["native", "directory"], default="native",
                        help="native skill selection or the original directory comparison prompt")
    parser.add_argument("--skill-scope", choices=["okf-only", "selected", "none", "host"], default="okf-only",
                        help="enable all OKF skills, the selected skill alone, no skills, or the host catalog")
    parser.add_argument("--replicates", type=int, default=2)
    parser.add_argument("--skill", choices=SCENARIOS, help="run only this scenario")
    parser.add_argument("--case", type=int, help="case ID for a single --skill")
    parser.add_argument("--jobs", type=int, default=3)
    args = parser.parse_args()
    if args.skill_scope in ("none", "selected") and args.discovery == "directory":
        parser.error("The directory comparison requires all three OKF skills")
    if args.case is not None and not args.skill:
        parser.error("--case requires --skill")
    cases = {}
    for skill in ([args.skill] if args.skill else SCENARIOS):
        case_id = SCENARIOS[skill] if args.case is None else args.case
        entries = json.loads((SKILLS / skill / "evals/evals.json").read_text())["evals"]
        case = next((c for c in entries if c["id"] == case_id), None)
        if case is None:
            parser.error(f"Unsupported trace scenario: {skill} case {case_id}")
        cases[skill] = case
    target = args.output.resolve()
    if target.is_relative_to(ROOT) or args.replicates < 1 or args.jobs < 1:
        parser.error("Use a directory outside the checkout and positive replicate and job counts")
    if not (APP / "dist/index.js").is_file():
        parser.error("Build okf-graph before running trials")
    target.mkdir(parents=True)
    save_json(target / "manifest.json", dict(
        codex=subprocess.check_output(["codex", "--version"], text=True).strip(),
        revision=subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        cases={s: c["id"] for s, c in cases.items()},
        model=args.model, effort=args.effort, discovery=args.discovery, skill_scope=args.skill_scope, skill_sha256={
            s: hashlib.sha256((SKILLS / s / "SKILL.md").read_bytes()).hexdigest() for s in SCENARIOS}))
    validation = cases.get("okf-validate")
    outage = (outage_seed(ROOT / validation["files"][0], target)
              if validation and validation["id"] == 2 else nullcontext(None))
    with outage as seed, ThreadPoolExecutor(args.jobs) as pool:
        jobs = [pool.submit(trial, s, case, n, target, args.model, args.effort, args.discovery, args.skill_scope, seed)
                for n in range(1, args.replicates + 1) for s, case in cases.items()]
        return 0 if all([job.result() for job in jobs]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
