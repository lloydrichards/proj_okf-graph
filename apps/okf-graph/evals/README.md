# Evaluate skill behavior

Each bundled skill has cases in its source directory under `evals/evals.json`. Each case lists its input fixture, any extra setup, the user prompt, and the expected outcome.

1. Copy the contents of the fixture to a fresh temporary directory. Perform any case-specific setup there. Keep a copy of this starting state for comparison.
2. Install all three skills in the temporary repository so Codex can discover them. Give a fresh agent the case's prompt. Use a neutral working directory name. Make the CLI available as it would be in a consumer repository. Keep the rubric and other cases outside its context.
3. Record the chosen skill, commands, exit status, and actual file diff. Compare those results with `expected_output`. For both cleanup cases, run the same request on the resulting directory and compare it with the first run's output.
4. Score selection and task completion separately. Record a blocked CLI or registry as an incomplete execution. If using a test double, identify which commands it replaced in the results.

## Trial results, 2026-11-16

Fresh Codex agents chose the intended bundled skill in all six cases. The agents received the fixture and user prompt. The evaluator inspected their command output and compared files against the starting copies.

| Request                           | Selected skill | Observed outcome                                                                                                                                                                                            |
| --------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document emergency replay         | `okf`          | Updated only `job-ordering.md` with Q-12's scope and rationale. The source reference and custom owner survived. Validation returned zero issues.                                                            |
| Assess a private rename           | `okf`          | Checked the policy and bundle references. All files stayed identical.                                                                                                                                       |
| Validate before merge             | `okf-validate` | Resolved npm's live tag to 0.3.1, then executed that version. The command exited 0. The agent reported the broken playbook link as a warning and left the files untouched.                                  |
| Validate during a registry outage | `okf-validate` | The default cache held a simulated latest tag of 0.2.0. After the loopback registry stopped, the fresh lookup exited 1. The agent reported that validation could not complete and left all files untouched. |
| Clean up the handover             | `okf-dream`    | Removed session chatter, retained tenant admission and the unresolved retry proposals, and recorded replay ordering in the existing decision. Existing links resolved. Validation returned zero issues.     |
| Review before tomorrow's cleanup  | `okf-dream`    | Identified duplicated ordering advice, unique admission behavior, the open retry question, and incoming links. The agent proposed edits and left the fixture untouched.                                     |

A fresh agent repeated the weekly cleanup on the first run's output. The resulting bundle was byte-for-byte identical and validation returned zero issues.

The first authoring trial created a duplicate ordering page. We clarified the prompt's source reference and revised the skill's guidance on extending an existing rule before repeating the trial. A restricted network and a temporary storage quota interrupted early CLI runs. The successful online trials used the public npm release.

## Dream skill after the cleanup policy review

Three fresh agents chose `okf-dream` from the bundled skills and used the built CLI for validation.

- **Weekly tidy.** The agent retired the handover, moved tenant admission into the worker guide, and kept the two retry proposals open. The review-only trial proposed a similar cleanup and left the fixture unchanged.
- **Rotation cleanup.** The agent gathered P-41, P-44, and P-49 into one incident concept and cited the incident register. It recorded recovery after restart, left causality and safety open, and retained the unreproduced P-49 loss. It deleted `tuesday.md` after moving its evidence and dropped `scratch.md` without replacement. The D-17 pager template still resolved through `monday.md`.
- **Reviewer decision.** The agent preserved D-8, its rationale, and its owner. It asked whether dispatch should restore the approved two retries or adopt the four allowed by the code and its test. Its summary accounted for both deleted IDs. All files outside the bundle stayed unchanged.

Fresh agents repeated both cleanup requests. Both resulting directories were byte-for-byte identical to their first-pass outputs. All three cases and both repeats passed bundle validation with zero issues.

## Compare fresh-agent traces

Build the CLI first. From the repository root, run the benchmark against the baseline skills. After changing the skill instructions, repeat the command with a new output directory. Use the same Codex CLI, model, reasoning effort, installed Bun and npm, and worker count in both rounds.

```bash
bun run build
python3 -B apps/okf-graph/evals/trace_trials.py /var/tmp/okf-baseline --model gpt-6-astra
# Revise the skill instructions after inspecting the baseline traces.
python3 -B apps/okf-graph/evals/trace_trials.py /var/tmp/okf-candidate --model gpt-6-astra
```

Each round starts two independent Codex sessions per scenario by default. Use `--replicates` for a larger sample. This benchmark uses writing case 1, validation case 1, and cleanup case 3. It gives each agent a fresh copy of the fixture, the three installed skills, and the user prompt. The writing and cleanup tasks receive a repository check that runs the built CLI. The validation task gets network access and an empty npm cache. The runner needs Codex authentication and disk space for the individual caches. Keep the output outside the checkout. Each session works in a randomly named directory. After the run, the harness saves its workspace under the labeled result directory.

By default, `--skill-scope okf-only` restricts Codex's skill catalog to the three installed OKF files. Before each task the runner inventories the workspace, applies process-local disables, and checks that the enabled paths match those files. Each run records the check in `inventory.json`. The overrides leave the user's installed skills and settings intact. Use `--skill-scope host` to reproduce the earlier unfiltered trials. For the native no-skill control, use `--skill-scope none`. It also omits the OKF files from the fixture because a disabled file can still be opened by path.

The default `--discovery native` asks the task without telling the agent to compare the skills. To test discovery, run the same revision twice with `--discovery directory` and `--discovery native`, each with its own output directory. The directory control reproduces the original comparison sentence. Both arms install the same three files and leave skill selection to the agent.

To test a single skill against an unguided agent, specify its case and compare `--skill-scope selected` with `--skill-scope none`. For the harder writing case, run the following from the same checkout.

```bash
python3 -B apps/okf-graph/evals/trace_trials.py /var/tmp/writing-guided --skill okf --case 3 --skill-scope selected --replicates 3 --jobs 2 --model gpt-6-astra
python3 -B apps/okf-graph/evals/trace_trials.py /var/tmp/writing-unguided --skill okf --case 3 --skill-scope none --replicates 3 --jobs 2 --model gpt-6-astra
```

Grade the result against the case's existing `expected_output`. Inspect `workspace/`, `changes.diff`, the final message, and the completed tool events in `trace.jsonl`. Trace evidence of skill use includes consulting the right decision before editing, resolving the latest tag before validation, and checking a known consumer before removing a concept ID. Record partial or failed runs even when the command exits successfully. The rotation repeat and review-only cases are separate behavioral checks.

Compare runs within each skill. `metrics.json` contains model-reported input, cached input and output tokens, completed event counts by type, shell commands with nonzero exits, command output bytes, and wall time. Subtract cached input from input to get uncached input. Count completed command and edit events once each. A shell command may batch several operations, and a nonzero search can mean no matches. The `full_body_outputs` count records shell outputs containing each complete skill body verbatim. Inspect partial, numbered, or split reads in the trace, and distinguish metadata reads from body reads. Read the trace before labeling a step wasted. Token usage is per turn and includes accumulated context across model calls. It cannot assign a token cost to an individual tool or reveal the model's private reasoning.

The [paired trial results](trace-results.md) include all runs, the observed repairs, and the changes in token use.
