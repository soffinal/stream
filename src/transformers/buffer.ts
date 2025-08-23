import { Stream } from "../stream.ts";

export const buffer: buffer.Transformer =
  <VALUE, ACC>(
    triggerOrCountOrAccumulator:
      | Stream<any>
      | number
      | ((buffer: VALUE[], value: VALUE) => boolean | number | Promise<boolean | number>)
      | ACC,
    selector?: (
      accumulator: ACC,
      buffer: VALUE[],
      value: VALUE
    ) => [boolean, ACC] | [number, ACC] | Promise<[boolean, ACC] | [number, ACC]>
  ) =>
  (stream: Stream<VALUE>): Stream<VALUE[]> => {
    // Stream trigger
    if (triggerOrCountOrAccumulator instanceof Stream) {
      const trigger = triggerOrCountOrAccumulator;
      return new Stream<VALUE[]>(async function* () {
        const queue: VALUE[][] = [];
        let resolver: Function | undefined;
        let currentBuffer: VALUE[] = [];

        const streamAbort = stream.listen((value) => {
          currentBuffer.push(value);
        });

        const triggerAbort = trigger.listen(() => {
          if (currentBuffer.length > 0) {
            queue.push([...currentBuffer]);
            currentBuffer = [];
            resolver?.();
          }
        });

        try {
          while (true) {
            await new Promise((resolve) => (resolver = resolve));
            while (queue.length > 0) {
              yield queue.shift()!;
            }
          }
        } finally {
          streamAbort();
          triggerAbort();
        }
      });
    }

    // Stateful buffer (check before number to handle buffer(0, selector))
    if (selector) {
      return new Stream<VALUE[]>(async function* () {
        const buffer: VALUE[] = [];
        let accumulator = triggerOrCountOrAccumulator as ACC;

        for await (const value of stream) {
          buffer.push(value);
          const result = await selector(accumulator, buffer, value);

          if (typeof result[0] === "boolean") {
            // Boolean predicate
            const [shouldEmit, newAcc] = result;
            if (shouldEmit && buffer.length > 0) {
              yield [...buffer];
              buffer.length = 0;
            }
            accumulator = newAcc;
          } else {
            // Count-based
            const [count, newAcc] = result;
            accumulator = newAcc;
            while (buffer.length >= count && count > 0) {
              yield buffer.splice(0, count);
            }
          }
        }
        // No final emission - streams are infinite
      });
    }

    // Fixed count
    if (typeof triggerOrCountOrAccumulator === "number") {
      const count = triggerOrCountOrAccumulator;
      return new Stream<VALUE[]>(async function* () {
        const buffer: VALUE[] = [];

        for await (const value of stream) {
          buffer.push(value);
          while (buffer.length >= count && count > 0) {
            yield buffer.splice(0, count);
          }
        }
        // No final emission - streams are infinite
      });
    }

    // Function case - distinguish by return type
    const fn = triggerOrCountOrAccumulator as (
      buffer: VALUE[],
      value: VALUE
    ) => boolean | number | Promise<boolean | number>;
    return new Stream<VALUE[]>(async function* () {
      const buffer: VALUE[] = [];

      for await (const value of stream) {
        buffer.push(value);
        const result = await fn(buffer, value);

        if (typeof result === "boolean") {
          // Predicate - emit when true
          if (result && buffer.length > 0) {
            yield [...buffer];
            buffer.length = 0;
          }
        } else {
          // Count selector - emit when buffer reaches count
          const count = result;
          while (buffer.length >= count && count > 0) {
            yield buffer.splice(0, count);
          }
        }
      }
    });
  };

export namespace buffer {
  export type BufferFunction<VALUE> = (buffer: VALUE[], value: VALUE) => boolean | number | Promise<boolean | number>;
  export type StatefulSelector<VALUE, ACC> = (
    accumulator: ACC,
    buffer: VALUE[],
    value: VALUE
  ) => [boolean, ACC] | [number, ACC] | Promise<[boolean, ACC] | [number, ACC]>;
  export interface Transformer {
    <VALUE>(count: number): (stream: Stream<VALUE>) => Stream<VALUE[]>;
    <VALUE>(trigger: Stream<any>): (stream: Stream<VALUE>) => Stream<VALUE[]>;
    <VALUE>(fn: BufferFunction<VALUE>): (stream: Stream<VALUE>) => Stream<VALUE[]>;
    <VALUE, ACC>(initialValue: ACC, selector: StatefulSelector<VALUE, ACC>): (stream: Stream<VALUE>) => Stream<VALUE[]>;
  }
}
