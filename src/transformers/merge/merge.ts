import { Stream } from "../../stream.ts";

export function merge<VALUE, STREAMS extends [Stream<any>, ...Stream<any>[]]>(
  ...streams: STREAMS
): Stream.Transformer<Stream<VALUE>, Stream<VALUE | Stream.ValueOf<STREAMS[number]>>> {
  return (stream: Stream<VALUE>): Stream<VALUE | Stream.ValueOf<STREAMS[number]>> =>
    new Stream<VALUE | Stream.ValueOf<STREAMS[number]>>(async function* () {
      const allStreams = [stream, ...streams];
      const queue: (VALUE | Stream.ValueOf<STREAMS[number]>)[] = [];
      let resolver: Function | undefined;

      const cleanups = allStreams.map((s) =>
        s.listen((value) => {
          queue.push(value);
          resolver?.();
        }),
      );

      try {
        while (true) {
          if (queue.length) {
            yield queue.shift()!;
          } else {
            await new Promise((resolve) => (resolver = resolve));
          }
        }
      } finally {
        cleanups.forEach((cleanup) => cleanup());
      }
    });
}
