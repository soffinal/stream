import { Stream } from "../../src/stream";

/**
 * Map to inner stream, cancel previous when new value arrives
 * 
 * @example
 * ```typescript
 * searchInput.pipe(switchMap(query => fetchResults(query)))
 * // New search cancels previous fetch
 * ```
 */
export const switchMap = <T, U>(project: (value: T) => Stream<U>) => (source: Stream<T>) => {
  const output = new Stream<U>(async function* () {
    let currentCleanup: (() => void) | null = null;

    for await (const value of source) {
      // Cancel previous stream
      if (currentCleanup) {
        currentCleanup();
      }

      // Start new stream
      const innerStream = project(value);
      currentCleanup = innerStream.listen((innerValue) => {
        output.push(innerValue);
      });
    }

    if (currentCleanup) {
      currentCleanup();
    }
  });

  return output;
};