import { Stream } from "../../stream.ts";
import { map } from "../map/map.ts";

export const filter: filter.Filter = <
  VALUE,
  STATE extends Record<string, unknown> = {},
  FILTERED extends VALUE = VALUE,
  ARGS = any,
>(
  initialStateOrPredicate: STATE | filter.Predicate<VALUE, ARGS> | filter.GuardPredicate<VALUE, FILTERED>,
  statefulPredicateOrOptions?:
    | filter.StatefulPredicate<VALUE, STATE>
    | filter.StatefulGuardPredicate<VALUE, STATE, FILTERED>
    | filter.Options<ARGS>,
): Stream.Transformer<Stream<VALUE>, Stream<FILTERED>> => {
  const [predicate, options, initalState, statefulPredicate] =
    typeof initialStateOrPredicate === "function"
      ? [
          initialStateOrPredicate as filter.Predicate<VALUE, ARGS>,
          statefulPredicateOrOptions as filter.Options<ARGS>,
          undefined,
          undefined,
        ]
      : [
          undefined,
          undefined,
          initialStateOrPredicate,
          statefulPredicateOrOptions as filter.StatefulPredicate<VALUE, STATE>,
        ];

  return (stream: Stream<VALUE>): Stream<FILTERED> => {
    // Use map to handle execution strategies

    const mapped = predicate
      ? stream.pipe(
          map(async (value, args) => {
            return [value, await predicate(value, args)] as [VALUE, boolean | undefined];
          }, options),
        )
      : stream.pipe(
          map(initalState!, async (state, value) => {
            const result = await statefulPredicate(state, value);
            return (result ? [[value, result[0]], result[1]] : [[value, undefined], state]) as [
              [VALUE, boolean | undefined],
              STATE,
            ];
          }),
        );
    // Filter based on boolean
    return new Stream<FILTERED>(async function* () {
      for await (const [value, shouldPass] of mapped) {
        if (shouldPass === undefined) break;
        if (shouldPass) yield value as FILTERED;
      }
    });
  };
};

export namespace filter {
  export type Options<ARGS = any> = map.Options<ARGS>;
  export type Predicate<VALUE = unknown, ARGS = any> = (
    value: VALUE,
    args: ARGS,
  ) => boolean | void | Promise<boolean | void>;
  export type GuardPredicate<VALUE = unknown, FILTERED extends VALUE = VALUE> = (value: VALUE) => value is FILTERED;
  export type StatefulPredicate<VALUE = unknown, STATE extends Record<string, unknown> = {}> = (
    state: STATE,
    value: VALUE,
  ) => [boolean, STATE] | void | Promise<[boolean, STATE] | void>;
  export type StatefulGuardPredicate<
    VALUE = unknown,
    STATE extends Record<string, unknown> = {},
    FILTERED extends VALUE = VALUE,
  > = (state: STATE, value: VALUE) => [boolean, STATE, FILTERED] | void | Promise<[boolean, STATE, FILTERED] | void>;
  export interface Filter {
    //here we have not options because GuardPredicate rely on synchronous function
    // this overload is only for typescript
    <VALUE, FILTERED extends VALUE = VALUE>(
      predicate: GuardPredicate<VALUE, FILTERED>,
    ): Stream.Transformer<Stream<VALUE>, Stream<FILTERED>>;

    <VALUE, ARGS>(
      predicate: Predicate<VALUE>,
      options?: Options<ARGS>,
    ): Stream.Transformer<Stream<VALUE>, Stream<VALUE>>;

    //here we have not options because stateful operations must be sequential
    <VALUE, STATE extends Record<string, unknown> = {}>(
      initialState: STATE,
      predicate: StatefulPredicate<VALUE, STATE>,
    ): Stream.Transformer<Stream<VALUE>, Stream<VALUE>>;

    <VALUE, STATE extends Record<string, unknown> = {}, FILTERED extends VALUE = VALUE>(
      initialState: STATE,
      predicate: StatefulGuardPredicate<VALUE, STATE, FILTERED>,
    ): Stream.Transformer<Stream<VALUE>, Stream<FILTERED>>;
  }
}
