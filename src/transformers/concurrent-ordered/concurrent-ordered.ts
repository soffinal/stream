import { Stream } from "../../stream";

export function concurrentOrdered<VALUE, MAPPED>(
  mapper: concurrentOrdered.Mapper<VALUE, MAPPED>,
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> {
  return (stream) => {
    return new Stream<MAPPED>((self) => {
      const queue: Promise<MAPPED>[] = [];
      let processing = false;

      return stream
        .listen(async (value, controller) => {
          queue.push(mapper(value, controller));
          startProcessing(controller);
        })
        .addCleanup(() => {
          queue.length = 0;
        });

      async function startProcessing(controller: Stream.Controller) {
        if (processing) return;
        processing = true;

        while (queue.length && !controller.aborted) {
          const result = await queue.shift()!;
          if (controller.aborted) return;
          self.push(result);
        }
        processing = false;
      }
    });
  };
}

export namespace concurrentOrdered {
  export type Mapper<VALUE, MAPPED> = (value: VALUE, controller: Stream.Controller) => Promise<MAPPED>;
}
