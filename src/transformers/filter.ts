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
 * @see {@link Stream} - Complete copy-paste transformers library
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
