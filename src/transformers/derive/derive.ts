import { Stream } from "../../stream";

export function derive<VALUE>(): Stream.Transformer<Stream<VALUE>> {
  return function (source) {
    return new Stream<VALUE>((self) => {
      return source.listen((v) => self.push(v));
    });
  };
}
