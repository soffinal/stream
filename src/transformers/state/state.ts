import { Stream } from "../../stream";

/**
 * Stream with reactive state management via getter/setter.
 *
 * @template T - The type of values in the stream
 */
export type State<T> = Stream<T> & {
  state: {
    value: T;
  };
};

/**
 * Adds `.state.value` getter/setter to a stream for reactive state management.
 *
 * @template T - The type of values in the stream
 * @param initialValue - Initial state value
 * @returns Transformer that adds state behavior
 *
 * @example
 * ```typescript
 * const counter = new Stream<number>().pipe(state(0));
 * counter.listen(n => console.log(n));
 * counter.state.value = 5; // Triggers listener
 * console.log(counter.state.value); // 5
 * ```
 *
 * @example
 * ```typescript
 * const source = new Stream<number>();
 * const stateful = source.pipe(state(0));
 * source.push(10); // Updates stateful.state.value to 10
 * ```
 */
export function state<T>(initialValue: T): Stream.Transformer<Stream<T>, Stream<T>> {
  return (source: Stream<T>): State<T> => {
    let current = initialValue;
    const output = new Stream<T>(async function* () {
      for await (const value of source) {
        current = value;
        yield value;
      }
    });

    Object.defineProperty(output, "state", {
      value: {
        get value() {
          return current;
        },
        set value(newValue: T) {
          current = newValue;
          output.push(newValue);
        },
      },
      enumerable: true,
      configurable: false,
    });

    return output as State<T>;
  };
}
