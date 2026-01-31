import { Stream } from "../../stream";

export function bind<VALUE>(
  other: Stream<VALUE>,
  ...others: Stream<VALUE>[]
): Stream.Transformer<Stream<VALUE>, Stream<VALUE>> {
  return function (stream) {
    const output = new Stream<VALUE>();

    const sources = [other, ...others];
    const targets = [output, other, ...others];

    return new Stream<VALUE>(async function* () {
      const ctrl = stream.listen((value) => targets.forEach((other) => other.push(value)));

      const ctrls = sources.map((stream) => stream.listen(output.push.bind(output)));

      try {
        for await (const value of output) yield value;
      } finally {
        ctrl.abort();
        ctrls.forEach((ctrl) => ctrl.abort());
      }
    });
  };
}
