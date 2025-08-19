import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { Map } from "./map";

describe("Map", () => {
  let map: Map<string, any>;
  let cleanups: (() => void)[] = [];

  beforeEach(() => {
    map = new Map();
    cleanups = [];
  });

  afterEach(() => {
    cleanups.forEach((cleanup) => cleanup());
    cleanups = [];
  });

  describe("constructor", () => {
    it("should create empty map", () => {
      const map = new Map<string, number>();
      expect(map.size).toBe(0);
    });

    it("should initialize with iterable", () => {
      const map = new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]);
      expect(map.size).toBe(3);
      expect(map.get("a")).toBe(1);
      expect(map.get("b")).toBe(2);
      expect(map.get("c")).toBe(3);
    });

    it("should work with different key/value types", () => {
      const numberMap = new Map([
        [1, "one"],
        [2, "two"],
      ]);
      const objectMap = new Map([
        [{ id: 1 }, "obj1"],
        [{ id: 2 }, "obj2"],
      ]);

      expect(numberMap.size).toBe(2);
      expect(objectMap.size).toBe(2);
    });
  });

  describe("set method", () => {
    it("should set new key-value pairs", () => {
      const result = map.set("key1", 42);
      expect(result).toBe(map); // returns this
      expect(map.get("key1")).toBe(42);
      expect(map.size).toBe(1);
    });

    it("should update existing keys", () => {
      map.set("key1", 10);
      map.set("key1", 20);
      expect(map.get("key1")).toBe(20);
      expect(map.size).toBe(1);
    });

    it("should notify listeners when setting new key-value pairs", () => {
      const listener = jest.fn();
      cleanups.push(map.set.listen(listener));

      map.set("key1", 42);
      expect(listener).toHaveBeenCalledWith(["key1", 42]);
    });

    it("should notify listeners when updating existing keys", () => {
      const listener = jest.fn();
      map.set("key1", 10); // Set initial value
      cleanups.push(map.set.listen(listener));

      map.set("key1", 20); // Update value
      expect(listener).toHaveBeenCalledWith(["key1", 20]);
    });

    it("should not notify listeners when setting same key-value pair", () => {
      const listener = jest.fn();
      map.set("key1", 42); // Set initial value
      cleanups.push(map.set.listen(listener));

      map.set("key1", 42); // Set same value
      expect(listener).not.toHaveBeenCalled();
    });

    it("should notify multiple listeners", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      cleanups.push(map.set.listen(listener1));
      cleanups.push(map.set.listen(listener2));

      map.set("key1", 42);
      expect(listener1).toHaveBeenCalledWith(["key1", 42]);
      expect(listener2).toHaveBeenCalledWith(["key1", 42]);
    });

    it("should support async iteration", async () => {
      const values: [string, number][] = [];
      const iterator = map.set[Symbol.asyncIterator]();

      (async () => {
        for await (const value of iterator) {
          values.push(value);
          if (values.length === 3) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));

      map.set("a", 1);
      map.set("b", 2);
      map.set("a", 1); // same value, shouldn't emit
      map.set("c", 3);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]);
      await iterator.return();
    });
  });

  describe("delete method", () => {
    beforeEach(() => {
      map.set("key1", 10);
      map.set("key2", 20);
      map.set("key3", 30);
    });

    it("should delete existing keys", () => {
      const result = map.delete("key1");
      expect(result).toBe(true);
      expect(map.has("key1")).toBe(false);
      expect(map.size).toBe(2);
    });

    it("should return false for non-existing keys", () => {
      const result = map.delete("nonexistent");
      expect(result).toBe(false);
      expect(map.size).toBe(3);
    });

    it("should notify listeners when deleting existing keys", () => {
      const listener = jest.fn();
      cleanups.push(map.delete.listen(listener));

      map.delete("key1");
      expect(listener).toHaveBeenCalledWith(["key1", 10]);
    });

    it("should not notify listeners for non-existing keys", () => {
      const listener = jest.fn();
      cleanups.push(map.delete.listen(listener));

      map.delete("nonexistent");
      expect(listener).not.toHaveBeenCalled();
    });

    it("should notify multiple listeners", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      cleanups.push(map.delete.listen(listener1));
      cleanups.push(map.delete.listen(listener2));

      map.delete("key2");
      expect(listener1).toHaveBeenCalledWith(["key2", 20]);
      expect(listener2).toHaveBeenCalledWith(["key2", 20]);
    });

    it("should support async iteration", async () => {
      const values: [string, number][] = [];
      const iterator = map.delete[Symbol.asyncIterator]();

      (async () => {
        for await (const value of iterator) {
          values.push(value);
          if (values.length === 2) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));

      map.delete("key1");
      map.delete("nonexistent"); // doesn't exist, shouldn't emit
      map.delete("key2");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([
        ["key1", 10],
        ["key2", 20],
      ]);
      await iterator.return();
    });
  });

  describe("clear method", () => {
    beforeEach(() => {
      map.set("key1", 10);
      map.set("key2", 20);
      map.set("key3", 30);
    });

    it("should clear all entries", () => {
      map.clear();
      expect(map.size).toBe(0);
      expect(map.has("key1")).toBe(false);
      expect(map.has("key2")).toBe(false);
      expect(map.has("key3")).toBe(false);
    });

    it("should notify listeners when clearing non-empty map", () => {
      const listener = jest.fn();
      cleanups.push(map.clear.listen(listener));

      map.clear();
      expect(listener).toHaveBeenCalledWith(undefined);
    });

    it("should not notify listeners when clearing empty map", () => {
      const emptyMap = new Map<string, number>();
      const listener = jest.fn();
      cleanups.push(emptyMap.clear.listen(listener));

      emptyMap.clear();
      expect(listener).not.toHaveBeenCalled();
    });

    it("should notify multiple listeners", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      cleanups.push(map.clear.listen(listener1));
      cleanups.push(map.clear.listen(listener2));

      map.clear();
      expect(listener1).toHaveBeenCalledWith(undefined);
      expect(listener2).toHaveBeenCalledWith(undefined);
    });

    it("should support async iteration", async () => {
      const values: any[] = [];
      const iterator = map.clear[Symbol.asyncIterator]();

      (async () => {
        for await (const value of iterator) {
          values.push(value);
          if (values.length === 2) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));

      map.clear();
      map.set("key1", 10); // Add something back
      map.clear(); // Clear again

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([undefined, undefined]);
      await iterator.return();
    });
  });

  describe("stream operations", () => {
    it("should support filter on set stream", async () => {
      const filtered = map.set.filter(([key, value]) => value > 15);
      const values: [string, number][] = [];

      const iterator = filtered[Symbol.asyncIterator]();
      (async () => {
        for await (const value of iterator) {
          values.push(value);
          if (values.length === 2) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));

      map.set("a", 10); // filtered out
      map.set("b", 20); // included
      map.set("c", 5); // filtered out
      map.set("d", 25); // included

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([
        ["b", 20],
        ["d", 25],
      ]);
      await iterator.return();
    });

    it("should support map on delete stream", async () => {
      map.set("key1", 10);
      map.set("key2", 20);
      map.set("key3", 30);

      const mapped = map.delete.map(([key, value]) => `${key}:${value}`);
      const values: string[] = [];

      const iterator = mapped[Symbol.asyncIterator]();
      (async () => {
        for await (const value of iterator) {
          values.push(value);
          if (values.length === 2) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));

      map.delete("key1");
      map.delete("key2");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual(["key1:10", "key2:20"]);
      await iterator.return();
    });

    it("should support then (Promise-like behavior)", async () => {
      const promise = map.set.then();

      map.set("test", 42);

      const result = await promise;

      expect(result).toEqual(["test", 42]);
    });
  });

  describe("Map inheritance", () => {
    it("should inherit all Map methods", () => {
      map.set("a", 1);
      map.set("b", 2);
      map.set("c", 3);

      expect(map.size).toBe(3);
      expect(map.has("b")).toBe(true);
      expect(map.get("b")).toBe(2);
      expect([...map.keys()]).toEqual(["a", "b", "c"]);
      expect([...map.values()]).toEqual([1, 2, 3]);
      expect([...map.entries()]).toEqual([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]);
    });

    it("should support forEach", () => {
      map.set("a", 1);
      map.set("b", 2);
      map.set("c", 3);

      const entries: [string, number][] = [];
      map.forEach((value, key) => entries.push([key, value]));

      expect(entries).toEqual([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]);
    });

    it("should be iterable", () => {
      map.set("a", 1);
      map.set("b", 2);
      map.set("c", 3);

      const entries = [];
      for (const entry of map) {
        entries.push(entry);
      }

      expect(entries).toEqual([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]);
    });
  });

  describe("listener management", () => {
    it("should track hasListeners correctly for set stream", () => {
      expect(map.set.hasListeners).toBe(false);

      const cleanup = map.set.listen(() => {});
      expect(map.set.hasListeners).toBe(true);

      cleanup();
      expect(map.set.hasListeners).toBe(false);
    });

    it("should handle AbortSignal for delete stream", () => {
      map.set("key1", 10);
      const controller = new AbortController();
      const listener = jest.fn();

      map.delete.listen(listener, controller.signal);
      expect(map.delete.hasListeners).toBe(true);

      controller.abort();
      expect(map.delete.hasListeners).toBe(false);

      map.delete("key1");
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle object keys and values", () => {
      const key1 = { id: 1 };
      const key2 = { id: 2 };
      const value1 = { name: "Alice" };
      const value2 = { name: "Bob" };

      const objMap = new Map([[key1, value1]]);
      const listener = jest.fn();
      cleanups.push(objMap.set.listen(listener));

      objMap.set(key2, value2);
      expect(listener).toHaveBeenCalledWith([key2, value2]);
      expect(objMap.size).toBe(2);
    });

    it("should handle undefined and null keys/values", () => {
      const mixedMap = new Map<any, any>();
      const listener = jest.fn();
      cleanups.push(mixedMap.set.listen(listener));

      mixedMap.set(null, "null-key");
      mixedMap.set(undefined, "undefined-key");
      mixedMap.set("null-value", null);
      mixedMap.set("undefined-value", undefined);

      expect(listener).toHaveBeenCalledTimes(4);
      expect(mixedMap.size).toBe(4);
    });

    it("should handle primitive value equality correctly", () => {
      const listener = jest.fn();
      cleanups.push(map.set.listen(listener));

      map.set("key", 42);
      map.set("key", 42); // Same primitive value
      map.set("key", 43); // Different value

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenNthCalledWith(1, ["key", 42]);
      expect(listener).toHaveBeenNthCalledWith(2, ["key", 43]);
    });

    it("should handle object value equality by reference", () => {
      const obj1 = { value: 42 };
      const obj2 = { value: 42 }; // Different reference, same content

      const listener = jest.fn();
      cleanups.push(map.set.listen(listener));

      map.set("key", obj1);
      map.set("key", obj1); // Same reference
      map.set("key", obj2); // Different reference

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenNthCalledWith(1, ["key", obj1]);
      expect(listener).toHaveBeenNthCalledWith(2, ["key", obj2]);
    });

    it("should lazy-initialize streams", () => {
      const newMap = new Map<string, number>();

      // Streams should not exist until accessed
      expect((newMap as any)._setStream).toBeUndefined();
      expect((newMap as any)._deleteStream).toBeUndefined();
      expect((newMap as any)._clearStream).toBeUndefined();

      // Accessing stream properties should create them
      newMap.set.listen(() => {});
      expect((newMap as any)._setStream).toBeDefined();
    });

    it("should handle WeakMap-like behavior with object keys", () => {
      const key1 = { id: 1 };
      const key2 = { id: 2 };

      map.set(key1 as any, 100);
      map.set(key2 as any, 200);

      expect(map.get(key1 as any)).toBe(100);
      expect(map.get(key2 as any)).toBe(200);
      expect(map.size).toBe(2);
    });
  });

  describe("complex scenarios", () => {
    it("should handle rapid set/delete operations", () => {
      const setListener = jest.fn();
      const deleteListener = jest.fn();

      cleanups.push(map.set.listen(setListener));
      cleanups.push(map.delete.listen(deleteListener));

      map.set("key", 1);
      map.set("key", 2);
      map.delete("key");
      map.set("key", 3);

      expect(setListener).toHaveBeenCalledTimes(3);
      expect(deleteListener).toHaveBeenCalledTimes(1);
      expect(deleteListener).toHaveBeenCalledWith(["key", 2]);
    });

    it("should maintain correct state after multiple operations", () => {
      map.set("a", 1);
      map.set("b", 2);
      map.set("a", 10); // Update
      map.delete("b");
      map.set("c", 3);

      expect(map.size).toBe(2);
      expect(map.get("a")).toBe(10);
      expect(map.has("b")).toBe(false);
      expect(map.get("c")).toBe(3);
    });
  });
});
