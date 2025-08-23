import { Stream } from "../stream.ts";

export const debounce: debounce.Transformer =
  <VALUE, ACC>(
    msOrSelector: number | ((value: VALUE) => number | Promise<number>) | ACC,
    delaySelector?: (accumulator: ACC, value: VALUE) => [number, ACC] | Promise<[number, ACC]>
  ) =>
  (stream: Stream<VALUE>): Stream<VALUE> => {
    return new Stream<VALUE>(async function* () {
      const queue: VALUE[] = [];
      let resolver: Function | undefined;
      let timeoutId: Timer | undefined;
      let accumulator = delaySelector ? (msOrSelector as ACC) : undefined;

      const streamAbort = stream.listen(async (value) => {
        queue.push(value);
        if (timeoutId) clearTimeout(timeoutId);

        let delay: number;

        if (delaySelector) {
          // Stateful debounce
          const [newDelay, newAcc] = await delaySelector(accumulator!, value);
          delay = newDelay;
          accumulator = newAcc;
        } else if (typeof msOrSelector === "function") {
          // Dynamic delay
          delay = await (msOrSelector as (value: VALUE) => number | Promise<number>)(value);
        } else {
          // Fixed delay
          delay = msOrSelector as number;
        }

        timeoutId = setTimeout(() => resolver?.(), delay);
      });

      try {
        while (true) {
          await new Promise((resolve) => (resolver = resolve));
          if (queue.length > 0) {
            const lastValue = queue[queue.length - 1]!;
            queue.length = 0;
            yield lastValue;
          }
        }
      } finally {
        streamAbort();
        if (timeoutId) clearTimeout(timeoutId);
      }
    });
  };

export namespace debounce {
  export type DelaySelector<VALUE> = (value: VALUE) => number | Promise<number>;
  export type StatefulDelaySelector<VALUE, ACC> = (
    accumulator: ACC,
    value: VALUE
  ) => [number, ACC] | Promise<[number, ACC]>;
  export interface Transformer {
    <VALUE>(ms: number): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE>(delaySelector: DelaySelector<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE, ACC>(initialValue: ACC, delaySelector: StatefulDelaySelector<VALUE, ACC>): (
      stream: Stream<VALUE>
    ) => Stream<VALUE>;
  }
}
