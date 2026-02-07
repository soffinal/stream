import { Stream } from "../../stream";

export function sequential<VALUE, MAPPED>(
  mapper: sequential.Mapper<VALUE, MAPPED>,
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> {
  return (source) =>
    new Stream<MAPPED>((self) => {
      return source.listen((value) => {
        const mapped = mapper(value);
        if (mapped instanceof Promise) {
          mapped.then(self.push.bind(self));
        } else {
          self.push(mapped);
        }
      });
    });
}

export namespace sequential {
  export type Mapper<VALUE, MAPPED> = (value: VALUE) => MAPPED | Promise<MAPPED>;
}
