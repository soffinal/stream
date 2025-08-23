import { Stream } from "../stream.ts";

export const delay: delay.Transformer =
  <VALUE, ACC>(
    msOrSelector: number | ((value: VALUE) => number | Promise<number>) | ACC,
    delaySelector?: (accumulator: ACC, value: VALUE) => [number, ACC] | Promise<[number, ACC]>
  ) =>
  (stream: Stream<VALUE>): Stream<VALUE> =>
    new Stream<VALUE>(async function* () {
      let accumulator = delaySelector ? (msOrSelector as ACC) : undefined;

      for await (const value of stream) {
        let delayMs: number;

        if (delaySelector) {
          // Stateful delay
          const [newDelay, newAcc] = await delaySelector(accumulator!, value);
          delayMs = newDelay;
          accumulator = newAcc;
        } else if (typeof msOrSelector === "function") {
          // Dynamic delay
          delayMs = await (msOrSelector as (value: VALUE) => number | Promise<number>)(value);
        } else {
          // Fixed delay
          delayMs = msOrSelector as number;
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        yield value;
      }
    });

export namespace delay {
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
