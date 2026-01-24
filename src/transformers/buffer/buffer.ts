import { Stream } from "../../stream.ts";

export function buffer<T>(size: number): Stream.Transformer<Stream<T>, Stream<T[]>> {
  return (source: Stream<T>): Stream<T[]> => {
    return new Stream<T[]>(async function* () {
      const buf: T[] = [];

      for await (const value of source) {
        buf.push(value);
        if (buf.length >= size) {
          yield [...buf];
          buf.length = 0;
        }
      }
    });
  };
}
