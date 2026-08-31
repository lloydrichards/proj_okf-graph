import { Ansi, Box } from "effect-boxes";

export type TableColumn = {
  readonly header: string;
  readonly width: number;
  readonly align?: Box.Alignment | undefined;
  readonly headerAlign?: Box.Alignment | undefined;
};

export type TableOptions = {
  readonly showHeader?: boolean | undefined;
};

export const Table = (
  columns: ReadonlyArray<TableColumn>,
  rows: ReadonlyArray<ReadonlyArray<Box.Box<Ansi.AnsiStyle>>>,
  options: TableOptions = {},
): Box.Box<Ansi.AnsiStyle> => {
  const separator = Box.text(" │ ").pipe(Box.annotate(Ansi.dim));
  const header = Box.punctuateH(
    columns.map((column) =>
      Box.text(column.header).pipe(
        Box.truncate(column.width, Box.left),
        Box.alignHoriz(column.headerAlign ?? Box.left, column.width),
        Box.annotate(Ansi.bold),
      ),
    ),
    Box.top,
    separator,
  );
  const divider = Box.text(
    columns.map(({ width }) => "─".repeat(width)).join("─┼─"),
  ).pipe(Box.annotate(Ansi.dim));
  const body = rows.map((row) => {
    const cells = columns.map((column, index) =>
      (row[index] ?? Box.nullBox).pipe(
        Box.truncate(column.width, Box.left),
        Box.alignHoriz(column.align ?? Box.left, column.width),
      ),
    );
    const height = Math.max(1, ...cells.map(Box.rows));
    const rowSeparator = Box.vcat(
      Array.from({ length: height }, () => separator),
      Box.left,
    );

    return Box.punctuateH(
      cells.map(Box.alignVert(Box.top, height)),
      Box.top,
      rowSeparator,
    );
  });

  return Box.vcat(
    options.showHeader === false ? body : [header, divider, ...body],
    Box.left,
  );
};
