# Maintaining a CRD

## Find affected knowledge

Inspect the changed artifact and name the durable claim that changed. Search the bundle for its filename or source identifier. Read the matching CRD and relevant neighbors. Relative source paths vary by directory, so do not rely solely on one repository-relative path string.

| Change                             | Maintenance action                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement or scope decision      | Update its current statement and affected usage guidance. Preserve its identity and record the reason.                                    |
| Design resolves an open question   | Update the originating requirement and record the resolution. Close the corresponding question without creating a second source of truth. |
| Implementation differs from intent | Report the exact disagreement. Change agreed intent only when an accepted decision establishes the new behavior.                          |
| New implementation finding         | Add durable reasoning or a deviation, linked to evidence. A code convention is not automatically an approved requirement.                 |
| Shared precedent changes           | Find CRDs that depend on it. Reassess only affected claims; do not copy the new policy into every document.                               |
| Component lifecycle event          | Update `component_lifecycle` with evidence, keeping document `status` independent.                                                        |
| Source relocation                  | Repair references. Do not advance knowledge timestamps unless the meaning changed.                                                        |
| Passing test run                   | Report verification evidence separately. Do not add a CRD test-results table or infer human review.                                       |
| Formatting or equivalent refactor  | Leave CRD meaning and generation metadata unchanged unless a source reference needs repair.                                               |

## Keep current authority traceable

For each changed claim, inspect its source attribution in requirements, decisions, and usage guidance. A source that established old behavior cannot authorize the new behavior. Cite the actual superseding decision and retain historical sources only where their role is clear. Reassess opening authority statements too. Keep implementation snapshots labeled by revision rather than citing old call sites as current.

Keep unresolved design choices in Open questions and known implementation mismatches in Dev notes & deviations. Record formatting-only findings and verification receipts outside the CRD. Do not add a no-change note to a document whose knowledge did not change.

## Check requirement identity across the edit

Before changing requirements, compare the existing ID and its obligation with the proposed change. Refining the same obligation keeps its ID. An additional obligation gets an unused ID. A replacement or split needs an explicit old-to-new mapping and a grounded retirement decision; do not repurpose an ID simply because it is nearby.

After editing, compare every changed or missing ID with its previous statement. Check unaffected obligations as well as the requested new behavior. For example, allowing several panels to stay open does not remove the separate obligation that a panel can be collapsed. Keep the collapse requirement unless a decision actually changes it. Record this comparison in the maintenance receipt, not as a second requirement list inside the CRD.

## Amend a built component

Keep the existing file and current requirements. Add a temporary Pending amendment block above Requirements for proposed changes. Identify affected IDs, what is proposed, why, and what decisions remain open. Do not replace approved requirements with an unaccepted proposal.

When the change is accepted and its design questions are resolved, fold agreed changes into current requirements, retain the dated reason, and remove the temporary block. Acceptance of the requirements does not prove implementation has caught up; record any known implementation deviation. Keep unresolved proposals visible rather than silently folding them in.

Inspect affected documentation, design references, implementation references, and consuming compositions. Update only the authorized artifacts whose claims changed. Report inaccessible or out-of-scope dependencies as follow-up work. Do not publish, message another team, or schedule a monitor as a side effect of CRD maintenance.

## Review or readiness assessment

Use the requested next activity to choose the checks. For a development handoff, inspect requirements and design completeness, joint review evidence, inline `[open]` markers, unresolved question rows, amendments, and conflicting sources. Cite the actual blockers. `status: stable`, `component_lifecycle: built`, or a complete-looking template is not a substitute for those checks.

For implementation alignment, distinguish a mismatch against agreed intent from a missing requirement. A screenshot can establish visual evidence for its visible states, not full keyboard behavior or release status. Run relevant behavior checks only when that verification is requested or required by the task. Keep runtime receipts outside the CRD.

Do not store the assessment as a readiness flag or duplicate blocker summary in frontmatter. Return it to the user with its inspected sources and limits.
