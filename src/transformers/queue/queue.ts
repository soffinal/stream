import { Stream } from "../../stream";
import { cache } from "../cache";

/**
 * HOT transformer that provides a consumable cache.
 *
 * Values are removed from the queue as they're iterated, making it perfect for
 * producer/consumer patterns and async buffering.
 *
 * @see {@link https://github.com/soffinal/stream/blob/main/src/transformers/queue/queue.md} - Full documentation
 *
 * @example
 * ```typescript
 * const source = new Stream<Task>();
 * const tasks = source.pipe(queue({ maxSize: 100 }));
 *
 * // Producer
 * source.push({ id: 1, work: 'process' });
 *
 * // Consumer (values are removed as consumed)
 * for await (const task of tasks) {
 *   await processTask(task);
 *   console.log('Queue size:', tasks.cache.values.length);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Bounded buffer with backpressure monitoring
 * const events = source.pipe(queue({ maxSize: 1000, dropStrategy: 'oldest' }));
 *
 * setInterval(() => {
 *   const size = events.cache.values.length;
 *   if (size > 800) console.warn('Queue nearly full!');
 * }, 1000);
 * ```
 */
export function queue<T>(options?: queue.Options<T>): Stream.Transformer<Stream<T>, queue.Queue<T>> {
  return (stream: Stream<T>): queue.Queue<T> => {
    const cached = stream.pipe(cache(options));

    const output = new Stream<T>(async function* () {
      try {
        while (true) {
          // Wait for values
          if (cached.cache.values.length === 0) await cached;

          // Consume (shift) values
          while (cached.cache.values.length) {
            const value = cached.cache.values.shift()!;
            yield value;
          }
        }
      } finally {
        return;
      }
    });

    // Expose cache API
    Object.defineProperty(output, "cache", {
      get() {
        return cached.cache;
      },
      enumerable: true,
      configurable: false,
    });

    return output as queue.Queue<T>;
  };
}

export namespace queue {
  export type Options<T> = cache.Options<T>;
  export type Queue<T> = cache.Cache<T>;
}
