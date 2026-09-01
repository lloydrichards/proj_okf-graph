# OKF Graph

Explore and validate [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) bundles from your terminal.

[![npm version](https://img.shields.io/npm/v/okf-graph)](https://www.npmjs.com/package/okf-graph)

`okf-graph` turns the Markdown links in an OKF bundle into a directed graph. Use it to find broken links, inspect individual concepts, explore relationships, and understand the structure of a knowledge bundle.

![Validate and explore an OKF bundle with okf-graph](./media/okf-graph-demo.gif)

## Quick start

Install [Bun](https://bun.sh) first. The examples use `npx` to run the latest published version without installing it globally.

```bash
npx okf-graph@latest graph neighbors \
  https://github.com/lloydrichards/proj_okf-graph/tree/main/examples/house-plants-okf \
  propagation/leaf-cuttings
```

An OKF bundle, like the included [`house-plants-okf`](./examples/house-plants-okf), is a directory of Markdown concept files with YAML frontmatter. Links between those files express relationships as a directed graph.

## Explore a bundle

```bash
# Use the example bundle for the commands below
BUNDLE="https://github.com/lloydrichards/proj_okf-graph/tree/main/examples/house-plants-okf"

# Read a concept and explore its local graph interactively
npx okf-graph@latest concept "$BUNDLE" foundations/houseplant --interactive

# Print a concept's neighbors directly
npx okf-graph@latest graph neighbors "$BUNDLE" foundations/houseplant

# Validate the structure and links in your own bundle
npx okf-graph@latest validate path/to/your-bundle
```

`foundations/houseplant` is a concept ID: the path to its Markdown file inside the bundle, without the `.md` extension. Run `npx okf-graph@latest --help` to discover commands, then `npx okf-graph@latest <command> --help` for options such as machine-readable JSON output.

## Install globally

Install the command if you use it regularly:

```bash
npm install --global okf-graph
okf-graph --help
```

Commands accept local directories and GitHub tree URLs like the example above.

## Learn more

- [okf-graph on npm](https://www.npmjs.com/package/okf-graph)
- [Open Knowledge Format specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
- [Google Knowledge Catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog)
- [edu_effect-okf](https://github.com/lloydrichards/edu_effect-okf), the learning project that preceded this CLI

## Development

Clone the repository, install dependencies with Bun, and run the CLI from the repository root:

```bash
bun install
bun start -- --help
bun start -- graph path examples/house-plants-okf foundations/houseplant care/watering
bun test
```

The repository includes [`examples/house-plants-okf`](./examples/house-plants-okf), a sample bundle for local exploration.

## License

[MIT](LICENSE)
