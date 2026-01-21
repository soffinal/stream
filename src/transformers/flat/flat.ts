import { Stream } from "../../stream.ts";

export function flat<VALUE, DEPTH extends number = 0>(
  depth: DEPTH = 0 as DEPTH,
): Stream.Transformer<Stream<VALUE>, Stream<FlatArray<VALUE, DEPTH>>> {
  return (stream: Stream<VALUE>): Stream<FlatArray<VALUE, DEPTH>> => {
    return new Stream<FlatArray<VALUE, DEPTH>>(async function* () {
      for await (const value of stream) {
        if (Array.isArray(value)) {
          const values = value.flat(depth);
          for (let i = 0; i < values.length; i++) {
            yield values[i]!;
          }
        } else {
          yield value as FlatArray<VALUE, DEPTH>;
        }
      }
    });
  };
}
