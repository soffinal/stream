import { Stream } from "../../stream";
import { gate, Gate } from "../gate";
import { map } from "../sequential";
import { snapshot } from "../snapshot";

/**
 * Stream with reactive state management via getter/setter.
 *
 * @template T - The type of values in the stream
 */
export type State<T> = {
  value: T;
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
export function state<T>(initialValue: T): Stream.Transformer<Stream<T>, Stream<T> & { state: State<T> }> {
  return (source) => {
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

    return output as Stream<T> & { state: State<T> };
  };
}

const s = new Stream<number>()
  .pipe(state(0))
  .pipe(map((v) => v.toFixed()))
  .pipe(gate())
  .pipe(snapshot("v1"))
  .pipe(map((v) => Number(v)))
  .pipe(snapshot("v2"));
