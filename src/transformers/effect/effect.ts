import { Stream } from "../../stream.ts";

export const effect: effect.Effect = <VALUE>(
  callback: effect.Callback<VALUE>,
): Stream.Transformer<Stream<VALUE>, Stream<VALUE>> => {
  return (stream) => {
    return new Stream<VALUE>(async function* () {
      try {
        for await (const value of stream) {
          callback(value);
          yield value;
        }
      } finally {
        return;
      }
    });
  };
};

export namespace effect {
  export type Callback<VALUE> = (value: VALUE) => any;

  export interface Effect {
    <VALUE>(predicate: Callback<VALUE>): Stream.Transformer<Stream<VALUE>, Stream<VALUE>>;
  }
}
