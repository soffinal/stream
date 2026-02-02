import { Stream } from "../../stream";

export function bind<VALUE>(other: Stream<VALUE>, ...others: Stream<VALUE>[]): Stream.Transformer<Stream<VALUE>> {
  return function (source) {
    const output = new Stream<VALUE>();

    const sources = [other, ...others];
    const targets = [output, other, ...others];

    return new Stream<VALUE>(async function* () {
      const sourceCtrl = source.listen((value) => targets.forEach((other) => other.push(value)));

      const othersCtrls = sources.map((source) => source.listen(output.push.bind(output)));

      try {
        for await (const value of output) yield value;
      } finally {
        sourceCtrl.abort();
        othersCtrls.forEach((ctrl) => ctrl.abort());
      }
    });
  };
}
