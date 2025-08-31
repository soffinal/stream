import { FunctionGenerator, Stream } from "../stream.ts";

/**
 * A reactive state container that extends Stream to provide stateful value management.
 *
 * @template VALUE - The type of the state value
 *
 * @see {@link Stream} - Complete copy-paste transformers library
 *
 * @example
 * ```typescript
 * // Basic state
 * const counter = new State(0);
 * counter.listen(value => console.log('Counter:', value));
 * counter.value = 5; // Counter: 5
 *
 * // State from stream
 * const source = new Stream<number>();
 * const state = new State(0, source);
 * state.listen(value => console.log('State:', value));
 * source.push(1, 2, 3); // State: 1, State: 2, State: 3
 *
 * // State from transformed stream
 * const filtered = source.pipe(filter({}, (_, v) => [v > 0, {}]));
 * const derivedState = new State(-1, filtered);
 * ```
 */
export class State<VALUE = unknown> extends Stream<VALUE> {
  protected _value: VALUE;
  constructor(initialValue: VALUE);
  constructor(initialValue: VALUE, stream: FunctionGenerator<VALUE> | Stream<VALUE>);
  /**
   * Creates a new State with an initial value.
   *
   * @param initialValue - The initial state value
   *
   * @see {@link Stream} - Complete copy-paste transformers library
   *
   * @example
   * ```typescript
   * const count = new State(0);
   * const theme = new State<'light' | 'dark'>('light');
   * const user = new State<User | null>(null);
   * ```
   */
  constructor(initialValue: VALUE, stream?: FunctionGenerator<VALUE> | Stream<VALUE>) {
    super(stream!);
    this._value = initialValue;
  }
  /**
   * Updates the state with one or more values sequentially.
   * Each value triggers listeners and updates the current state.
   *
   * @param values - Values to set as state
   *
   * @see {@link Stream} - Complete copy-paste transformers library
   *
   * @example
   * ```typescript
   * const state = new State(0);
   * state.listen(v => console.log(v));
   *
   * state.push(1, 2, 3); // Logs: 1, 2, 3
   * console.log(state.value); // 3
   * ```
   */
  override push(...values: VALUE[]): void {
    for (const value of values) {
      this.value = value;
    }
  }
  /**
   * Gets the current state value.
   *
   * @see {@link Stream} - Complete copy-paste transformers library
   *
   * @example
   * ```typescript
   * const state = new State('hello');
   * console.log(state.value); // 'hello'
   * ```
   */
  get value(): VALUE {
    return this._value;
  }
  /**
   * Sets the current state value and notifies all listeners.
   *
   * @param value - The new state value
   *
   * @see {@link Stream} - Complete copy-paste transformers library
   *
   * @example
   * ```typescript
   * const state = new State(0);
   * state.listen(v => console.log('New value:', v));
   *
   * state.value = 42; // New value: 42
   * state.value = 100; // New value: 100
   * ```
   */
  set value(value: VALUE) {
    this._value = value;
    super.push(value);
  }
}
