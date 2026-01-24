import { Stream } from "../../src/stream";

/**
 * Delay emissions until quiet period
 *
 * @example
 * ```typescript
 * stream.pipe(debounce(300))
 * ```
 */
export const debounce =
  <T>(ms: number) =>
  (source: Stream<T>) => {
    const output = new Stream<T>(async function* () {
      let timer: any = null;

      for await (const value of source) {
        clearTimeout(timer);
        timer = setTimeout(() => output.push(value), ms);
      }
    });

    return output;
  };
