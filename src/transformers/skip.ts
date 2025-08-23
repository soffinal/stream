import { Stream } from "../stream.ts";

export const skip: skip.Transformer =
  <VALUE, ACC>(
    countOrPredicateOrSignal: number | ((value: VALUE) => boolean | Promise<boolean>) | ACC | Stream<any> | AbortSignal,
    predicate?: (accumulator: ACC, value: VALUE) => [boolean, ACC] | Promise<[boolean, ACC]>
  ) =>
  (stream: Stream<VALUE>): Stream<VALUE> => {
    // Stateful skip (check first before number to handle skip(0, predicate))
    if (predicate) {
      return new Stream<VALUE>(async function* () {
        let accumulator = countOrPredicateOrSignal as ACC;
        for await (const value of stream) {
          const [shouldSkip, newAcc] = await predicate(accumulator, value);
          accumulator = newAcc;
          if (!shouldSkip) yield value;
        }
      });
    }

    // Skip by count
    if (typeof countOrPredicateOrSignal === "number") {
      return new Stream<VALUE>(async function* () {
        let skipped = 0;
        for await (const value of stream) {
          if (skipped < countOrPredicateOrSignal) {
            skipped++;
          } else {
            yield value;
          }
        }
      });
    }

    // Skip until signal (Stream or AbortSignal)
    if (countOrPredicateOrSignal instanceof Stream || countOrPredicateOrSignal instanceof AbortSignal) {
      const signal = countOrPredicateOrSignal;
      return new Stream<VALUE>(async function* () {
        const queue: VALUE[] = [];
        let resolver: Function | undefined;
        let started = false;

        // Listen to the signal to know when to start
        const signalAbort =
          signal instanceof Stream
            ? signal.listen(() => {
                started = true;
                resolver?.();
              })
            : (() => {
                const handler = () => {
                  started = true;
                  resolver?.();
                };
                signal.addEventListener("abort", handler);
                return () => signal.removeEventListener("abort", handler);
              })();

        const streamAbort = stream.listen((value) => {
          if (started) {
            queue.push(value);
            resolver?.();
          }
        });

        try {
          while (true) {
            if (started && queue.length) {
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



    // Skip by predicate
    const simplePredicate = countOrPredicateOrSignal as (value: VALUE) => boolean | Promise<boolean>;
    return new Stream<VALUE>(async function* () {
      for await (const value of stream) {
        if (!(await simplePredicate(value))) {
          yield value;
        }
      }
    });
  };

export namespace skip {
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
