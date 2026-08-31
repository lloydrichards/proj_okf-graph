import type {
  GraphProjection,
  MarkovPolicy,
  NavigationEvaluation,
} from "@repo/domain/Evaluation";
import { MarkovPolicy as MarkovPolicySchema } from "@repo/domain/Evaluation";
import { Array as Arr, Number as Num, Order, pipe } from "effect";
import type { EvaluationTopology, TopologyEdge } from "./EvaluationTopology";

export type NavigationPolicy = Omit<MarkovPolicy, "projection">;

export const defaultNavigationPolicy: NavigationPolicy = {
  alpha: 0.85,
  tolerance: 0.000001,
  maxIterations: 100,
};

type MarkovModel = {
  readonly ids: ReadonlyArray<string>;
  readonly indexById: ReadonlyMap<string, number>;
  readonly outgoing: ReadonlyMap<string, ReadonlyArray<string>>;
};

const makeModel = (
  ids: ReadonlyArray<string>,
  topology: ReadonlyArray<TopologyEdge>,
  projection: GraphProjection,
) => {
  const outgoing = new Map<string, Set<string>>(
    Arr.map(ids, (id) => [id, new Set<string>()]),
  );

  for (const { sourceId, targetId } of topology) {
    const source = outgoing.get(sourceId);
    const target = outgoing.get(targetId);
    if (sourceId === targetId || source === undefined || target === undefined)
      continue;

    source.add(targetId);
    if (projection === "undirected") target.add(sourceId);
  }

  return {
    ids,
    indexById: new Map(Arr.map(ids, (id, index) => [id, index])),
    outgoing: new Map(
      Arr.map(Array.from(outgoing), ([id, targets]) => [
        id,
        Arr.sort(Array.from(targets), Order.String),
      ]),
    ),
  };
};

const powerStep = (
  model: MarkovModel,
  policy: MarkovPolicy,
  distribution: ReadonlyArray<number>,
) => {
  const count = model.ids.length;
  const next = Array<number>(count).fill((1 - policy.alpha) / count);

  for (const [sourceIndex, sourceId] of model.ids.entries()) {
    const probability = distribution[sourceIndex] ?? 0;
    const targets = model.outgoing.get(sourceId) ?? [];
    const contribution =
      (policy.alpha * probability) /
      (targets.length === 0 ? count : targets.length);

    if (targets.length === 0) {
      for (const targetIndex of next.keys())
        next[targetIndex] = (next[targetIndex] ?? 0) + contribution;
      continue;
    }

    for (const targetId of targets) {
      const targetIndex = model.indexById.get(targetId);
      if (targetIndex === undefined) continue;
      next[targetIndex] = (next[targetIndex] ?? 0) + contribution;
    }
  }

  const total = Num.sumAll(next);
  return Arr.map(next, (value) => value / total);
};

const powerIteration = (model: MarkovModel, policy: MarkovPolicy) => {
  let distribution: ReadonlyArray<number> = Array<number>(
    model.ids.length,
  ).fill(1 / model.ids.length);
  let residual = 0;

  for (let iteration = 1; iteration <= policy.maxIterations; iteration++) {
    const next = powerStep(model, policy, distribution);
    residual = Num.sumAll(
      Arr.zipWith(next, distribution, (current, previous) =>
        Math.abs(current - previous),
      ),
    );
    if (residual <= policy.tolerance)
      return {
        distribution: next,
        converged: true,
        iterations: iteration,
        residual,
      };
    distribution = next;
  }

  return {
    distribution,
    converged: false,
    iterations: policy.maxIterations,
    residual,
  };
};

const metrics = (distribution: ReadonlyArray<number>) => {
  const count = distribution.length;
  if (count <= 1)
    return { entropy: 0, effectiveConcepts: count, topProbability: count };

  const logCount = Math.log(count);
  const entropy =
    -pipe(
      distribution,
      Arr.reduce(0, (sum, probability) =>
        probability === 0 ? sum : sum + probability * Math.log(probability),
      ),
    ) / logCount;

  return {
    entropy,
    effectiveConcepts: entropy === 1 ? count : Math.exp(entropy * logCount),
    topProbability: Arr.reduce(distribution, 0, (highest, probability) =>
      Math.max(highest, probability),
    ),
  };
};

type NavigationResult = {
  readonly policy: MarkovPolicy;
  readonly discoverability: {
    readonly distribution: ReadonlyArray<{
      readonly conceptId: string;
      readonly probability: number;
    }>;
    readonly entropy: number;
    readonly effectiveConcepts: number;
    readonly topProbability: number;
    readonly teleportRate: number;
  };
  readonly convergence: {
    readonly converged: boolean;
    readonly iterations: number;
    readonly residual: number;
  };
};

const resultFrom = (
  model: MarkovModel,
  policy: MarkovPolicy,
  result: {
    readonly distribution: ReadonlyArray<number>;
    readonly converged: boolean;
    readonly iterations: number;
    readonly residual: number;
  },
): NavigationResult => ({
  policy,
  discoverability: {
    distribution: Arr.zipWith(
      model.ids,
      result.distribution,
      (conceptId, probability) => ({ conceptId, probability }),
    ),
    ...metrics(result.distribution),
    teleportRate:
      1 -
      policy.alpha +
      policy.alpha *
        Arr.reduce(model.ids, 0, (mass, id, index) =>
          (model.outgoing.get(id)?.length ?? 0) === 0
            ? mass + (result.distribution[index] ?? 0)
            : mass,
        ),
  },
  convergence: {
    converged: result.converged,
    iterations: result.iterations,
    residual: result.residual,
  },
});

const evaluateProjection = (
  conceptIds: ReadonlyArray<string>,
  topology: ReadonlyArray<TopologyEdge>,
  projection: GraphProjection,
  config: NavigationPolicy,
) => {
  const policy = MarkovPolicySchema.make({
    ...config,
    projection,
  });
  const model = makeModel(conceptIds, topology, projection);
  const count = model.ids.length;

  if (count === 0)
    return resultFrom(model, policy, {
      distribution: [],
      converged: true,
      iterations: 0,
      residual: 0,
    });

  if (
    Arr.every(
      Array.from(model.outgoing.values()),
      (targets) => targets.length === 0,
    )
  )
    return resultFrom(model, policy, {
      distribution: Array<number>(count).fill(1 / count),
      converged: true,
      iterations: 0,
      residual: 0,
    });

  return resultFrom(model, policy, powerIteration(model, policy));
};

type Probability = NavigationResult["discoverability"]["distribution"][number];
type DirectionSensitive =
  NavigationEvaluation["directionSensitivity"]["concepts"][number];

const pairProbabilities = (
  left: ReadonlyArray<Probability>,
  right: ReadonlyArray<Probability>,
) => {
  const rightById = new Map(
    Arr.map(right, ({ conceptId, probability }) => [conceptId, probability]),
  );

  return Arr.flatMap(left, ({ conceptId, probability }) => {
    const rightProbability = rightById.get(conceptId);
    return rightProbability === undefined
      ? []
      : [{ conceptId, leftProbability: probability, rightProbability }];
  });
};

const divergence = (
  left: ReadonlyArray<Probability>,
  right: ReadonlyArray<Probability>,
) =>
  pipe(
    pairProbabilities(left, right),
    Arr.map(({ leftProbability, rightProbability }) => {
      const mean = (leftProbability + rightProbability) / 2;
      const entropy = (probability: number) =>
        probability === 0 ? 0 : probability * Math.log(probability / mean);
      return (entropy(leftProbability) + entropy(rightProbability)) / 2;
    }),
    Num.sumAll,
    (value) => value / Math.log(2),
  );

const probabilityOrder = Order.combine(
  Order.mapInput(Order.Number, (item: Probability) => item.probability),
  Order.mapInput(Order.String, (item: Probability) => item.conceptId),
);
const probabilityDescending = Order.combine(
  Order.flip(
    Order.mapInput(Order.Number, (item: Probability) => item.probability),
  ),
  Order.mapInput(Order.String, (item: Probability) => item.conceptId),
);

const summarize = ({
  discoverability: { distribution, ...metrics },
  ...result
}: NavigationResult) => ({
  ...result,
  metrics,
  evidence: {
    highest: pipe(distribution, Arr.sort(probabilityDescending), Arr.take(5)),
    lowest: pipe(distribution, Arr.sort(probabilityOrder), Arr.take(5)),
  },
});

export const evaluateNavigation = (
  topology: EvaluationTopology,
  policy: NavigationPolicy = defaultNavigationPolicy,
) => {
  const directed = evaluateProjection(
    topology.conceptIds,
    topology.directedTopology,
    "directed",
    policy,
  );
  const undirected = evaluateProjection(
    topology.conceptIds,
    topology.undirectedTopology,
    "undirected",
    policy,
  );
  const pairs = pairProbabilities(
    directed.discoverability.distribution,
    undirected.discoverability.distribution,
  );

  return {
    directed: summarize(directed),
    undirected: summarize(undirected),
    directionSensitivity: {
      divergence: divergence(
        directed.discoverability.distribution,
        undirected.discoverability.distribution,
      ),
      concepts: pipe(
        pairs,
        Arr.map(({ conceptId, leftProbability, rightProbability }) => ({
          conceptId,
          directedProbability: leftProbability,
          undirectedProbability: rightProbability,
          absoluteDifference: Math.abs(leftProbability - rightProbability),
        })),
        Arr.sort(
          Order.combine(
            Order.flip(
              Order.mapInput(
                Order.Number,
                (item: DirectionSensitive) => item.absoluteDifference,
              ),
            ),
            Order.mapInput(
              Order.String,
              (item: DirectionSensitive) => item.conceptId,
            ),
          ),
        ),
        Arr.take(5),
      ),
    },
  } satisfies NavigationEvaluation;
};
