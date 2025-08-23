import { Stream } from "../stream.ts";

export const sample: sample.Transformer =
  <VALUE, STATE>(
    triggerOrIntervalOrState:
      | Stream<any>
      | number
      | ((value: VALUE, lastSampled?: VALUE) => boolean | Promise<boolean>)
      | STATE,
    selector?: (state: STATE, value: VALUE, lastSampled?: VALUE) => [boolean, STATE] | Promise<[boolean, STATE]>
  ) =>
  (stream: Stream<VALUE>): Stream<VALUE> => {
    // Stream trigger
    if (triggerOrIntervalOrState instanceof Stream) {
      const trigger = triggerOrIntervalOrState;
      return new Stream<VALUE>(async function* () {
        const queue: VALUE[] = [];
        let resolver: Function | undefined;
        let lastValue: VALUE | undefined;

        const streamAbort = stream.listen((value) => {
          lastValue = value;
        });

        const triggerAbort = trigger.listen(() => {
          if (lastValue !== undefined) {
            queue.push(lastValue);
            resolver?.();
          }
        });

        try {
          while (true) {
            await new Promise((resolve) => (resolver = resolve));
            while (queue.length > 0) {
              yield queue.shift()!;
            }
          }
        } finally {
          streamAbort();
          triggerAbort();
        }
      });
    }

    // Fixed interval sampling
    if (typeof triggerOrIntervalOrState === "number") {
      const intervalMs = triggerOrIntervalOrState;
      return new Stream<VALUE>(async function* () {
        const queue: VALUE[] = [];
        let resolver: Function | undefined;
        let lastValue: VALUE | undefined;
        let intervalId: NodeJS.Timeout | undefined;

        const streamAbort = stream.listen((value) => {
          lastValue = value;
        });

        const startInterval = () => {
          intervalId = setInterval(() => {
            if (lastValue !== undefined) {
              queue.push(lastValue);
              resolver?.();
            }
          }, intervalMs);
        };

        startInterval();

        try {
          while (true) {
            await new Promise((resolve) => (resolver = resolve));
            while (queue.length > 0) {
              yield queue.shift()!;
            }
          }
        } finally {
          streamAbort();
          if (intervalId) clearInterval(intervalId);
        }
      });
    }

    // Stateful sampling
    if (selector) {
      return new Stream<VALUE>(async function* () {
        let state = triggerOrIntervalOrState as STATE;
        let lastSampled: VALUE | undefined;

        for await (const value of stream) {
          const [shouldSample, newState] = await selector(state, value, lastSampled);

          if (shouldSample) {
            lastSampled = value;
            yield value;
          }

          state = newState;
        }
      });
    }

    // Dynamic interval or predicate sampling
    if (typeof triggerOrIntervalOrState === "function") {
      const func = triggerOrIntervalOrState as (value: VALUE, lastSampled?: VALUE) => any;

      // Check if it returns a number (dynamic interval) or boolean (predicate)
      return new Stream<VALUE>(async function* () {
        let lastSampled: VALUE | undefined;
        let nextSampleTime = 0;

        for await (const value of stream) {
          const result = await func(value, lastSampled);

          if (typeof result === "number") {
            // Dynamic interval sampling
            const now = Date.now();
            if (now >= nextSampleTime) {
              lastSampled = value;
              nextSampleTime = now + result;
              yield value;
            }
          } else if (typeof result === "boolean") {
            // Predicate sampling
            if (result) {
              lastSampled = value;
              yield value;
            }
          }
        }
      });
    }

    throw new Error("Invalid sample configuration");
  };

export namespace sample {
  export type IntervalSelector<VALUE> = (value: VALUE) => number | Promise<number>;
  export type Predicate<VALUE> = (value: VALUE, lastSampled?: VALUE) => boolean | Promise<boolean>;
  export type StatefulSelector<VALUE, STATE> = (
    state: STATE,
    value: VALUE,
    lastSampled?: VALUE
  ) => [boolean, STATE] | Promise<[boolean, STATE]>;
  export interface Transformer {
    <VALUE>(intervalMs: number): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE>(intervalSelector: IntervalSelector<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE>(predicate: Predicate<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE>(trigger: Stream<any>): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE, STATE>(initialState: STATE, selector: StatefulSelector<VALUE, STATE>): (
      stream: Stream<VALUE>
    ) => Stream<VALUE>;
  }
}
