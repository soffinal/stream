import { Stream } from "../../stream.ts";
import { WorkerPool } from "../../workerPool/workerPool.ts";

/**
 * Transform values with optional execution strategies
 * 
 * @example
 * ```typescript
 * // Simple transformation
 * stream.pipe(map(x => x * 2))
 * 
 * // Async transformation
 * stream.pipe(map(async x => await fetch(x)))
 * 
 * // Concurrent execution (main thread, unordered)
 * stream.pipe(map(async x => await process(x), { execution: 'concurrent' }))
 * 
 * // Concurrent ordered (main thread, maintains order)
 * stream.pipe(map(async x => await process(x), { execution: 'concurrent-ordered' }))
 * 
 * // Parallel execution (Web Workers, unordered - fastest)
 * stream.pipe(map(x => heavyComputation(x), { execution: 'parallel' }))
 * 
 * // Parallel ordered (Web Workers, maintains order)
 * stream.pipe(map(x => heavyComputation(x), { execution: 'parallel-ordered' }))
 * 
 * // With args (for workers)
 * stream.pipe(map((x, args) => x * args.multiplier, { 
 *   execution: 'parallel',
 *   args: { multiplier: 2 }
 * }))
 * 
 * // Stateful transformation
 * stream.pipe(map({ sum: 0 }, (state, x) => {
 *   const newSum = state.sum + x;
 *   return [newSum, { sum: newSum }];
 * }))
 * ```
 */
export const map: map.Map = <VALUE, STATE extends Record<string, unknown>, MAPPED, ARGS>(
  initialStateOrMapper: STATE | map.Mapper<VALUE, MAPPED, ARGS>,
  statefulMapperOrOptions?: map.StatefulMapper<VALUE, STATE, MAPPED> | map.Options<ARGS>,
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> => {
  const [mapper, options, initalState, statefulMapper] =
    typeof initialStateOrMapper === "function"
      ? [
          initialStateOrMapper as map.Mapper<VALUE, MAPPED, ARGS>,
          statefulMapperOrOptions as map.Options<ARGS>,
          undefined,
          undefined,
        ]
      : [
          undefined,
          undefined,
          initialStateOrMapper,
          statefulMapperOrOptions as map.StatefulMapper<VALUE, STATE, MAPPED>,
        ];

  const { execution = "sequential", args } = options ?? {};

  return (stream: Stream<VALUE>): Stream<MAPPED> => {
    if (mapper) {
      const mapper = initialStateOrMapper as map.Mapper<VALUE, MAPPED, ARGS>;

      // Parallel (workers)
      if (execution === "parallel" || execution === "parallel-ordered") {
        if (typeof Worker === "undefined") {
          // Fallback to concurrent
          return execution === "parallel" ? concurrent() : concurrentOrdered();
        }

        if (execution === "parallel") {
          return new Stream<MAPPED>(async function* () {
            const { execute } = WorkerPool.register(mapper, args);
            const pendings: Promise<MAPPED>[] = [];
            let resolve: Function | undefined;

            const abort = stream.listen((value) => {
              pendings.push(execute(value));
              resolve?.();
            });

            try {
              while (true) {
                if (pendings.length) {
                  yield await pendings.shift()!;
                } else {
                  await new Promise((r) => (resolve = r));
                }
              }
            } finally {
              pendings.length = 0;
              abort();
              resolve = undefined;
            }
          });
        }

        if (execution === "parallel-ordered") {
          return new Stream<MAPPED>(async function* () {
            const { execute } = WorkerPool.register(mapper, args);
            const pendings: Promise<MAPPED>[] = [];
            let resolve: Function | undefined;

            const abort = stream.listen((value) => {
              pendings.push(execute(value));
              resolve?.();
            });

            try {
              while (true) {
                if (pendings.length) {
                  yield await pendings.shift()!;
                } else {
                  await new Promise((r) => (resolve = r));
                }
              }
            } finally {
              pendings.length = 0;
              abort();
              resolve = undefined;
            }
          });
        }
      }

      // Sequential
      if (execution === "sequential") {
        return sequential();
      }

      // Concurrent (main thread)
      if (execution === "concurrent") {
        return concurrent();
      }

      if (execution === "concurrent-ordered") {
        return concurrentOrdered();
      }

      function sequential() {
        return new Stream<MAPPED>(async function* () {
          for await (const value of stream) {
            yield await mapper(value, args!);
          }
        });
      }
      function concurrent() {
        return new Stream<MAPPED>(async function* () {
          let pendings = new Array<MAPPED>();
          let resolve: Function | undefined;

          const abort = stream.listen(async (value) => {
            pendings.push(await mapper(value, args!));
            resolve?.();
          });

          try {
            while (true) {
              if (pendings.length) {
                yield pendings.shift()!;
              } else {
                await new Promise<void>((r) => (resolve = r));
              }
            }
          } finally {
            pendings.length = 0;
            abort();
            resolve?.();
            resolve = undefined;
          }
        });
      }
      function concurrentOrdered() {
        const output = new Stream<MAPPED>(async function* () {
          const pendings: (MAPPED | Promise<MAPPED>)[] = [];
          let resolve: Function | undefined;

          let abort = stream.listen((value) => {
            pendings.push(mapper(value, args!));
            resolve?.();
          });

          try {
            while (true) {
              if (pendings.length) {
                yield await pendings.shift()!;
              } else {
                await new Promise((r) => (resolve = r));
              }
            }
          } finally {
            pendings.length = 0;
            abort();
            resolve?.();
            resolve = undefined;
          }
        });
        return output;
      }
    }

    return new Stream<MAPPED>(async function* () {
      let currentState = initalState as STATE;
      for await (const value of stream) {
        const [mapped, state] = await (statefulMapper as map.StatefulMapper<VALUE, STATE, MAPPED>)(currentState, value);
        currentState = state;
        yield mapped;
      }
    });
  };
};

export namespace map {
  export type Options<ARGS = any> =
    | {
        execution?: "sequential" | "concurrent" | "concurrent-ordered" | "parallel" | "parallel-ordered";
        args?: never;
      }
    | {
        execution?: "parallel" | "parallel-ordered";
        args?: ARGS;
      };

  export type Mapper<VALUE = unknown, MAPPED = VALUE, ARGS = any> = (
    value: VALUE,
    args: ARGS,
  ) => MAPPED | Promise<MAPPED>;

  export type StatefulMapper<VALUE = unknown, STATE extends Record<string, unknown> = {}, MAPPED = VALUE> = (
    state: STATE,
    value: VALUE,
  ) => [MAPPED, STATE] | Promise<[MAPPED, STATE]>;

  export interface Map {
    <VALUE, MAPPED, ARGS>(
      mapper: Mapper<VALUE, MAPPED, ARGS>,
      options?: Options<ARGS>,
    ): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>>;
    //here we have not options because stateful operations mus be sequential
    <VALUE, STATE extends Record<string, unknown> = {}, MAPPED = VALUE>(
      initialState: STATE,
      mapper: StatefulMapper<VALUE, STATE, MAPPED>,
    ): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>>;
  }
}
