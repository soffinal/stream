import { Stream } from "../../stream";
import { map } from "../sequential";

/**
 * Emit first value, then ignore until quiet period
 *
 * @example
 * ```typescript
 * stream.pipe(audit(300)) // Emit first, ignore for 300ms
 * ```
 */

export function audit<T>(ms: number): Stream.Transformer<Stream<T>, Stream<T>> {
  return function (source: Stream<T>) {
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

const s = new Stream<number>().pipe(map((v) => v.toFixed()));
const s2 = new Stream<number>().pipe(audit2, 6);

function audit2<T>(source: Stream<T>, ms: number) {
  return audit<T>(ms)(source);
}
