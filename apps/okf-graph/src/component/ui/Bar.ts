import { Ansi, Box } from "effect-boxes";

export type BarOptions = {
  readonly value: number;
  readonly maximum?: number | undefined;
  readonly width: number;
  readonly annotation?: Ansi.AnsiAnnotation | undefined;
};

export const Bar = ({
  value,
  maximum = 1,
  width,
  annotation = Ansi.cyan,
}: BarOptions): Box.Box<Ansi.AnsiStyle> => {
  const safeWidth = Math.max(1, width);
  const ratio = maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0;
  const filled = Math.round(ratio * safeWidth);

  return Box.hcat(
    [
      Box.text("█".repeat(filled)).pipe(Box.annotate(annotation)),
      Box.text("░".repeat(safeWidth - filled)).pipe(Box.annotate(Ansi.dim)),
    ],
    Box.top,
  );
};
