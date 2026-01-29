import { Stream } from "../../stream.ts";

type ZipOutput<VALUE, STREAMS extends [Stream<any>, ...Stream<any>[]]> = [
  VALUE,
  ...{ [K in keyof STREAMS]: Stream.ValueOf<STREAMS[K]> },
];

export function zip<VALUE, STREAMS extends [Stream<any>, ...Stream<any>[]]>(
  ...streams: STREAMS
): Stream.Transformer<Stream<VALUE>, Stream<ZipOutput<VALUE, STREAMS>>> {
  return (source: Stream<VALUE>): Stream<ZipOutput<VALUE, STREAMS>> =>
    new Stream(async function* () {
      const iterators = [source, ...streams].map((s) => s[Symbol.asyncIterator]());

      try {
        while (true) {
          const results = await Promise.all(iterators.map((it) => it.next()));
          if (results.some((r) => r.done)) break;
          yield results.map((r) => r.value) as ZipOutput<VALUE, STREAMS>;
        }
      } finally {
        iterators.forEach((it) => it.return?.());
      }
    });
}
