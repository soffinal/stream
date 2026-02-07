import { Stream } from "../../stream";

/**
 * Sync latest from multiple streams
 *
 * @example
 * ```typescript
 * stream1.pipe(combineLatest(stream2))
 * ```
 */
export function combineLatest<VALUE, STREAMS extends [Stream<any>, ...Stream<any>[]]>(
  ...streams: STREAMS
): Stream.Transformer<Stream<VALUE>, Stream<[VALUE, ...{ [K in keyof STREAMS]: Stream.ValueOf<STREAMS[K]> }]>> {
  return function (source) {
    return new Stream((self) => {
      const latest = new Array(streams.length + 1) as [VALUE, ...{ [K in keyof STREAMS]: Stream.ValueOf<STREAMS[K]> }];
      const hasValue: boolean[] = new Array(streams.length + 1).fill(false);

      const controllers = [source, ...streams].map((stream, i) =>
        stream.listen((value) => {
          latest[i] = value;
          hasValue[i] = true;
          if (hasValue.every(Boolean)) {
            self.push([...latest]);
          }
        }),
      );

      return new Stream.Controller(() => controllers.forEach((controller) => controller.abort()));
    });
  };
}
