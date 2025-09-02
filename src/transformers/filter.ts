import { Stream } from "../stream.ts";

/**
 * Adaptive filter transformer that maintains state and can terminate streams.
 *
 * @template VALUE - The type of values flowing through the stream
 * @template STATE - The type of the internal state object
 *
 * @param initialState - Initial state object for the transformer
 * @param predicate - Function that determines if a value should pass through
 *   - Returns `[boolean, newState]` to continue with updated state
 *   - Returns `void` or `undefined` to terminate the stream
 *   - Can be async for complex filtering logic
 *
 * @returns A transformer function that can be used with `.pipe()`
 *
 * @see {@link Stream} - Complete copy-paste transformers library
 *
 * @example
 * // Simple filtering
 * stream.pipe(filter({}, (_, value) => [value > 0, {}]))
 *
 * @example
 * // Async filtering
 * stream.pipe(
 *   filter({}, async (_, value) => {
 *     const valid = await validate(value);
 *     return [valid, {}];
 *   })
 * )
 *

 *
 */
export const filter: filter.Filter = <
  VALUE,
  STATE extends Record<string, unknown> = {},
  FILTERED extends VALUE = VALUE
>(
  initialStateOrPredicate: STATE | filter.Predicate<VALUE> | filter.GuardPredicate<VALUE, FILTERED>,
  statefulPredicateOrOptions?:
    | filter.StatefulPredicate<VALUE, STATE>
    | filter.StatefulGuardPredicate<VALUE, STATE, FILTERED>
    | filter.Options,
  options?: filter.Options
): ((stream: Stream<VALUE>) => Stream<FILTERED>) => {
  return (stream: Stream<VALUE>): Stream<FILTERED> => {
    const { strategy = "sequential" } = options ?? {};

    if (!statefulPredicateOrOptions || typeof statefulPredicateOrOptions === "object") {
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

      if (strategy === "concurent-unordered") {
        return new Stream<FILTERED>(async function* () {
          const ABORT = Symbol.for("__abort");

          let queue = new Array<FILTERED | typeof ABORT>();
          let resolver: Function | undefined;

          const abort = stream.listen(async (value) => {
            const result = await predicate(value);
            if (result! === false) {
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

      if (strategy === "concurent-ordered") {
        return new Stream<FILTERED>(async function* () {
          let queue = new Array<{ resultPromise: boolean | void | Promise<boolean | void>; value: VALUE }>();
          let resolver: Function | undefined;

          const abort = stream.listen((value) => {
            queue.push({ resultPromise: predicate(value), value });
            resolver?.();
            resolver = undefined;
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

    if (strategy === "concurent-unordered") {
      return new Stream<FILTERED>(async function* () {
        const ABORT = Symbol.for("__abort");
        let currentState = initialStateOrPredicate as STATE;

        let queue = new Array<VALUE | typeof ABORT>();
        let resolver: Function | undefined;

        const abort = stream.listen(async (value) => {
          const result = await predicate(currentState, value);
          if (result === undefined) {
            queue.push(ABORT);
          } else {
            const [ok, state] = result;
            currentState = state;
            if (!ok) return;
            queue.push(value);
          }
          resolver?.();
          resolver = undefined;
        });

        try {
          while (true) {
            if (queue.length) {
              const value = queue.shift()!;
              if (value === ABORT) break;
              yield value as FILTERED;
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

    return new Stream<FILTERED>(async function* () {
      let currentState = initialStateOrPredicate as STATE;
      for await (const value of stream) {
        const result = await (statefulPredicateOrOptions as filter.StatefulGuardPredicate<VALUE, STATE>)(
          currentState,
          value
        );
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
  export type Options = { strategy: "sequential" | "concurent-unordered" | "concurent-ordered" };
  export type Predicate<VALUE = unknown> = (value: VALUE) => boolean | void | Promise<boolean | void>;
  export type GuardPredicate<VALUE = unknown, FILTERED extends VALUE = VALUE> = (value: VALUE) => value is FILTERED;
  export type StatefulPredicate<VALUE = unknown, STATE extends Record<string, unknown> = {}> = (
    state: STATE,
    value: VALUE
  ) => [boolean, STATE] | void | Promise<[boolean, STATE] | void>;
  export type StatefulGuardPredicate<
    VALUE = unknown,
    STATE extends Record<string, unknown> = {},
    FILTERED extends VALUE = VALUE
  > = (state: STATE, value: VALUE) => [boolean, STATE, FILTERED] | void | Promise<[boolean, STATE, FILTERED] | void>;
  export interface Filter {
    <VALUE, FILTERED extends VALUE>(predicate: GuardPredicate<VALUE, FILTERED>, options?: Options): (
      stream: Stream<VALUE>
    ) => Stream<FILTERED>;

    <VALUE>(predicate: Predicate<VALUE>, options?: Options): (stream: Stream<VALUE>) => Stream<VALUE>;

    <VALUE, STATE extends Record<string, unknown> = {}>(
      initialState: STATE,
      predicate: StatefulPredicate<VALUE, STATE>,
      options?: Options
    ): (stream: Stream<VALUE>) => Stream<VALUE>;

    <VALUE, STATE extends Record<string, unknown> = {}, FILTERED extends VALUE = VALUE>(
      initialState: STATE,
      predicate: StatefulGuardPredicate<VALUE, STATE, FILTERED>,
      options?: Options
    ): (stream: Stream<VALUE>) => Stream<FILTERED>;
  }
}

const stream = new Stream<{ type: "add"; user: string } | { type: "delete" }>();

const out = stream.pipe(
  filter(async (v) => {
    await new Promise((r) => setTimeout(r, Math.random() * 200));
    return v.type === "delete";
  })
);

out.listen(console.log);

stream.push(
  { type: "add", user: "dddd" },
  { type: "delete" },
  { type: "add", user: "dddd" },
  { type: "delete" },
  { type: "add", user: "dddd" }
);
