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
  const content =
    bodyHeight === undefined
      ? body
      : body.pipe(Box.maxHeight(bodyHeight), Box.minHeight(bodyHeight));

  return content.pipe(
    Box.truncate(innerWidth, Box.left),
    Box.minWidth(innerWidth),
    Box.pad(0, 1),
    Box.border("rounded"),
  );
};
