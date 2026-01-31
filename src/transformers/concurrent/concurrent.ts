import { Stream } from "../../stream";

export function concurrent<VALUE, MAPPED>(
  mapper: concurrent.Mapper<VALUE, MAPPED>,
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> {
  return (stream) => {
    return new Stream<MAPPED>(async function* () {
      const output = new Stream<MAPPED>();
      const ctr = stream.listen(async (value) => {
        output.push(await Promise.resolve().then(() => mapper(value)));
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

export namespace concurrent {
  export interface Mapper<VALUE, MAPPED> {
    (value: VALUE): MAPPED | Promise<MAPPED>;
  }
}
