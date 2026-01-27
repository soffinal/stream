import { Stream } from "../../src/stream";

/**
 * Emit first value, then ignore until quiet period
 *
 * @example
 * ```typescript
 * stream.pipe(audit(300)) // Emit first, ignore for 300ms
 * ```
 */
export const audit =
  <T>(ms: number): Stream.Transformer<Stream<T>, Stream<T>> =>
  (source: Stream<T>) => {
    return new Stream<T>(async function* (self) {
      let timer: any = null;
      let canEmit = true;

      for await (const value of source) {
        if (!self.hasListeners) {
          clearTimeout(timer);
          break;
        }
        if (canEmit) {
          self.push(value);
          canEmit = false;
          clearTimeout(timer);
          timer = setTimeout(() => (canEmit = true), ms);
        }
      }
    });
  };
