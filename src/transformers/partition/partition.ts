import { filter } from "../filter/filter";
import { Stream } from "../../stream";

/**
 * Partition into two streams
 *
 * @example
 * ```typescript
 * const [evens, odds] = stream.pipe(partition(n => n % 2 === 0))
 * ```
 */
export const partition =
  <T>(predicate: (value: T) => boolean) =>
  (source: Stream<T>) => {
    const pass = source.pipe(filter(predicate));
    const fail = source.pipe(filter((v) => !predicate(v)));
    return [pass, fail] as const;
  };
