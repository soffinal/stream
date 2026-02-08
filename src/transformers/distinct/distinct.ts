import { Stream } from "../../stream";
import { filter } from "../filter";
import { sequential, map } from "../sequential";
import { statefull } from "../statefull";

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
export function distinct<VALUE>(): Stream.Transformer<Stream<VALUE>> {
  return function (source) {
    return new Stream((self) => {
      const seen = new Set<VALUE>();
      return source.listen((value) => {
        if (!seen.has(value)) {
          self.push(value);
          seen.add(value);
        }
      });
    });
  };
}
