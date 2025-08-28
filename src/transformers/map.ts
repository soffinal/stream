import { State } from "../reactive/state.ts";
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
 * @see {@link Stream} - Complete copy-paste transformers library
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
