import { Stream } from "../../stream.ts";

export const filter: filter.Function = <VALUE, FILTERED extends VALUE = VALUE>(
  predicate: filter.Predicate<VALUE>,
): Stream.Transformer<Stream<VALUE>, Stream<FILTERED>> => {
  return (source) => {
    return new Stream<FILTERED>(function (self) {
      return source.listen((value) => {
        if (predicate(value)) self.push(value as FILTERED);
      });
    });
  };
};

export namespace filter {
  export type GardPredicate<VALUE, FILTERED extends VALUE = VALUE> = (value: VALUE) => value is FILTERED;
  export type Predicate<VALUE> = (value: VALUE) => boolean;

  export interface Function {
    <VALUE, FILTERED extends VALUE = VALUE>(
      predicate: GardPredicate<VALUE, FILTERED>,
    ): Stream.Transformer<Stream<VALUE>, Stream<FILTERED>>;

    <VALUE>(predicate: Predicate<VALUE>): Stream.Transformer<Stream<VALUE>, Stream<VALUE>>;
  }
}
