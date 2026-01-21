import { Stream } from "../../stream.ts";

export const filter: filter.Filter = <
  VALUE,
  STATE extends Record<string, unknown> = {},
  FILTERED extends VALUE = VALUE,
>(
  initialStateOrPredicate: STATE | filter.Predicate<VALUE> | filter.GuardPredicate<VALUE, FILTERED>,
  statefulPredicateOrOptions?:
    | filter.StatefulPredicate<VALUE, STATE>
    | filter.StatefulGuardPredicate<VALUE, STATE, FILTERED>
    | filter.Options,
): Stream.Transformer<Stream<VALUE>, Stream<FILTERED>> => {
  return (stream: Stream<VALUE>): Stream<FILTERED> => {
    if (!statefulPredicateOrOptions || typeof statefulPredicateOrOptions === "object") {
      const { strategy = "sequential" } = statefulPredicateOrOptions ?? {};

      const predicate = initialStateOrPredicate as filter.Predicate<VALUE>;

      if (strategy === "sequential") {
        return new Stream<FILTERED>(async function* () {
          for await (const value of stream) {
            const result = await predicate(value);
            if (result) yield value as FILTERED;
            if (result === undefined) return;
          }
        });
      }

      if (strategy === "concurrent-unordered") {
        return new Stream<FILTERED>(async function* () {
          const ABORT = Symbol.for("__abort");

          let queue = new Array<FILTERED | typeof ABORT>();
          let resolver: Function | undefined;

          const abort = stream.listen(async (value) => {
            const result = await predicate(value);
            if (result !== false) {
              result === undefined ? queue.push(ABORT) : queue.push(value as FILTERED);
              resolver?.();
              resolver = undefined;
            }
          });

          try {
            while (true) {
              if (queue.length) {
                const value = queue.shift()!;
                if (value === ABORT) break;
                yield value;
              } else {
                await new Promise<void>((r) => (resolver = r));
              }
            }
          } finally {
            queue.length = 0;
            abort();
            resolver = undefined;
          }
        });
      }

      if (strategy === "concurrent-ordered") {
        return new Stream<FILTERED>(async function* () {
          let queue = new Array<{ resultPromise: boolean | void | Promise<boolean | void>; value: VALUE }>();
          let resolver: Function | undefined;

          const abort = stream.listen((value) => {
            const pormise = predicate(value);
            queue.push({ resultPromise: pormise, value });
            (async () => {
              await pormise;
              resolver?.();
              resolver = undefined;
            })();
          });

          try {
            while (true) {
              if (queue.length) {
                const { resultPromise, value } = queue.shift()!;
                const result = await resultPromise;
                if (result) yield value as FILTERED;
                if (result === undefined) break;
              } else {
                await new Promise<void>((r) => (resolver = r));
              }
            }
          } finally {
            queue.length = 0;
            abort();
            resolver = undefined;
          }
        });
      }
    }

    const predicate = statefulPredicateOrOptions as filter.StatefulGuardPredicate<VALUE, STATE>;

    return new Stream<FILTERED>(async function* () {
      let currentState = initialStateOrPredicate as STATE;
      for await (const value of stream) {
        const result = await predicate(currentState, value);
        if (!result) return;
        const [emit, state] = result;
        currentState = state;
        if (emit) {
          yield value as FILTERED;
        }
      }
    });
  };
};

export namespace filter {
  export type Options = { strategy: "sequential" | "concurrent-unordered" | "concurrent-ordered" };
  export type Predicate<VALUE = unknown> = (value: VALUE) => boolean | void | Promise<boolean | void>;
  export type GuardPredicate<VALUE = unknown, FILTERED extends VALUE = VALUE> = (value: VALUE) => value is FILTERED;
  export type StatefulPredicate<VALUE = unknown, STATE extends Record<string, unknown> = {}> = (
    state: STATE,
    value: VALUE,
  ) => [boolean, STATE] | void | Promise<[boolean, STATE] | void>;
  export type StatefulGuardPredicate<
    VALUE = unknown,
    STATE extends Record<string, unknown> = {},
    FILTERED extends VALUE = VALUE,
  > = (state: STATE, value: VALUE) => [boolean, STATE, FILTERED] | void | Promise<[boolean, STATE, FILTERED] | void>;
  export interface Filter {
    <VALUE, FILTERED extends VALUE = VALUE>(
      predicate: GuardPredicate<VALUE, FILTERED>,
    ): Stream.Transformer<Stream<VALUE>, Stream<FILTERED>>;

    <VALUE>(predicate: Predicate<VALUE>, options?: Options): Stream.Transformer<Stream<VALUE>, Stream<VALUE>>;

    <VALUE, STATE extends Record<string, unknown> = {}>(
      initialState: STATE,
      predicate: StatefulPredicate<VALUE, STATE>,
    ): Stream.Transformer<Stream<VALUE>, Stream<VALUE>>;

    <VALUE, STATE extends Record<string, unknown> = {}, FILTERED extends VALUE = VALUE>(
      initialState: STATE,
      predicate: StatefulGuardPredicate<VALUE, STATE, FILTERED>,
    ): Stream.Transformer<Stream<VALUE>, Stream<FILTERED>>;
  }
}
