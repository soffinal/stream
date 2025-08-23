import { Stream } from "../stream.ts";

export const rateLimit: rateLimit.Transformer =
  <VALUE, ACC>(
    countOrSelector: number | ((value: VALUE) => number | Promise<number>) | ACC,
    windowMsOrSelector?:
      | number
      | ((value: VALUE) => number | Promise<number>)
      | ((accumulator: ACC, value: VALUE) => [number, number, ACC] | Promise<[number, number, ACC]>)
  ) =>
  (stream: Stream<VALUE>): Stream<VALUE> => {
    // Stateful rate limiting
    if (typeof countOrSelector !== "number" && typeof countOrSelector !== "function") {
      const selector = windowMsOrSelector as (
        accumulator: ACC,
        value: VALUE
      ) => [number, number, ACC] | Promise<[number, number, ACC]>;

      return stream.filter({ acc: countOrSelector as ACC, timestamps: [] as number[] }, async (state, value) => {
        const [shouldAllow, count, windowMs, newAcc] = await selector(state.acc, value);
        if (!shouldAllow) {
          return [false, { acc: newAcc, timestamps: state.timestamps }];
        }
        const now = Date.now();
        const validTimestamps = state.timestamps.filter((t) => now - t < windowMs);

        if (validTimestamps.length < count) {
          return [true, { acc: newAcc, timestamps: [...validTimestamps, now] }];
        }
        return [false, { acc: newAcc, timestamps: validTimestamps }];
      });
    }

    // All other overloads use unified logic
    return stream.filter([] as number[], async (timestamps, value) => {
      let count: number;
      let windowMs: number;

      if (typeof countOrSelector === "number" && typeof windowMsOrSelector === "number") {
        // Fixed count + fixed window
        count = countOrSelector;
        windowMs = windowMsOrSelector;
      } else if (typeof countOrSelector === "number" && typeof windowMsOrSelector === "function") {
        // Fixed count + dynamic window
        count = countOrSelector;
        windowMs = await (windowMsOrSelector as (value: VALUE) => number | Promise<number>)(value);
      } else if (typeof countOrSelector === "function" && typeof windowMsOrSelector === "number") {
        // Dynamic count + fixed window
        count = await (countOrSelector as (value: VALUE) => number | Promise<number>)(value);
        windowMs = windowMsOrSelector;
      } else {
        // Dynamic count + dynamic window
        count = await (countOrSelector as (value: VALUE) => number | Promise<number>)(value);
        windowMs = await (windowMsOrSelector as (value: VALUE) => number | Promise<number>)(value);
      }

      const now = Date.now();
      const validTimestamps = timestamps.filter((t) => now - t < windowMs);

      if (validTimestamps.length < count) {
        return [true, [...validTimestamps, now]];
      }
      return [false, validTimestamps];
    });
  };

export namespace rateLimit {
  export type CountSelector<VALUE> = (value: VALUE) => number | Promise<number>;
  export type WindowSelector<VALUE> = (value: VALUE) => number | Promise<number>;
  export type StatefulSelector<VALUE, ACC> = (
    accumulator: ACC,
    value: VALUE
  ) => [boolean, number, number, ACC] | Promise<[boolean, number, number, ACC]>;
  export interface Transformer {
    <VALUE>(count: number, windowMs: number): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE>(count: number, windowSelector: WindowSelector<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE>(countSelector: CountSelector<VALUE>, windowMs: number): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE>(countSelector: CountSelector<VALUE>, windowSelector: WindowSelector<VALUE>): (
      stream: Stream<VALUE>
    ) => Stream<VALUE>;
    <VALUE, ACC>(initialValue: ACC, selector: StatefulSelector<VALUE, ACC>): (stream: Stream<VALUE>) => Stream<VALUE>;
  }
}
