import { Stream } from "../../stream";
import { filter } from "../filter";
import { sequential } from "../sequential";
import { statefull } from "../statefull/statefull";

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
export const distinct =
  <T>(): Stream.Transformer<Stream<T>, Stream<T>> =>
  (source) => {
    return source
      .pipe(
        statefull({ seen: new Set() }, (state, value) => {
          if (state.seen.has(value)) return [[value, false as boolean], state] as const;
          state.seen.add(value);
          return [[value, true as boolean], state] as const;
        }),
      )
      .pipe(filter((v) => v[1]))
      .pipe(sequential((v) => v[0]));
  };

const s = new Stream<number>().pipe(distinct());
