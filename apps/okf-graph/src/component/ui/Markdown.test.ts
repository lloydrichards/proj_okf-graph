import type { MarkdownDocument } from "@repo/domain/Markdown";
import { Box } from "effect-boxes";
import { describe, expect, it } from "vitest";
import { MarkdownBox } from "./Markdown";

const visible = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n");

const document = (blocks: MarkdownDocument["blocks"]): MarkdownDocument => ({
  blocks,
});

describe("renderMarkdownBox", () => {
  it("should wrap paragraph content when it exceeds the available width", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            {
              _tag: "Paragraph",
              children: [
                {
                  _tag: "Text",
                  value: "This is a paragraph that wraps nicely.",
                },
              ],
            },
          ]),
          12,
        ),
      ),
    );

    expect(rendered).toBe("This is a\nparagraph\nthat wraps\nnicely.");
  });

  it("should preserve an explicit Markdown line break when rendering a paragraph", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            {
              _tag: "Paragraph",
              children: [
                { _tag: "Text", value: "first line" },
                { _tag: "Break" },
                { _tag: "Text", value: "second line" },
              ],
            },
          ]),
          20,
        ),
      ),
    );

    expect(rendered).toBe("first line\nsecond line");
  });

  it("should use hanging indentation when rendering an unordered list", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            {
              _tag: "List",
              ordered: false,
              items: [
                [
                  {
                    _tag: "Paragraph",
                    children: [
                      { _tag: "Text", value: "first item wraps nicely" },
                    ],
                  },
                ],
              ],
            },
          ]),
          14,
        ),
      ),
    );

    expect(rendered).toBe("• first item\n  wraps nicely");
  });

  it("should align markers when rendering an ordered list", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            {
              _tag: "List",
              ordered: true,
              start: 1,
              items: [
                [
                  {
                    _tag: "Paragraph",
                    children: [{ _tag: "Text", value: "alpha beta gamma" }],
                  },
                ],
                [
                  {
                    _tag: "Paragraph",
                    children: [{ _tag: "Text", value: "delta epsilon" }],
                  },
                ],
              ],
            },
          ]),
          16,
        ),
      ),
    );

    expect(rendered).toBe("1. alpha beta\n   gamma\n2. delta epsilon");
  });

  it("should render a quoted gutter when rendering a blockquote", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            {
              _tag: "Blockquote",
              children: [
                {
                  _tag: "Paragraph",
                  children: [
                    { _tag: "Text", value: "quoted words here please" },
                  ],
                },
              ],
            },
          ]),
          14,
        ),
      ),
    );

    expect(rendered).toBe("│ quoted words\n│ here please");
  });

  it("should truncate long code lines when rendering a preformatted block", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            {
              _tag: "CodeBlock",
              value: "abcdefghijk\nxyz",
              language: "ts",
            },
          ]),
          6,
        ),
      ),
    );

    expect(rendered).toBe("abcde…\nxyz");
  });

  it("should preserve frontmatter delimiters when rendering a document", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            { _tag: "Frontmatter", value: "version: 1\nname: demo" },
            {
              _tag: "Paragraph",
              children: [{ _tag: "Text", value: "Body text" }],
            },
          ]),
          20,
        ),
      ),
    );

    expect(rendered).toBe("---\nversion: 1\nname: demo\n---\n\nBody text");
  });
});
