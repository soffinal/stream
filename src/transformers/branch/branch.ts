import { Stream } from "../../stream";
import { merge } from "../merge";

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
export function branch<T>(target: Stream<T>): Stream.Transformer<Stream<T>> {
  return function (source) {
    const oldSource = target.getSource();
    target.setSource(oldSource ? source.pipe(merge(oldSource)) : source);

    return new Stream<T>(async function* () {
      try {
        yield* source;
      } finally {
        return;
      }
    });
  };
}
