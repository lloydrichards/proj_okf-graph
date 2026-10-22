import type { MarkdownDocument } from "@repo/domain/Markdown";

import { Ansi, Box } from "effect-boxes";
import { MarkdownBox } from "./Markdown";

export type ConceptDocumentPanelOptions = {
  readonly title: string;
  readonly reference: string;
  readonly type: string;
  readonly tags?: ReadonlyArray<string> | undefined;
  readonly document: MarkdownDocument;
  readonly width: number;
  readonly height?: number | undefined;
  readonly scrollOffset?: number | undefined;
  readonly onViewport?:
    | ((viewport: {
        offset: number;
        maxOffset: number;
        pageSize: number;
      }) => void)
    | undefined;
};

export const ConceptDocumentPanel = (
  options: ConceptDocumentPanelOptions,
): Box.Box<unknown> => {
  const width = Math.max(12, options.width);
  const innerWidth = Math.max(1, width - 4);
  const bodyHeight =
    options.height === undefined ? undefined : Math.max(1, options.height - 2);

  const metadata = Box.vcat(
    [
      Box.text(options.title).pipe(Box.annotate(Ansi.bold)),
      Box.text(`${options.type} · ${options.reference}`).pipe(
        Box.annotate(Ansi.dim),
      ),
      ...(options.tags && options.tags.length > 0
        ? [Box.text(options.tags.join(" · ")).pipe(Box.annotate(Ansi.cyan))]
        : []),
    ],
    Box.left,
  );
  const document = {
    blocks: options.document.blocks.filter(
      (block) => block._tag !== "Frontmatter",
    ),
  };

  const body = Box.vcat(
    [
      metadata,
      MarkdownBox(document, innerWidth).pipe(
        Box.border("rounded", {
          annotation: Ansi.dim,
          sides: { top: true, bottom: false, left: false, right: false },
        }),
      ),
    ],
    Box.left,
  );
  const pageSize = Math.max(1, (bodyHeight ?? body.rows) - 1);
  const maxOffset = Math.max(0, body.rows - pageSize);
  const offset = Math.max(0, Math.min(options.scrollOffset ?? 0, maxOffset));
  options.onViewport?.({ offset, maxOffset, pageSize });
  const content =
    bodyHeight === undefined
      ? body
      : Box.vcat(
          [
            body.pipe(
              Box.cropHeight(offset, pageSize),
              Box.minHeight(pageSize),
            ),
            Box.text(
              `${offset + 1}–${Math.min(body.rows, offset + pageSize)} / ${body.rows} · PgUp/PgDn Home/End`,
            ).pipe(Box.annotate(Ansi.dim)),
          ],
          Box.left,
        );

  return content.pipe(
    Box.truncate(innerWidth, Box.left),
    Box.minWidth(innerWidth),
    Box.pad(0, 1),
    Box.border("rounded"),
  );
};
