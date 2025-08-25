import { Stream } from "../stream.ts";

type ValueOf<STREAM> = STREAM extends Stream<infer VALUE> ? VALUE : never;

/**
 * Merge multiple streams into a single stream with temporal ordering.
 * 
 * @template VALUE - The type of values from the source stream
 * @template STREAMS - Tuple type of additional streams to merge
 * 
 * @param streams - Additional streams to merge with the source stream
 * 
 * @returns A transformer that merges all streams into one with union types
 * 
 * @example
 * // Basic merge with type safety
 * const numbers = new Stream<number>();
 * const strings = new Stream<string>();
 * const merged = numbers.pipe(merge(strings));
 * // Type: Stream<number | string>
 * 
 * @example
 * // Multiple streams
 * const stream1 = new Stream<number>();
 * const stream2 = new Stream<string>();
 * const stream3 = new Stream<boolean>();
 * 
 * const combined = stream1.pipe(merge(stream2, stream3));
 * // Type: Stream<number | string | boolean>
 * 

 */
export function merge<VALUE, STREAMS extends [Stream<any>, ...Stream<any>[]]>(
  ...streams: STREAMS
): (stream: Stream<VALUE>) => Stream<VALUE | ValueOf<STREAMS[number]>> {
  return (stream: Stream<VALUE>): Stream<VALUE | ValueOf<STREAMS[number]>> =>
    new Stream<VALUE | ValueOf<STREAMS[number]>>(async function* () {
      const allStreams = [stream, ...streams];
      const queue: (VALUE | ValueOf<STREAMS[number]>)[] = [];
      let resolver: Function | undefined;

      const cleanups = allStreams.map((s) =>
        s.listen((value) => {
          queue.push(value);
          resolver?.();
        })
      );

      try {
        while (true) {
          if (queue.length) {
            yield queue.shift()!;
          } else {
            await new Promise((resolve) => (resolver = resolve));
          }
        }
      } finally {
        cleanups.forEach((cleanup) => cleanup());
      }
    });
}
