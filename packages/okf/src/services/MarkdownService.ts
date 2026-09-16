import {
  MarkdownBlock,
  type MarkdownDocument,
  MarkdownInline,
} from "@repo/domain/Markdown";
import {
  Array as Arr,
  Context,
  Data,
  Effect,
  Layer,
  Match,
  Option,
  pipe,
} from "effect";
import type {
  Definition,
  Link,
  LinkReference,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
  Yaml,
} from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import YAML from "yaml";

export class MarkdownParseError extends Data.TaggedError("MarkdownParseError")<{
  reason: string;
}> {}

export interface RawLink {
  readonly label: string;
  readonly target: string;
  readonly title?: string | undefined;
}

export interface ParsedMarkdown {
  readonly frontmatter: Option.Option<unknown>;
  readonly body: string;
  readonly links: ReadonlyArray<RawLink>;
}

export interface ParsedMarkdownDocument extends ParsedMarkdown {
  readonly document: MarkdownDocument;
}

type GfmTable = {
  readonly type: "table";
  readonly align?: ReadonlyArray<"left" | "center" | "right" | null>;
  readonly children: ReadonlyArray<{
    readonly children: ReadonlyArray<{
      readonly children: ReadonlyArray<PhrasingContent>;
    }>;
  }>;
};

/** Recursively extract plain text from an mdast node */
const extractText = (node: unknown): string => {
  if (node == null || typeof node !== "object") return "";
  const n = node as { value?: unknown; alt?: unknown; children?: unknown };
  if (typeof n.value === "string") return n.value;
  if (typeof n.alt === "string") return n.alt;
  if (Array.isArray(n.children))
    return (n.children as Array<unknown>).map(extractText).join("");
  return "";
};

const mapInline = (
  node: PhrasingContent,
  definitions: ReadonlyMap<string, Definition>,
): ReadonlyArray<MarkdownInline> =>
  Match.value(node).pipe(
    Match.when({ type: "text" }, (n) => [
      MarkdownInline.cases.Text.make({ value: n.value }),
    ]),
    Match.when({ type: "break" }, () => [MarkdownInline.cases.Break.make({})]),
    Match.when({ type: "inlineCode" }, (n) => [
      MarkdownInline.cases.InlineCode.make({ value: n.value }),
    ]),
    Match.when({ type: "emphasis" }, (n) => [
      MarkdownInline.cases.Emphasis.make({
        children: mapInlines(n.children, definitions),
      }),
    ]),
    Match.when({ type: "strong" }, (n) => [
      MarkdownInline.cases.Strong.make({
        children: mapInlines(n.children, definitions),
      }),
    ]),
    Match.when({ type: "delete" }, (n) => [
      MarkdownInline.cases.Delete.make({
        children: mapInlines(n.children, definitions),
      }),
    ]),
    Match.when({ type: "link" }, (n) => [
      MarkdownInline.cases.Link.make({
        url: n.url,
        title: n.title ?? undefined,
        children: mapInlines(n.children, definitions),
      }),
    ]),
    Match.when({ type: "linkReference" }, (n) => {
      const definition = definitions.get(n.identifier);
      return definition === undefined
        ? [MarkdownInline.cases.Text.make({ value: extractText(n) })]
        : [
            MarkdownInline.cases.Link.make({
              url: definition.url,
              title: definition.title ?? undefined,
              children: mapInlines(n.children, definitions),
            }),
          ];
    }),
    Match.orElse((n) => [
      MarkdownInline.cases.Text.make({ value: extractText(n) }),
    ]),
  );

const mapInlines = (
  nodes: ReadonlyArray<PhrasingContent>,
  definitions: ReadonlyMap<string, Definition>,
): ReadonlyArray<MarkdownInline> =>
  Arr.flatMap(nodes, (node) => mapInline(node, definitions));

const mapListItem = (
  node: ListItem,
  definitions: ReadonlyMap<string, Definition>,
): ReadonlyArray<MarkdownBlock> =>
  Arr.flatMap(node.children, (child) => mapBlock(child, definitions));

const mapBlock = (
  node: RootContent | GfmTable,
  definitions: ReadonlyMap<string, Definition>,
): ReadonlyArray<MarkdownBlock> =>
  Match.value(node).pipe(
    Match.when({ type: "yaml" }, (n) => [
      MarkdownBlock.cases.Frontmatter.make({ value: n.value }),
    ]),
    Match.when({ type: "heading" }, (n) => [
      MarkdownBlock.cases.Heading.make({
        level: n.depth,
        children: mapInlines(n.children, definitions),
      }),
    ]),
    Match.when({ type: "paragraph" }, (n) => [
      MarkdownBlock.cases.Paragraph.make({
        children: mapInlines(n.children, definitions),
      }),
    ]),
    Match.when({ type: "list" }, (n) => [
      MarkdownBlock.cases.List.make({
        ordered: n.ordered ?? false,
        start: n.start ?? undefined,
        items: Arr.map(n.children, (item) => mapListItem(item, definitions)),
      }),
    ]),
    Match.when({ type: "blockquote" }, (n) => [
      MarkdownBlock.cases.Blockquote.make({
        children: Arr.flatMap(n.children, (child) =>
          mapBlock(child, definitions),
        ),
      }),
    ]),
    Match.when({ type: "code" }, (n) => [
      MarkdownBlock.cases.CodeBlock.make({
        value: n.value,
        language: n.lang ?? undefined,
      }),
    ]),
    Match.when({ type: "table" }, (n) => [
      MarkdownBlock.cases.Table.make({
        alignments: (n.align ?? []).map((alignment) => alignment ?? undefined),
        rows: n.children.map((row) =>
          row.children.map((cell) => mapInlines(cell.children, definitions)),
        ),
      }),
    ]),
    Match.when({ type: "thematicBreak" }, () => [
      MarkdownBlock.cases.Rule.make({}),
    ]),
    Match.when({ type: "html" }, (n) => [
      MarkdownBlock.cases.Html.make({ value: n.value }),
    ]),
    Match.orElse(() => []),
  );

const mapDocument = (
  tree: Root,
  definitions: ReadonlyMap<string, Definition>,
): MarkdownDocument => ({
  blocks: Arr.flatMap(tree.children, (node) => mapBlock(node, definitions)),
});

/** Recursively collect all link nodes from an AST node list */
const collectLinks = (
  nodes: ReadonlyArray<RootContent>,
  definitions: ReadonlyMap<string, Definition>,
): ReadonlyArray<RawLink> =>
  Arr.flatMap(nodes, (node): ReadonlyArray<RawLink> => {
    const self: ReadonlyArray<RawLink> =
      node.type === "link"
        ? [
            {
              label: extractText(node),
              target: (node as Link).url,
              title: (node as Link).title ?? undefined,
            },
          ]
        : node.type === "linkReference"
          ? (() => {
              const definition = definitions.get(
                (node as LinkReference).identifier,
              );
              return definition === undefined
                ? []
                : [
                    {
                      label: extractText(node),
                      target: definition.url,
                      title: definition.title ?? undefined,
                    },
                  ];
            })()
          : [];
    const nested: ReadonlyArray<RawLink> =
      "children" in node
        ? collectLinks(node.children as ReadonlyArray<RootContent>, definitions)
        : [];
    return Arr.appendAll(self, nested);
  });

export class MarkdownService extends Context.Service<MarkdownService>()(
  "@repo/MarkdownService",
  {
    make: Effect.sync(() => {
      const processor = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkFrontmatter, ["yaml"]);

      /**
       * Parse raw markdown into frontmatter, body text, and links
       * in a single AST pass.
       *
       * - Frontmatter is `Option.none()` when no YAML block exists.
       * - Fails with `MarkdownParseError` on malformed YAML.
       * - Links are extracted via recursive AST traversal.
       */
      const parseDocument = (raw: string) =>
        Effect.gen(function* () {
          const tree = yield* Effect.try({
            try: () => processor.parse(raw) as Root,
            catch: (error) =>
              new MarkdownParseError({
                reason: error instanceof Error ? error.message : String(error),
              }),
          });

          const definitions = new Map(
            tree.children.flatMap((node) =>
              node.type === "definition"
                ? [[node.identifier, node as Definition] as const]
                : [],
            ),
          );

          // Extract frontmatter via Option pipeline
          const yamlNode = Arr.findFirst(
            tree.children,
            (n): n is Yaml => n.type === "yaml",
          );

          const frontmatter = yield* pipe(
            yamlNode,
            Option.match({
              onNone: () => Effect.succeed(Option.none<unknown>()),
              onSome: (node) =>
                Effect.try({
                  try: () => YAML.parse(node.value),
                  catch: (error) =>
                    new MarkdownParseError({
                      reason:
                        error instanceof Error ? error.message : String(error),
                    }),
                }).pipe(Effect.asSome),
            }),
          );

          const body = pipe(
            yamlNode,
            Option.flatMap((node) => Option.fromNullishOr(node.position)),
            Option.map((pos) => raw.slice(pos.end.offset).trimStart()),
            Option.getOrElse(() => raw),
          );

          // Collect links via recursive traversal (no mutation)
          const links = collectLinks(tree.children, definitions);

          return {
            frontmatter,
            body,
            links,
            document: mapDocument(tree, definitions),
          } satisfies ParsedMarkdownDocument;
        });

      const parse = (raw: string) =>
        parseDocument(raw).pipe(
          Effect.map(
            ({ frontmatter, body, links }) =>
              ({
                frontmatter,
                body,
                links,
              }) satisfies ParsedMarkdown,
          ),
        );

      return { parse, parseDocument } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
