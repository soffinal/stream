import { Stream } from "../../stream.ts";

export function buffer<T>(size: number): Stream.Transformer<Stream<T>, Stream<T[]>> {
  return function (source) {
    return new Stream<T[]>((self) => {
      const buf: T[] = [];
      return source
        .listen((value) => {
          buf.push(value);
          if (buf.length >= size) {
            self.push([...buf]);
            buf.length = 0;
          }
        })
        .addCleanup(() => (buf.length = 0));
    });
  };
}
