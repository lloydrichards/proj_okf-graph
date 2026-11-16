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
