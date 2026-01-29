import { map } from "../map";

/**
 * Emit array of last N values (sliding window)
 *
 * @example
 * ```typescript
 * stream.pipe(history(3))
 * // 1 → [1]
 * // 2 → [1, 2]
 * // 3 → [1, 2, 3]
 * // 4 → [2, 3, 4]
 * ```
 */
export const history = <T>(size: number) =>
  map<T, { window: T[] }, T[]>({ window: [] }, (state, value) => {
    const newWindow = [...state.window, value].slice(-size);
    return [newWindow, { window: newWindow }];
  });
