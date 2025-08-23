import { Stream } from "../stream.ts";

export const throttle: throttle.Transformer =
  <VALUE, ACC>(
    msOrSelector: number | ((value: VALUE) => number | Promise<number>) | ACC,
    timeSelector?: (accumulator: ACC, value: VALUE) => [number, ACC] | Promise<[number, ACC]>
  ) =>
  (stream: Stream<VALUE>): Stream<VALUE> => {
    // Stateful throttling
    if (timeSelector) {
      return stream.filter({ acc: msOrSelector as ACC, lastEmit: 0, lastInterval: 0 }, async (state, value) => {
        const [interval, newAcc] = await timeSelector(state.acc, value);
        const now = Date.now();

        // Use the interval from the last emission, not the current one
        const effectiveInterval = state.lastInterval || interval;

        if (now - state.lastEmit >= effectiveInterval) {
          return [true, { acc: newAcc, lastEmit: now, lastInterval: interval }];
        }
        // Don't update accumulator for filtered values - keep previous state
        return [false, state];
      });
    }

    // Dynamic time selector
    if (typeof msOrSelector === "function") {
      const dynamicTimeSelector = msOrSelector as (value: VALUE) => number | Promise<number>;
      return stream.filter({ lastEmit: 0, lastInterval: 0 }, async (state, value) => {
        const interval = await dynamicTimeSelector(value);
        const now = Date.now();

        // Use the interval from when we last emitted, not the current interval
        const effectiveInterval = state.lastInterval || interval;

        if (now - state.lastEmit >= effectiveInterval) {
          return [true, { lastEmit: now, lastInterval: interval }];
        }
        return [false, { lastEmit: state.lastEmit, lastInterval: state.lastInterval }];
      });
    }

    // Fixed time interval
    const ms = msOrSelector as number;
    return stream.filter(0, (lastEmit, value) => {
      const now = Date.now();

      if (now - lastEmit >= ms) {
        return [true, now];
      }
      return [false, lastEmit];
    });
  };

export namespace throttle {
  export type TimeSelector<VALUE> = (value: VALUE) => number | Promise<number>;
  export type StatefulTimeSelector<VALUE, ACC> = (accumulator: ACC, value: VALUE) => [number, ACC] | Promise<[number, ACC]>;
  export interface Transformer {
    <VALUE>(ms: number): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE>(timeSelector: TimeSelector<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE, ACC>(initialValue: ACC, timeSelector: StatefulTimeSelector<VALUE, ACC>): (stream: Stream<VALUE>) => Stream<VALUE>;
  }
}
