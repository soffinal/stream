import { Stream } from "../stream.ts";

/**
 * Adaptive map transformer that transforms values while maintaining state.
 * Supports multiple concurrency strategies for async mappers.
 *
 * @template VALUE - The type of input values
 * @template STATE - The type of the internal state object
 * @template MAPPED - The type of output values after transformation
 *
 * @param initialStateOrMapper - Initial state object or mapper function
 * @param statefulMapperOrOptions - Stateful mapper function or options for simple mappers
 *
 * @returns A transformer function that can be used with `.pipe()`
 *
 * @see {@link Stream} - Complete copy-paste transformers library
 *
 * @example
 * // Simple synchronous transformation
 * stream.pipe(map((value) => value * 2))
 *
 * @example
 * // Type transformation
 * stream.pipe(map((value: number) => value.toString()))
 *
 * @example
 * // Async transformation with sequential strategy (default)
 * stream.pipe(
 *   map(async (value) => {
 *     const result = await processAsync(value);
 *     return result;
 *   })
 * )
 *
 * @example
 * // Async transformation with concurrent-unordered strategy
 * stream.pipe(
 *   map(async (value) => {
 *     const enriched = await enrichWithAPI(value);
 *     return enriched;
 *   }, { strategy: "concurrent-unordered" })
 * )
 *
 * @example
 * // Async transformation with concurrent-ordered strategy
 * stream.pipe(
 *   map(async (value) => {
 *     const processed = await heavyProcessing(value);
 *     return processed;
 *   }, { strategy: "concurrent-ordered" })
 * )
 *
 * @example
 * // Stateful transformation (always sequential)
 * stream.pipe(
 *   map({ sum: 0 }, (state, value) => {
 *     const newSum = state.sum + value;
 *     return [{ value, runningSum: newSum }, { sum: newSum }];
 *   })
 * )
 *
 * @example
 * // Complex stateful transformation
 * stream.pipe(
 *   map({ count: 0, items: [] }, (state, value) => {
 *     const newItems = [...state.items, value];
 *     const newCount = state.count + 1;
 *     return [
 *       {
 *         item: value,
 *         index: newCount,
 *         total: newItems.length,
 *         history: newItems
 *       },
 *       { count: newCount, items: newItems }
 *     ];
 *   })
 * )
 *
 * @example
 * // Async stateful transformation
 * stream.pipe(
 *   map({ cache: new Map() }, async (state, value) => {
 *     const cached = state.cache.get(value);
 *     if (cached) return [cached, state];
 *
 *     const processed = await expensiveOperation(value);
 *     const newCache = new Map(state.cache);
 *     newCache.set(value, processed);
 *
 *     return [processed, { cache: newCache }];
 *   })
 * )
 */
export const map: map.Map = <VALUE, STATE extends Record<string, unknown>, MAPPED>(
  initialStateOrMapper: STATE | map.Mapper<VALUE, MAPPED>,
  statefulMapper?: map.StatefulMapper<VALUE, STATE, MAPPED> | map.Options
): ((stream: Stream<VALUE>) => Stream<MAPPED>) => {
  return (stream: Stream<VALUE>): Stream<MAPPED> => {
    if (!statefulMapper || typeof statefulMapper === "object") {
      const { strategy = "sequential" } = statefulMapper ?? {};
      const mapper = initialStateOrMapper as map.Mapper<VALUE, MAPPED>;

      if (strategy === "sequential") {
        return new Stream<MAPPED>(async function* () {
          for await (const value of stream) {
            yield await mapper(value);
          }
        });
      }
      if (strategy === "concurrent-unordered") {
        return new Stream<MAPPED>(async function* () {
          let queue = new Array<MAPPED>();
          let resolver: Function | undefined;

          const abort = stream.listen(async (value) => {
            queue.push(await mapper(value));
            resolver?.();
            resolver = undefined;
          });

          try {
            while (true) {
              if (queue.length) {
                yield queue.shift()!;
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
        return new Stream<MAPPED>(async function* () {
          let queue = new Array<MAPPED | Promise<MAPPED>>();
          let resolver: Function | undefined;

          const abort = stream.listen((value) => {
            const promise = mapper(value);

            queue.push(promise);

            (async () => {
              await promise;
              resolver?.();
              resolver = undefined;
            })();
          });

          try {
            while (true) {
              if (queue.length) {
                yield await queue.shift()!;
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

    const mapper = statefulMapper as map.StatefulMapper<VALUE, STATE, MAPPED>;

    return new Stream<MAPPED>(async function* () {
      let currentState = initialStateOrMapper as STATE;
      for await (const value of stream) {
        const [mapped, state] = await mapper(currentState, value);
        currentState = state;
        yield mapped;
      }
    });
  };
};

export namespace map {
  export type Options = { strategy: "sequential" | "concurrent-unordered" | "concurrent-ordered" };
  export type Mapper<VALUE = unknown, MAPPED = VALUE> = (value: VALUE) => MAPPED | Promise<MAPPED>;
  export type StatefulMapper<VALUE = unknown, STATE extends Record<string, unknown> = {}, MAPPED = VALUE> = (
    state: STATE,
    value: VALUE
  ) => [MAPPED, STATE] | Promise<[MAPPED, STATE]>;

  export interface Map {
    <VALUE, MAPPED>(mapper: Mapper<VALUE, MAPPED>, options?: Options): (stream: Stream<VALUE>) => Stream<MAPPED>;
    <VALUE, STATE extends Record<string, unknown> = {}, MAPPED = VALUE>(
      initialState: STATE,
      mapper: StatefulMapper<VALUE, STATE, MAPPED>
    ): (stream: Stream<VALUE>) => Stream<MAPPED>;
  }
}
