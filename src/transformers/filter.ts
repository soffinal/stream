import { Stream } from "../stream.ts";

export const filter: filter.Transformer =
  <VALUE, ACC>(
    predicateOrInitial: ACC | filter.Predicate<VALUE>,
    statePredicate?: filter.StatefulPredicate<VALUE, ACC>
  ): ((stream: Stream<VALUE>) => Stream<any>) =>
  (stream: Stream<VALUE>): Stream<any> => {
    if (statePredicate) {
      return new Stream<VALUE>(async function* () {
        let accumulator = predicateOrInitial as ACC;
        for await (const value of stream) {
          const [shouldPass, newAcc] = await statePredicate(accumulator, value);
          accumulator = newAcc;
          if (shouldPass) yield value;
        }
      });
    } else {
      const predicate = predicateOrInitial as filter.Predicate<VALUE>;
      return new Stream<VALUE>(async function* () {
        for await (const value of stream) {
          if (await predicate(value)) yield value;
        }
      });
    }
  };

export namespace filter {
  export type GuardPredicate<VALUE, FILTERED extends VALUE> = (value: VALUE) => value is FILTERED;
  export type Predicate<VALUE> = (value: VALUE) => boolean | Promise<boolean>;
  export type StatefulPredicate<VALUE, ACC> = (
    accumulator: ACC,
    value: VALUE
  ) => [boolean, ACC] | Promise<[boolean, ACC]>;
  export interface Transformer {
    <VALUE, FILTERED extends VALUE>(predicate: GuardPredicate<VALUE, FILTERED>): (
      stream: Stream<VALUE>
    ) => Stream<FILTERED>;
    <VALUE>(predicate: Predicate<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE>;
    <VALUE, ACC>(initialValue: ACC, predicate: StatefulPredicate<VALUE, ACC>): (stream: Stream<VALUE>) => Stream<VALUE>;
  }
}
