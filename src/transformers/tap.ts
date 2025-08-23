import { Stream } from "../stream.ts";

export const tap: tap.Transformer =
  <VALUE>(sideEffect: tap.SideEffect<VALUE>): ((stream: Stream<VALUE>) => Stream<VALUE>) =>
  (stream: Stream<VALUE>): Stream<VALUE> =>
    new Stream<VALUE>(async function* () {
      for await (const value of stream) {
        await sideEffect(value);
        yield value;
      }
    });

export namespace tap {
  export type SideEffect<VALUE> = (value: VALUE) => any;
  export interface Transformer {
    <VALUE>(sideEffect: SideEffect<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE>;
  }
}
