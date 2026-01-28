import { Stream } from "../../stream";

/**
 * Temporarily HOT transformer that captures values pushed before listener is added.
 *
 * **Two phases:**
 * 1. HOT phase (first microtask): Captures all values pushed synchronously
 * 2. COLD phase (after first microtask): Becomes direct passthrough
 *
 * @see {@link https://github.com/soffinal/stream/blob/main/src/transformers/microbatch/microbatch.md} - Full documentation
 *
 * @example
 * ```typescript
 * const source = new Stream<number>();
 * const batched = source.pipe(microbatch());
 *
 * // Push before listener exists
 * source.push(1, 2, 3);
 *
 * // Listener receives all values
 * batched.listen(v => console.log(v)); // 1, 2, 3
 * ```
 *
 * @example
 * ```typescript
 * // Initialization pattern
 * const config = new Stream<Config>();
 * const settings = config.pipe(microbatch());
 *
 * config.push({ theme: 'dark' });
 * config.push({ lang: 'en' });
 *
 * settings.listen(cfg => applyConfig(cfg));
 * ```
 */
export function microbatch<T>(): Stream.Transformer<Stream<T>, Stream<T>> {
  return function (stream: Stream<T>): Stream<T> {
    const queue: T[] = [];

    const output = new Stream<T>();

    // HOT phase: Listen immediately to capture early pushes
    let abort = stream.listen((value) => {
      queue.push(value);
    });

    // Abort HOT listener after first microtask
    queueMicrotask(() => {
      abort();
      if (queue.length) {
        output.push(...(queue as [T, ...T[]]));
        queue.length = 0;
      }
    });

    // COLD phase: Direct passthrough after HOT phase
    return new Stream<T>(async function* () {
      const abort = stream.listen((value) => output.push(value));
      try {
        for await (const value of output) {
          yield value;
        }
      } finally {
        abort();
      }
    });
  };
}
