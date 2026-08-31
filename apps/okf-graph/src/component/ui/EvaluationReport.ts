import type { EvaluationReport as Report } from "@repo/domain/Evaluation";
import { Ansi, Box } from "effect-boxes";
import { Bar } from "./Bar";
import { KpiGrid } from "./Kpi";
import { RankedList } from "./RankedList";
import { Table } from "./Table";

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
const decimal = (value: number): string => value.toFixed(2);
const cell = (value: string | number): Box.Box<Ansi.AnsiStyle> =>
  Box.text(String(value));
const dim = (value: string): Box.Box<Ansi.AnsiStyle> =>
  Box.text(value).pipe(Box.annotate(Ansi.dim));
const heading = (value: string): Box.Box<Ansi.AnsiStyle> =>
  Box.text(value).pipe(Box.annotate(Ansi.combine(Ansi.bold, Ansi.cyan)));
const subheading = (value: string): Box.Box<Ansi.AnsiStyle> =>
  Box.text(value).pipe(Box.annotate(Ansi.bold));

const section = (
  title: string,
  width: number,
  content: ReadonlyArray<Box.Box<Ansi.AnsiStyle>>,
): Box.Box<Ansi.AnsiStyle> =>
  Box.vsep(
    [
      Box.hsep(
        [
          heading(title),
          Box.text("─".repeat(Math.max(1, width - title.length - 1))).pipe(
            Box.annotate(Ansi.dim),
          ),
        ],
        1,
        Box.center1,
      ),
      ...content,
    ],
    1,
    Box.left,
  );

const summaryCard = (
  title: string,
  primary: string,
  detail: string,
  width: number,
): Box.Box<Ansi.AnsiStyle> => {
  const innerWidth = Math.max(1, width - 4);
  return Box.vcat(
    [
      Box.text(title.toUpperCase()).pipe(
        Box.annotate(Ansi.combine(Ansi.bold, Ansi.cyan)),
      ),
      Box.text(primary).pipe(Box.annotate(Ansi.bold)),
      Box.para(detail, Box.left, innerWidth).pipe(Box.annotate(Ansi.dim)),
    ],
    Box.left,
  ).pipe(Box.minWidth(innerWidth), Box.pad(0, 1), Box.border<never>("rounded"));
};

const overview = (report: Report, width: number): Box.Box<Ansi.AnsiStyle> => {
  const cardWidth = Math.floor((width - 2) / 2);
  const cards = [
    summaryCard(
      "Content",
      `${report.bundle.metrics.conceptCount} concepts`,
      `${percent(report.bundle.metrics.metadataCoverage.description)} described · ${percent(report.bundle.metrics.emptyBodyRate)} empty bodies`,
      cardWidth,
    ),
    summaryCard(
      "Connectivity",
      `${percent(report.connectivity.metrics.brokenLinkRate)} broken links`,
      `${percent(report.connectivity.metrics.outboundLinkCoverage)} outbound coverage · ${report.connectivity.metrics.components.count} components`,
      cardWidth,
    ),
    summaryCard(
      "Structure",
      `${percent(report.structure.metrics.reachability.pairRate)} reachable`,
      `diameter ${report.structure.metrics.reachability.diameter} · ${report.structure.metrics.resilience.articulationConceptCount} articulation concepts`,
      cardWidth,
    ),
    summaryCard(
      "Navigation",
      `${percent(report.navigation.directed.metrics.entropy)} directed entropy`,
      `${decimal(report.navigation.directed.metrics.effectiveConcepts)} effective concepts · ${report.navigation.directed.convergence.converged ? "converged" : "not converged"}`,
      cardWidth,
    ),
  ];

  return Box.vsep(
    [
      Box.hsep(cards.slice(0, 2), 2, Box.top),
      Box.hsep(cards.slice(2), 2, Box.top),
    ],
    1,
    Box.left,
  );
};

const findings = (report: Report, width: number): Box.Box<Ansi.AnsiStyle> => {
  const items = [
    ...report.bundle.findings.map((finding) =>
      finding._tag === "duplicate-title"
        ? `Duplicate title: ${finding.conceptIds.join(", ")}`
        : `Duplicate body: ${finding.conceptIds.join(", ")}`,
    ),
    ...report.connectivity.findings.map((finding) =>
      finding._tag === "broken-link"
        ? `Broken link: ${finding.sourceId} → ${finding.targetId}`
        : `Isolated concept: ${finding.conceptId}`,
    ),
  ];
  const body =
    items.length === 0
      ? [Box.text("No findings").pipe(Box.annotate(Ansi.green))]
      : items.map((item) =>
          Box.hcat(
            [
              Box.text("! ").pipe(Box.annotate(Ansi.yellow)),
              Box.para(item, Box.left, Math.max(1, width - 2)),
            ],
            Box.top,
          ),
        );

  return Box.vcat([heading("FINDINGS"), ...body], Box.left).pipe(
    Box.minWidth(Math.max(1, width - 4)),
    Box.pad(0, 1),
    Box.border<Ansi.AnsiStyle>("rounded", {
      annotation: items.length === 0 ? Ansi.green : Ansi.yellow,
    }),
  );
};

const content = (report: Report, width: number): Box.Box<Ansi.AnsiStyle> => {
  const metrics = report.bundle.metrics;
  return section("CONTENT", width, [
    Box.vcat(
      [
        subheading("Metadata coverage"),
        KpiGrid(
          [
            { label: "titles", value: percent(metrics.metadataCoverage.title) },
            {
              label: "descriptions",
              value: percent(metrics.metadataCoverage.description),
            },
            { label: "tags", value: percent(metrics.metadataCoverage.tags) },
            {
              label: "timestamps",
              value: percent(metrics.metadataCoverage.timestamp),
            },
          ],
          width,
        ),
      ],
      Box.left,
    ),
    Box.vcat(
      [
        subheading("Bodies and formatting"),
        KpiGrid(
          [
            { label: "median words", value: String(metrics.wordCount.p50) },
            { label: "p90 words", value: String(metrics.wordCount.p90) },
            { label: "empty bodies", value: percent(metrics.emptyBodyRate) },
            {
              label: "with headings",
              value: percent(metrics.contentCoverage.heading),
            },
            {
              label: "with lists",
              value: percent(metrics.contentCoverage.list),
            },
            {
              label: "with code",
              value: percent(metrics.contentCoverage.codeBlock),
            },
          ],
          width,
          3,
        ),
      ],
      Box.left,
    ),
  ]);
};

const rankedDegrees = (
  title: string,
  values: ReadonlyArray<{
    readonly conceptId: string;
    readonly degree: number;
  }>,
  width: number,
): Box.Box<Ansi.AnsiStyle> => {
  return RankedList(
    title,
    values.slice(0, 3).map(({ conceptId, degree }) => ({
      label: conceptId,
      value: String(degree),
    })),
    width,
  );
};

const connectivity = (
  report: Report,
  width: number,
): Box.Box<Ansi.AnsiStyle> => {
  const metrics = report.connectivity.metrics;
  const half = Math.max(28, Math.floor((width - 3) / 2));
  const rankings =
    width >= 76
      ? Box.hsep(
          [
            rankedDegrees(
              "Top inbound",
              report.connectivity.evidence.degree.highestInbound,
              half,
            ),
            rankedDegrees(
              "Top outbound",
              report.connectivity.evidence.degree.highestOutbound,
              half,
            ),
          ],
          3,
          Box.top,
        )
      : Box.vsep(
          [
            rankedDegrees(
              "Top inbound",
              report.connectivity.evidence.degree.highestInbound,
              width,
            ),
            rankedDegrees(
              "Top outbound",
              report.connectivity.evidence.degree.highestOutbound,
              width,
            ),
          ],
          1,
          Box.left,
        );

  return section("CONNECTIVITY", width, [
    Box.vcat(
      [
        subheading("Link health"),
        KpiGrid(
          [
            { label: "broken links", value: percent(metrics.brokenLinkRate) },
            {
              label: "outbound coverage",
              value: percent(metrics.outboundLinkCoverage),
            },
            { label: "isolated", value: percent(metrics.isolatedRate) },
            { label: "components", value: String(metrics.components.count) },
            {
              label: "largest component",
              value: percent(metrics.components.largestCoverage),
            },
          ],
          width,
          3,
        ),
      ],
      Box.left,
    ),
    Box.vcat(
      [
        subheading("Degree distribution"),
        Table(
          [
            { header: "Direction", width: 14 },
            {
              header: "p50",
              width: 6,
              align: Box.right,
              headerAlign: Box.right,
            },
            {
              header: "p90",
              width: 6,
              align: Box.right,
              headerAlign: Box.right,
            },
            {
              header: "Max",
              width: 6,
              align: Box.right,
              headerAlign: Box.right,
            },
            {
              header: "Zero",
              width: 8,
              align: Box.right,
              headerAlign: Box.right,
            },
          ],
          [
            [
              cell("Inbound"),
              cell(metrics.degree.inbound.p50),
              cell(metrics.degree.inbound.p90),
              cell(metrics.degree.inbound.max),
              cell(percent(metrics.degree.inbound.zeroRate)),
            ],
            [
              cell("Outbound"),
              cell(metrics.degree.outbound.p50),
              cell(metrics.degree.outbound.p90),
              cell(metrics.degree.outbound.max),
              dim("—"),
            ],
          ],
        ),
      ],
      Box.left,
    ),
    Box.vcat(
      [
        subheading("Relation labels"),
        KpiGrid(
          [
            {
              label: "coverage",
              value: percent(metrics.relationLabels.coverage),
            },
            {
              label: "distinct labels",
              value: String(metrics.relationLabels.distinctCount),
            },
            {
              label: "entropy",
              value: percent(metrics.relationLabels.entropy),
            },
            {
              label: "top-label share",
              value: percent(metrics.relationLabels.topShare),
            },
          ],
          width,
        ),
      ],
      Box.left,
    ),
    Box.vcat([subheading("Degree leaders"), rankings], Box.left),
  ]);
};

const growthRows = (
  label: string,
  growth: Report["structure"]["metrics"]["neighborhoodGrowth"]["directed"],
  barWidth: number,
): ReadonlyArray<Box.Box<Ansi.AnsiStyle>> => [
  cell(label),
  cell(percent(growth.within1Hop.p50)),
  cell(percent(growth.within2Hops.p50)),
  cell(percent(growth.within3Hops.p50)),
  Bar({ value: growth.within3Hops.p50, width: barWidth }),
];

const structure = (report: Report, width: number): Box.Box<Ansi.AnsiStyle> => {
  const metrics = report.structure.metrics;
  const barWidth = Math.max(8, width - 50);
  const growth = Table(
    [
      { header: "Median", width: 10 },
      { header: "1 hop", width: 7, align: Box.right, headerAlign: Box.right },
      { header: "2 hops", width: 7, align: Box.right, headerAlign: Box.right },
      { header: "3 hops", width: 7, align: Box.right, headerAlign: Box.right },
      { header: "3-hop coverage", width: barWidth },
    ],
    [
      growthRows("Directed", metrics.neighborhoodGrowth.directed, barWidth),
      growthRows("Undirected", metrics.neighborhoodGrowth.undirected, barWidth),
    ],
  );

  return section("STRUCTURE", width, [
    Box.vcat(
      [
        subheading("Graph shape"),
        KpiGrid(
          [
            {
              label: "directed density",
              value: percent(metrics.directedDensity),
            },
            {
              label: "average degree",
              value: decimal(metrics.averageTotalDegree),
            },
            {
              label: "reachable pairs",
              value: percent(metrics.reachability.pairRate),
            },
            {
              label: "average path",
              value: decimal(metrics.reachability.averageShortestPathLength),
            },
            { label: "diameter", value: String(metrics.reachability.diameter) },
          ],
          width,
          3,
        ),
      ],
      Box.left,
    ),
    Box.vcat(
      [
        subheading("Resilience"),
        KpiGrid(
          [
            {
              label: "inbound centralization",
              value: percent(metrics.inboundCentralization),
            },
            {
              label: "articulation concepts",
              value: String(metrics.resilience.articulationConceptCount),
            },
            {
              label: "articulation rate",
              value: percent(metrics.resilience.articulationConceptRate),
            },
            {
              label: "bridge relationships",
              value: String(metrics.resilience.bridgeRelationshipCount),
            },
            {
              label: "bridge rate",
              value: percent(metrics.resilience.bridgeRelationshipRate),
            },
          ],
          width,
          3,
        ),
      ],
      Box.left,
    ),
    Box.vcat([subheading("Median neighborhood coverage"), growth], Box.left),
    dim(
      `Diameter path: ${report.structure.evidence.reachability.diameterPath[0] ?? "—"} → … → ${report.structure.evidence.reachability.diameterPath.at(-1) ?? "—"}`,
    ),
  ]);
};

const navigation = (report: Report, width: number): Box.Box<Ansi.AnsiStyle> => {
  const directed = report.navigation.directed;
  const undirected = report.navigation.undirected;
  const evidenceWidth = width >= 90 ? Math.floor((width - 3) / 2) : width;
  const sensitive = RankedList(
    "Direction-sensitive",
    report.navigation.directionSensitivity.concepts.slice(0, 3).map((item) => ({
      label: item.conceptId,
      value: percent(item.absoluteDifference),
    })),
    evidenceWidth,
  );
  const top = RankedList(
    "Top directed",
    directed.evidence.highest.slice(0, 3).map((item) => ({
      label: item.conceptId,
      value: percent(item.probability),
    })),
    evidenceWidth,
  );

  const evidence =
    width >= 90
      ? Box.hsep([top, sensitive], 3, Box.top)
      : Box.vsep([top, sensitive], 1, Box.left);

  return section("NAVIGATION", width, [
    Table(
      [
        { header: "Metric", width: 24 },
        {
          header: "Directed",
          width: 11,
          align: Box.right,
          headerAlign: Box.right,
        },
        {
          header: "Undirected",
          width: 11,
          align: Box.right,
          headerAlign: Box.right,
        },
      ],
      [
        [
          cell("Entropy"),
          cell(percent(directed.metrics.entropy)),
          cell(percent(undirected.metrics.entropy)),
        ],
        [
          cell("Effective concepts"),
          cell(decimal(directed.metrics.effectiveConcepts)),
          cell(decimal(undirected.metrics.effectiveConcepts)),
        ],
        [
          cell("Top probability"),
          cell(percent(directed.metrics.topProbability)),
          cell(percent(undirected.metrics.topProbability)),
        ],
        [
          cell("Teleport rate"),
          cell(percent(directed.metrics.teleportRate)),
          cell(percent(undirected.metrics.teleportRate)),
        ],
        [
          cell("Convergence"),
          cell(
            `${directed.convergence.converged ? "yes" : "no"} · ${directed.convergence.iterations}`,
          ),
          cell(
            `${undirected.convergence.converged ? "yes" : "no"} · ${undirected.convergence.iterations}`,
          ),
        ],
      ],
    ),
    Box.vcat([subheading("Discoverability evidence"), evidence], Box.left),
    dim(
      `Direction divergence ${percent(report.navigation.directionSensitivity.divergence)} · PageRank α=${directed.policy.alpha} · tolerance ${directed.policy.tolerance}`,
    ),
  ]);
};

export const EvaluationReportBox = (
  report: Report,
  bundlePath: string,
  terminalWidth: number,
): Box.Box<Ansi.AnsiStyle> => {
  const width = Math.max(56, Math.min(116, terminalWidth));
  const findingCount =
    report.bundle.findings.length + report.connectivity.findings.length;
  const title = Box.hsep(
    [
      Box.text("OKF EVALUATION").pipe(Box.annotate(Ansi.bold)),
      Box.text(bundlePath).pipe(Box.annotate(Ansi.cyan)),
    ],
    2,
    Box.top,
  );

  return Box.vsep(
    [
      Box.vcat(
        [
          title,
          dim(
            `${report.bundle.metrics.conceptCount} concepts · ${findingCount} ${findingCount === 1 ? "finding" : "findings"}`,
          ),
        ],
        Box.left,
      ),
      overview(report, width),
      findings(report, width),
      content(report, width),
      connectivity(report, width),
      structure(report, width),
      navigation(report, width),
    ],
    1,
    Box.left,
  ).pipe(Box.maxWidth(width));
};
