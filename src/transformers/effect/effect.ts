import { Stream } from "../../stream.ts";

export function effect<INPUT extends Stream<any>>(
  callback: (value: Stream.ValueOf<INPUT>) => void,
): Stream.Transformer<INPUT, Stream<Stream.ValueOf<INPUT>>> {
  return (source) => {
    return new Stream(function (self) {
      return source.listen((value) => {
        callback(value);
        self.push(value);
      });
    });
  };
}
