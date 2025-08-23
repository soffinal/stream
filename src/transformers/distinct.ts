import { Stream } from "../stream.ts";

export const distinct: distinct.Transformer =
  <VALUE, KEY>(keySelector?: distinct.KeySelector<VALUE, KEY>): ((stream: Stream<VALUE>) => Stream<VALUE>) =>
  (stream: Stream<VALUE>): Stream<VALUE> => {
    if (keySelector === undefined) {
      return new Stream<VALUE>(async function* () {
        const seen = new Set<VALUE>();
        for await (const value of stream) {
          if (!seen.has(value)) {
            seen.add(value);
            yield value;
          }
        }
      });
    }

    return new Stream<VALUE>(async function* () {
      const seen = new Set<KEY>();
      for await (const value of stream) {
        const key = await keySelector(value);
        if (!seen.has(key)) {
          seen.add(key);
          yield value;
        }
      }
    });
  };

export namespace distinct {
  export type KeySelector<VALUE, KEY> = (value: VALUE) => KEY | Promise<KEY>;
  export interface Transformer {
    <VALUE>(): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE, KEY>(keySelector: KeySelector<VALUE, KEY>): (stream: Stream<VALUE>) => Stream<VALUE>;
  }
}
