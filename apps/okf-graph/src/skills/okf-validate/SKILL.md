---
name: okf-validate
description: Check an Open Knowledge Format (OKF) bundle with the latest published okf-graph CLI. Use for validation-only requests, broken-link checks, or a report of errors and warnings after edits.
---

# Validate an OKF bundle

Use the bundle path supplied by the caller. If omitted, locate the bundle root from repository documentation or its index. Run the validator against that root. Bun must be on PATH to execute the CLI.

Resolve npm's `latest` tag on every run. Use an empty temporary cache for the lookup so a registry outage cannot return yesterday's version. The executable can reuse the normal npm cache once the version is known. Substitute the actual bundle path below.

```bash
(
  lookup_cache=$(mktemp -d) || exit 1
  trap 'rm -rf -- "$lookup_cache"' EXIT
  version=$(npm view --cache "$lookup_cache" okf-graph@latest version) || exit 1
  test -n "$version" || exit 1
  printf 'Checking with okf-graph@%s\n' "$version" >&2
  npx --yes "okf-graph@$version" validate "<bundle-path>" --json
)
```

Read the exit status and the JSON. Report the bundle, resolved version, command, validity, and findings by severity. Include each affected concept or file and the reason. A valid bundle can still have warnings, including an unresolved link. When findings repeat across many files, group them by reason and give the count.

If the package cannot be fetched or the runtime fails, report the error and that validation did not complete. A pinned repository check can answer a separate compatibility question if requested. A validation-only run leaves the bundle, log, dependencies, and lockfiles untouched.
