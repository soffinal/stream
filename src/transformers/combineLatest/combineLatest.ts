import { Stream } from "../../stream";
import { cache } from "../cache";
import { zip } from "../zip";

/**
 * Sync latest from multiple streams
 *
 * @example
 * ```typescript
 * stream1.pipe(combineLatest(stream2))
 * ```
 */
export const combineLatest =
  <T, U>(other: Stream<U>) =>
  (source: Stream<T>) =>
    source.pipe(cache({ size: 1 })).pipe(zip(other.pipe(cache({ size: 1 }))));
