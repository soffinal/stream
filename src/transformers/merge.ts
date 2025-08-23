import { Stream } from "../stream.ts";

export const merge: merge.Transformer =
  <STREAMS extends [Stream<any>, ...Stream<any>[]]>(...streams: STREAMS) =>
  <VALUE>(stream: Stream<VALUE>): Stream<VALUE | merge.ValueOf<STREAMS[number]>> =>
    new Stream<VALUE | merge.ValueOf<STREAMS[number]>>(async function* () {
      const allStreams = [stream, ...streams];
      const queue: (VALUE | merge.ValueOf<STREAMS[number]>)[] = [];
      let resolver: Function | undefined;

      const cleanups = allStreams.map((s) =>
        s.listen((value) => {
          queue.push(value);
          resolver?.();
        })
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

export namespace merge {
  export type ValueOf<STREAM> = STREAM extends Stream<infer VALUE> ? VALUE : never;

  export interface Transformer {
    <STREAMS extends [Stream<any>, ...Stream<any>[]]>(...streams: STREAMS): <VALUE>(
      stream: Stream<VALUE>
    ) => Stream<VALUE | ValueOf<STREAMS[number]>>;
  }
}
