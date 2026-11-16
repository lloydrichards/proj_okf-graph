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

## Harder writing case: durability and ownership

Case 3 gives the agent a restore-drill handover, a decision register, a feed contract, and three plausible concept owners. The restore procedure is unchanged. A durable posting exception and a confirmed receipt interpretation belong in different concepts. The expired sandbox override, pending proposal, observed 47-second delay, and unreproduced console indicator are distractors.

Before running the agents we fixed five gates in [the writing eval](../src/skills/okf/evals/evals.json): posting ownership and all exception conditions, feed ownership and verification advice, durability, source integrity, and a successful post-edit check. Three independent sessions received only the unchanged writing skill from `f20ef41`. Three scored controls had an empty inventory and no skill files in the fixture. All received identical prompts and fixtures with native discovery, gpt-6-astra, and medium reasoning effort. A reviewer graded the shuffled, anonymous diffs and check evidence. A separate review inspected the commands and final answers.

| Condition     | Rep             | Gross input | Uncached input | Output | Shell calls | Edit events | Shell output bytes | Gates passed |
| ------------- | --------------- | ----------- | -------------- | ------ | ----------- | ----------- | ------------------ | ------------ |
| Writing skill | 1               | 81522       | 11762          | 1131   | 5           | 1           | 7916               | 5/5          |
| Writing skill | 2               | 80655       | 5391           | 928    | 6           | 1           | 7358               | 5/5          |
| Writing skill | 3               | 68844       | 6252           | 875    | 4           | 1           | 7906               | 5/5          |
| No skills     | 1 (replacement) | 84434       | 6354           | 848    | 4           | 1           | 7627               | 5/5          |
| No skills     | 2               | 103564      | 6668           | 1234   | 6           | 2           | 7583               | 5/5          |
| No skills     | 3               | 85006       | 11662          | 1021   | 4           | 2           | 7193               | 5/5          |

Both arms passed 3/3. Every agent put the sealed-period, different-period, new-voucher exception and audit rationale in posting identity. Each put the delayed receipt and account/key ledger lookup in the feed reference. All preserved the ordinary retry rule and its account scope. None promoted a rehearsal setting, an open proposal, or a one-off observation to production policy. One guided agent created a redundant history log. We recorded the extra file separately because the locked rubric allowed logging.

The trace of every scored run returned all eight fixture Markdown files before the first edit. Each guided agent opened the writing skill once and finished in one edit. The controls made five edit calls in total. Two revised wording after already passing validation, then checked again. Every first post-edit check was clean. Guided runs used 23,405 uncached input tokens versus 24,684 (5.2% fewer), and 2,934 output tokens versus 3,103 (5.4% fewer). Shell output was 3.5% larger with the skill.

The first attempted control opened a host Pages writing skill and its writing-quality reference despite its empty catalog. We excluded it on exposure grounds and used a fresh control with the same settings. Its unscored turn consumed 19,371 uncached input and 926 output tokens. The scored controls showed no skill reads. Catalog isolation controls discovery; trace inspection still matters.

The handover directed readers to both authorities and the existing procedure linked both owners. The case therefore tests selecting, verifying, and placing durable information when a source trail exists. It did not establish that the writing skill improves those judgments or reliably reduces cost.

## Ambiguous ownership without a handover cue

Case 4 asks the agent to update the bundle after an old-batch drill and explain where it put the change and why. The handover names neither candidate. Both the reconciliation reference and the rebuilding guide already discuss matching account and client keys, cite the same record, and have the same review owner. The [five gates](../src/skills/okf/evals/evals.json) were fixed before the runs. Either page could hold the complete rule if the agent justified the choice for readers and kept the other page accurate.

Six fresh gpt-6-astra sessions at medium reasoning effort received identical prompts and fixtures. Three had only the writing skill and three had an empty skill catalog. No trace showed a host skill read. An independent reviewer graded shuffled, condition-masked diffs, final reports and validation evidence. A separate reviewer checked the visible commands and progress messages.

| Condition     | Rep | Gross input | Uncached input | Output | Shell calls | Edit events | Shell output bytes | Artifact gates |
| ------------- | --- | ----------- | -------------- | ------ | ----------- | ----------- | ------------------ | -------------- |
| Writing skill | 1   | 85701       | 16965          | 1094   | 5           | 1           | 6273               | 5/5            |
| Writing skill | 2   | 85127       | 12167          | 1204   | 7           | 1           | 5817               | 5/5            |
| Writing skill | 3   | 68477       | 12157          | 1107   | 3           | 1           | 2695               | 5/5            |
| No skills     | 1   | 66378       | 5450           | 1160   | 3           | 1           | 3760               | 3/5            |
| No skills     | 2   | 82834       | 9234           | 1197   | 4           | 1           | 3770               | 3/5            |
| No skills     | 3   | 66332       | 10908          | 1151   | 3           | 1           | 3760               | 3/5            |

All six edited the same two pages, linked from rebuilding to reconciliation, preserved the eligibility conditions and audit rationale, discarded the drill-only details, and passed their first post-edit check. Their stated plans already showed the difference before editing. Each guided agent chose reconciliation to own the repeat-submission rule because it applies to both direct and imported submissions. The rebuilding guide gave the replay-specific action and pointed readers to the full rule. Each control planned to update both pages and then copied the full three-condition rule into both. That duplication accounts for both missed gates, single ownership and treatment of the competing page.

All three controls and the first two guided runs visibly read the handover, decision record, index, and both candidate pages before editing. Guided run 3 stated the correct rule, but its pre-edit command results show only filenames and the skill body. Its diff and report meet the artifact criteria. The trace leaves the source inspection required by the competing-page gate unverified for that run.

Across three runs per condition, the skill used 41,289 uncached input tokens versus 25,592 (+61.3%), 3,405 output tokens versus 3,508 (−2.9%), and 15 shell calls versus 10. These are whole-session totals. On this fixture the skill consistently produced one place to maintain the rule at higher input cost. Three runs per condition on a single case do not establish a general cost or quality advantage.

## Trimming the writing skill on the same ownership case

The earlier 61.3% difference compares uncached input with and without the skill. Gross input rose from 215,544 to 239,305 (+11.0%), while the cached share of input fell from 88.1% to 82.7%. Three reads of the 2,487-byte skill account for three of the five additional shell calls. Shell output grew by only 3,495 bytes in total, partly because one guided trace lacked the source contents. Two unguided sessions with identical shell-output sizes and nearly identical gross input used 5,450 and 10,908 uncached tokens. The turn totals cannot assign a token charge to any individual read.

We repeated case 4 with the original skill from `cdb3803` and three successive edits. Each group used three fresh Codex CLI 0.169.0 sessions, gpt-6-astra at medium effort, two workers, native discovery, and only the writing skill enabled. The prompt, fixture, rubric, and discovery description stayed fixed. A reviewer graded anonymized diffs, final answers and check results. We also inspected the completed commands for evidence reads, extra discovery, and validation repairs.

The first trim made ownership explicit: keep the complete rule where readers look for the answer and put a link and local action in competing concepts. It also weakened the condition on updating generation metadata. All three agents added timestamps to both pages, received missing-author warnings, repaired the metadata and validated again. The second trim restored the condition that the bundle already tracks the timestamp. All three left the metadata alone and validated once. The final variant also asked agents to read known paths in one call and widen their search only for an unresolved claim or owner.

| Version (three runs each)        | Skill bytes | Single owner | Gross input | Uncached input | Output | Shell calls | Edit events | Shell output bytes |
| -------------------------------- | ----------: | -----------: | ----------: | -------------: | -----: | ----------: | ----------: | -----------------: |
| Original, fresh baseline         |       2,487 |          0/3 |     214,480 |         16,336 |  3,406 |          13 |           3 |             18,727 |
| First trim                       |       1,363 |          3/3 |     365,412 |         28,004 |  4,435 |          21 |           6 |             17,097 |
| Conditional timestamp (retained) |       1,384 |          3/3 |     220,135 |         21,863 |  3,186 |          15 |           3 |             15,174 |
| Explicit batching                |       1,466 |          3/3 |     252,680 |         30,472 |  3,279 |          15 |           3 |             14,896 |

Every session visibly read all five fixture documents before editing, read the writing skill once, and finished with zero validator findings. The fresh original-skill runs preserved the facts but repeated all three eligibility conditions and the new-posting outcome on both pages, missing gates 1 and 3. The previous three original-skill runs kept one owner. All nine trimmed-skill runs passed all five gates. They put the complete rule in the reconciliation reference and linked to it from replay instructions.

We retained the 1,384-byte version. It cuts skill bytes by 44.4% and shell output by 19.0% against the fresh baseline. Output tokens fell 6.5%, gross input rose 2.6%, and uncached input rose 33.8%. Per-run uncached input was 6,153 / 5,592 / 10,118, versus 5,120 / 5,333 / 5,883 for the fresh baseline. The earlier original-skill group used 41,289 uncached tokens, so the apparent saving depends on which baseline is used. The explicit batching variant still made 15 shell calls, including a directory listing before reading the already identified files. This case supports retaining the shorter ownership guidance. It does not establish lower whole-session input cost.

## Twelve alternating pairs on ambiguous ownership

We fixed the sample at twelve pairs before running case 4. Within each pair, two fresh, serial sessions received the same fixture, prompt, built validator, frozen rubric and discovery description. Odd pairs ran the original skill first, even pairs the retained trim first. The only installed skill was the version under test. The 2,487-byte original came from `cdb3803` and the 1,384-byte trim from `af33899`. Both used native skill discovery, Codex CLI 0.169.0, gpt-6-astra and medium reasoning effort. The table below contains only this round.

A reviewer scored each randomly labeled diff, final explanation and validation result without seeing the version or token counts. Both homes were eligible under the rubric. A guide that links to the reference and repeats every eligibility condition and the new-posting outcome still contains a second usable rule. The trace audit separately checked source reads and post-edit validation.

| Pair | Original owner | Trimmed owner | Original uncached | Trimmed uncached | Difference (trimmed − original) |
| ---: | -------------- | ------------- | ----------------: | ---------------: | ------------------------------: |
|    1 | Single         | Single        |            12,013 |            9,642 |                          -2,371 |
|    2 | Duplicated     | Single        |             6,083 |           11,268 |                          +5,185 |
|    3 | Duplicated     | Single        |             5,150 |            5,996 |                            +846 |
|    4 | Single         | Single        |            11,007 |           10,664 |                            -343 |
|    5 | Duplicated     | Single        |             6,152 |            5,038 |                          -1,114 |
|    6 | Duplicated     | Single        |            10,085 |            5,956 |                          -4,129 |
|    7 | Duplicated     | Single        |             6,151 |            5,885 |                            -266 |
|    8 | Duplicated     | Single        |            10,947 |            8,422 |                          -2,525 |
|    9 | Duplicated     | Single        |            16,331 |           12,610 |                          -3,721 |
|   10 | Duplicated     | Single        |            12,630 |            8,265 |                          -4,365 |
|   11 | Duplicated     | Single        |             6,292 |            5,176 |                          -1,116 |
|   12 | Duplicated     | Single        |             6,016 |           14,007 |                          +7,991 |

The trim kept a single owner in 12/12 runs and the original in 2/12. Both succeeded in pairs 1 and 4. In the other ten pairs, only the trimmed version kept one complete rule. All 24 updated the same two concepts, preserved the contract and sources, and ended with zero validation findings. Each trace showed one complete read of its assigned skill. In original run 3 the visible pre-edit results listed the source and candidate filenames without returning their contents. Its diff independently establishes duplication. The other 23 traces showed all five fixture documents before editing.

| Metric across twelve sessions     |     Original | Retained trim |
| --------------------------------- | -----------: | ------------: |
| Gross input tokens                |      937,017 |     1,046,545 |
| Cached share of gross input       |        88.4% |         90.2% |
| Uncached input tokens             |      108,857 |       102,929 |
| Median uncached input per session |      8,188.5 |       8,343.5 |
| Uncached input range              | 5,150–16,331 |  5,038–14,007 |
| Output tokens                     |       13,409 |        14,398 |
| Shell calls                       |           57 |            69 |
| Edit events                       |           12 |            15 |

The trim used fewer uncached tokens in nine pairs. The median within-pair change was −1,115 tokens and the range was −4,365 to +7,991. The two arm medians are calculated independently, so their difference need not match the median paired change. Across the round the trim used 5.4% less uncached input, 11.7% more gross input, and 7.4% more output. Cache reuse varied between sessions. Three trimmed runs (pairs 2, 3 and 12) added a Markdown link to the external decision record, repaired the resulting broken-link warning, and validated again. All original runs finished with one edit. Ownership was consistent for the trim on this fixture. Token savings varied even with run order balanced.

## Citing evidence outside the bundle

Three of the twelve trimmed-skill sessions in the alternating study added a Markdown link to the external decision record. Their first validation returned a broken-link warning. Each agent then repaired the link and validated again. We added one sentence to the retained skill:

> For evidence files outside the bundle, keep the path only in `sources` and cite the decision or section in prose.

We ran twelve new serial sessions on case 4 with the same fixture, prompt, rubric, model, effort, and isolated skill catalog. The comparison below uses the previous twelve trimmed-skill sessions as its baseline. A reviewer scored the shuffled, anonymously labeled diffs and reports from both groups. We checked each trace for the first validation findings, any later edits, and the final result.

| Across twelve sessions             | Prior trim | With citation sentence |
| ---------------------------------- | ---------: | ---------------------: |
| Kept one authoritative rule        |         12 |                     12 |
| Clean first post-edit validation   |          9 |                     12 |
| Repaired an external evidence link |          3 |                      0 |
| Clean final validation             |         12 |                     12 |
| Shell calls                        |         69 |                     56 |
| Edit events                        |         15 |                     12 |
| Gross input tokens                 |  1,046,545 |                884,319 |
| Uncached input tokens              |    102,929 |                 96,351 |
| Output tokens                      |     14,398 |                 12,645 |

Each revised-skill trace shows the agent reading the skill and all five fixture documents before editing. Each made one edit covering both concepts and ran one clean check. The reconciliation reference kept the full eligibility rule. The rebuild guide linked to that reference and gave the local replay action. The external decision record remained in the existing source metadata. These twelve runs avoided the observed repair on this case. The groups ran at different times, so the token totals alone cannot attribute savings to the added sentence.
