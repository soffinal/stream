import { Stream } from "../stream.ts";

/**
 * A reactive Set that extends the native Set with stream-based mutation events.
 * Emits events when items are added, deleted, or the set is cleared.
 *
 * @template VALUE - The type of values stored in the set
 *
 * @example
 * ```typescript
 * const activeUsers = new Set<string>();
 *
 * // Listen to additions
 * activeUsers.add.listen(userId => {
 *   console.log(`User ${userId} came online`);
 * });
 *
 * // Listen to deletions
 * activeUsers.delete.listen(userId => {
 *   console.log(`User ${userId} went offline`);
 * });
 *
 * activeUsers.add('alice'); // User alice came online
 * activeUsers.delete('alice'); // User alice went offline
 * ```
 */
export class Set<VALUE> extends globalThis.Set<VALUE> {
  protected _addStream?: Stream<VALUE>;
  protected _deleteStream?: Stream<VALUE>;
  protected _clearStream?: Stream<void>;

  /**
   * Adds a value to the set and emits the value to listeners.
   * Only emits if the value is actually added (not a duplicate).
   *
   * @example
   * ```typescript
   * const tags = new Set<string>();
   * tags.add.listen(tag => console.log('Added:', tag));
   *
   * tags.add('javascript'); // Added: javascript
   * tags.add('javascript'); // No emission (duplicate)
   * ```
   */
  declare add: ((value: VALUE) => this) & Stream<VALUE>;

  /**
   * Deletes a value from the set and emits the value to listeners.
   * Only emits if the value was actually deleted (existed in set).
   *
   * @example
   * ```typescript
   * const items = new Set(['a', 'b', 'c']);
   * items.delete.listen(item => console.log('Removed:', item));
   *
   * items.delete('b'); // Removed: b
   * items.delete('x'); // No emission (didn't exist)
   * ```
   */
  declare delete: ((value: VALUE) => boolean) & Stream<VALUE>;

  /**
   * Clears all values from the set and emits to listeners.
   * Only emits if the set was not already empty.
   *
   * @example
   * ```typescript
   * const cache = new Set([1, 2, 3]);
   * cache.clear.listen(() => console.log('Cache cleared'));
   *
   * cache.clear(); // Cache cleared
   * cache.clear(); // No emission (already empty)
   * ```
   */
  declare clear: (() => void) & Stream<void>;

  /**
   * Creates a new reactive Set.
   *
   * @param values - Optional iterable of initial values
   *
   * @example
   * ```typescript
   * // Empty set
   * const tags = new Set<string>();
   *
   * // With initial values
   * const colors = new Set(['red', 'green', 'blue']);
   *
   * // Listen to changes
   * colors.add.listen(color => updateUI(color));
   * colors.delete.listen(color => removeFromUI(color));
   * ```
   */
  constructor(values?: Iterable<VALUE>) {
    super(values);

    const self = this;

    this.add = new Proxy(
      (value: VALUE): this => {
        if (globalThis.Set.prototype.has.call(self, value)) return self;
        globalThis.Set.prototype.add.call(self, value);
        self._addStream?.push(value);
        return self;
      },
      {
        get(target, prop) {
          if (prop in target) return (target as any)[prop];
          if (!self._addStream) self._addStream = new Stream<VALUE>();
          return (self._addStream as any)[prop];
        },
      }
    ) as any;

    this.delete = new Proxy(
      (value: VALUE): boolean => {
        if (!globalThis.Set.prototype.has.call(self, value)) return false;
        globalThis.Set.prototype.delete.call(self, value);
        self._deleteStream?.push(value);
        return true;
      },
      {
        get(target, prop) {
          if (prop in target) return (target as any)[prop];
          if (!self._deleteStream) self._deleteStream = new Stream<VALUE>();
          return (self._deleteStream as any)[prop];
        },
      }
    ) as any;

    this.clear = new Proxy(
      (): void => {
        if (self.size > 0) {
          globalThis.Set.prototype.clear.call(self);
          self._clearStream?.push();
        }
      },
      {
        get(target, prop) {
          if (prop in target) return (target as any)[prop];
          if (!self._clearStream) self._clearStream = new Stream<void>();
          return (self._clearStream as any)[prop];
        },
      }
    ) as any;
  }
}
