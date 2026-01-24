import { Stream } from "../../stream.ts";

export function zip<VALUE, STREAMS extends [Stream<any>, ...Stream<any>[]]>(
  ...streams: STREAMS
): Stream.Transformer<Stream<VALUE>, Stream<[VALUE, ...{ [K in keyof STREAMS]: Stream.ValueOf<STREAMS[K]> }]>> {
  return (source: Stream<VALUE>): Stream<[VALUE, ...{ [K in keyof STREAMS]: Stream.ValueOf<STREAMS[K]> }]> =>
    new Stream(async function* () {
      const allStreams = [source, ...streams];
      const iterators = allStreams.map((s) => s[Symbol.asyncIterator]());

      try {
        while (true) {
          const results = await Promise.all(iterators.map((it) => it.next()));
          if (results.some((r) => r.done)) break;
          yield results.map((r) => r.value) as [VALUE, ...{ [K in keyof STREAMS]: Stream.ValueOf<STREAMS[K]> }];
        }
      } finally {
        iterators.forEach((it) => it.return?.());
      }
    });
}
