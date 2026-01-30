import { Stream } from "../../stream";

/**
 * Take until notifier stream emits
 *
 * @example
 * ```typescript
 * stream.pipe(takeUntil(stopSignal))
 * ```
 */
export function takeUntil<T>(notifier: AbortSignal): Stream.Transformer<Stream<T>, Stream<T>>;
export function takeUntil<T>(notifier: object): Stream.Transformer<Stream<T>, Stream<T>>;
export function takeUntil<T>(notifier: Stream): Stream.Transformer<Stream<T>, Stream<T>>;
export function takeUntil<T>(notifier: AbortSignal | object | Stream): Stream.Transformer<Stream<T>, Stream<T>> {
  return (source) =>
    new Stream<T>(async function* () {
      const output = new Stream<T>();
      const controller = source.listen(output.push.bind(output), notifier);

      try {
        for await (const value of output) {
          if (controller.aborted) break;
          yield value;
        }
      } finally {
        controller.abort();
      }
    });
}
