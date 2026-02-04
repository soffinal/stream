import { Stream } from "../../stream";
import { WorkerPool } from "../../workerPool/workerPool";
import { statefull } from "../statefull/statefull";

export function statefullWorker<VALUE, STATE extends Record<string, unknown>, MAPPED, ARGS extends any[]>(
  initialState: STATE,
  mapper: statefullWorker.Mapper<VALUE, STATE, MAPPED, ARGS>,
  ...args: ARGS
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> {
  if (typeof Worker === "undefined")
    return statefull(initialState, mapper as unknown as statefull.Mapper<VALUE, STATE, MAPPED>);

  return (stream) => {
    return new Stream<MAPPED>(async function* () {
      const { execute } = WorkerPool.register(
        (value: { state: STATE; value: VALUE }, args: ARGS) => {
          const [mapped, newState] = args[0](value.state, value.value, ...args.slice(1));
          return { mapped, state: newState };
        },
        [mapper, ...args],
      );

      let currentState = initialState;

      try {
        for await (const value of stream) {
          const result = await execute({ state: currentState, value });
          currentState = result.state;
          yield result.mapped;
        }
      } finally {
        return;
      }
    });
  };
}

export namespace statefullWorker {
  export type Mapper<VALUE, STATE extends Record<string, unknown>, MAPPED, ARGS extends any[]> = (
    state: STATE,
    value: VALUE,
    ...args: ARGS
  ) => [MAPPED, STATE] | Promise<[MAPPED, STATE]>;
}
