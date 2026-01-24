import { filter } from "../../src/transformers/filter";

/**
 * Remove duplicate values (unbounded memory)
 * 
 * Warning: Stores all seen values in memory.
 * For bounded memory, use distinctUntilChanged().
 * 
 * @example
 * ```typescript
 * stream.pipe(distinct())
 * // [1, 2, 1, 3] → [1, 2, 3]
 * ```
 */
export const distinct = <T>() =>
  filter<T, { seen: Set<T> }>({ seen: new Set() }, (state, value) => {
    if (state.seen.has(value)) return [false, state];
    state.seen.add(value);
    return [true, state];
  });
