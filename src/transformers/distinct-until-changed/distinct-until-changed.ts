import { Stream } from "../../stream";
import { filter } from "../filter";
import { sequential } from "../sequential/sequential";
import { statefull } from "../statefull";

/**
 * Remove consecutive duplicate values (O(1) memory)
 *
 * @example
 * ```typescript
 * stream.pipe(distinctUntilChanged())
 * // [1, 1, 2, 2, 1] → [1, 2, 1]
 * ```
 */

export function distinctUntilChanged<VALUE>(): Stream.Transformer<Stream<VALUE>> {
  return function (source) {
    return new Stream((self) => {
      let prev = Symbol() as VALUE;

      return source.listen((value) => {
        if (prev === value) return;
        prev = value;
        self.push(value);
      });
    });
  };
}
