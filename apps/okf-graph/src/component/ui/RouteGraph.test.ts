import { String } from "effect";
import { Box } from "effect-boxes";
import { describe, expect, it } from "vitest";
import { RouteGraph } from "./RouteGraph";

const visible = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n");

const expected = (text: string): string =>
  visible(text).replace(/^\n/u, "").replace(/\n$/u, "");

describe("RouteGraph", () => {
  it("should render a route below the center when the direction is outgoing", () => {
    expect(
      visible(
        Box.renderPlainSync(
          RouteGraph({
            centerLabel: "Center",
            pathLabels: ["Fractions", "Equivalent Fractions"],
            direction: "outgoing",
            width: 40,
          }),
        ),
      ),
    ).toBe(
      expected(
        String.stripMargin(`
         |╭────────╮
         |│ Center │
         |╰─┬──────╯
         |  ╰─┬─▶ Fractions
         |    ╰──▶ Equivalent Fractions
         `),
      ),
    );
  });

  it("should render a route above the center when the direction is incoming", () => {
    expect(
      visible(
        Box.renderPlainSync(
          RouteGraph({
            centerLabel: "Center",
            pathLabels: ["Prior Knowledge", "Prerequisites"],
            direction: "incoming",
            width: 40,
          }),
        ),
      ),
    ).toBe(
      expected(
        String.stripMargin(`
         |    ╭─── Prerequisites
         |  ╭─┴─ Prior Knowledge
         |╭─┴──────╮
         |│ Center │
         |╰────────╯
         `),
      ),
    );
  });

  it("should render only the center when the direction is self", () => {
    expect(
      visible(
        Box.renderPlainSync(
          RouteGraph({
            centerLabel: "Center",
            pathLabels: [],
            direction: "self",
            width: 40,
          }),
        ),
      ),
    ).toBe(
      expected(
        String.stripMargin(`
         |╭────────╮
         |│ Center │
         |╰────────╯
         `),
      ),
    );
  });
});
