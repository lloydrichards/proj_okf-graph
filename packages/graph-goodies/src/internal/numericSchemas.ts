import { Schema } from "effect";

/** @internal */
export const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0));

/** @internal */
export const NonNegativeInt = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
);
