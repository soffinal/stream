import { test, expect, describe } from "bun:test";
import { List } from "./list";

describe("List", () => {
  describe("Constructor", () => {
    test("creates empty list", () => {
      const list = new List<number>();
      expect(list.length).toBe(0);
    });

    test("creates list from iterable", () => {
      const list = new List([1, 2, 3]);
      expect(list.length).toBe(3);
      expect(list[0]).toBe(1);
      expect(list[1]).toBe(2);
      expect(list[2]).toBe(3);
    });
  });

  describe("Index Access", () => {
    test("gets values by index", () => {
      const list = new List([10, 20, 30]);
      expect(list[0]).toBe(10);
      expect(list[1]).toBe(20);
      expect(list[2]).toBe(30);
    });

    test("handles negative indices with modulo", () => {
      const list = new List([10, 20, 30]);
      expect(list[-1]).toBe(30); // -1 % 3 = 2
      expect(list[-2]).toBe(20); // -2 % 3 = 1
    });

    test("returns undefined for empty list", () => {
      const list = new List<number>();
      expect(list[0]).toBeUndefined();
      expect(list[-1]).toBeUndefined();
    });
  });

  describe("Index Mutation", () => {
    test("sets values by index", () => {
      const list = new List([1, 2, 3]);
      list[1] = 99;
      expect(list[1]).toBe(99);
    });

    test("handles negative index mutation", () => {
      const list = new List([1, 2, 3]);
      list[-1] = 99; // Sets last element
      expect(list[2]).toBe(99);
    });

    test("wraps index with modulo", () => {
      const list = new List([1, 2, 3]);
      list[5] = 99; // 5 % 3 = 2
      expect(list[2]).toBe(99);
    });

    test("set at the index 0 on empty list", () => {
      const list = new List<number>();

      const result = ((list as any)[0] = 99);

      expect(list.length).toBe(1);
    });
  });

  describe("Insert Method", () => {
    test("inserts at beginning", () => {
      const list = new List([2, 3]);
      list.insert(0, 1);
      expect([...list]).toEqual([1, 2, 3]);
    });

    test("inserts at end", () => {
      const list = new List([1, 2]);
      list.insert(2, 3);
      expect([...list]).toEqual([1, 2, 3]);
    });

    test("inserts in middle", () => {
      const list = new List([1, 3]);
      list.insert(1, 2);
      expect([...list]).toEqual([1, 2, 3]);
    });

    test("handles negative index", () => {
      const list = new List([1, 3]);
      list.insert(-1, 2); // Insert as last element (at the end)

      expect([...list]).toEqual([1, 3, 2]); // ✅ Correct expectation
    });

    test("returns list for chaining", () => {
      const list = new List<number>();
      const result = list.insert(0, 1);
      expect(result).toBe(list);
    });
  });

  describe("Delete Method", () => {
    test("deletes by index", () => {
      const list = new List([1, 2, 3]);
      const deleted = list.delete(1);
      expect(deleted).toBe(2);
      expect([...list]).toEqual([1, 3]);
    });

    test("returns undefined for invalid index", () => {
      const list = new List([1, 2, 3]);
      expect(list.delete(-1)).toBeUndefined();
      expect(list.delete(5)).toBeUndefined();
    });

    test("handles empty list", () => {
      const list = new List<number>();
      expect(list.delete(0)).toBeUndefined();
    });
  });

  describe("Clear Method", () => {
    test("clears all items", () => {
      const list = new List([1, 2, 3]);
      list.clear();
      expect(list.length).toBe(0);
      expect([...list]).toEqual([]);
    });

    test("handles empty list", () => {
      const list = new List<number>();
      list.clear();
      expect(list.length).toBe(0);
    });
  });

  describe("Reactive Streams", () => {
    test("insert stream emits on method call", async () => {
      const list = new List([1, 2]);
      const events: [number, number][] = [];

      list.insert.listen((event) => events.push(event));

      list.insert(1, 99);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(events).toEqual([[1, 99]]);
    });

    test("insert stream emits on index mutation", async () => {
      const list = new List([1, 2, 3]);
      const events: [number, number][] = [];

      list.insert.listen((event) => events.push(event));

      list[1] = 99;
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(events).toEqual([[1, 99]]);
    });

    test("delete stream emits", async () => {
      const list = new List([1, 2, 3]);
      const events: [number, number][] = [];

      list.delete.listen((event) => events.push(event));

      list.delete(1);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(events).toEqual([[1, 2]]);
    });

    test("clear stream emits", async () => {
      const list = new List([1, 2, 3]);
      const events: number[] = [];

      list.clear.listen(() => events.push(2));

      list.clear();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(events).toHaveLength(1);
    });

    test("no event on no-op mutations", async () => {
      const list = new List([1, 2, 3]);
      const events: [number, number][] = [];

      list.insert.listen((event) => events.push(event));

      list[1] = 2; // Same value
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(events).toEqual([]);
    });
  });

  describe("Iteration", () => {
    test("implements iterable", () => {
      const list = new List([1, 2, 3]);
      expect([...list]).toEqual([1, 2, 3]);
    });

    test("values() method", () => {
      const list = new List([1, 2, 3]);
      expect([...list.values()]).toEqual([1, 2, 3]);
    });
  });

  describe("Properties", () => {
    test("length property", () => {
      const list = new List([1, 2, 3]);
      expect(list.length).toBe(3);

      list.insert(0, 0);
      expect(list.length).toBe(4);

      list.delete(0);
      expect(list.length).toBe(3);
    });

    test("get() method", () => {
      const list = new List([1, 2, 3]);
      expect(list.get(0)).toBe(1);
      expect(list.get(5)).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    test("handles large indices", () => {
      const list = new List([1, 2, 3]);
      list[1000] = 99; // 1000 % 3 = 1
      expect(list[1]).toBe(99);
    });

    test("handles very negative indices", () => {
      const list = new List([1, 2, 3]);
      list[-1000] = 99; // Wraps to index 2
      expect(list[2]).toBe(99);
    });

    test("ordering operations", async () => {
      const list = new List([1, 2, 3, 4]);
      const events: [number, number][] = [];

      list.insert.listen((event) => events.push(event));
      list.delete.listen((event) => events.push(event));

      // Move item from index 0 to index 2
      const value = list.delete(0);
      list.insert(2, value!);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(events).toEqual([
        [0, 1], // Delete from 0
        [2, 1], // Insert at 2
      ]);
      expect([...list]).toEqual([2, 3, 1, 4]);
    });
  });
});
