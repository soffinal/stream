import { Stream } from "../../stream";

/**
 * Stream with flow control via open/close methods.
 *
 * @template T - The type of values in the stream
 */
export type Gate<T> = Stream<T> & {
  gate: {
    open(): void;
    close(): void;
    readonly isOpen: boolean;
  };
};

/**
 * Adds flow control to a stream with `.gate.open()` and `.gate.close()` methods.
 * Gate starts open by default. Closed gate blocks all values.
 *
 * @template T - The type of values in the stream
 * @returns Transformer that adds gate behavior
 *
 * @example
 * ```typescript
 * const source = new Stream<number>();
 * const gated = source.pipe(gate());
 *
 * gated.listen(n => console.log(n));
 * source.push(1); // Logs: 1
 * gated.gate.close();
 * source.push(2); // Blocked
 * gated.gate.open();
 * source.push(3); // Logs: 3
 * ```
 *
 * @example
 * ```typescript
 * const events = new Stream<string>().pipe(gate());
 * console.log(events.gate.isOpen); // true
 * events.gate.close();
 * console.log(events.gate.isOpen); // false
 * ```
 */
export function gate<T>(): Stream.Transformer<Stream<T>, Gate<T>> {
  return (source: Stream<T>): Gate<T> => {
    let isOpen = true;

    const output = new Stream<T>(async function* () {
      for await (const value of source) {
        if (isOpen) yield value;
      }
    });

    Object.defineProperty(output, "gate", {
      value: {
        open: () => (isOpen = true),
        close: () => (isOpen = false),
        get isOpen() {
          return isOpen;
        },
      },
      enumerable: true,
      configurable: false,
    });

    return output as Gate<T>;
  };
}
