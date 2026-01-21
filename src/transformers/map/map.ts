import { Stream } from "../../stream.ts";

export const map: map.Map = <VALUE, STATE extends Record<string, unknown>, MAPPED>(
  initialStateOrMapper: STATE | map.Mapper<VALUE, MAPPED>,
  statefulMapper?: map.StatefulMapper<VALUE, STATE, MAPPED> | map.Options,
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> => {
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
    value: VALUE,
  ) => [MAPPED, STATE] | Promise<[MAPPED, STATE]>;

  export interface Map {
    <VALUE, MAPPED>(
      mapper: Mapper<VALUE, MAPPED>,
      options?: Options,
    ): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>>;
    <VALUE, STATE extends Record<string, unknown> = {}, MAPPED = VALUE>(
      initialState: STATE,
      mapper: StatefulMapper<VALUE, STATE, MAPPED>,
    ): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>>;
  }
}
