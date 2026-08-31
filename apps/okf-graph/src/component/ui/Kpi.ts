import { Ansi, Box } from "effect-boxes";

export type KpiItem = {
  readonly label: string;
  readonly value: string;
};

const Kpi = (item: KpiItem, width: number): Box.Box<Ansi.AnsiStyle> =>
  Box.vcat(
    [
      Box.text(item.value).pipe(Box.annotate(Ansi.bold)),
      Box.text(item.label).pipe(Box.annotate(Ansi.dim)),
    ],
    Box.left,
  ).pipe(
    Box.truncate(width - 2, Box.left),
    Box.minWidth(width - 2),
    Box.pad(0, 1),
    Box.border("rounded", { annotation: Ansi.dim }),
  );

export const KpiGrid = (
  items: ReadonlyArray<KpiItem>,
  width: number,
  maximumColumns = 4,
): Box.Box<Ansi.AnsiStyle> => {
  const columns = Math.max(
    1,
    Math.min(maximumColumns, items.length, Math.floor((width + 3) / 18)),
  );
  const cellWidth = Math.max(
    1,
    Math.floor((width - (columns - 1) * 3) / columns),
  );
  const rows = Array.from(
    { length: Math.ceil(items.length / columns) },
    (_, rowIndex) =>
      Box.hsep(
        items
          .slice(rowIndex * columns, (rowIndex + 1) * columns)
          .map((item) => Kpi(item, cellWidth)),
        1,
        Box.top,
      ),
  );

  return Box.vcat(rows, Box.left);
};
