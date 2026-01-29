import { Stream } from "../../stream";

/**
 * Delay emissions until quiet period
 *
 * @example
 * ```typescript
 * stream.pipe(debounce(300))
 * ```
 */
export const debounce =
  <T>(ms: number): Stream.Transformer<Stream<T>, Stream<T>> =>
  (source: Stream<T>) => {
    return new Stream<T>(async function* () {
      let timer: any = null;

      const output = new Stream<T>();
      const abort = source.listen((value) => {
        clearTimeout(timer);
        timer = setTimeout(() => output.push(value), ms);
      });

      try {
        for await (const value of output) {
          yield value;
        }
      } finally {
        abort();
      }
    });
  };
