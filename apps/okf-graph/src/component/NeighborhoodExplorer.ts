import {
  Array as Arr,
  Data,
  Effect,
  Graph,
  Match,
  Option,
  pipe,
  Terminal,
} from "effect";
import { Prompt } from "effect/unstable/cli";
import { Ansi, Box, Cmd, Flex } from "effect-boxes";
import {
  ConceptDocumentPanel,
  type ConceptDocumentPanelOptions,
} from "./ui/ConceptDocumentPanel";
import { NeighborhoodGraph } from "./ui/NeighborhoodGraph";

const Action = Data.taggedEnum<Prompt.ActionDefinition>();

export type NeighborhoodExplorerOptions<N, E> = {
  readonly graph: Graph.Graph<N, E>;
  readonly nodeIndex: Graph.NodeIndex;
  readonly radius?: number | undefined;
  readonly message?: string | undefined;
  readonly nodeLabel: (node: N) => string;
  readonly nodeView?:
    | ((node: N) => Omit<ConceptDocumentPanelOptions, "width" | "height"> & {
        readonly description?: string | undefined;
      })
    | undefined;
};

type Direction = "self" | "incoming" | "outgoing";

type NavigationTarget = {
  readonly nodeIndex: Graph.NodeIndex;
  readonly direction: Direction;
  readonly path: ReadonlyArray<Graph.NodeIndex>;
};

export type NeighborhoodExplorerState = {
  readonly center: Graph.NodeIndex;
  readonly direction: Direction;
  readonly path: ReadonlyArray<Graph.NodeIndex>;
  readonly cursor: number;
  readonly history: ReadonlyArray<Graph.NodeIndex>;
  readonly historyCursor: number;
};

const immediateNeighbors = <N, E>(
  graph: Graph.Graph<N, E>,
  center: Graph.NodeIndex,
  radius: number,
): ReadonlyArray<NavigationTarget> => [
  { nodeIndex: center, direction: "self", path: [] },
  ...outgoingRootTargets(graph, center, radius),
  ...incomingRootTargets(graph, center, radius),
];

const outgoingRootTargets = <N, E>(
  graph: Graph.Graph<N, E>,
  center: Graph.NodeIndex,
  radius: number,
): ReadonlyArray<NavigationTarget> => {
  const visit = (
    target: NavigationTarget,
    depth: number,
  ): ReadonlyArray<NavigationTarget> =>
    depth >= radius
      ? []
      : pipe(
          Graph.successors(graph, target.nodeIndex),
          Arr.filter(
            (nodeIndex) =>
              nodeIndex !== center && !target.path.includes(nodeIndex),
          ),
          Arr.flatMap((nodeIndex) => {
            const child = {
              nodeIndex,
              direction: "outgoing" as const,
              path: [...target.path, nodeIndex],
            };

            return [child, ...visit(child, depth + 1)];
          }),
        );

  const roots = Graph.successors(graph, center).map((nodeIndex) => ({
    nodeIndex,
    direction: "outgoing" as const,
    path: [nodeIndex],
  }));

  return radius <= 0
    ? []
    : pipe(
        roots,
        Arr.flatMap((root) => [root, ...visit(root, 1)]),
      );
};

const incomingRootTargets = <N, E>(
  graph: Graph.Graph<N, E>,
  center: Graph.NodeIndex,
  radius: number,
): ReadonlyArray<NavigationTarget> => {
  const visit = (
    target: NavigationTarget,
    depth: number,
  ): ReadonlyArray<NavigationTarget> => {
    if (depth >= radius) return [target];

    const parents = pipe(
      Graph.predecessors(graph, target.nodeIndex),
      Arr.filter(
        (nodeIndex) => nodeIndex !== center && !target.path.includes(nodeIndex),
      ),
      Arr.flatMap((nodeIndex) =>
        visit(
          {
            nodeIndex,
            direction: "incoming" as const,
            path: [...target.path, nodeIndex],
          },
          depth + 1,
        ),
      ),
    );

    return [...parents, target];
  };

  return radius <= 0
    ? []
    : pipe(
        Graph.predecessors(graph, center),
        Arr.flatMap((nodeIndex) =>
          visit(
            {
              nodeIndex,
              direction: "incoming" as const,
              path: [nodeIndex],
            },
            1,
          ),
        ),
      );
};

const neighbors = <N, E>(
  graph: Graph.Graph<N, E>,
  nodeIndex: Graph.NodeIndex,
  direction: Exclude<Direction, "self">,
): ReadonlyArray<Graph.NodeIndex> =>
  direction === "incoming"
    ? Graph.predecessors(graph, nodeIndex)
    : Graph.successors(graph, nodeIndex);

const frontier = <N, E>(
  graph: Graph.Graph<N, E>,
  center: Graph.NodeIndex,
  direction: Direction,
  path: ReadonlyArray<Graph.NodeIndex>,
  radius: number,
): ReadonlyArray<NavigationTarget> => {
  if (path.length === 0) return immediateNeighbors(graph, center, radius);
  if (direction === "self") return [];

  const anchor = pipe(
    path,
    Arr.last,
    Option.getOrElse(() => center),
  );

  return pipe(
    neighbors(graph, anchor, direction),
    Arr.filter(
      (nodeIndex) => nodeIndex !== center && !path.includes(nodeIndex),
    ),
    Arr.map((nodeIndex) => ({
      nodeIndex,
      direction,
      path: [...path, nodeIndex],
    })),
  );
};

const selectedNodeIndex = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  state: NeighborhoodExplorerState,
): Option.Option<NavigationTarget> =>
  pipe(
    frontier(
      options.graph,
      state.center,
      state.direction,
      state.path,
      options.radius ?? 3,
    ),
    Arr.get(state.cursor),
  );

const clampCursor = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  state: NeighborhoodExplorerState,
): NeighborhoodExplorerState => {
  const nodes = frontier(
    options.graph,
    state.center,
    state.direction,
    state.path,
    options.radius ?? 3,
  );

  return {
    ...state,
    cursor: nodes.length === 0 ? 0 : state.cursor % nodes.length,
  };
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const stripAnsi = (text: string): string =>
  text.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu"), "");

const yellowAnsi = new RegExp(
  `${String.fromCharCode(27)}\\[(?:[0-9]+;)*33(?:;[0-9]+)*m`,
  "u",
);

const panel = (
  title: string,
  width: number,
  height: number,
  body: Box.Box<unknown>,
): Box.Box<unknown> => {
  const innerWidth = Math.max(1, width - 4);
  const innerHeight = Math.max(1, height - 2);
  const titleBox = Box.text(title).pipe(
    Box.truncate(innerWidth, Box.left),
    Box.annotate(Ansi.bold),
  );
  const bodyHeight = Math.max(0, innerHeight - 1);

  return Box.vcat(
    [
      titleBox,
      body.pipe(
        Box.truncate(innerWidth, Box.left),
        Box.maxHeight(bodyHeight),
        Box.minHeight(bodyHeight),
      ),
    ],
    Box.left,
  ).pipe(Box.minWidth(innerWidth), Box.pad(0, 1), Box.border("rounded"));
};

const panelBodyHeight = (height: number): number =>
  Math.max(1, Math.max(1, height - 2) - 1);

const nodeLabel = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  nodeIndex: Graph.NodeIndex,
): string =>
  pipe(
    Graph.getNode(options.graph, nodeIndex),
    Option.map(options.nodeLabel),
    Option.getOrElse(() => nodeIndex.toString()),
  );

const breadcrumb = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  history: ReadonlyArray<Graph.NodeIndex>,
  cursor: number,
) =>
  Box.punctuateH(
    Arr.map(history, (index, position) =>
      Box.text(nodeLabel(options, index)).pipe(
        Box.annotate(position === cursor ? Ansi.bold : Ansi.dim),
      ),
    ),
    Box.left,
    Box.text(" ▶ ").pipe(Box.annotate(Ansi.dim)),
  );

const historyAt = (
  history: ReadonlyArray<Graph.NodeIndex>,
  cursor: number,
): Option.Option<Graph.NodeIndex> => pipe(history, Arr.get(cursor));

const nodeDetails = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  nodeIndex: Graph.NodeIndex,
  extra: ReadonlyArray<string>,
): Box.Box<Ansi.AnsiStyle> =>
  Box.vsep(
    [
      Box.text(nodeLabel(options, nodeIndex)).pipe(Box.annotate(Ansi.cyan)),
      Box.vcat(
        [
          Box.text(`index: ${nodeIndex}`),
          Box.text(
            `parents: ${Graph.predecessors(options.graph, nodeIndex).length}`,
          ),
          Box.text(
            `children: ${Graph.successors(options.graph, nodeIndex).length}`,
          ),
          ...extra.map((line) => Box.text(line)),
        ],
        Box.left,
      ).pipe(Box.annotate(Ansi.dim)),
    ],
    1,
    Box.left,
  );

const conceptPanel = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  nodeIndex: Graph.NodeIndex,
  width: number,
  height: number,
  label: string,
): Box.Box<unknown> => {
  const view = pipe(
    Graph.getNode(options.graph, nodeIndex),
    Option.flatMap((node) =>
      options.nodeView ? Option.some(options.nodeView(node)) : Option.none(),
    ),
  );

  return pipe(
    view,
    Option.match({
      onNone: () =>
        panel(label, width, height, nodeDetails(options, nodeIndex, [])),
      onSome: (content) =>
        ConceptDocumentPanel({
          ...content,
          width,
          height,
        }),
    }),
  );
};

const neighborPreview = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  target: NavigationTarget,
  width: number,
): Box.Box<unknown> => {
  const view = pipe(
    Graph.getNode(options.graph, target.nodeIndex),
    Option.flatMap((node) =>
      options.nodeView ? Option.some(options.nodeView(node)) : Option.none(),
    ),
  );

  return pipe(
    view,
    Option.match({
      onNone: () =>
        nodeDetails(options, target.nodeIndex, [
          `direction: ${target.direction}`,
          `depth: ${target.path.length}`,
        ]),
      onSome: (content) => {
        const description = content.description?.trim();
        return Box.vsep(
          [
            Box.text("Neighbor preview").pipe(Box.annotate(Ansi.bold)),
            Box.text(content.title).pipe(
              Box.annotate(Ansi.combine(Ansi.yellow, Ansi.bold)),
            ),
            Box.text(`${content.type} · ${content.reference}`).pipe(
              Box.annotate(Ansi.dim),
            ),
            ...(description
              ? [Box.para(description, Box.left, Math.max(1, width))]
              : []),
            Box.text(
              target.direction === "self"
                ? "current center"
                : `${target.direction} neighbor · depth ${target.path.length}`,
            ).pipe(Box.annotate(Ansi.dim)),
          ],
          0,
          Box.left,
        ).pipe(Box.truncate(width, Box.left));
      },
    }),
  );
};

const graphViewport = (
  graph: Box.Box<Ansi.AnsiStyle>,
  selectedLabel: string,
  width: number,
  height: number,
): Box.Box<Ansi.AnsiStyle> => {
  const styledLines = Box.renderPrettySync(graph).split("\n");
  const selectedRow = Math.max(
    0,
    styledLines.findIndex(
      (line) =>
        stripAnsi(line).includes(selectedLabel) && yellowAnsi.test(line),
    ),
  );
  const bodyHeight = Math.max(1, height);

  const maxOffset = Math.max(0, graph.rows - bodyHeight);
  const offset = clamp(selectedRow - Math.floor(bodyHeight / 2), 0, maxOffset);

  return graph.pipe(
    Box.cropHeight(offset, bodyHeight),
    Box.maxWidth(width),
    Box.maxHeight(height),
    Box.minHeight(height),
  );
};

const neighborhoodBody = (
  graph: Box.Box<Ansi.AnsiStyle>,
  preview: Box.Box<unknown>,
  selectedLabel: string,
  width: number,
  height: number,
): Box.Box<unknown> => {
  const hint = Box.text(
    "up/down select · left/right history · enter recenter · esc submit",
  ).pipe(Box.annotate(Ansi.dim));
  const hintHeight = 1;
  const gapHeight = 2;
  const graphHeight = Math.max(
    1,
    height - hintHeight - gapHeight - preview.rows,
  );

  return Box.vsep(
    [graphViewport(graph, selectedLabel, width, graphHeight), preview, hint],
    1,
    Box.left,
  );
};

export const NeighborhoodExplorerView = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  state: NeighborhoodExplorerState,
  submitted: boolean,
  terminalWidth: number,
  terminalHeight: number,
  mode: "interactive" | "static" = "interactive",
) => {
  const width = Math.max(60, terminalWidth);
  const height = Math.max(12, terminalHeight - 1);
  const label = Box.text(options.message ?? "Explore neighborhood").pipe(
    Box.annotate(Ansi.bold),
  );

  const selected = selectedNodeIndex(options, state);
  const selectedLabel = pipe(
    selected,
    Option.flatMap((target) => Graph.getNode(options.graph, target.nodeIndex)),
    Option.map(options.nodeLabel),
    Option.getOrElse(() => "none"),
  );
  const selectedDirection = pipe(
    selected,
    Option.map((target) => target.direction),
    Option.getOrUndefined,
  );
  const selectedGraphDirection =
    selectedDirection === "self" ? undefined : selectedDirection;
  const isInteractive = mode === "interactive";

  if (submitted) {
    const centerLabel = pipe(
      Graph.getNode(options.graph, state.center),
      Option.map(options.nodeLabel),
      Option.getOrElse(() => state.center.toString()),
    );

    return Box.hsep(
      [
        Box.text("✔").pipe(Box.annotate(Ansi.green)),
        label,
        Box.text(centerLabel).pipe(Box.annotate(Ansi.cyan)),
      ],
      1,
      Box.top,
    );
  }

  const graph = NeighborhoodGraph({
    graph: options.graph,
    nodeIndex: state.center,
    highlightedNodeIndex: pipe(
      selected,
      Option.map((target) => target.nodeIndex),
      Option.getOrUndefined,
    ),
    highlightedPath: pipe(
      selected,
      Option.map((target) => target.path),
      Option.getOrUndefined,
    ),
    highlightedDirection: selectedGraphDirection,
    radius: options.radius ?? 3,
    direction: "both",
    nodeLabel: options.nodeLabel,
  });

  const status = Box.hsep(
    [
      Box.text("history:"),
      breadcrumb(options, state.history, state.historyCursor).pipe(
        Box.annotate(Ansi.yellow),
      ),
    ],
    1,
    Box.left,
  );

  const headerHeight = 1;
  const footerHeight = isInteractive ? 1 : 0;
  const layoutGaps = isInteractive ? 2 : 1;
  const panelHeight = Math.max(
    6,
    height - headerHeight - footerHeight - layoutGaps,
  );
  const sideMinWidth = 24;
  const previewHeight = 7;
  const canShowSides = width >= 90;
  const navigator = (panelWidth: number, panelHeight: number) => {
    const innerWidth = Math.max(1, panelWidth - 4);
    if (!isInteractive) {
      return panel(
        "Navigate neighborhood",
        panelWidth,
        panelHeight,
        graphViewport(
          graph,
          selectedLabel,
          innerWidth,
          panelBodyHeight(panelHeight),
        ),
      );
    }
    const preview = pipe(
      selected,
      Option.match({
        onNone: () =>
          Box.text("No highlighted node").pipe(Box.annotate(Ansi.dim)),
        onSome: (target) => neighborPreview(options, target, innerWidth),
      }),
      Box.maxHeight(previewHeight - 1),
      Box.minHeight(previewHeight - 1),
      Box.moveDown(1),
    );
    return panel(
      "Navigate neighborhood",
      panelWidth,
      panelHeight,
      neighborhoodBody(
        graph,
        preview,
        selectedLabel,
        innerWidth,
        panelBodyHeight(panelHeight),
      ),
    );
  };
  const row = canShowSides
    ? Flex.row(
        [
          Flex.fill(
            (panelWidth) =>
              conceptPanel(
                options,
                state.center,
                Math.max(sideMinWidth, panelWidth),
                panelHeight,
                "Current",
              ),
            2,
          ),
          Flex.fill((panelWidth) =>
            navigator(Math.max(sideMinWidth, panelWidth), panelHeight),
          ),
        ],
        width,
        { gap: 1 },
      )
    : (() => {
        const readerHeight = Math.max(8, Math.floor(panelHeight * 0.58));
        const navigatorHeight = Math.max(6, panelHeight - readerHeight - 1);
        return Box.vsep(
          [
            conceptPanel(options, state.center, width, readerHeight, "Current"),
            navigator(width, navigatorHeight),
          ],
          1,
          Box.left,
        );
      })();

  return Box.vsep(
    isInteractive ? [label, row, status] : [label, row],
    1,
    Box.left,
  ).pipe(Box.maxHeight(height));
};

const renderLayout = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  state: NeighborhoodExplorerState,
  submitted: boolean,
) =>
  Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal;
    const terminalWidth = yield* terminal.columns;
    const terminalHeight = yield* terminal.rows;

    return NeighborhoodExplorerView(
      options,
      state,
      submitted,
      terminalWidth,
      terminalHeight,
    );
  });

export const processNeighborhoodExplorerInput = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
  input: Terminal.UserInput,
  state: NeighborhoodExplorerState,
) => {
  const currentFrontier = frontier(
    options.graph,
    state.center,
    state.direction,
    state.path,
    options.radius ?? 3,
  );
  const next = (state: NeighborhoodExplorerState) =>
    Action.NextFrame({ state: clampCursor(options, state) });
  const cycleCursor = (offset: number) =>
    currentFrontier.length === 0
      ? 0
      : (state.cursor + offset + currentFrontier.length) %
        currentFrontier.length;
  const depth = state.path.length + 1;

  return Match.value(input).pipe(
    Match.when({ key: { name: "up" } }, () =>
      next({ ...state, cursor: cycleCursor(-1) }),
    ),
    Match.when({ key: { name: "down" } }, () =>
      depth === 1
        ? next({ ...state, cursor: cycleCursor(1) })
        : next({
            ...state,
            cursor: cycleCursor(1),
          }),
    ),
    Match.when({ key: { name: "left" } }, () =>
      state.historyCursor <= 0
        ? Action.Beep()
        : pipe(
            historyAt(state.history, state.historyCursor - 1),
            Option.match({
              onNone: () => Action.Beep(),
              onSome: (center) =>
                next({
                  ...state,
                  center,
                  direction: "self",
                  path: [],
                  cursor: 0,
                  historyCursor: state.historyCursor - 1,
                }),
            }),
          ),
    ),
    Match.when({ key: { name: "right" } }, () =>
      state.historyCursor >= state.history.length - 1
        ? Action.Beep()
        : pipe(
            historyAt(state.history, state.historyCursor + 1),
            Option.match({
              onNone: () => Action.Beep(),
              onSome: (center) =>
                next({
                  ...state,
                  center,
                  direction: "self",
                  path: [],
                  cursor: 0,
                  historyCursor: state.historyCursor + 1,
                }),
            }),
          ),
    ),
    Match.when({ key: { name: "return" } }, () =>
      pipe(
        Arr.get(currentFrontier, state.cursor),
        Option.match({
          onNone: () => Action.Beep(),
          onSome: (target) => {
            const historyPrefix = state.history.slice(
              0,
              state.historyCursor + 1,
            );
            const history =
              target.path.length === 0
                ? historyPrefix
                : [...historyPrefix, ...target.path];

            return next({
              center: target.nodeIndex,
              direction: "self",
              path: [],
              cursor: 0,
              history,
              historyCursor: history.length - 1,
            });
          },
        }),
      ),
    ),
    Match.when({ key: { name: "escape" } }, () =>
      Action.Submit({ value: state.center }),
    ),
    Match.orElse(() => next(state)),
  );
};

export const NeighborhoodExplorer = <N, E>(
  options: NeighborhoodExplorerOptions<N, E>,
): Prompt.Prompt<Graph.NodeIndex> => {
  const initialState: NeighborhoodExplorerState = {
    center: options.nodeIndex,
    direction: "self",
    path: [],
    cursor: 0,
    history: [options.nodeIndex],
    historyCursor: 0,
  };

  let hasRendered = false;

  return Prompt.custom<NeighborhoodExplorerState, Graph.NodeIndex>(
    initialState,
    {
      render: Effect.fnUntraced(function* (state, action) {
        const layout = yield* Action.$match(action, {
          Beep: () => renderLayout(options, state, false),
          Submit: () => renderLayout(options, state, true),
          NextFrame: ({ state: nextState }) =>
            renderLayout(options, nextState, false),
          default: () => renderLayout(options, state, false),
        });

        if (action._tag === "Submit") {
          return yield* Box.renderPretty(
            Box.combineAll([
              Cmd.cursorShow,
              Cmd.altScreenLeave,
              layout,
              Cmd.cursorNextLine(1),
            ]),
          );
        }

        const setup = hasRendered
          ? Box.combine(Cmd.home, Cmd.clearScreen)
          : Box.combineAll([
              Cmd.altScreenEnter,
              Cmd.cursorHide,
              Cmd.clearScreen,
            ]);
        hasRendered = true;

        return yield* Box.renderPretty(
          Box.combine(setup, layout.pipe(Box.combine(Cmd.cursorHide))),
        );
      }),
      process: (input, state) =>
        Effect.sync(() =>
          processNeighborhoodExplorerInput(options, input, state),
        ),
      clear: () => Effect.succeed(""),
    },
  );
};
