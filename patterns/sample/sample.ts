import { Stream } from "../../src/stream";

/**
 * Sample on another stream
 * 
 * @example
 * ```typescript
 * stream.pipe(sample(ticker))
 * ```
 */
export const sample = <T>(sampler: Stream<any>) => (source: Stream<T>) =>
  new Stream<T>(async function* () {
    let latest: T | undefined;
    let hasValue = false;
    source.listen((value) => {
      latest = value;
      hasValue = true;
    });
    for await (const _ of sampler) {
      if (hasValue) {
        yield latest!;
        hasValue = false;
      }
    }
  });
