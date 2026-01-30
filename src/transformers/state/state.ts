import { Stream } from "../../stream";
import { gate, Gate } from "../gate";

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
 * Supports automatic dependency tracking when used with `effect()`.
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
 * // Reactive effects with automatic tracking
 * ```typescript
 * const counter = new Stream<number>().pipe(state(0));
 *
 * effect(() => {
 *   console.log('Counter:', counter.state.value);
 * });
 *
 * counter.state.value = 5; // Logs: "Counter: 5"
 * ```
 */
export function state<T>(initialValue: T): Stream.Transformer<Stream<T>, State<T>> {
  return (source: Stream<T>): State<T> => {
    let current = initialValue;

    const output = new Stream<T>(async function* () {
      try {
        for await (const value of source) {
          current = value;
          yield value;
        }
      } finally {
        return;
      }
    });

    Object.defineProperty(output, "state", {
      value: {
        get value() {
          return current;
        },
        set value(newValue: T) {
          if (current === newValue) return;
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
const stream = new Stream<number>();
const s = stream.pipe(state(0));
const s2 = s.pipe(gate());

const s3 = s2;
