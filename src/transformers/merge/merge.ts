import { Stream } from "../../stream.ts";

export function merge<VALUE, STREAM extends Stream<any>>(
  other: STREAM,
): Stream.Transformer<Stream<VALUE>, Stream<VALUE | Stream.ValueOf<STREAM>>> {
  return (source) =>
    new Stream<VALUE | Stream.ValueOf<STREAM>>((self) => {
      const controller = other.listen((value) => self.push(value));
      return source.listen((value) => self.push(value)).addCleanup(() => controller.abort());
    });
}
