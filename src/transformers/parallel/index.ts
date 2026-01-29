import { Stream } from "../../stream";
import { WorkerPool } from "../../workerPool/workerPool";
import { concurrent } from "../concurrent";

export function parallel<VALUE, MAPPED, ARGS extends any[]>(
  mapper: parallel.Mapper<VALUE, MAPPED, ARGS>,
  ...args: ARGS
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> {
  if (typeof Worker === "undefined") return concurrent(mapper as unknown as concurrent.Mapper<VALUE, MAPPED>);

  return (stream) => {
    return new Stream<MAPPED>(async function* () {
      const { execute } = WorkerPool.register(mapper, args);

      const output = new Stream<MAPPED>();
      const abort = stream.listen(async (value) => {
        output.push(await execute(value));
      });

      try {
        for await (const mapped of output) {
          yield mapped;
        }
      } finally {
        abort();
        return;
      }
    });
  };
}

export namespace parallel {
  export type Mapper<VALUE, MAPPED, ARGS extends any[]> = (value: VALUE, ...args: ARGS) => MAPPED | Promise<MAPPED>;
}
