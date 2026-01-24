import { Stream } from "../../src/stream";

/**
 * Emit error if no value received within time period
 * 
 * @example
 * ```typescript
 * stream.pipe(timeout(1000, new Error('Timeout')))
 * ```
 */
export const timeout = <T>(ms: number, error: Error = new Error('Timeout')) => (source: Stream<T>) =>
  new Stream<T>(async function* () {
    let timer: any = null;
    let timedOut = false;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        throw error;
      }, ms);
    };

    resetTimer();

    try {
      for await (const value of source) {
        if (timedOut) break;
        resetTimer();
        yield value;
      }
    } finally {
      clearTimeout(timer);
    }
  });
