import { Stream } from "../../stream";

/**
 * Emit values while predicate is true, stop when false
 *
 * @example
 * ```typescript
 * stream.pipe(takeWhile(x => x < 100))
 * // Emits values until one fails the predicate
 * ```
 */
export const takeWhile = <T>(
  predicate: (value: T, index: number) => boolean,
): Stream.Transformer<Stream<T>, Stream<T>> => {
  return (source) => {
    let index = 0;
    let terminated = false;
    return new Stream<T>(async function* () {
      if (terminated) return;
      try {
        for await (const value of source) {
          if (!predicate(value, index++)) break; // Stop when predicate fails
          yield value;
        }
      } finally {
        return;
      }
    });
  };
};
