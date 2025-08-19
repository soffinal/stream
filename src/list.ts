import { Stream } from "./stream";

/**
 * A reactive List that provides array-like functionality with stream-based mutation events.
 * Emits events when items are inserted, deleted, or the list is cleared.
 * Supports negative indexing with modulo wrapping.
 *
 * @template VALUE - The type of values stored in the list
 *
 * @example
 * ```typescript
 * const todos = new List<string>();
 *
 * // Listen to insertions
 * todos.insert.listen(([index, item]) => {
 *   console.log(`Added "${item}" at index ${index}`);
 * });
 *
 * // Listen to deletions
 * todos.delete.listen(([index, item]) => {
 *   console.log(`Removed "${item}" from index ${index}`);
 * });
 *
 * todos.insert(0, "Buy milk"); //Added "Buy milk" at index 0
 * todos.insert(1, "Walk dog"); //Added "Walk dog" at index 1
 * todos.insert(-1, "kechma haja"); //Added "kechma haja" at index 2
 * todos[0] = "Buy organic milk"; // Added "Buy organic milk" at index 0
 * ```
 */
export class List<VALUE> implements Iterable<VALUE> {
  private _items: VALUE[] = [];
  private _insertStream?: Stream<[number, VALUE]>;
  private _deleteStream?: Stream<[number, VALUE]>;
  private _clearStream?: Stream<void>;

  [index: number]: VALUE | undefined;

  /**
   * Inserts a value at the specified index and emits the insertion event.
   * Negative indices are handled specially for insertion positioning.
   *
   * @example
   * ```typescript
   * const list = new List([1, 2, 3]);
   * list.insert.listen(([index, value]) => console.log(`Inserted ${value} at ${index}`));
   *
   * list.insert(1, 99); // Inserted 99 at 1 → [1, 99, 2, 3]
   * list.insert(-1, 88); // Insert at end → [1, 99, 2, 3, 88]
   * ```
   */
  declare insert: ((index: number, value: VALUE) => this) & Stream<[number, VALUE]>;

  /**
   * Deletes a value at the specified index and emits the deletion event.
   * Returns the deleted value or undefined if index is invalid.
   *
   * @example
   * ```typescript
   * const list = new List(['a', 'b', 'c']);
   * list.delete.listen(([index, value]) => console.log(`Deleted ${value} from ${index}`));
   *
   * const deleted = list.delete(1); // Deleted b from 1
   * console.log(deleted); // 'b'
   * ```
   */
  declare delete: ((index: number) => VALUE | undefined) & Stream<[number, VALUE]>;

  /**
   * Clears all items from the list and emits the clear event.
   * Only emits if the list was not already empty.
   *
   * @example
   * ```typescript
   * const list = new List([1, 2, 3]);
   * list.clear.listen(() => console.log('List cleared'));
   *
   * list.clear(); // List cleared
   * list.clear(); // No emission (already empty)
   * ```
   */
  declare clear: (() => void) & Stream<void>;

  /**
   * Creates a new reactive List.
   *
   * @param items - Optional iterable of initial items
   *
   * @example
   * ```typescript
   * // Empty list
   * const list = new List<number>();
   *
   * // With initial items
   * const todos = new List(['Buy milk', 'Walk dog']);
   *
   * // Listen to changes
   * todos.insert.listen(([index, item]) => updateUI(index, item));
   * todos.delete.listen(([index, item]) => removeFromUI(index));
   *
   * // Index access with modulo wrapping
   * console.log(todos[0]);  // 'Buy milk'
   * console.log(todos[-1]); // 'Walk dog' (last item)
   * ```
   */
  constructor(items?: Iterable<VALUE>) {
    if (items) this._items = [...items];

    const self = this;

    function normalizeIndex(index: number, length: number): number {
      if (length === 0) return 0;
      return index < 0 ? ((index % length) + length) % length : index % length;
    }

    this.insert = new Proxy(
      (index: number, value: VALUE) => {
        const actualIndex =
          index < 0 ? Math.max(0, self._items.length + index + 1) : Math.min(index, self._items.length);
        self._items.splice(actualIndex, 0, value);
        self._insertStream?.push([actualIndex, value]);
        return proxy;
      },
      {
        get(target, prop) {
          if (prop in target) return (target as any)[prop];
          if (!self._insertStream) self._insertStream = new Stream();
          return (self._insertStream as any)[prop];
        },
      }
    ) as any;
    this.delete = new Proxy(
      (index: number) => {
        if (index < 0 || index >= self._items.length) return undefined;
        const value = self._items.splice(index, 1)[0]!;
        self._deleteStream?.push([index, value]);
        return value;
      },
      {
        get(target, prop) {
          if (prop in target) return (target as any)[prop];
          if (!self._deleteStream) self._deleteStream = new Stream();
          return (self._deleteStream as any)[prop];
        },
      }
    ) as any;

    this.clear = new Proxy(
      () => {
        if (self._items.length > 0) {
          self._items.length = 0;
          self._clearStream?.push();
        }
      },
      {
        get(target, prop) {
          if (prop in target) return (target as any)[prop];
          if (!self._clearStream) self._clearStream = new Stream();
          return (self._clearStream as any)[prop];
        },
      }
    ) as any;

    const proxy = new Proxy(this, {
      get(target, prop) {
        if (typeof prop === "string" && /^-?\d+$/.test(prop)) {
          const index = parseInt(prop);
          if (target._items.length === 0) return undefined;
          const actualIndex = normalizeIndex(index, target._items.length);
          return target._items[actualIndex];
        }
        return (target as any)[prop];
      },

      set(target, prop, value) {
        if (typeof prop === "string" && /^-?\d+$/.test(prop)) {
          const index = parseInt(prop);

          if (target._items.length === 0) {
            // Empty array: any index mutation adds first element at index 0
            target._items.push(value);
            target._insertStream?.push([0, value]);
            return true;
          }

          const actualIndex = normalizeIndex(index, target._items.length);
          const oldValue = target._items[actualIndex];

          if (oldValue !== value) {
            target._items[actualIndex] = value;
            target._insertStream?.push([actualIndex, value]);
          }
          return true;
        }
        (target as any)[prop] = value;
        return true;
      },
    });

    return proxy;
  }

  /**
   * Gets the value at the specified index without modulo wrapping.
   *
   * @param index - The index to access
   * @returns The value at the index or undefined
   *
   * @example
   * ```typescript
   * const list = new List([10, 20, 30]);
   * console.log(list.get(1)); // 20
   * console.log(list.get(5)); // undefined
   * ```
   */
  get(index: number): VALUE | undefined {
    return this._items[index];
  }

  /**
   * Gets the current length of the list.
   *
   * @example
   * ```typescript
   * const list = new List([1, 2, 3]);
   * console.log(list.length); // 3
   *
   * list.insert(0, 0);
   * console.log(list.length); // 4
   * ```
   */
  get length(): number {
    return this._items.length;
  }
  /**
   * Returns an iterator for the list values.
   *
   * @example
   * ```typescript
   * const list = new List([1, 2, 3]);
   * for (const value of list.values()) {
   *   console.log(value); // 1, 2, 3
   * }
   * ```
   */
  values() {
    return this._items[Symbol.iterator]();
  }
  /**
   * Makes the list iterable.
   *
   * @example
   * ```typescript
   * const list = new List(['a', 'b', 'c']);
   * for (const item of list) {
   *   console.log(item); // 'a', 'b', 'c'
   * }
   *
   * const array = [...list]; // ['a', 'b', 'c']
   * ```
   */
  [Symbol.iterator]() {
    return this._items[Symbol.iterator]();
  }
}
