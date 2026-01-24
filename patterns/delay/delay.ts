import { Stream } from "../../src/stream";

/**
 * Delay each emission
 * 
 * @example
 * ```typescript
 * stream.pipe(delay(1000))
 * ```
 */
export const delay = <T>(ms: number) => (source: Stream<T>) =>
  new Stream<T>(async function* () {
    for await (const value of source) {
      await new Promise(resolve => setTimeout(resolve, ms));
      yield value;
    }
  });
