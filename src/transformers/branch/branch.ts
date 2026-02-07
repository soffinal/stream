import { Stream } from "../../stream";

export function branch<VALUE>(target: Stream<VALUE>): Stream.Transformer<Stream<VALUE>> {
  return function (source) {
    const oldSource = target.getSource();

    target.setSource((self) => {
      const oldController = oldSource?.(self);

      const sourceController = source.listen((value) => {
        self.push(value);
      });

      return sourceController.addCleanup(() => oldController?.abort());
    });

    return new Stream<VALUE>((self) => source.listen((value) => self.push(value)));
  };
}
