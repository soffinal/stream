import { Stream } from "../../src/stream";

/**
 * Emit first value, then ignore until quiet period
 * 
 * @example
 * ```typescript
 * stream.pipe(audit(300)) // Emit first, ignore for 300ms
 * ```
 */
export const audit = <T>(ms: number) => (source: Stream<T>) => {
  const output = new Stream<T>(async function* () {
    let timer: any = null;
    let canEmit = true;

    for await (const value of source) {
      if (canEmit) {
        output.push(value);
        canEmit = false;
        clearTimeout(timer);
        timer = setTimeout(() => (canEmit = true), ms);
      }
    }
  });

  return output;
};
