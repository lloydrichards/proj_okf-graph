# Authoring a CRD

## Establish the component

Read the supplied brief, relevant sibling CRDs, accepted decisions, and available design and implementation sources. Find the component's user task and boundary. Compare adjacent components before proposing a new one. Distinguish an explicit requirement from a suggested convention or observed implementation.

The template's six sections follow the supplied Switch example: Requirements, Design specifications, Implementation, Brand validation, CMS behaviour, and Documentation guidance. They are our default for new CRDs, not required by OKF. Preserve distinct Purpose, Scope, requirement categories, Design decisions, Implementation decisions, and Dev notes & deviations. Retain a target's established structure when it expresses these distinctions. Numbering is optional. Brand and CMS sections apply only where those consumers exist. Keep a section empty when its evidence is missing, and state explicit non-applicability in the body when decided.

## Make requirements traceable

Separate Purpose, Scope, and Anatomy from identified requirements. Scope distinguishes included work, work owned by another component, and rejected approaches. Anatomy defines the nouns used for component parts.

Use the established ID syntax, with `F1`, `S1`, `B1`, `C1`, `A1`, and `I1` as defaults for new documents. Each identified statement has one observable obligation. Split statements that could be partly satisfied. Keep abstract intent in Purpose and subjective criteria beside a `[review]` marker. Do not manufacture requirements merely to populate every category. Assign new statements by their meaning: ownership and composition belong in Integration; conditions in States; user responses in Behaviour. Keep unsupported categories empty or identify the scope gap. Label consumer-specific contracts under their category so one screen's policy is not read as a shared default.

Check whether each outcome could succeed while another fails. Split independent outcomes, even when one interaction triggers both. A warning such as "do not blindly apply disabled" belongs in usage guidance until an observable contract is decided; preserve the unresolved question. Conditions may qualify one outcome without requiring extra IDs.

Keep a requirement's ID for a refinement of the same obligation. For a split or replacement, preserve the old-to-new relationship in a dated decision. Retire removed IDs without recycling them. Current requirements describe current agreed intent; historical alternatives and superseded reasoning live in decisions or Ruled out. Do not duplicate the requirements as an acceptance checklist.

Place `[open]` directly beside a provisional requirement. Both `[open] B2: ...` and `B2: [open] ...` are valid local styles. A human-assessed statement can use `C1: [review] ...`. A separate question table records question, owner if known, decision deadline or stage if known, and status. Do not assign owners or deadlines without evidence.

## Preserve reasons

Keep component-local design and implementation decisions in their respective sections. Each entry states the decision, the real reason, its known date, and evidence when available. Log choices someone could reasonably propose differently, including relevant rejected options. Do not write post-hoc justifications or invent alternatives nobody considered. Add a revisit condition when a reason depends on a changing constraint.

Put product interaction, caller-boundary choices, and rejected design alternatives in Design decisions. Put technical implementation choices in Implementation decisions and observed mismatches in Dev notes & deviations. A dated decision should make supersession clear. Store a full rejection rationale once and refer to it from Ruled out if needed.

The design section carries missing context and references to visual authority. Implementation captures pre-development research, choices, and deviations. Requirements state observable behavior rather than reproducing code prop tables. Distinct CMS configuration or brand validation rules may be recorded where their authority originates. Validation rules are not validation results.

Keep code-owned exports, default values, styles, and call-site contents at their source. Prose that enumerates them is duplication too. Include a specific code observation only when it explains a durable decision, constraint, or mismatch. Formatting-only notes and test receipts belong in the task receipt, not the CRD.

When a wrapper delegates interaction to a dependency, inspect and reference the available documented contract. Distinguish documented dependency behavior, adopted product intent, and verified runtime behavior. Missing runtime receipts do not prevent citing documentation; missing version evidence prevents claiming it matches the installed runtime. State capture limits if available sources do not establish a complete component contract.

Usage guidance explains suitable contexts, alternatives, composition limits, and pitfalls consumers cannot infer from the API. Keep shared policies in their owning concepts. Use directed links with meaningful titles where the target tooling supports them, such as `depends on` or `constrained by`.

## Conversion

Use substantive work as the opportunity to convert legacy CRDs. Preserve existing requirements and source links. Consolidate duplicate acceptance lists only after identifying their authoritative statements. Do not drop a unique obligation hidden in a legacy checklist. Mark disagreements and missing rationale. A conversion does not establish new lifecycle events or human review.
