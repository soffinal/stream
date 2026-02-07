import { Stream } from "../../stream";

export function concurrent<VALUE, MAPPED>(
  mapper: concurrent.Mapper<VALUE, MAPPED>,
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> {
  return (stream) => {
    return new Stream<MAPPED>((self) => {
      return stream.listen(async (value, controller) => {
        const result = await mapper(value, controller);
        if (controller.aborted) return;
        self.push(result);
      });
    });
  };
}

export namespace concurrent {
  export interface Mapper<VALUE, MAPPED> {
    (value: VALUE, controller: Stream.Controller): Promise<MAPPED>;
  }
}
