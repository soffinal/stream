import { filter } from "../filter/filter";

/**
 * Take while condition is true
 *
 * @example
 * ```typescript
 * stream.pipe(takeWhile(n => n < 10))
 * ```
 */
export const takeWhile = <T>(predicate: (value: T) => boolean) =>
  filter<T, {}>({}, (_, value) => {
    if (!predicate(value)) return;
    return [true, {}];
  });
