import { Stream } from "../stream.ts";
import { map } from "./map.ts";

/**
 * Flatten arrays in a stream, converting 1 array event into N individual events.
 *
 * @template VALUE - The type of values in the stream (should be arrays)
 * @template DEPTH - The depth of flattening (0 = one level, 1 = two levels, etc.)
 *
 * @param depth - How many levels deep to flatten (default: 0 = one level)
 *
 * @returns A transformer that flattens array values into individual events
 *
 * @see {@link Stream} - Complete copy-paste transformers library
 *
 * @example
 * // Basic flattening - 1 array → N events
 * const arrayStream = new Stream<number[]>();
 * const individualNumbers = arrayStream.pipe(flat());
 *
 * arrayStream.push([1, 2, 3]); // Emits: 1, 2, 3 as separate events
 *
 * @example
 * // Deep flattening
 * const deepArrays = new Stream<number[][]>();
 * const flattened = deepArrays.pipe(flat(1)); // Flatten 2 levels
 *
 * deepArrays.push([[1, 2], [3, 4]]);
 * // Emits: 1, 2, 3, 4 as separate events
 *
 */
export function flat<VALUE, DEPTH extends number = 0>(
  depth: DEPTH = 0 as DEPTH
): (stream: Stream<VALUE>) => Stream<FlatArray<VALUE, DEPTH>> {
  return (stream: Stream<VALUE>): Stream<FlatArray<VALUE, DEPTH>> => {
    return new Stream<FlatArray<VALUE, DEPTH>>(async function* () {
      for await (const value of stream) {
        if (Array.isArray(value)) {
          const values = value.flat(depth);
          for (let i = 0; i < values.length; i++) {
            yield values[i]!;
          }
        } else {
          yield value as FlatArray<VALUE, DEPTH>;
        }
      }
    });
  };
}
