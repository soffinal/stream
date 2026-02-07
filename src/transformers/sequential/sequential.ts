import { Stream } from "../../stream";

export function sequential<VALUE, MAPPED>(
  mapper: sequential.Mapper<VALUE, MAPPED>,
): Stream.Transformer<Stream<VALUE>, Stream<MAPPED>> {
  return (source) =>
    new Stream<MAPPED>((self) => {
      const queue: VALUE[] = [];
      let processing = false;

      return source
        .listen((value, controller) => {
          queue.push(value);
          startProcessing(controller);
        })
        .addCleanup(() => {
          queue.length = 0;
        });

      async function startProcessing(controller: Stream.Controller) {
        if (processing) return;
        processing = true;
        while (queue.length && !controller.aborted) {
          const mapped = mapper(queue.shift()!, controller);
          if (mapped instanceof Promise) {
            const result = await mapped;
            if (controller.aborted) return;
            self.push(result);
          } else {
            self.push(mapped);
          }
        }
        processing = false;
      }
    });
}

export namespace sequential {
  export type Mapper<VALUE, MAPPED> = (value: VALUE, controller: Stream.Controller) => MAPPED | Promise<MAPPED>;
}
