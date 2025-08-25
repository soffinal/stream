import { Stream } from "../stream.ts";

/**
 * Adaptive filter transformer that maintains state and can terminate streams.
 *
 * @template VALUE - The type of values flowing through the stream
 * @template STATE - The type of the internal state object
 *
 * @param initialState - Initial state object for the transformer
 * @param predicate - Function that determines if a value should pass through
 *   - Returns `[boolean, newState]` to continue with updated state
 *   - Returns `void` or `undefined` to terminate the stream
 *   - Can be async for complex filtering logic
 *
 * @returns A transformer function that can be used with `.pipe()`
 *
 * @example
 * // Simple filtering
 * stream.pipe(filter({}, (_, value) => [value > 0, {}]))
 *
 * @example
 * // Async filtering
 * stream.pipe(
 *   filter({}, async (_, value) => {
 *     const valid = await validate(value);
 *     return [valid, {}];
 *   })
 * )
 *
 * @example
 * // 📦 COPY-PASTE TRANSFORMER: simpleFilter() - Simple predicate filtering
 * const simpleFilter = <T>(predicate: (value: T) => boolean | Promise<boolean>) =>
 *   filter<T, {}>({}, async (_, value) => {
 *     const shouldPass = await predicate(value);
 *     return [shouldPass, {}];
 *   });
 *
 * @example
 * // 📦 COPY-PASTE TRANSFORMER: take(n) - Limit to N items
 * const take = <T>(n: number) =>
 *   filter<T, { count: number }>({ count: 0 }, (state, value) => {
 *     if (state.count >= n) return;
 *     return [true, { count: state.count + 1 }];
 *   });
 *
 * @example
 * // 📦 COPY-PASTE TRANSFORMER: skip(n) - Skip first N items
 * const skip = <T>(n: number) =>
 *   filter<T, { count: number }>({ count: 0 }, (state, value) => {
 *     const newCount = state.count + 1;
 *     return [newCount > n, { count: newCount }];
 *   });
 *
 * @example
 * // 📦 COPY-PASTE TRANSFORMER: distinct() - Remove duplicates
 * const distinct = <T>() =>
 *   filter<T, { seen: Set<T> }>({ seen: new Set() }, (state, value) => {
 *     if (state.seen.has(value)) return [false, state];
 *     state.seen.add(value);
 *     return [true, state];
 *   });
 *
 */
export function filter<VALUE, STATE extends Record<string, unknown> = {}>(
  initialState: STATE,
  predicate: (state: STATE, value: VALUE) => [boolean, STATE] | void | Promise<[boolean, STATE] | void>
): (stream: Stream<VALUE>) => Stream<VALUE> {
  return (stream: Stream<VALUE>): Stream<VALUE> =>
    new Stream<VALUE>(async function* () {
      let currentState = initialState;

      for await (const value of stream) {
        const result = await predicate(currentState, value);
        if (!result) return;
        const [emit, state] = result;
        currentState = state;
        if (emit) {
          yield value;
        }
      }
    });
}
