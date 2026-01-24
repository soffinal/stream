import { Stream } from "../../src/stream";
import { cache, type CacheOptions } from "../../src/transformers/cache/cache";

/**
 * Replay pattern: Cache + replay to all listeners
 *
 * @example
 * ```typescript
 * const events = stream.pipe(replay({ maxSize: 10 }));
 *
 * stream.push(1, 2, 3);
 *
 * // Late subscriber gets cached values
 * events.listen(console.log); // Logs: 1, 2, 3
 * ```
 */
export function replay<T>(options?: CacheOptions<T>): Stream.Transformer<Stream<T>, Stream<T>> {
  return (source: Stream<T>) => {
    const cached = source.pipe(cache(options));

    // Override listen to emit cache first
    const originalListen = cached.listen.bind(cached);
    cached.listen = ((listener: (value: T) => void, context?: any) => {
      cached.cache.values.forEach((v) => listener(v));
      return originalListen(listener, context);
    }) as typeof cached.listen;

    return cached;
  };
}
