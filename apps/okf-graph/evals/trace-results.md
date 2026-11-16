# Skill execution traces, 2026-11-16

Two fresh gpt-6-astra sessions (medium effort, Codex CLI 0.169.0) ran each scenario per round. The baseline used commit `51e6e22`. Round 1 revised all three skills together. Round 2 changed only the dream skill's pointer guidance and repeated the cleanup scenario. Each run below met the one-pass output criteria. The reviewers also inspected intermediate actions, including warnings and repairs concealed by a successful final check.

| Skill        | Round | Rep | Input  | Cached input | Uncached input | Output | Shell | Edit events | Shell output bytes |
| ------------ | ----- | --- | ------ | ------------ | -------------- | ------ | ----- | ----------- | ------------------ |
| okf          | Base  | 1   | 140624 | 126336       | 14288          | 856    | 6     | 2           | 29230              |
| okf          | Base  | 2   | 154267 | 140672       | 13595          | 873    | 6     | 2           | 29017              |
| okf-validate | Base  | 1   | 125519 | 115072       | 10447          | 813    | 6     | 0           | 16320              |
| okf-validate | Base  | 2   | 102031 | 92160        | 9871           | 653    | 4     | 0           | 10211              |
| okf-dream    | Base  | 1   | 126543 | 115584       | 10959          | 1962   | 7     | 1           | 18681              |
| okf-dream    | Base  | 2   | 157472 | 144896       | 12576          | 2140   | 7     | 2           | 24448              |
| okf          | 1     | 1   | 134647 | 121088       | 13559          | 664    | 5     | 1           | 26329              |
| okf          | 1     | 2   | 106132 | 95360        | 10772          | 595    | 5     | 1           | 15373              |
| okf-validate | 1     | 1   | 122708 | 113024       | 9684           | 692    | 3     | 0           | 9040               |
| okf-validate | 1     | 2   | 123590 | 113664       | 9926           | 794    | 6     | 0           | 9949               |
| okf-dream    | 1     | 1   | 159634 | 146944       | 12690          | 2063   | 8     | 3           | 20852              |
| okf-dream    | 1     | 2   | 100359 | 90496        | 9863           | 1522   | 5     | 1           | 15718              |
| okf-dream    | 2     | 1   | 104694 | 93824        | 10870          | 1599   | 6     | 1           | 20187              |
| okf-dream    | 2     | 2   | 128066 | 115200       | 12866          | 1633   | 6     | 1           | 27376              |

## What the traces showed

- Both baseline writers consulted Q-12 and edited the correct owner. Both introduced a broken graph edge to an external source, repaired it, and reran validation. Explicit guidance to reuse the frontmatter citation removed that repair in both revised runs. Output tokens fell 27% and uncached input fell 13%. All four agents still read all three skill bodies.
- All four validation agents freshly resolved release 0.3.1, ran that version, reported the broken playbook link as a warning, and left the fixture unchanged. With the revised edge-ID explanation, both agents limited bundle reads to the affected file. One still reread sibling skill descriptions after validation. Shell output fell 28%, uncached input fell 3.5%, total input rose 8%, and generated tokens rose 1%.
- Both baseline cleanup agents deleted the scratchpad, consolidated incident evidence, and recovered from four broken citation links. Both also raised an extra restart-policy question. One temporarily created a Python bytecode file outside the bundle, then removed it. In round 1 both agents kept outside sources in metadata and raised only the retry-policy conflict. The first also linked a pointer to the index and tried to fix the warning by changing index frontmatter, which failed validation. It eventually repaired the pointer. The second completed the cleanup in one edit.
- In round 2 both cleanup agents kept the existing pager address pointing to a replacement concept. Both preserved the unreproduced loss and the limits of the restart evidence, separated the accepted limit from the observed implementation, and asked only about the policy discrepancy. Both passed their first post-edit check. Against baseline, shell and edit events fell from 17 to 14 and generated tokens fell 21%. Uncached input rose 0.9%, and shell output grew 10%. One run loaded an additional host writing guide.

These comparisons cover one successful scenario per skill, with two observations per condition. They do not establish production cost savings. Prompt caching, sibling skill reads, ambient host guidance, command batching, and agent sampling affect the totals. Idempotence and registry-outage handling have separate behavioral trials. See the [runner and grading instructions](README.md#compare-fresh-agent-traces).

## Discovery prompt comparison

The original runner asked each agent to “Choose among the three installed skills under .agents/skills using their descriptions and follow the applicable one.” Some agents printed every file to make that comparison. In the earlier trace study all four writers printed all three bodies. Codex's skill inventory also listed all three as enabled repository skills in a standalone trial workspace.

We installed the exact same skills from `c43caf9` for both arms. The directory arm kept the comparison sentence. The native arm omitted it. The task, fixtures, model, effort, tools and success criteria stayed the same. We used opaque workspace and temporary-directory names in both arms to remove the expected skill name from the agent's path. Run each arm with `--jobs 2`. There were two fresh sessions per task per arm.

| Task         | Rep | Prompt    | Full sibling bodies | Partial only | Input  | Uncached input | Output | Tool events |
| ------------ | --- | --------- | ------------------- | ------------ | ------ | -------------- | ------ | ----------- |
| okf          | 1   | directory | 2                   | 0            | 84043  | 10443          | 546    | 5           |
| okf          | 1   | native    | 0                   | 0            | 105486 | 11534          | 611    | 6           |
| okf          | 2   | directory | 0                   | 2            | 103902 | 10206          | 662    | 7           |
| okf          | 2   | native    | 0                   | 0            | 106144 | 19232          | 631    | 7           |
| okf-validate | 1   | directory | 0                   | 0            | 123614 | 9822           | 802    | 5           |
| okf-validate | 1   | native    | 0                   | 0            | 116870 | 13830          | 640    | 4           |
| okf-validate | 2   | directory | 0                   | 0            | 117209 | 8921           | 691    | 5           |
| okf-validate | 2   | native    | 0                   | 0            | 101414 | 9894           | 653    | 4           |
| okf-dream    | 1   | directory | 2                   | 0            | 136783 | 24271          | 1670   | 8           |
| okf-dream    | 1   | native    | 0                   | 0            | 133941 | 14005          | 1649   | 7           |
| okf-dream    | 2   | directory | 2                   | 0            | 130128 | 12112          | 1511   | 7           |
| okf-dream    | 2   | native    | 0                   | 0            | 111216 | 13808          | 1631   | 7           |

All 12 agents opened the intended skill and met the task's one-pass rubric. Both writing arms updated the existing Q-12 concept. Both validation arms resolved the live release, ran that version, reported the broken playbook warning, and left the fixture untouched. Both cleanup arms preserved the pager link and incident evidence, deleted the scratchpad, and flagged the retry-policy conflict.

Three directory-prompt agents read both full siblings alongside the selected skill. Another skimmed both sibling bodies later. A validator that read only sibling frontmatter counted as zero sibling bodies. The six native-prompt agents read zero sibling bodies. The same descriptions were sufficient to route these scenarios. An earlier 12-run pilot used paths containing the expected skill name and is excluded from the table. In that pilot, two native cleanup agents consulted the writing skill later during execution.

Across six tasks per arm, native discovery used 675,071 total input tokens versus 695,679 (down 3.0%), 82,303 uncached input versus 75,775 (up 8.6%), and 5,815 output tokens versus 5,882 (down 1.1%). Tool events fell from 37 to 35. Shell output rose from 95,234 to 120,576 bytes. Four native agents opened an additional host technical-writing guide, compared with one control agent. Small samples, extra host reads and variable cache hits limit the interpretation of token totals. Removing the comparison instruction eliminated unnecessary OKF body reads in the scored sample.

## OKF skills in isolation

We repeated both discovery arms from commit `6cc876b` with the same model, medium effort, worker count, fixture, prompt bytes, and skill file hashes. Each of 12 preflights found three enabled repository skills and disabled the other 24 catalog entries. A separate prompt inspection showed only those three names and descriptions. Trace review found no host skill reads, including the host technical-writing guide. All 12 agents met the existing one-pass rubric. Each read its target body once. Neither arm read a sibling body, even partially.

| Six runs per arm        | Gross input | Uncached input | Output | Tool events | Shell output bytes |
| ----------------------- | ----------- | -------------- | ------ | ----------- | ------------------ |
| Host and OKF, directory | 695,679     | 75,775         | 5,882  | 37          | 95,234             |
| Host and OKF, native    | 675,071     | 82,303         | 5,815  | 35          | 120,576            |
| OKF only, directory     | 492,273     | 53,745         | 5,415  | 30          | 31,636             |
| OKF only, native        | 504,684     | 54,124         | 5,561  | 32          | 34,316             |

Within the isolated sample, native discovery used 0.7% more uncached input than the directory prompt. Against the earlier host-enabled native arm, the isolated native arm used 34.2% less uncached input and returned 71.5% fewer shell-output bytes. Those differences include sampling and cache variation across rounds. The direct instruction payload for one full body was 2,226 UTF-8 bytes for writing, 1,073 for validation, and 2,529 for cleanup, excluding frontmatter and surrounding shell output.

| Skill        | Prompt    | Rep | Input  | Uncached input | Output | Tool events |
| ------------ | --------- | --- | ------ | -------------- | ------ | ----------- |
| okf          | directory | 1   | 67711  | 11135          | 533    | 5           |
| okf          | directory | 2   | 67608  | 5656           | 469    | 5           |
| okf          | native    | 1   | 67702  | 5750           | 536    | 5           |
| okf          | native    | 2   | 67662  | 5710           | 446    | 5           |
| okf-validate | directory | 1   | 79028  | 4660           | 597    | 3           |
| okf-validate | directory | 2   | 102164 | 11412          | 800    | 5           |
| okf-validate | native    | 1   | 95500  | 12428          | 718    | 4           |
| okf-validate | native    | 2   | 102015 | 10623          | 746    | 5           |
| okf-dream    | directory | 1   | 87727  | 13743          | 1504   | 6           |
| okf-dream    | directory | 2   | 88035  | 7139           | 1512   | 6           |
| okf-dream    | native    | 1   | 83030  | 12118          | 1464   | 6           |
| okf-dream    | native    | 2   | 88775  | 7495           | 1651   | 7           |

### What changes when there is no skill?

We also repeated the native prompts with an empty catalog and removed the three files from each fixture. The first attempt at this control disabled discovery but left the files on disk. Two agents opened them directly, so we stopped that attempt and excluded it.

| Task without skills | Rep | Uncached input | Output      | Outcome                                        |
| ------------------- | --- | -------------- | ----------- | ---------------------------------------------- |
| okf                 | 1   | 4399           | 508         | Passed                                         |
| okf                 | 2   | 5509           | 542         | Passed                                         |
| okf-dream           | 1   | 9039           | 1945        | Partial, extra reviewer decision               |
| okf-dream           | 2   | 7707           | 1889        | Partial, extra reviewer decision               |
| okf-validate        | 1   | Unavailable    | Unavailable | Stopped after selecting an unrelated CLI       |
| okf-validate        | 2   | 13029          | 1187        | Asked which CLI to use, reported link manually |

- **Writing.** All four native writers, with or without the skill, updated the existing decision correctly and passed validation. With the skill, mean uncached input rose from 4,954 to 5,730 tokens (+776) and mean output fell from 525 to 491 tokens. This measures the whole task under each condition.
- **Validation.** The fixture does not identify the package in the prompt. Both unguided agents found the broken link manually, but neither validated with the published OKF CLI. We stopped one after it attempted to install an unrelated CLI. Its turn did not emit token usage. Both guided agents resolved and ran `okf-graph@0.3.1` and reported the warning. Comparing cost per successful validation would require a successful unguided run.
- **Cleanup.** Both unguided agents produced structurally valid bundles, preserved the pager link and incident evidence, and identified the retry discrepancy. Both also asked the reviewer to assign an investigator for an evidence gap. The guided agents left that uncertainty documented and asked only for the retry-policy decision.

Each task and configuration was sampled twice. Direct body bytes measure text returned by the tool. Turn-level token totals include the full task context, repeated model calls, and the final response. The trace API does not give a token bill for individual skills.
