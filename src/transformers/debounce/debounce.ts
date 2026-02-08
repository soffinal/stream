import { Stream } from "../../stream";

/**
 * Delay emissions until quiet period
 *
 * @example
 * ```typescript
 * stream.pipe(debounce(300))
 * ```
 */
export function debounce<VALUE>(ms: number): Stream.Transformer<Stream<VALUE>> {
  return function (source) {
    return new Stream((self) => {
      let timer: any = null;

      return source
        .listen((value) => {
          clearTimeout(timer);
          timer = setTimeout(() => self.push(value), ms);
        })
        .addCleanup(() => clearTimeout(timer));
    });
  };
}
