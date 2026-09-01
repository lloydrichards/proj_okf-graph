# OKF Graph

`okf-graph` is a command-line tool for reading, validating, and exploring [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) bundles. It builds a directed graph from Markdown links so you can inspect concepts, relationships, navigation, and structural quality.

## Install

```bash
npm install --global okf-graph
```

The CLI requires Bun. Install it from [bun.sh](https://bun.sh), then run:

```bash
okf-graph --help
```

## Usage

Pass a local OKF bundle directory or a supported Git source to each command.

```bash
# Validate document structure and cross-links.
okf-graph validate path/to/bundle

# View a concept card.
okf-graph concept path/to/bundle foundations/houseplant

# Browse a concept's local graph interactively.
okf-graph concept path/to/bundle foundations/houseplant --interactive

# Print graph statistics and Mermaid diagram source.
okf-graph graph path/to/bundle

# Inspect incoming and outgoing links for a concept.
okf-graph graph neighbors path/to/bundle foundations/houseplant

# Find the shortest directed path between two concepts.
okf-graph graph path path/to/bundle foundations/houseplant care/watering

# Render the bundle index documents.
okf-graph bundle index path/to/bundle

# Evaluate structural properties of the bundle.
okf-graph eval path/to/bundle
```

Use `--json` with `validate`, `graph`, `graph neighbors`, `graph path`, `graph topologies`, or `eval` when consuming output programmatically. Use `eval --schema` to include the evaluation JSON Schema, and `eval --output report.json` to save an evaluation report.

## Development

Clone the repository, install dependencies with Bun, and run the CLI from the repository root:

```bash
bun install
bun start -- --help
```

The repository includes `house-plants-okf`, a sample bundle for local exploration.

## License

[MIT](LICENSE)
