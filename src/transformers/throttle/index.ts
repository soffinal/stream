import { filter } from "../filter/filter";

/**
 * Rate limit emissions - emit at most once per time period
 *
 * @example
 * ```typescript
 * stream.pipe(throttle(1000)) // Max one value per second
 * ```
 */
export const throttle = <T>(ms: number) =>
  filter<T, { lastEmit: number }>({ lastEmit: 0 }, (state, value) => {
    const now = Date.now();
    if (now - state.lastEmit < ms) return [false, state];
    return [true, { lastEmit: now }];
  });
