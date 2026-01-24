import { Stream } from "../../src/stream";

/**
 * Collect values into time-based windows
 *
 * @example
 * ```typescript
 * stream.pipe(window(1000)) // Emit array every 1 second
 * ```
 */
export const window =
  <T>(ms: number) =>
  (source: Stream<T>) => {
    const output = new Stream<T[]>(async function* () {
      let buffer: T[] = [];
      let timer: any = null;

      const flush = () => {
        if (buffer.length > 0) {
          output.push([...buffer]);
          buffer = [];
        }
      };

      timer = setInterval(flush, ms);

      for await (const value of source) {
        buffer.push(value);
      }

      clearInterval(timer);
      flush(); // Emit remaining values
    });

    return output;
  };
