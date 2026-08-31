import { Ansi, Box } from "effect-boxes";

export type RankedListItem = {
  readonly label: string;
  readonly value: string;
};

export const RankedList = (
  title: string,
  items: ReadonlyArray<RankedListItem>,
  width: number,
): Box.Box<Ansi.AnsiStyle> => {
  const valueWidth = Math.max(6, ...items.map(({ value }) => value.length));
  const labelWidth = Math.max(8, width - valueWidth - 4);
  const rows = items.map(({ label, value }, index) =>
    Box.hcat(
      [
        Box.text(`${index + 1}.`).pipe(
          Box.alignHoriz(Box.right, 2),
          Box.annotate(Ansi.dim),
        ),
        Box.text(" "),
        Box.text(label).pipe(
          Box.truncate(labelWidth, Box.left),
          Box.alignHoriz(Box.left, labelWidth),
        ),
        Box.text(" "),
        Box.text(value).pipe(
          Box.alignHoriz(Box.right, valueWidth),
          Box.annotate(Ansi.cyan),
        ),
      ],
      Box.top,
    ),
  );

  return Box.vcat(
    [Box.text(title).pipe(Box.annotate(Ansi.bold)), ...rows],
    Box.left,
  );
};
