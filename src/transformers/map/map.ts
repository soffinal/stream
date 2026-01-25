import { Stream } from "../../stream.ts";
import { WorkerPool } from "../../workerPool/workerPool.ts";

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

  return (stream: Stream<VALUE>): Stream<MAPPED> => {
    if (mapper) {
      const { execution, args } = options ?? {};
      const mapper = initialStateOrMapper as map.Mapper<VALUE, MAPPED, ARGS>;

      // Parallel (workers)
      if (execution === "parallel" || execution === "parallel-ordered") {
        if (typeof Worker === "undefined") {
          // Fallback to concurrent
          return execution === "parallel" ? concurrent() : concurrentOrdered();
        }

        if (execution === "parallel") {
          return new Stream<MAPPED>(async function* () {
            let queue = new Array<MAPPED>();
            let resolver: Function | undefined;

            const abort = stream.listen(async (value) => {
              const result = await WorkerPool.execute(mapper, value, args);
              queue.push(result);
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

        if (execution === "parallel-ordered") {
          return new Stream<MAPPED>(async function* () {
            for await (const value of stream) {
              yield await WorkerPool.execute(mapper, value, args);
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
          let queue = new Array<MAPPED>();
          let resolver: Function | undefined;

          const abort = stream.listen(async (value) => {
            queue.push(await mapper(value, args!));
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
      function concurrentOrdered() {
        return new Stream<MAPPED>(async function* () {
          let queue = new Array<MAPPED | Promise<MAPPED>>();
          let resolver: Function | undefined;

          const abort = stream.listen((value) => {
            const promise = mapper(value, args!);

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

    return new Stream<MAPPED>(async function* () {
      let currentState = initialStateOrMapper as STATE;
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

// const stream = new Stream<number>();

// const mapped = stream.pipe(map((v, d) => v.toFixed(), { execution: "parallel" }));
