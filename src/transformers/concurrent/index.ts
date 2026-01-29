import { Stream } from "../../stream";

export function concurrent<VALUE, MAPPED>(
  mapper: concurrent.Mapper<VALUE, MAPPED>,
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> {
  return (stream) => {
    return new Stream<MAPPED>(async function* () {
      const output = new Stream<MAPPED>();
      const abort = stream.listen(async (value) => {
        output.push(await mapper(value));
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

export namespace concurrent {
  export interface Mapper<VALUE, MAPPED> {
    (value: VALUE): MAPPED | Promise<MAPPED>;
  }
}
