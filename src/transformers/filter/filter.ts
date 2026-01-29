import { Stream } from "../../stream.ts";

export const filter: filter.Filter = <VALUE, FILTERED extends VALUE = VALUE>(
  predicate: filter.Predicate<VALUE>,
): Stream.Transformer<Stream<VALUE>, Stream<FILTERED>> => {
  return (stream) => {
    return new Stream<FILTERED>(async function* () {
      try {
        for await (const value of stream) {
          if (predicate(value)) yield value as FILTERED;
        }
      } finally {
        return;
      }
    });
  };
};

export namespace filter {
  export type GardPredicate<VALUE, FILTERED extends VALUE = VALUE> = (value: VALUE) => value is FILTERED;
  export type Predicate<VALUE> = (value: VALUE) => boolean;

  export interface Filter {
    <VALUE, FILTERED extends VALUE = VALUE>(
      predicate: GardPredicate<VALUE, FILTERED>,
    ): Stream.Transformer<Stream<VALUE>, Stream<FILTERED>>;

    <VALUE>(predicate: Predicate<VALUE>): Stream.Transformer<Stream<VALUE>, Stream<VALUE>>;
  }
}
