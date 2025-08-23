import { Stream } from "../stream.ts";

export const take: take.Transformer =
  <VALUE, ACC>(
    countOrPredicateOrSignal: number | ((value: VALUE) => boolean | Promise<boolean>) | ACC | Stream<any> | AbortSignal,
    predicate?: (accumulator: ACC, value: VALUE) => [boolean, ACC] | Promise<[boolean, ACC]>
  ) =>
  (stream: Stream<VALUE>): Stream<VALUE> => {
    // Take by count
    if (typeof countOrPredicateOrSignal === "number") {
      return new Stream<VALUE>(async function* () {
        let taken = 0;
        for await (const value of stream) {
          if (taken >= countOrPredicateOrSignal) break;
          yield value;
          taken++;
        }
      });
    }

    // Take until signal (Stream or AbortSignal)
    if (countOrPredicateOrSignal instanceof Stream || countOrPredicateOrSignal instanceof AbortSignal) {
      const signal = countOrPredicateOrSignal;
      return new Stream<VALUE>(async function* () {
        const queue: VALUE[] = [];
        let resolver: Function | undefined;
        let stopped = false;

        // Listen to the signal to know when to stop
        const signalAbort =
          signal instanceof Stream
            ? signal.listen(() => {
                stopped = true;
                resolver?.();
              })
            : (() => {
                const handler = () => {
                  stopped = true;
                  resolver?.();
                };
                signal.addEventListener("abort", handler);
                return () => signal.removeEventListener("abort", handler);
              })();

        // Listen to the stream for values
        const streamAbort = stream.listen((value) => {
          if (!stopped) {
            queue.push(value);
            resolver?.();
          }
        });

        try {
          while (!stopped || queue.length > 0) {
            if (queue.length) {
              yield queue.shift()!;
            } else {
              await new Promise((resolve) => (resolver = resolve));
            }
          }
        } finally {
          signalAbort();
          streamAbort();
        }
      });
    }

    // Stateful take
    if (predicate) {
      return new Stream<VALUE>(async function* () {
        let accumulator = countOrPredicateOrSignal as ACC;
        for await (const value of stream) {
          const [shouldTake, newAcc] = await predicate(accumulator, value);
          if (!shouldTake) break;
          yield value;
          accumulator = newAcc;
        }
      });
    }

    // Take by predicate
    const simplePredicate = countOrPredicateOrSignal as (value: VALUE) => boolean | Promise<boolean>;
    return new Stream<VALUE>(async function* () {
      for await (const value of stream) {
        if (!(await simplePredicate(value))) break;
        yield value;
      }
    });
  };

export namespace take {
  export type Predicate<VALUE> = (value: VALUE) => boolean | Promise<boolean>;
  export type StatePredicate<VALUE, ACC> = (accumulator: ACC, value: VALUE) => [boolean, ACC] | Promise<[boolean, ACC]>;
  export interface Transformer {
    <VALUE>(count: number): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE>(predicate: Predicate<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE, ACC>(initialValue: ACC, predicate: StatePredicate<VALUE, ACC>): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE>(signal: Stream<any>): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE>(signal: AbortSignal): (stream: Stream<VALUE>) => Stream<VALUE>;
  }
}
