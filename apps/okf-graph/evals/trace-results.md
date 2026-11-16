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
