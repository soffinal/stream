import { Stream } from "../../stream";

export function sequential<VALUE, MAPPED>(
  mapper: sequential.Mapper<VALUE, MAPPED>,
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> {
  return (stream) => {
    return new Stream<MAPPED>(async function* () {
      try {
        for await (const value of stream) {
          yield await mapper(value);
        }
      } finally {
        return;
      }
    });
  };
}

export namespace sequential {
  export type Mapper<VALUE, MAPPED> = (value: VALUE) => MAPPED | Promise<MAPPED>;
}
