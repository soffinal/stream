import { Stream } from "../stream.ts";

export const flat: flat.Transformer = <DEPTH extends number>(depth?: DEPTH): any => {
  return <VALUE>(stream: Stream<VALUE>): Stream<any> => {
    return new Stream<FlatArray<VALUE, DEPTH>>(async function* () {
      for await (const value of stream) {
        if (Array.isArray(value)) {
          const values = value.flat(depth);
          for (let i = 0; i < values.length; i++) {
            yield values[i]!;
          }
        } else {
          yield value as FlatArray<VALUE, DEPTH>;
        }
      }
    });
  };
};

export namespace flat {
  export interface Transformer {
    (): <T>(stream: Stream<T>) => Stream<FlatArray<T, 0>>;
    <DEPTH extends number>(depth: DEPTH): <T>(stream: Stream<T>) => Stream<FlatArray<T, DEPTH>>;
  }
}
