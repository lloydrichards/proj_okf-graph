# Basis and deliberate adaptations

This skill contains original instructions developed from the user's research and decisions. It does not install or depend on the external skill packs below.

- [Cassie Groos's CRD article](https://www.designsystemscollective.com/probabilistic-isnt-a-dirty-word-37fa836bedd8) motivates stable component files and distinguishing lifecycle from development readiness. Our default extension preserves lifecycle while section progress is assessed from the body. This is a local adaptation. The author's v2 was early in production when described.
- User-supplied Switch screenshots establish six visible sections, requirement IDs, inline markers, dated decisions, and unresolved questions. They do not expose complete frontmatter or a published skill. The Switch's specific design choices are not defaults for other components.
- [OKF v0.2](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md) defines the metadata and extension conventions. It does not prescribe CRD body sections or implement this workflow.
- The `effect-virtual-fs` repository's local OKF skill informed source-driven maintenance and meaning-based timestamps. Its executable wrapper and repository-specific zero-broken-link rule are not dependencies of this skill.
- Murphy Trueman's [decision-record](https://github.com/murphytrueman/design-system-ops/blob/main/skills/decision-record/SKILL.md) informed evidence-backed reasons and revisit conditions. We retain component-local reasoning inline rather than creating separate records by default.
- His [design-to-code-check](https://github.com/murphytrueman/design-system-ops/blob/main/skills/design-to-code-check/SKILL.md) distinguishes implementation discrepancies from specification gaps. This distinction informs review without turning every CRD edit into a full design audit.
- [Anthropic's design-system skill](https://github.com/anthropics/knowledge-work-plugins/blob/main/design/skills/design-system/SKILL.md) provides useful questions about states, accessibility, and neighboring patterns. We avoid its independently copied API tables and generic numerical audit scores.

Do not automatically follow another pack's installation, permissions, publishing, or review workflow. Consult its original sources when adopting an additional capability.

The current skill template and frontmatter reference define our accepted convention. Earlier research drafts that propose mirrored section progress or a CRD format field are historical proposals, not defaults.
