import { Stream } from "../../stream";

/**
 * Emit first value, then ignore until quiet period
 *
 * @example
 * ```typescript
 * stream.pipe(audit(300)) // Emit first, ignore for 300ms
 * ```
 */
export function audit<T>(ms: number): Stream.Transformer<Stream<T>, Stream<T>> {
  return function (source) {
    return new Stream<T>(async function* () {
      let timer: any = null;
      let canEmit = true;

      try {
        for await (const value of source) {
          if (canEmit) {
            yield value;
            canEmit = false;
            clearTimeout(timer);
            timer = setTimeout(() => (canEmit = true), ms);
          }
        }
      } finally {
        clearTimeout(timer);
      }
    });
  };
}
