import { Stream } from "../../stream";

export function abortSignal<VALUE>(
  signal: AbortSignal,
): Stream.Transformer<Stream<VALUE>, Stream<VALUE | Stream.Controller.Aborted>> {
  return function (stream) {
    const out = new Stream<VALUE | Stream.Controller.Aborted>(async function* () {
      if (signal.aborted) {
        out.push(Stream.Controller.ABORTED);
        return;
      }

      signal.addEventListener("abort", () => out.push(Stream.Controller.ABORTED), { once: true });
      yield* stream;
    });

    return out;
  };
}
