import { Stream } from "../../stream";
import { WorkerPool } from "../../workerPool/workerPool";
import { concurrentOrdered } from "../concurrent-ordered/concurrent-ordered";

export function parallelOrdered<VALUE, MAPPED, ARGS extends any[]>(
  mapper: parallelOrdered.Mapper<VALUE, MAPPED, ARGS>,
  ...args: ARGS
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> {
  if (typeof Worker === "undefined")
    return concurrentOrdered(mapper as unknown as concurrentOrdered.Mapper<VALUE, MAPPED>);

  return (stream) => {
    return new Stream<MAPPED>(async function* () {
      const { execute } = WorkerPool.register(mapper, ...args);

      const output = new Stream<MAPPED | Promise<MAPPED>>();
      const abort = stream.listen(async (value) => {
        output.push(execute(value));
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

export namespace parallelOrdered {
  export type Mapper<VALUE, MAPPED, ARGS extends any[]> = (value: VALUE, ...args: ARGS) => MAPPED | Promise<MAPPED>;
}
