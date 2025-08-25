import { Stream } from "../stream.ts";

/**
 * Adaptive map transformer that transforms values while maintaining state.
 *
 * @template VALUE - The type of input values
 * @template STATE - The type of the internal state object
 * @template MAPPED - The type of output values after transformation
 *
 * @param initialState - Initial state object for the transformer
 * @param predicate - Function that transforms values and updates state
 *   - Must return `[transformedValue, newState]`
 *   - Can be async for complex transformations
 *   - Preserves order even with async operations
 *
 * @returns A transformer function that can be used with `.pipe()`
 *
 * @example
 * // Simple transformation
 * stream.pipe(map({}, (_, value) => [value * 2, {}]))
 *
 * @example
 * // Async transformation
 * stream.pipe(
 *   map({}, async (_, value) => {
 *     const result = await process(value);
 *     return [result, {}];
 *   })
 * )
 *
 * @example
 * // 📦 COPY-PASTE TRANSFORMER: simpleMap() - Simple transformation
 * const simpleMap = <T, U>(fn: (value: T) => U | Promise<U>) =>
 *   map<T, {}, U>({}, async (_, value) => {
 *     const result = await fn(value);
 *     return [result, {}];
 *   });
 *
 * @example
 * // 📦 COPY-PASTE TRANSFORMER: withIndex() - Add index to values
 * const withIndex = <T>() =>
 *   map<T, { index: number }, { value: T; index: number }>(
 *     { index: 0 },
 *     (state, value) => [
 *       { value, index: state.index },
 *       { index: state.index + 1 }
 *     ]
 *   );
 *
 * @example
 * // 📦 COPY-PASTE TRANSFORMER: delay(ms) - Delay each value
 * const delay = <T>(ms: number) =>
 *   map<T, {}, T>({}, async (_, value) => {
 *     await new Promise(resolve => setTimeout(resolve, ms));
 *     return [value, {}];
 *   });
 *
 * @example
 * // 📦 COPY-PASTE TRANSFORMER: pluck(key) - Extract property
 * const pluck = <T, K extends keyof T>(key: K) =>
 *   map<T, {}, T[K]>({}, (_, value) => [value[key], {}]);
 *
 */
export function map<VALUE, STATE extends Record<string, unknown>, MAPPED>(
  initialState: STATE,
  predicate: (state: STATE, value: VALUE) => [MAPPED, STATE] | Promise<[MAPPED, STATE]>
): (stream: Stream<VALUE>) => Stream<MAPPED> {
  return (stream: Stream<VALUE>): Stream<MAPPED> =>
    new Stream<MAPPED>(async function* () {
      let currentState = initialState;
      for await (const value of stream) {
        const [mapped, state] = await predicate(currentState, value);
        currentState = state;
        yield mapped;
      }
    });
}
