import { Stream } from "../../stream";
import { WorkerPool } from "../../workerPool/workerPool";
import { sequential } from "../sequential/sequential";

export function sequentialWorker<VALUE, MAPPED, ARGS extends any[]>(
  mapper: sequentialWorker.Mapper<VALUE, MAPPED, ARGS>,
  ...args: ARGS
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> {
  if (typeof Worker === "undefined") return sequential(mapper as unknown as sequential.Mapper<VALUE, MAPPED>);

  return (stream) => {
    return new Stream<MAPPED>(async function* () {
      const { execute } = WorkerPool.register(mapper, args);

      try {
        for await (const value of stream) {
          yield await execute(value);
        }
      } finally {
        return;
      }
    });
  };
}

export namespace sequentialWorker {
  export type Mapper<VALUE, MAPPED, ARGS extends any[]> = (value: VALUE, ...args: ARGS) => MAPPED | Promise<MAPPED>;
}
