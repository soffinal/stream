import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { flat } from "./flat";

describe("flat transformer", () => {
  describe("basic functionality", () => {
    it("should flatten arrays with default depth 0", async () => {
      const stream = new Stream<number[]>();
      const flattened = stream.pipe(flat());

      const results: number[] = [];
      flattened.listen((value) => results.push(value));

      stream.push([1, 2, 3]);
      stream.push([4, 5]);
      stream.push([6]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("should handle non-array values", async () => {
      const stream = new Stream<number | number[]>();
      const flattened = stream.pipe(flat());

      const results: number[] = [];
      flattened.listen((value) => results.push(value));

      stream.push(1);
      stream.push([2, 3]);
      stream.push(4);
      stream.push([5, 6, 7]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("should handle empty arrays", async () => {
      const stream = new Stream<number[]>();
      const flattened = stream.pipe(flat());

      const results: number[] = [];
      flattened.listen((value) => results.push(value));

      stream.push([1, 2]);
      stream.push([]);
      stream.push([3, 4]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3, 4]);
    });
  });

  describe("depth control", () => {
    it("should flatten with depth 1", async () => {
      const stream = new Stream<number[][]>();
      const flattened = stream.pipe(flat(1));

      const results: number[] = [];
      flattened.listen((value) => results.push(value));

      stream.push([
        [1, 2],
        [3, 4],
      ]);
      stream.push([[5], [6, 7, 8]]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("should flatten with depth 2", async () => {
      const stream = new Stream<number[][][]>();
      const flattened = stream.pipe(flat(2));

      const results: number[] = [];
      flattened.listen((value) => results.push(value));

      stream.push([[[1, 2]], [[3, 4]]]);
      stream.push([[[5]], [[6, 7]]]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("should handle partial flattening", async () => {
      const stream = new Stream<number[][][]>();
      const flattened = stream.pipe(flat(1));

      const results: number[][] = [];
      flattened.listen((value) => results.push(value));

      stream.push([[[1, 2]], [[3, 4]]]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });
  });

  describe("mixed data types", () => {
    it("should handle mixed array and non-array values", async () => {
      const stream = new Stream<string | string[]>();
      const flattened = stream.pipe(flat());

      const results: string[] = [];
      flattened.listen((value) => results.push(value));

      stream.push("hello");
      stream.push(["world", "it"]);
      stream.push("end");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual(["hello", "world", "it", "end"]);
    });

    it("should handle arrays with different lengths", async () => {
      const stream = new Stream<number[]>();
      const flattened = stream.pipe(flat());

      const results: number[] = [];
      flattened.listen((value) => results.push(value));

      stream.push([1]);
      stream.push([2, 3, 4, 5]);
      stream.push([6, 7]);
      stream.push([8, 9, 10, 11, 12]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });
  });

  describe("performance and memory", () => {
    it("should handle large arrays efficiently", async () => {
      const stream = new Stream<number[]>();
      const flattened = stream.pipe(flat());

      const results: number[] = [];
      flattened.listen((value) => results.push(value));

      const largeArray = Array.from({ length: 1000 }, (_, i) => i);
      stream.push(largeArray);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toHaveLength(1000);
      expect(results[0]).toBe(0);
      expect(results[999]).toBe(999);
    });

    it("should handle many small arrays", async () => {
      const stream = new Stream<number[]>();
      const flattened = stream.pipe(flat());

      const results: number[] = [];
      flattened.listen((value) => results.push(value));

      for (let i = 0; i < 100; i++) {
        stream.push([i * 2, i * 2 + 1]);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toHaveLength(200);
      expect(results).toEqual(Array.from({ length: 200 }, (_, i) => i));
    });
  });

  describe("edge cases", () => {
    it("should handle empty stream", async () => {
      const stream = new Stream<number[]>();
      const flattened = stream.pipe(flat());

      const results: number[] = [];
      flattened.listen((value) => results.push(value));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([]);
    });

    it("should handle single element arrays", async () => {
      const stream = new Stream<number[]>();
      const flattened = stream.pipe(flat());

      const results: number[] = [];
      flattened.listen((value) => results.push(value));

      stream.push([1]);
      stream.push([2]);
      stream.push([3]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3]);
    });

    it("should handle nested empty arrays", async () => {
      const stream = new Stream<number[][]>();
      const flattened = stream.pipe(flat(1));

      const results: number[] = [];
      flattened.listen((value) => results.push(value));

      stream.push([[], [1, 2], []]);
      stream.push([[], [], [3]]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3]);
    });

    it("should handle rapid successive emissions", async () => {
      const stream = new Stream<number[]>();
      const flattened = stream.pipe(flat());

      const results: number[] = [];
      flattened.listen((value) => results.push(value));

      for (let i = 0; i < 50; i++) {
        stream.push([i * 2, i * 2 + 1]);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toHaveLength(100);
      expect(results).toEqual(Array.from({ length: 100 }, (_, i) => i));
    });
  });

  describe("type safety", () => {
    it("should maintain type safety with depth 0", async () => {
      const stream = new Stream<string[]>();
      const flattened = stream.pipe(flat(0));

      const results: string[] = [];
      flattened.listen((value) => results.push(value));

      stream.push(["a", "b", "c"]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual(["a", "b", "c"]);
    });

    it("should handle complex nested structures", async () => {
      const stream = new Stream<{ id: number; values: number[] }[]>();
      const flattened = stream.pipe(flat());

      const results: { id: number; values: number[] }[] = [];
      flattened.listen((value) => results.push(value));

      stream.push([
        { id: 1, values: [1, 2] },
        { id: 2, values: [3, 4] },
      ]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([
        { id: 1, values: [1, 2] },
        { id: 2, values: [3, 4] },
      ]);
    });
  });
});
