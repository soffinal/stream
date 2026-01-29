import { Stream } from "../../stream";
import { cache } from "../cache";
import { zip } from "../zip/zip";
import { merge } from "../merge";

/**
 * Sync latest from multiple streams
 *
 * @example
 * ```typescript
 * stream1.pipe(combineLatest(stream2))
 * ```
 */
export const combineLatest =
  <T, STREAMS extends [Stream<any>, ...Stream<any>[]]>(...streams: STREAMS) =>
  (source: Stream<T>) =>
    source.pipe(cache({ size: 1 })).pipe(zip(...streams.map((s) => s.pipe(cache({ size: 1 })))));
