import { Stream } from "../../stream";
import { filter } from "../filter";
import { sequential } from "../sequential";
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
export const distinctUntilChanged =
  <T>(): Stream.Transformer<Stream<T>, Stream<T>> =>
  (source) =>
    source
      .pipe(
        statefull({ prev: Symbol() as T }, (state, value) => {
          if (state.prev === value) return [[value, false as boolean], state] as const;
          return [[value, true as boolean], { prev: value }] as const;
        }),
      )
      .pipe(filter((t) => t[1]))
      .pipe(sequential((t) => t[0]));
