import { filter } from "../../src/transformers/filter";

/**
 * Remove consecutive duplicate values (O(1) memory)
 * 
 * @example
 * ```typescript
 * stream.pipe(distinctUntilChanged())
 * // [1, 1, 2, 2, 1] → [1, 2, 1]
 * ```
 */
export const distinctUntilChanged = <T>() =>
  filter<T, { prev: T | symbol }>({ prev: Symbol() }, (state, value) => {
    if (state.prev === value) return [false, state];
    return [true, { prev: value }];
  });
