import type { MarkdownDocument } from "@repo/domain/Markdown";
import { Box } from "effect-boxes";
import { describe, expect, it } from "vitest";
import { MarkdownBox } from "./Markdown";

const visible = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n");

const ansiCode = (code: number): RegExp =>
  new RegExp(`${String.fromCharCode(27)}\\[(?:\\d+;)*${code}(?:;\\d+)*m`, "u");

const escape = String.fromCharCode(27);

const document = (blocks: MarkdownDocument["blocks"]): MarkdownDocument => ({
  blocks,
});

describe("renderMarkdownBox", () => {
  it("distinguishes links with color and directional markers", () => {
    const markdown = MarkdownBox(
      document([
        {
          _tag: "Paragraph",
          children: [
            { _tag: "Text", value: "Open " },
            {
              _tag: "Link",
              url: "concepts/system-boundaries.md",
              title: undefined,
              children: [{ _tag: "Text", value: "System boundaries" }],
            },
            { _tag: "Text", value: " or " },
            {
              _tag: "Link",
              url: "https://www.rfc-editor.org/rfc/rfc8881",
              title: undefined,
              children: [{ _tag: "Text", value: "RFC 8881" }],
            },
            { _tag: "Text", value: "." },
          ],
        },
      ]),
      80,
    );
    const plain = visible(Box.renderPlainSync(markdown));
    const pretty = Box.renderPrettySync(markdown);

    expect(plain).toBe("Open System boundaries → or RFC 8881 ↗.");
    expect(pretty).toMatch(ansiCode(95));
    expect(pretty).not.toMatch(ansiCode(4));
    expect(pretty).toContain(`${escape}[0;95m→${escape}[0m`);
    expect(pretty).toContain(`${escape}[0;95m↗${escape}[0m`);
  });

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

  it("renders a GFM table as an aligned grid", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            {
              _tag: "Table",
              alignments: ["left", "left", "right"],
              rows: [
                [
                  [{ _tag: "Text", value: "Profile" }],
                  [{ _tag: "Text", value: "Adds" }],
                  [{ _tag: "Text", value: "Issues" }],
                ],
                [
                  [{ _tag: "Text", value: "read-only-local" }],
                  [{ _tag: "Text", value: "complete read path" }],
                  [{ _tag: "Text", value: "#43, #39" }],
                ],
              ],
            },
          ]),
          48,
        ),
      ),
    );

    expect(rendered).toContain("Profile");
    expect(rendered).toContain("Adds");
    expect(rendered).toContain("Issues");
    expect(rendered).toContain("─┼─");
    expect(rendered).toContain("read-only-local");
    expect(rendered).not.toContain("| :---");
  });

  it("stacks table fields when columns cannot remain readable", () => {
    const rendered = visible(
      Box.renderPlainSync(
        MarkdownBox(
          document([
            {
              _tag: "Table",
              alignments: ["left", "left", "right"],
              rows: [
                [
                  [{ _tag: "Text", value: "Profile" }],
                  [{ _tag: "Text", value: "Adds" }],
                  [{ _tag: "Text", value: "Issues" }],
                ],
                [
                  [{ _tag: "Text", value: "local" }],
                  [{ _tag: "Text", value: "read path" }],
                  [{ _tag: "Text", value: "#43" }],
                ],
              ],
            },
          ]),
          16,
        ),
      ),
    );

    expect(rendered).toContain("Profile: local");
    expect(rendered).toContain("Adds: read path");
    expect(rendered).toContain("Issues: #43");
  });
});
