import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { MarkdownService } from "./MarkdownService";

describe("MarkdownService", () => {
  it.effect("should preserve YAML frontmatter when parsing a document", () =>
    Effect.gen(function* () {
      const markdown = yield* MarkdownService;
      const parsed = yield* markdown.parseDocument("---\ntitle: Demo\n---");

      expect(parsed.document.blocks).toEqual([
        { _tag: "Frontmatter", value: "title: Demo" },
      ]);
    }).pipe(Effect.provide(MarkdownService.layer)),
  );

  it.effect("should map headings when parsing a document", () =>
    Effect.gen(function* () {
      const markdown = yield* MarkdownService;
      const parsed = yield* markdown.parseDocument("# Heading");

      expect(parsed.document.blocks).toEqual([
        {
          _tag: "Heading",
          level: 1,
          children: [{ _tag: "Text", value: "Heading" }],
        },
      ]);
    }).pipe(Effect.provide(MarkdownService.layer)),
  );

  it.effect(
    "should preserve inline links and code when parsing a paragraph",
    () =>
      Effect.gen(function* () {
        const markdown = yield* MarkdownService;
        const parsed = yield* markdown.parseDocument(
          "Paragraph with [link](https://example.com) and `code`.",
        );

        expect(parsed.document.blocks).toEqual([
          {
            _tag: "Paragraph",
            children: [
              { _tag: "Text", value: "Paragraph with " },
              {
                _tag: "Link",
                url: "https://example.com",
                title: undefined,
                children: [{ _tag: "Text", value: "link" }],
              },
              { _tag: "Text", value: " and " },
              { _tag: "InlineCode", value: "code" },
              { _tag: "Text", value: "." },
            ],
          },
        ]);
      }).pipe(Effect.provide(MarkdownService.layer)),
  );

  it.effect("should map list items when parsing a document", () =>
    Effect.gen(function* () {
      const markdown = yield* MarkdownService;
      const parsed = yield* markdown.parseDocument(
        "- first item\n- second item",
      );

      expect(parsed.document.blocks).toEqual([
        {
          _tag: "List",
          ordered: false,
          start: undefined,
          items: [
            [
              {
                _tag: "Paragraph",
                children: [{ _tag: "Text", value: "first item" }],
              },
            ],
            [
              {
                _tag: "Paragraph",
                children: [{ _tag: "Text", value: "second item" }],
              },
            ],
          ],
        },
      ]);
    }).pipe(Effect.provide(MarkdownService.layer)),
  );

  it.effect("should map blockquotes when parsing a document", () =>
    Effect.gen(function* () {
      const markdown = yield* MarkdownService;
      const parsed = yield* markdown.parseDocument("> quoted text");

      expect(parsed.document.blocks).toEqual([
        {
          _tag: "Blockquote",
          children: [
            {
              _tag: "Paragraph",
              children: [{ _tag: "Text", value: "quoted text" }],
            },
          ],
        },
      ]);
    }).pipe(Effect.provide(MarkdownService.layer)),
  );

  it.effect(
    "should preserve code language when parsing a fenced code block",
    () =>
      Effect.gen(function* () {
        const markdown = yield* MarkdownService;
        const parsed = yield* markdown.parseDocument("```ts\nconst x = 1\n```");

        expect(parsed.document.blocks).toEqual([
          { _tag: "CodeBlock", value: "const x = 1", language: "ts" },
        ]);
      }).pipe(Effect.provide(MarkdownService.layer)),
  );

  it.effect("should extract a title when a Markdown link has one", () =>
    Effect.gen(function* () {
      const markdown = yield* MarkdownService;
      const parsed = yield* markdown.parse(
        `I am a [link](/otherConcept "child of") that can be parsed`,
      );

      expect(parsed.links).toEqual([
        {
          label: "link",
          target: "/otherConcept",
          title: "child of",
        },
      ]);
    }).pipe(Effect.provide(MarkdownService.layer)),
  );

  it.effect(
    "should resolve metadata when a link uses a reference definition",
    () =>
      Effect.gen(function* () {
        const markdown = yield* MarkdownService;
        const parsed = yield* markdown.parse(
          'Read the [guide][g].\n\n[g]: /guide.md "reference"',
        );

        expect(parsed.links).toEqual([
          { label: "guide", target: "/guide.md", title: "reference" },
        ]);
      }).pipe(Effect.provide(MarkdownService.layer)),
  );

  it.effect("should preserve image alt text when mapping an image", () =>
    Effect.gen(function* () {
      const markdown = yield* MarkdownService;
      const parsed = yield* markdown.parseDocument(
        "![Watering diagram](/water.png)",
      );

      expect(parsed.document.blocks).toEqual([
        {
          _tag: "Paragraph",
          children: [{ _tag: "Text", value: "Watering diagram" }],
        },
      ]);
    }).pipe(Effect.provide(MarkdownService.layer)),
  );
});
