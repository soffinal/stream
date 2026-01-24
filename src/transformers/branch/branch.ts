import { Stream } from "../../stream";

/**
 * Forwards all values to a target stream while passing them through.
 * Creates a parallel branch for monitoring, logging, or side effects.
 *
 * @param target - Stream to forward values to
 * @returns Transformer that forwards values
 *
 * @example
 * ```typescript
 * const monitoring = new Stream<number>();
 *
 * const result = source
 *   .pipe(filter((n) => n > 0))
 *   .pipe(branch(monitoring)) // Branch off for monitoring
 *   .pipe(map((n) => n * 2));
 *
 * // Listen to branch
 * monitoring.listen(console.log);
 * ```
 */
export function branch<T>(target: Stream<T>): Stream.Transformer<Stream<T>, Stream<T>> {
  return (source: Stream<T>): Stream<T> => {
    return new Stream<T>(async function* () {
      for await (const value of source) {
        target.push(value);
        yield value;
      }
    });
  };
}
