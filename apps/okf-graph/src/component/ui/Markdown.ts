import type {
  MarkdownBlock,
  MarkdownDocument,
  MarkdownInline,
} from "@repo/domain/Markdown";
import { Array, Match, pipe, String } from "effect";
import { Ansi, Box } from "effect-boxes";
import { Table as TerminalTable } from "./Table";

const blockquotePrefix = "│ ";

const clampWidth = (width: number): number => Math.max(1, width);

const normalizeWhitespace = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

type InlineSegment = {
  readonly value: string;
  readonly annotation: Ansi.AnsiAnnotation;
};

const combineAnnotation = (
  parent: Ansi.AnsiAnnotation,
  child: Ansi.AnsiAnnotation,
): Ansi.AnsiAnnotation => Ansi.combine(parent, child);

const isExternalLink = (url: string): boolean =>
  /^[a-z][a-z0-9+.-]*:/iu.test(url) || url.startsWith("//");

const inlineSegments = (
  children: ReadonlyArray<MarkdownInline>,
  annotation: Ansi.AnsiAnnotation = Ansi.fgDefault,
): ReadonlyArray<InlineSegment> =>
  pipe(
    children,
    Array.flatMap((child): ReadonlyArray<InlineSegment> =>
      Match.value(child).pipe(
        Match.tag("Text", ({ value }) => [{ value, annotation }]),
        Match.tag("Break", () => [{ value: "\n", annotation }]),
        Match.tag("InlineCode", ({ value }) => [
          { value, annotation: combineAnnotation(annotation, Ansi.dim) },
        ]),
        Match.tag("Emphasis", ({ children }) =>
          inlineSegments(children, combineAnnotation(annotation, Ansi.italic)),
        ),
        Match.tag("Strong", ({ children }) =>
          inlineSegments(children, combineAnnotation(annotation, Ansi.bold)),
        ),
        Match.tag("Delete", ({ children }) =>
          inlineSegments(
            children,
            combineAnnotation(annotation, Ansi.strikethrough),
          ),
        ),
        Match.tag("Link", ({ children, url }) => {
          const linkAnnotation = combineAnnotation(
            annotation,
            Ansi.brightMagenta,
          );
          const markerAnnotation = combineAnnotation(
            Ansi.reset,
            Ansi.brightMagenta,
          );
          return [
            ...inlineSegments(children, linkAnnotation),
            {
              value: isExternalLink(url) ? " ↗" : " →",
              annotation: markerAnnotation,
            },
          ];
        }),
        Match.tag("Paragraph", ({ children }) =>
          inlineSegments(children, annotation),
        ),
        Match.exhaustive,
      ),
    ),
  );

const renderInlineText = (children: ReadonlyArray<MarkdownInline>): string =>
  pipe(
    children,
    Array.map((child) =>
      Match.value(child).pipe(
        Match.tag("Text", ({ value }) => value),
        Match.tag("Break", () => "\n"),
        Match.tag("InlineCode", ({ value }) => value),
        Match.tag("Emphasis", ({ children }) => renderInlineText(children)),
        Match.tag("Strong", ({ children }) => renderInlineText(children)),
        Match.tag("Delete", ({ children }) => renderInlineText(children)),
        Match.tag(
          "Link",
          ({ children, url }) =>
            `${renderInlineText(children)} ${isExternalLink(url) ? "↗" : "→"}`,
        ),
        Match.tag("Paragraph", ({ children }) => renderInlineText(children)),
        Match.exhaustive,
      ),
    ),
    Array.join(""),
    (text) => text.split("\n").map(normalizeWhitespace).join("\n"),
  );

const PreformattedBlock = (text: string, width: number): Box.Box<unknown> =>
  Box.text(text).pipe(
    Box.truncate(clampWidth(width), Box.left),
    Box.annotate(Ansi.dim),
  );

const Paragraph = (
  children: ReadonlyArray<MarkdownInline>,
  width: number,
): Box.Box<Ansi.AnsiStyle> => {
  const safeWidth = clampWidth(width);
  const lines: Array<Array<Box.Box<Ansi.AnsiStyle>>> = [[]];
  let lineWidth = 0;
  let pendingSpace = false;

  const newLine = () => {
    lines.push([]);
    lineWidth = 0;
    pendingSpace = false;
  };
  const addWord = (value: string, annotation: Ansi.AnsiAnnotation) => {
    const word = Box.text(value).pipe(Box.annotate(annotation));
    const spacing = pendingSpace && lineWidth > 0 ? 1 : 0;
    if (lineWidth > 0 && lineWidth + spacing + word.cols > safeWidth) newLine();
    if (pendingSpace && lineWidth > 0) {
      lines[lines.length - 1]!.push(Box.text(" "));
      lineWidth += 1;
    }
    lines[lines.length - 1]!.push(word);
    lineWidth += word.cols;
    pendingSpace = false;
  };

  for (const segment of inlineSegments(children)) {
    for (const part of segment.value.split(/(\s+)/u)) {
      if (part.length === 0) continue;
      if (part.includes("\n")) {
        const pieces = part.split("\n");
        pieces.forEach((piece, index) => {
          if (piece.trim().length > 0) addWord(piece, segment.annotation);
          if (index < pieces.length - 1) newLine();
        });
      } else if (/^\s+$/u.test(part)) {
        pendingSpace = true;
      } else {
        addWord(part, segment.annotation);
      }
    }
  }

  return Box.vcat(
    lines.map((line) =>
      line.length === 0 ? Box.text("") : Box.hcat(line, Box.top),
    ),
    Box.left,
  );
};

const Document = (
  document: MarkdownDocument,
  width: number,
): Box.Box<unknown> => {
  const renderedBlocks = pipe(
    document.blocks,
    Array.map((block) => renderMarkdownBlock(block, clampWidth(width))),
  );

  return Array.match(renderedBlocks, {
    onEmpty: () => Box.nullBox,
    onNonEmpty: (blocks) => Box.vsep(blocks, 1, Box.left),
  });
};

const PrefixedBlock = (
  prefix: string,
  content: Box.Box<unknown>,
  width: number,
): Box.Box<unknown> => {
  const gutter = pipe(
    Math.max(content.rows, 1),
    Array.makeBy(() => prefix),
    Array.join("\n"),
    Box.text,
  );

  return Box.hcat(
    [gutter, content.pipe(Box.maxWidth(clampWidth(width - prefix.length)))],
    Box.top,
  );
};

const renderListMarker = (
  ordered: boolean,
  start: number | undefined,
  index: number,
): string => (ordered ? `${(start ?? 1) + index}.` : "•");

const getMarkerWidth = (
  block: Extract<MarkdownBlock, { _tag: "List" }>,
): number =>
  block.ordered
    ? pipe(
        block.items,
        Array.map(
          (_, index) => renderListMarker(true, block.start, index).length + 1,
        ),
        Array.reduce(0, (max, width) => Math.max(max, width)),
      )
    : 2;

const ListItem = (
  marker: string,
  blocks: ReadonlyArray<MarkdownBlock>,
  width: number,
  markerWidth: number,
): Box.Box<unknown> => {
  const markerBox = Box.text(String.padEnd(markerWidth, " ")(`${marker} `));
  const contentWidth = clampWidth(width - markerWidth);
  const content = Document({ blocks }, contentWidth);
  return Box.hcat([markerBox, content], Box.top);
};

const Heading = (
  level: number,
  children: ReadonlyArray<MarkdownInline>,
  width: number,
): Box.Box<unknown> => {
  const annotation = Match.value(level).pipe(
    Match.when(
      (value) => value <= 1,
      () => Ansi.combine(Ansi.bold, Ansi.cyan),
    ),
    Match.when(
      (value) => value === 2,
      () => Ansi.combine(Ansi.bold, Ansi.brightBlue),
    ),
    Match.orElse(() => Ansi.bold),
  );

  return Box.para(renderInlineText(children), Box.left, clampWidth(width)).pipe(
    Box.annotate(annotation),
  );
};

type TableBlock = Extract<MarkdownBlock, { _tag: "Table" }>;

const tableColumnWidths = (
  table: TableBlock,
  width: number,
): ReadonlyArray<number> => {
  const columnCount = Math.max(0, ...table.rows.map((row) => row.length));
  if (columnCount === 0) return [];
  const available = Math.max(1, width - (columnCount - 1) * 3);
  const natural = Array.makeBy(columnCount, (column) =>
    Math.max(
      1,
      ...table.rows.map((row) => renderInlineText(row[column] ?? []).length),
    ),
  );
  const minimum = Math.max(1, Math.min(8, Math.floor(available / columnCount)));
  const widths = natural.map((value) => Math.min(value, minimum));
  let remaining = available - widths.reduce((sum, value) => sum + value, 0);

  while (
    remaining > 0 &&
    widths.some((value, index) => value < natural[index]!)
  ) {
    for (let index = 0; index < widths.length && remaining > 0; index += 1) {
      if (widths[index]! < natural[index]!) {
        widths[index] = widths[index]! + 1;
        remaining -= 1;
      }
    }
  }

  return widths;
};

const tableAlignment = (
  alignment: "left" | "center" | "right" | undefined,
): Box.Alignment =>
  alignment === "center"
    ? Box.center1
    : alignment === "right"
      ? Box.right
      : Box.left;

const StackedTable = (table: TableBlock, width: number): Box.Box<unknown> => {
  const [header = [], ...rows] = table.rows;
  const labels = header.map(
    (cell, index) => renderInlineText(cell).trim() || `Column ${index + 1}`,
  );

  return Box.vsep(
    rows.map((row) =>
      Box.vsep(
        labels.map((label, index) => {
          const labelBox = Box.text(`${label}:`).pipe(Box.annotate(Ansi.bold));
          const cellWidth = Math.max(1, width - labelBox.cols - 1);
          return Box.hcat(
            [labelBox, Box.text(" "), Paragraph(row[index] ?? [], cellWidth)],
            Box.top,
          );
        }),
        0,
        Box.left,
      ),
    ),
    1,
    Box.left,
  );
};

const MarkdownTable = (table: TableBlock, width: number): Box.Box<unknown> => {
  const columnCount = Math.max(0, ...table.rows.map((row) => row.length));
  if (columnCount === 0) return Box.nullBox;
  const minimumGridWidth = columnCount * 6 + (columnCount - 1) * 3;
  if (width < minimumGridWidth) return StackedTable(table, width);

  const [header = [], ...rows] = table.rows;
  const widths = tableColumnWidths(table, width);
  return TerminalTable(
    widths.map((columnWidth, index) => ({
      header: renderInlineText(header[index] ?? []),
      width: columnWidth,
      align: tableAlignment(table.alignments[index]),
      headerAlign: tableAlignment(table.alignments[index]),
    })),
    rows.map((row) =>
      widths.map((columnWidth, index) =>
        Paragraph(row[index] ?? [], columnWidth),
      ),
    ),
  );
};

const renderMarkdownBlock = (
  block: MarkdownBlock,
  width: number,
): Box.Box<unknown> =>
  Match.value(block).pipe(
    Match.tag("Frontmatter", ({ value }) =>
      PreformattedBlock(`---\n${value}\n---`, width),
    ),
    Match.tag("Heading", ({ level, children }) =>
      Heading(level, children, width),
    ),
    Match.tag("Paragraph", ({ children }) => Paragraph(children, width)),
    Match.tag("List", (list) =>
      Box.vcat(
        pipe(
          list.items,
          Array.map((item, index) =>
            ListItem(
              renderListMarker(list.ordered, list.start, index),
              item,
              width,
              getMarkerWidth(list),
            ),
          ),
        ),
        Box.left,
      ),
    ),
    Match.tag("Blockquote", ({ children }) =>
      PrefixedBlock(
        blockquotePrefix,
        Document(
          { blocks: children },
          clampWidth(width - blockquotePrefix.length),
        ),
        width,
      ).pipe(Box.annotate(Ansi.dim)),
    ),
    Match.tag("CodeBlock", ({ value }) => PreformattedBlock(value, width)),
    Match.tag("Table", (table) => MarkdownTable(table, width)),
    Match.tag("Rule", () =>
      Box.text("─".repeat(clampWidth(width))).pipe(Box.annotate(Ansi.dim)),
    ),
    Match.tag("Html", ({ value }) => PreformattedBlock(value, width)),
    Match.exhaustive,
  );

export const MarkdownBox = (
  document: MarkdownDocument,
  width: number,
): Box.Box<unknown> => Document(document, width);
