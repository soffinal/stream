import { Stream } from "../../stream";

export function concurrentOrdered<VALUE, MAPPED>(
  mapper: concurrentOrdered.Mapper<VALUE, MAPPED>,
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> {
  return (stream) => {
    return new Stream<MAPPED>(async function* () {
      const output = new Stream<MAPPED | Promise<MAPPED>>();
      const ctr = stream.listen(async (value) => {
        output.push(Promise.resolve().then(() => mapper(value)));
      });

      try {
        for await (const mapped of output) {
          yield mapped;
        }
      } finally {
        ctr.abort();
        return;
      }
    });
  };
}

export namespace concurrentOrdered {
  export type Mapper<VALUE, MAPPED> = (value: VALUE) => MAPPED | Promise<MAPPED>;
}
