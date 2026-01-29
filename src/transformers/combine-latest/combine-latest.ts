import { Stream } from "../../stream";

/**
 * Sync latest from multiple streams
 *
 * @example
 * ```typescript
 * stream1.pipe(combineLatest(stream2))
 * ```
 */
export const combineLatest =
  <T, STREAMS extends [Stream<any>, ...Stream<any>[]]>(...streams: STREAMS) =>
  (source: Stream<T>) => {
    return new Stream(async function* () {
      const latest: any[] = new Array(streams.length + 1);
      const hasValue: boolean[] = new Array(streams.length + 1).fill(false);
      const output = new Stream<any>();

      const cleanups = [source, ...streams].map((stream, i) =>
        stream.listen((value) => {
          latest[i] = value;
          hasValue[i] = true;
          if (hasValue.every(Boolean)) {
            output.push([...latest]);
          }
        }),
      );

      try {
        for await (const value of output) {
          yield value;
        }
      } finally {
        // cleanup0();
        cleanups.forEach((c) => c());
      }
    });
  };
