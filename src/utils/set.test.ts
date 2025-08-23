import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { Set } from "./set";

describe("Set", () => {
  let set: Set<number>;
  let cleanups: (() => void)[] = [];

  beforeEach(() => {
    set = new Set();
    cleanups = [];
  });

  afterEach(() => {
    cleanups.forEach((cleanup) => cleanup());
    cleanups = [];
  });

  describe("constructor", () => {
    it("should create empty set", () => {
      const set = new Set<number>();
      expect(set.size).toBe(0);
    });

    it("should initialize with iterable", () => {
      const set = new Set([1, 2, 3, 2, 1]);
      expect(set.size).toBe(3);
      expect(set.has(1)).toBe(true);
      expect(set.has(2)).toBe(true);
      expect(set.has(3)).toBe(true);
    });

    it("should work with different types", () => {
      const stringSet = new Set(["a", "b", "c"]);
      const objectSet = new Set([{ id: 1 }, { id: 2 }]);

      expect(stringSet.size).toBe(3);
      expect(objectSet.size).toBe(2);
    });
  });

  describe("add method", () => {
    it("should add new values", () => {
      const result = set.add(1);
      expect(result).toBe(set); // returns this
      expect(set.has(1)).toBe(true);
      expect(set.size).toBe(1);
    });

    it("should not add duplicate values", () => {
      set.add(1);
      set.add(1);
      expect(set.size).toBe(1);
    });

    it("should notify listeners when adding new values", () => {
      const listener = jest.fn();
      cleanups.push(set.add.listen(listener));

      set.add(1);
      expect(listener).toHaveBeenCalledWith(1);
    });

    it("should not notify listeners for duplicate values", () => {
      const listener = jest.fn();
      set.add(1); // Add first
      cleanups.push(set.add.listen(listener));

      set.add(1); // Try to add duplicate
      expect(listener).not.toHaveBeenCalled();
    });

    it("should notify multiple listeners", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      cleanups.push(set.add.listen(listener1));
      cleanups.push(set.add.listen(listener2));

      set.add(42);
      expect(listener1).toHaveBeenCalledWith(42);
      expect(listener2).toHaveBeenCalledWith(42);
    });

    it("should support async iteration", async () => {
      const values: number[] = [];
      const iterator = set.add[Symbol.asyncIterator]();

      (async () => {
        for await (const value of iterator) {
          values.push(value);
          if (values.length === 3) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));

      set.add(1);
      set.add(2);
      set.add(2); // duplicate, shouldn't emit
      set.add(3);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([1, 2, 3]);
      await iterator.return();
    });
  });

  describe("delete method", () => {
    beforeEach(() => {
      set.add(1);
      set.add(2);
      set.add(3);
    });

    it("should delete existing values", () => {
      const result = set.delete(1);
      expect(result).toBe(true);
      expect(set.has(1)).toBe(false);
      expect(set.size).toBe(2);
    });

    it("should return false for non-existing values", () => {
      const result = set.delete(99);
      expect(result).toBe(false);
      expect(set.size).toBe(3);
    });

    it("should notify listeners when deleting existing values", () => {
      const listener = jest.fn();
      cleanups.push(set.delete.listen(listener));

      set.delete(1);
      expect(listener).toHaveBeenCalledWith(1);
    });

    it("should not notify listeners for non-existing values", () => {
      const listener = jest.fn();
      cleanups.push(set.delete.listen(listener));

      set.delete(99);
      expect(listener).not.toHaveBeenCalled();
    });

    it("should notify multiple listeners", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      cleanups.push(set.delete.listen(listener1));
      cleanups.push(set.delete.listen(listener2));

      set.delete(2);
      expect(listener1).toHaveBeenCalledWith(2);
      expect(listener2).toHaveBeenCalledWith(2);
    });

    it("should support async iteration", async () => {
      const values: number[] = [];
      const iterator = set.delete[Symbol.asyncIterator]();

      (async () => {
        for await (const value of iterator) {
          values.push(value);
          if (values.length === 2) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));

      set.delete(1);
      set.delete(99); // doesn't exist, shouldn't emit
      set.delete(2);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([1, 2]);
      await iterator.return();
    });
  });

  describe("clear method", () => {
    beforeEach(() => {
      set.add(1);
      set.add(2);
      set.add(3);
    });

    it("should clear all values", () => {
      set.clear();
      expect(set.size).toBe(0);
      expect(set.has(1)).toBe(false);
      expect(set.has(2)).toBe(false);
      expect(set.has(3)).toBe(false);
    });

    it("should notify listeners when clearing non-empty set", () => {
      const listener = jest.fn();
      cleanups.push(set.clear.listen(listener));

      set.clear();
      expect(listener).toHaveBeenCalledWith(undefined);
    });

    it("should not notify listeners when clearing empty set", () => {
      const emptySet = new Set<number>();
      const listener = jest.fn();
      cleanups.push(emptySet.clear.listen(listener));

      emptySet.clear();
      expect(listener).not.toHaveBeenCalled();
    });

    it("should notify multiple listeners", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      cleanups.push(set.clear.listen(listener1));
      cleanups.push(set.clear.listen(listener2));

      set.clear();
      expect(listener1).toHaveBeenCalledWith(undefined);
      expect(listener2).toHaveBeenCalledWith(undefined);
    });

    it("should support async iteration", async () => {
      const values: any[] = [];
      const iterator = set.clear[Symbol.asyncIterator]();

      (async () => {
        for await (const value of iterator) {
          values.push(value);
          if (values.length === 2) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));

      set.clear();
      set.add(1); // Add something back
      set.clear(); // Clear again

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([undefined, undefined]);
      await iterator.return();
    });
  });

  describe("stream operations", () => {
    it("should support filter on add stream", async () => {
      const filtered = set.add.filter((x) => x > 5);
      const values: number[] = [];

      const iterator = filtered[Symbol.asyncIterator]();
      (async () => {
        for await (const value of iterator) {
          values.push(value);
          if (values.length === 2) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));

      set.add(3); // filtered out
      set.add(7); // included
      set.add(2); // filtered out
      set.add(10); // included

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([7, 10]);
      await iterator.return();
    });

    it("should support map on delete stream", async () => {
      set.add(1);
      set.add(2);
      set.add(3);

      const mapped = set.delete.map((x) => `deleted-${x}`);
      const values: string[] = [];

      const iterator = mapped[Symbol.asyncIterator]();
      (async () => {
        for await (const value of iterator) {
          values.push(value);
          if (values.length === 2) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));

      set.delete(1);
      set.delete(2);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual(["deleted-1", "deleted-2"]);
      await iterator.return();
    });

    it("should support then (Promise-like behavior)", async () => {
      const promise = set.add.then((x) => x * 2);

      set.add(21);

      const result = await promise;
      expect(result).toBe(42);
    });
  });

  describe("Set inheritance", () => {
    it("should inherit all Set methods", () => {
      set.add(1);
      set.add(2);
      set.add(3);

      expect(set.size).toBe(3);
      expect(set.has(2)).toBe(true);
      expect([...set]).toEqual([1, 2, 3]);
      expect([...set.values()]).toEqual([1, 2, 3]);
      expect([...set.keys()]).toEqual([1, 2, 3]);
    });

    it("should support forEach", () => {
      set.add(1);
      set.add(2);
      set.add(3);

      const values: number[] = [];
      set.forEach((value) => values.push(value));

      expect(values).toEqual([1, 2, 3]);
    });

    it("should be iterable", () => {
      set.add(1);
      set.add(2);
      set.add(3);

      const values: number[] = [];
      for (const value of set) {
        values.push(value);
      }

      expect(values).toEqual([1, 2, 3]);
    });
  });

  describe("listener management", () => {
    it("should track hasListeners correctly for add stream", () => {
      expect(set.add.hasListeners).toBe(false);

      const cleanup = set.add.listen(() => {});
      expect(set.add.hasListeners).toBe(true);

      cleanup();
      expect(set.add.hasListeners).toBe(false);
    });

    it("should handle AbortSignal for delete stream", () => {
      set.add(1);
      const controller = new AbortController();
      const listener = jest.fn();

      set.delete.listen(listener, controller.signal);
      expect(set.delete.hasListeners).toBe(true);

      controller.abort();
      expect(set.delete.hasListeners).toBe(false);

      set.delete(1);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle object values", () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const objSet = new Set([obj1]);

      const listener = jest.fn();
      cleanups.push(objSet.add.listen(listener));

      objSet.add(obj2);
      expect(listener).toHaveBeenCalledWith(obj2);
      expect(objSet.size).toBe(2);
    });

    it("should handle undefined and null values", () => {
      const mixedSet = new Set<number | null | undefined>();
      const listener = jest.fn();
      cleanups.push(mixedSet.add.listen(listener));

      mixedSet.add(null);
      mixedSet.add(undefined);
      mixedSet.add(0);

      expect(listener).toHaveBeenCalledTimes(3);
      expect(mixedSet.size).toBe(3);
    });

    it("should lazy-initialize streams", () => {
      const newSet = new Set<number>();

      // Streams should not exist until accessed
      expect((newSet as any)._addStream).toBeUndefined();
      expect((newSet as any)._deleteStream).toBeUndefined();
      expect((newSet as any)._clearStream).toBeUndefined();

      // Accessing stream properties should create them
      newSet.add.listen(() => {});
      expect((newSet as any)._addStream).toBeDefined();
    });
  });
});
