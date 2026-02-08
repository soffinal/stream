import { Stream } from "../../stream";

/**
 * Delay each emission
 *
 * @example
 * ```typescript
 * stream.pipe(delay(1000))
 * ```
 */
export function delay<VALUE>(ms: number): Stream.Transformer<Stream<VALUE>> {
  return function (source) {
    return new Stream((self) => {
      return source.listen(async (value) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        self.push(value);
      });
    });
  };
}
