import { String } from "effect";
import { Box } from "effect-boxes";
import { describe, expect, it } from "vitest";
import { NeighborSummaryCard } from "./NeighborSummaryCard";

const visible = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n");

const expected = (text: string): string =>
  visible(text).replace(/^\n/u, "").replace(/\n$/u, "");

const render = (
  options: Partial<Parameters<typeof NeighborSummaryCard>[0]> = {},
): string =>
  visible(
    Box.renderPlainSync(
      NeighborSummaryCard({
        title: "Equivalent Fractions",
        reference: "math/fractions/equivalent.md",
        type: "concept",
        centerLabel: "Center",
        pathLabels: ["Fractions", "Equivalent Fractions"],
        direction: "outgoing",
        incoming: 1,
        outgoing: 4,
        width: 48,
        ...options,
      }),
    ),
  );

describe("NeighborSummaryCard", () => {
  it("renders an expandable outgoing neighbor with a route graph", () => {
    expect(render()).toBe(
      expected(
        String.stripMargin(`
         |╭──────────────────────────────────────────────╮
         |│ Highlighted Neighbor                         │
         |│ Equivalent Fractions                         │
         |│ concept · math/fractions/equivalent.md       │
         |│                                              │
         |│ outgoing neighbor · depth 2                  │
         |│                                              │
         |│ Route                                        │
         |│ ╭────────╮                                   │
         |│ │ Center │                                   │
         |│ ╰─┬──────╯                                   │
         |│   ╰─┬─▶ Fractions                            │
         |│     ╰──▶ Equivalent Fractions                │
         |│                                              │
         |│ Enter  recenter here                         │
          |│ Left/Right  browse history                   │
         |│                                              │
         |│ ← 1 in                               4 out → │
         |╰──────────────────────────────────────────────╯
         `),
      ),
    );
  });

  it("explains how to browse navigation history", () => {
    expect(render()).toContain("Left/Right  browse history");
  });

  it("renders self as the current center", () => {
    expect(
      render({
        title: "Introduction to Fractions",
        reference: "math/fractions/intro.md",
        type: "lesson",
        pathLabels: [],
        direction: "self",
        incoming: 3,
        outgoing: 5,
      }),
    ).toContain("current center");
    expect(
      render({
        title: "Introduction to Fractions",
        reference: "math/fractions/intro.md",
        type: "lesson",
        pathLabels: [],
        direction: "self",
        incoming: 3,
        outgoing: 5,
      }),
    ).toContain("Enter  stay centered");
  });
});
