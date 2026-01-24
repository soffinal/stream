import { filter } from "../../src/transformers/filter";

/**
 * Take first N values
 * 
 * @example
 * ```typescript
 * stream.pipe(take(5))
 * ```
 */
export const take = <T>(n: number) =>
  filter<T, { count: number }>({ count: 0 }, (state, value) => {
    if (state.count >= n) return;
    return [true, { count: state.count + 1 }];
  });
