import { Stream } from "../stream.ts";

export const startWith: startWith.Transformer =
  <VALUES extends any[]>(valuesOrFactory: VALUES | startWith.ValueFactory<VALUES>) =>
  (stream: Stream<VALUES[number]>): Stream<VALUES[number]> => {
    return new Stream<VALUES[number]>(async function* () {
      let first = true;

      for await (const value of stream) {
        if (first) {
          let initialValues: VALUES;

          if (typeof valuesOrFactory === "function") {
            // Dynamic/async values factory
            const result = await (valuesOrFactory as startWith.ValueFactory<VALUES>)();
            initialValues = result;
          } else {
            // Static values (original behavior)
            initialValues = valuesOrFactory;
          }

          for (const initialValue of initialValues) {
            yield initialValue;
          }
          first = false;
        }
        yield value;
      }
    });
  };

export namespace startWith {
  export type ValueFactory<VALUES extends any[]> = () => VALUES | Promise<VALUES>;
  export interface Transformer {
    <VALUES extends any[]>(valueFactory: ValueFactory<VALUES>): (
      stream: Stream<VALUES[number]>
    ) => Stream<VALUES[number]>;
    <VALUES extends any[]>(values: VALUES): (stream: Stream<VALUES[number]>) => Stream<VALUES[number]>;
  }
}
