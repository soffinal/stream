import { Stream } from "./stream";

/**
 * A reactive Map that extends the native Map with stream-based mutation events.
 * Emits events when entries are set, deleted, or the map is cleared.
 *
 * @template KEY - The type of keys in the map
 * @template VALUE - The type of values in the map
 *
 * @example
 * ```typescript
 * const cache = new Map<string, any>();
 *
 * // Listen to cache updates
 * cache.set.listen(([key, value]) => {
 *   console.log(`Cache updated: ${key} = ${value}`);
 * });
 *
 * // Listen to cache evictions
 * cache.delete.listen(([key, value]) => {
 *   console.log(`Cache evicted: ${key}`);
 * });
 *
 * cache.set('user:123', { name: 'John' });
 * cache.delete('user:123');
 * ```
 */
export class Map<KEY, VALUE> extends globalThis.Map<KEY, VALUE> {
  protected _setStream?: Stream<[KEY, VALUE]>;
  protected _deleteStream?: Stream<[KEY, VALUE]>;
  protected _clearStream?: Stream<void>;

  /**
   * Sets a key-value pair in the map and emits the entry to listeners.
   * Only emits if the value actually changes (not same key-value pair).
   *
   * @example
   * ```typescript
   * const config = new Map<string, string>();
   * config.set.listen(([key, value]) => console.log(`Set: ${key}=${value}`));
   *
   * config.set('theme', 'dark'); // Set: theme=dark
   * config.set('theme', 'dark'); // No emission (same value)
   * config.set('theme', 'light'); // Set: theme=light
   * ```
   */
  declare set: ((key: KEY, value: VALUE) => this) & Stream<[KEY, VALUE]>;

  /**
   * Deletes a key from the map and emits the deleted entry to listeners.
   * Only emits if the key was actually deleted (existed in map).
   *
   * @example
   * ```typescript
   * const users = new Map([['alice', { age: 30 }], ['bob', { age: 25 }]]);
   * users.delete.listen(([key, value]) => console.log(`Removed: ${key}`));
   *
   * users.delete('alice'); // Removed: alice
   * users.delete('charlie'); // No emission (didn't exist)
   * ```
   */
  declare delete: ((key: KEY) => boolean) & Stream<[KEY, VALUE]>;

  /**
   * Clears all entries from the map and emits to listeners.
   * Only emits if the map was not already empty.
   *
   * @example
   * ```typescript
   * const store = new Map([['a', 1], ['b', 2]]);
   * store.clear.listen(() => console.log('Store cleared'));
   *
   * store.clear(); // Store cleared
   * store.clear(); // No emission (already empty)
   * ```
   */
  declare clear: (() => void) & Stream<void>;

  /**
   * Creates a new reactive Map.
   *
   * @param entries - Optional iterable of initial key-value pairs
   *
   * @example
   * ```typescript
   * // Empty map
   * const cache = new Map<string, any>();
   *
   * // With initial entries
   * const config = new Map([
   *   ['theme', 'dark'],
   *   ['lang', 'en']
   * ]);
   *
   * // Listen to changes
   * config.set.listen(([key, value]) => saveConfig(key, value));
   * config.delete.listen(([key]) => removeConfig(key));
   * ```
   */
  constructor(entries?: Iterable<[KEY, VALUE]>) {
    super(entries);

    const self = this;

    this.set = new Proxy(
      (key: KEY, value: VALUE) => {
        if (globalThis.Map.prototype.has.call(self, key) && globalThis.Map.prototype.get.call(self, key) === value)
          return self;
        globalThis.Map.prototype.set.call(self, key, value);
        self._setStream?.push([key, value]);
        return self;
      },
      {
        get(target, prop) {
          if (prop in target) return (target as any)[prop];
          if (!self._setStream) self._setStream = new Stream();
          return (self._setStream as any)[prop];
        },
      }
    ) as any;

    this.delete = new Proxy(
      (key: KEY) => {
        if (!globalThis.Map.prototype.has.call(self, key)) return false;
        const value = globalThis.Map.prototype.get.call(self, key);
        globalThis.Map.prototype.delete.call(self, key);
        self._deleteStream?.push([key, value]);
        return true;
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
        if (self.size > 0) {
          globalThis.Map.prototype.clear.call(self);
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
  }
}
