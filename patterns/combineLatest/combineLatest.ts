import { Stream } from "../../src/stream";
import { cache } from "../../src/transformers/cache";
import { zip } from "../../src/transformers/zip";

/**
 * Sync latest from multiple streams
 * 
 * @example
 * ```typescript
 * stream1.pipe(combineLatest(stream2))
 * ```
 */
export const combineLatest = <T, U>(other: Stream<U>) => (source: Stream<T>) =>
  source.pipe(cache({ maxSize: 1 })).pipe(zip(other.pipe(cache({ maxSize: 1 }))));
