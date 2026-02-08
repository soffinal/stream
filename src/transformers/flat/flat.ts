import { Stream } from "../../stream.ts";

export function flat<VALUE, DEPTH extends number = 0>(
  depth: DEPTH = 0 as DEPTH,
): Stream.Transformer<Stream<VALUE>, Stream<FlatArray<VALUE, DEPTH>>> {
  return (source) => {
    return new Stream(function (self) {
      return source.listen((value) => {
        if (Array.isArray(value)) {
          const values = value.flat(depth);
          for (let i = 0; i < values.length; i++) {
            self.push(values[i]!);
          }
        } else {
          self.push(value as FlatArray<VALUE, DEPTH>);
        }
      });
    });
  };
}
