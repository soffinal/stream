import { Stream } from "../stream.ts";

export const zip: zip.Transformer =
  <VALUE, OTHER, ACC, RESULT>(
    otherOrOthers: Stream<OTHER> | Stream<any>[],
    combinerOrInitial?: ((a: VALUE, b: OTHER) => RESULT | Promise<RESULT>) | ACC | ((first: VALUE, ...rest: any[]) => RESULT | Promise<RESULT>),
    statefulCombiner?: (accumulator: ACC, a: VALUE, b: OTHER) => [any, ACC] | Promise<[any, ACC]>
  ) =>
  (stream: Stream<VALUE>): Stream<any> => {
    // Stateful zip
    if (statefulCombiner) {
      const other = otherOrOthers as Stream<OTHER>;
      const initialValue = combinerOrInitial as ACC;
      return new Stream(async function* () {
        const iter1 = stream[Symbol.asyncIterator]();
        const iter2 = other[Symbol.asyncIterator]();
        let accumulator = initialValue;

        while (true) {
          const [result1, result2] = await Promise.all([iter1.next(), iter2.next()]);
          if (result1.done || result2.done) break;

          const [value, newAcc] = await statefulCombiner(accumulator, result1.value, result2.value);
          accumulator = newAcc;
          yield value;
        }
      });
    }

    // Multiple streams with combiner
    if (Array.isArray(otherOrOthers) && typeof combinerOrInitial === "function") {
      const others = otherOrOthers;
      const combiner = combinerOrInitial as (first: VALUE, ...rest: any[]) => RESULT | Promise<RESULT>;
      return new Stream(async function* () {
        const iterators = [stream[Symbol.asyncIterator](), ...others.map((s) => s[Symbol.asyncIterator]())];

        while (true) {
          const results = await Promise.all(iterators.map((iter) => iter.next()));
          if (results.some((r) => r.done)) break;

          const values = results.map((r) => r.value);
          const combined = await combiner(values[0], ...values.slice(1));
          yield combined;
        }
      });
    }

    // Single stream with combiner
    if (!Array.isArray(otherOrOthers) && typeof combinerOrInitial === "function") {
      const other = otherOrOthers as Stream<OTHER>;
      const combiner = combinerOrInitial as (a: VALUE, b: OTHER) => RESULT | Promise<RESULT>;
      return new Stream(async function* () {
        const iter1 = stream[Symbol.asyncIterator]();
        const iter2 = other[Symbol.asyncIterator]();

        while (true) {
          const [result1, result2] = await Promise.all([iter1.next(), iter2.next()]);
          if (result1.done || result2.done) break;

          const combined = await combiner(result1.value, result2.value);
          yield combined;
        }
      });
    }

    // Multiple streams (array) - basic zip
    if (Array.isArray(otherOrOthers)) {
      const others = otherOrOthers;
      return new Stream(async function* () {
        const iterators = [stream[Symbol.asyncIterator](), ...others.map((s) => s[Symbol.asyncIterator]())];

        while (true) {
          const results = await Promise.all(iterators.map((iter) => iter.next()));
          if (results.some((r) => r.done)) break;

          yield results.map((r) => r.value) as any;
        }
      });
    }

    // Basic zip with single stream
    const other = otherOrOthers as Stream<OTHER>;
    return new Stream(async function* () {
      const iter1 = stream[Symbol.asyncIterator]();
      const iter2 = other[Symbol.asyncIterator]();

      while (true) {
        const [result1, result2] = await Promise.all([iter1.next(), iter2.next()]);
        if (result1.done || result2.done) break;
        yield [result1.value, result2.value];
      }
    });
  };

export namespace zip {
  export type Combiner<VALUE, OTHER, RESULT> = (a: VALUE, b: OTHER) => RESULT | Promise<RESULT>;
  export type MultipleCombiner<VALUE, RESULT> = (first: VALUE, ...rest: any[]) => RESULT | Promise<RESULT>;
  export type StatefulCombiner<VALUE, OTHER, ACC> = (accumulator: ACC, a: VALUE, b: OTHER) => [any, ACC] | Promise<[any, ACC]>;
  export interface Transformer {
    <VALUE, OTHER>(other: Stream<OTHER>): (stream: Stream<VALUE>) => Stream<[VALUE, OTHER]>;
    <VALUE, STREAMS extends [Stream<any>, ...Stream<any>[]]>(...others: STREAMS): (stream: Stream<VALUE>) => Stream<[VALUE, ...{ [K in keyof STREAMS]: STREAMS[K] extends Stream<infer U> ? U : never }]>;
    <VALUE, OTHER, RESULT>(other: Stream<OTHER>, combiner: Combiner<VALUE, OTHER, RESULT>): (stream: Stream<VALUE>) => Stream<RESULT>;
    <VALUE, STREAMS extends [Stream<any>, ...Stream<any>[]], RESULT>(others: STREAMS, combiner: MultipleCombiner<VALUE, RESULT>): (stream: Stream<VALUE>) => Stream<RESULT>;
    <VALUE, OTHER, ACC>(other: Stream<OTHER>, initialValue: ACC, combiner: StatefulCombiner<VALUE, OTHER, ACC>): (stream: Stream<VALUE>) => Stream<any>;
  }
}
