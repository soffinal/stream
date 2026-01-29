import { map } from "../map";

/**
 * Accumulate values over time (like Array.reduce but emits each step)
 *
 * @example
 * ```typescript
 * stream.pipe(scan((sum, n) => sum + n, 0)) // Running sum
 * ```
 */
export const scan = <T, U>(fn: (acc: U, value: T) => U, initial: U) =>
  map<T, { acc: U }, U>({ acc: initial }, (state, value) => {
    const newAcc = fn(state.acc, value);
    return [newAcc, { acc: newAcc }];
  });
