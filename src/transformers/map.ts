import { Stream } from "../stream.ts";

export const map: map.Transformer =
  <VALUE, MAPPED, ACC>(
    mapperOrInitial: ACC | map.Mapper<VALUE, MAPPED>,
    stateMapper?: map.StatefulMapper<VALUE, MAPPED, ACC>
  ): ((stream: Stream<VALUE>) => Stream<any>) =>
  (stream: Stream<VALUE>): Stream<any> => {
    if (stateMapper) {
      return new Stream<MAPPED>(async function* () {
        let accumulator = mapperOrInitial as ACC;
        for await (const value of stream) {
          const [result, newAcc] = await stateMapper(accumulator, value);
          accumulator = newAcc;
          yield result;
        }
      });
    } else {
      const mapper = mapperOrInitial as map.Mapper<VALUE, MAPPED>;
      return new Stream<MAPPED>(async function* () {
        for await (const value of stream) {
          yield await mapper(value);
        }
      });
    }
  };

export namespace map {
  export type Mapper<VALUE, MAPPED> = (value: VALUE) => MAPPED | Promise<MAPPED>;
  export type StatefulMapper<VALUE, MAPPED, ACC> = (
    accumulator: ACC,
    value: VALUE
  ) => [MAPPED, ACC] | Promise<[MAPPED, ACC]>;
  export interface Transformer {
    <VALUE, MAPPED>(mapper: Mapper<VALUE, MAPPED>): (stream: Stream<VALUE>) => Stream<MAPPED>;
    <VALUE, MAPPED, ACC>(initialValue: ACC, mapper: StatefulMapper<VALUE, MAPPED, ACC>): (
      stream: Stream<VALUE>
    ) => Stream<MAPPED>;
  }
}
