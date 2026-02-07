import { Stream } from "../../stream";

/**
 * Emit first value, then ignore until quiet period
 *
 * @example
 * ```typescript
 * stream.pipe(audit(300)) // Emit first, ignore for 300ms
 * ```
 */

export function audit<T>(ms: number): Stream.Transformer<Stream<T>> {
  return (source) =>
    new Stream<T>((self) => {
      let timer: any = null;
      let canEmit = true;

      return source
        .listen((value) => {
          if (canEmit) {
            self.push(value);
            canEmit = false;
            clearTimeout(timer);
            timer = setTimeout(() => (canEmit = true), ms!);
          }
        })
        .addCleanup(() => clearTimeout(timer));
    });
}
