import { Stream } from "../../src/stream";

/**
 * Take until notifier stream emits
 * 
 * @example
 * ```typescript
 * stream.pipe(takeUntil(stopSignal))
 * ```
 */
export const takeUntil = <T>(notifier: Stream<any>) => (source: Stream<T>) =>
  new Stream<T>(async function* () {
    let stopped = false;
    notifier.listen(() => (stopped = true));
    for await (const value of source) {
      if (stopped) break;
      yield value;
    }
  });
