import { Graph, Option, Terminal } from "effect";
import { Box } from "effect-boxes";
import { describe, expect, it } from "vitest";
import {
  NeighborhoodExplorerView,
  processNeighborhoodExplorerInput,
  type NeighborhoodExplorerState,
} from "./NeighborhoodExplorer";

const graph = Graph.directed<string, string>((mutable) => {
  Graph.addNode(mutable, "Long file");
  Graph.addNode(mutable, "Short file");
  Graph.addEdge(mutable, 0, 1, "link");
});
const options = {
  graph,
  nodeIndex: 0,
  nodeLabel: (node: string) => node,
  nodeView: (node: string) => ({
    title: node,
    reference: "file.md",
    type: "concept",
    document: {
      blocks: [
        {
          _tag: "CodeBlock" as const,
          language: undefined,
          value:
            node === "Long file"
              ? Array.from(
                  { length: 100 },
                  (_, i) => `LINE_${String(i + 1).padStart(3, "0")}`,
                ).join("\n")
              : "SHORT_FILE",
        },
      ],
    },
  }),
};
const initial: NeighborhoodExplorerState = {
  center: 0,
  direction: "self",
  path: [],
  cursor: 0,
  history: [0],
  historyCursor: 0,
};
const press = (
  state: NeighborhoodExplorerState,
  name: string,
  width: number,
  height = 24,
) => {
  const input: Terminal.UserInput = {
    input: Option.none(),
    key: { name, ctrl: false, meta: false, shift: false },
  };
  const action = processNeighborhoodExplorerInput(
    options,
    input,
    state,
    width,
    height,
  );
  if (action._tag !== "NextFrame") throw new Error(`Unexpected ${action._tag}`);
  return action.state as NeighborhoodExplorerState;
};
const render = (
  state: NeighborhoodExplorerState,
  width: number,
  mode: "static" | "interactive" = "interactive",
  height = 24,
) =>
  Box.renderPrettySync(
    NeighborhoodExplorerView(options, state, false, width, height, mode),
  );

describe.each([80, 120])("document access at width %i", (width) => {
  it("prints every line in static output regardless of terminal height", () => {
    const output = render(initial, width, "static");
    for (let line = 1; line <= 100; line++)
      expect(output).toContain(`LINE_${String(line).padStart(3, "0")}`);
  });
  it("reaches every line through PageDown and returns with PageUp", () => {
    let state = initial;
    let output = render(state, width);
    for (let page = 0; page < 120; page++) {
      const next = press(state, "pagedown", width);
      output += render(next, width);
      if (next.readerOffset === state.readerOffset) break;
      state = next;
    }
    for (let line = 1; line <= 100; line++)
      expect(output).toContain(`LINE_${String(line).padStart(3, "0")}`);
    for (let page = 0; page < 120; page++)
      state = press(state, "pageup", width);
    expect(render(state, width)).toContain("LINE_001");
    expect(state.readerOffset).toBe(0);
  });
  it("supports End/Home, clamps after resizing, and resets on recenter", () => {
    let state = press(initial, "end", width);
    expect(render(state, width)).toContain("LINE_100");
    const resizedWidth = width === 80 ? 120 : 80;
    state = press(state, "end", resizedWidth, 30);
    expect(render(state, resizedWidth, "interactive", 30)).toContain(
      "LINE_100",
    );
    state = press(state, "home", width);
    expect(render(state, width)).toContain("LINE_001");
    state = press(press(initial, "end", width), "down", width);
    state = press(state, "return", width);
    expect(state.readerOffset).toBe(0);
    expect(render(state, width)).toContain("SHORT_FILE");
  });
});
