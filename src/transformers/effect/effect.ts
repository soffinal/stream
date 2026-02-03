import { Stream } from "../../stream.ts";

export function effect<INPUT extends Stream<any>>(
  callback: (value: Stream.ValueOf<INPUT>) => void,
): Stream.Transformer<INPUT, Stream<Stream.ValueOf<INPUT>>> {
  return (stream) => {
    return new Stream<Stream.ValueOf<INPUT>>(async function* () {
      try {
        for await (const value of stream) {
          callback(value);
          yield value;
        }
      } finally {
        return;
      }
    });
  };
}
