import { Stream } from "../../stream.ts";

export function merge<VALUE, STREAMS extends [Stream<any>, ...Stream<any>[]]>(
  ...streams: STREAMS
): Stream.Transformer<Stream<VALUE>, Stream<VALUE | Stream.ValueOf<STREAMS[number]>>> {
  return (stream: Stream<VALUE>): Stream<VALUE | Stream.ValueOf<STREAMS[number]>> =>
    new Stream<VALUE | Stream.ValueOf<STREAMS[number]>>(async function* () {
      const output = new Stream<VALUE | Stream.ValueOf<STREAMS[number]>>();

      const ctrls = [stream, ...streams].map((s) =>
        s.listen((value) => {
          output.push(value);
        }),
      );

      yield* output;

      Stream.Controller.abort(ctrls);
    });
}
