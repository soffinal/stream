import { Stream } from "../../stream";

export function abortSignal<VALUE>(
  signal: AbortSignal,
): Stream.Transformer<Stream<VALUE>, Stream<VALUE | Stream.Controller.Aborted>> {
  return function (source) {
    return new Stream<VALUE | Stream.Controller.Aborted>((self) => {
      if (signal.aborted) self.push(Stream.Controller.ABORTED);

      signal.addEventListener("abort", () => self.push(Stream.Controller.ABORTED), { once: true });

      return source.listen((value) => self.push(value));
    });
  };
}
