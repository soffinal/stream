import { Stream } from "../../stream";

/**
 * Adds flow control to a stream with `.gate.open()` and `.gate.close()` methods.
 * Gate starts open by default. Closed gate blocks all values.
 *
 * @template VALUE - The type of values in the stream
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
export function gate<VALUE>(): Stream.Transformer<Stream<VALUE>, Stream<VALUE> & { gate: gate.Gate }> {
  return (source) => {
    let isOpen = true;

    return Stream.create<VALUE, { gate: gate.Gate }>(
      function (self) {
        return source.listen((value) => {
          if (isOpen) self.push(value);
        });
      },
      () => {
        return {
          gate: {
            open: () => (isOpen = true),
            close: () => (isOpen = false),
            get isOpen() {
              return isOpen;
            },
          },
        };
      },
    );
  };
}

export namespace gate {
  export type Gate = {
    open(): void;
    close(): void;
    readonly isOpen: boolean;
  };
}
