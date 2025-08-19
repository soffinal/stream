import { Stream } from "./stream";

/**
 * A reactive state container that extends Stream to provide stateful value management.
 *
 * @template VALUE - The type of the state value
 *
 * @example
 * ```typescript
 * // Basic state
 * const counter = new State(0);
 * counter.listen(value => console.log('Counter:', value));
 * counter.value = 5; // Counter: 5
 *
 * // Complex state
 * interface User { id: string; name: string; }
 * const user = new State<User | null>(null);
 *
 * user.listen(u => console.log('User:', u?.name || 'None'));
 * user.value = { id: '1', name: 'Alice' }; // User: Alice
 * ```
 */
export class State<VALUE> extends Stream<VALUE> {
  protected _value: VALUE;

  /**
   * Creates a new State with an initial value.
   *
   * @param initialValue - The initial state value
   *
   * @example
   * ```typescript
   * const count = new State(0);
   * const theme = new State<'light' | 'dark'>('light');
   * const user = new State<User | null>(null);
   * ```
   */
  constructor(initialValue: VALUE) {
    super();
    this._value = initialValue;
  }
  /**
   * Updates the state with one or more values sequentially.
   * Each value triggers listeners and updates the current state.
   *
   * @param values - Values to set as state
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
   * @example
   * ```typescript
   * const state = new State('hello');
   * console.log(state.value); // 'hello'
   * ```
   */
  get value() {
    return this._value;
  }
  /**
   * Sets the current state value and notifies all listeners.
   *
   * @param value - The new state value
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
  set value(value) {
    this._value = value;
    super.push(value);
  }
}
