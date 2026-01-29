import { filter } from "../filter/filter";

/**
 * Skip first N values
 *
 * @example
 * ```typescript
 * stream.pipe(skip(3))
 * ```
 */
export const skip = <T>(n: number) =>
  filter<T, { count: number }>({ count: 0 }, (state, value) => {
    const newCount = state.count + 1;
    return [newCount > n, { count: newCount }];
  });
