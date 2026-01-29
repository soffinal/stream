import { Stream } from "../../stream";

/**
 * Map to inner stream, cancel previous when new value arrives
 *
 * @example
 * ```typescript
 * searchInput.pipe(switchMap(query => fetchResults(query)))
 * // New search cancels previous fetch
 * ```
 */
export const switchMap =
  <T, U>(project: (value: T) => Stream<U>) =>
  (source: Stream<T>) => {
    return new Stream<U>(async function* () {
      let currentCleanup: (() => void) | null = null;

      const output = new Stream<U>();

      const abort = source.listen((value) => {
        // Cancel previous stream
        if (currentCleanup) {
          currentCleanup();
        }

        // Start new stream
        currentCleanup = project(value).listen((innerValue) => {
          output.push(innerValue);
        });
      });

      try {
        for await (const value of output) {
          yield value;
        }
      } finally {
        abort();
        currentCleanup!?.();
        currentCleanup = null;
      }
    });
  };
