import { Stream } from "../../stream";

export function statefull<VALUE, STATE extends Record<string, unknown>, MAPPED>(
  initialState: STATE,
  mapper: statefull.Mapper<VALUE, STATE, MAPPED>,
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> {
  return (stream) => {
    return new Stream<MAPPED>(async function* () {
      let currentState = initialState;
      try {
        for await (const value of stream) {
          const [mapped, state] = await mapper(currentState, value);
          currentState = state;
          yield mapped;
        }
      } finally {
        return;
      }
    });
  };
}

export namespace statefull {
  export type Mapper<VALUE, STATE extends Record<string, unknown>, MAPPED> = (
    state: STATE,
    value: VALUE,
  ) => [MAPPED, STATE] | Promise<[MAPPED, STATE]>;
}
