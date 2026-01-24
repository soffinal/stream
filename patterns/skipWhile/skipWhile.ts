import { filter } from "../../src/transformers/filter";

/**
 * Skip while condition is true
 * 
 * @example
 * ```typescript
 * stream.pipe(skipWhile(n => n < 10))
 * ```
 */
export const skipWhile = <T>(predicate: (value: T) => boolean) =>
  filter<T, { skipping: boolean }>({ skipping: true }, (state, value) => {
    if (state.skipping && !predicate(value)) {
      return [true, { skipping: false }];
    }
    return [!state.skipping, state];
  });
