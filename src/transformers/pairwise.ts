import { Stream } from "../stream.ts";

export const pairwise: pairwise.Transformer = <VALUE, ACC = any, RESULT = any>(
  arg1?: ACC | ((prev: VALUE, curr: VALUE) => boolean | Promise<boolean> | RESULT | Promise<RESULT>),
  arg2?: (accumulator: ACC, prev: VALUE, curr: VALUE) => [boolean | RESULT, ACC] | Promise<[boolean | RESULT, ACC]>
) => {
  return (stream: Stream<VALUE>): Stream<any> => {
    if (arg1 === undefined) {
      // Basic pairwise
      return new Stream<[VALUE, VALUE]>(async function* () {
        let previous: VALUE | undefined;
        let hasPrevious = false;

        for await (const value of stream) {
          if (hasPrevious) {
            yield [previous!, value];
          }
          previous = value;
          hasPrevious = true;
        }
      });
    }

    if (arg2 === undefined) {
      // Predicate-based or transformer
      const fn = arg1 as (prev: VALUE, curr: VALUE) => boolean | Promise<boolean> | RESULT | Promise<RESULT>;

      return new Stream(async function* () {
        let previous: VALUE | undefined;
        let hasPrevious = false;

        for await (const value of stream) {
          if (hasPrevious) {
            const result = await fn(previous!, value);

            if (typeof result === "boolean") {
              // Predicate-based
              if (result) {
                yield [previous!, value];
              }
            } else {
              // Transformer
              yield result;
            }
          }
          previous = value;
          hasPrevious = true;
        }
      });
    }

    // Stateful operations
    const initialValue = arg1 as ACC;
    const accumulatorFn = arg2 as (
      accumulator: ACC,
      prev: VALUE,
      curr: VALUE
    ) => [boolean | RESULT, ACC] | Promise<[boolean | RESULT, ACC]>;

    return new Stream(async function* () {
      let accumulator = initialValue;
      let previous: VALUE | undefined;
      let hasPrevious = false;

      for await (const value of stream) {
        if (hasPrevious) {
          const [result, newAcc] = await accumulatorFn(accumulator, previous!, value);
          accumulator = newAcc;

          if (typeof result === "boolean") {
            // Stateful predicate
            if (result) {
              yield [previous!, value];
            }
          } else {
            // Stateful transformer
            yield result;
          }
        }
        previous = value;
        hasPrevious = true;
      }
    });
  };
};

export namespace pairwise {
  export type Predicate<VALUE> = (prev: VALUE, curr: VALUE) => boolean | Promise<boolean>;
  export type Mapper<VALUE, RESULT> = (prev: VALUE, curr: VALUE) => RESULT | Promise<RESULT>;
  export type StatefulPredicate<VALUE, ACC> = (
    accumulator: ACC,
    prev: VALUE,
    curr: VALUE
  ) => [boolean, ACC] | Promise<[boolean, ACC]>;
  export type StatefulMapper<VALUE, ACC, RESULT> = (
    accumulator: ACC,
    prev: VALUE,
    curr: VALUE
  ) => [RESULT, ACC] | Promise<[RESULT, ACC]>;
  export interface Transformer {
    <VALUE>(): (stream: Stream<VALUE>) => Stream<[VALUE, VALUE]>;
    <VALUE>(predicate: Predicate<VALUE>): (stream: Stream<VALUE>) => Stream<[VALUE, VALUE]>;
    <VALUE, ACC>(initialValue: ACC, accumulator: StatefulPredicate<VALUE, ACC>): (
      stream: Stream<VALUE>
    ) => Stream<[VALUE, VALUE]>;
    <VALUE, RESULT>(mapper: Mapper<VALUE, RESULT>): (stream: Stream<VALUE>) => Stream<RESULT>;
    <VALUE, ACC, RESULT>(initialValue: ACC, accumulator: StatefulMapper<VALUE, ACC, RESULT>): (
      stream: Stream<VALUE>
    ) => Stream<RESULT>;
  }
}
