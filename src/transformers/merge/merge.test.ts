import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { merge } from "./merge";

describe("merge transformer", () => {
  describe("basic functionality", () => {
    it("should merge two streams with same type", async () => {
      const stream1 = new Stream<number>();
      const stream2 = new Stream<number>();
      const merged = stream1.pipe(merge(stream2));

      const results: number[] = [];
      merged.listen((value) => results.push(value));

      stream1.push(1, 2);
      stream2.push(3, 4);
      stream1.push(5);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3, 4, 5]);
    });

    it("should merge streams with different types", async () => {
      const numberStream = new Stream<number>();
      const stringStream = new Stream<string>();
      const merged = numberStream.pipe(merge(stringStream));

      const results: (number | string)[] = [];
      merged.listen((value) => results.push(value));

      numberStream.push(1);
      stringStream.push("hello");
      numberStream.push(2);
      stringStream.push("world");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, "hello", 2, "world"]);
    });

    it("should handle empty streams", async () => {
      const stream1 = new Stream<number>();
      const stream2 = new Stream<number>();
      const merged = stream1.pipe(merge(stream2));

      const results: number[] = [];
      merged.listen((value) => results.push(value));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([]);
    });
  });

  describe("multiple streams", () => {
    it("should merge three streams", async () => {
      const stream1 = new Stream<number>();
      const stream2 = new Stream<number>();
      const stream3 = new Stream<number>();
      const merged = stream1.pipe(merge(stream2, stream3));

      const results: number[] = [];
      merged.listen((value) => results.push(value));

      stream1.push(1);
      stream2.push(2);
      stream3.push(3);
      stream1.push(4);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3, 4]);
    });

    it("should merge multiple streams with different types", async () => {
      const numberStream = new Stream<number>();
      const stringStream = new Stream<string>();
      const booleanStream = new Stream<boolean>();
      const merged = numberStream.pipe(merge(stringStream, booleanStream));

      const results: (number | string | boolean)[] = [];
      merged.listen((value) => results.push(value));

      numberStream.push(42);
      stringStream.push("it");
      booleanStream.push(true);
      numberStream.push(100);
      booleanStream.push(false);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([42, "it", true, 100, false]);
    });
  });

  describe("timing and order", () => {
    it("should preserve emission order within same tick", async () => {
      const stream1 = new Stream<string>();
      const stream2 = new Stream<string>();
      const merged = stream1.pipe(merge(stream2));

      const results: string[] = [];
      merged.listen((value) => results.push(value));

      // Push multiple values in same tick
      stream1.push("a", "b");
      stream2.push("c", "d");
      stream1.push("e");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("should handle async timing correctly", async () => {
      const stream1 = new Stream<number>();
      const stream2 = new Stream<number>();
      const merged = stream1.pipe(merge(stream2));

      const results: number[] = [];
      merged.listen((value) => results.push(value));

      stream1.push(1);

      setTimeout(() => stream2.push(2), 5);
      setTimeout(() => stream1.push(3), 10);
      setTimeout(() => stream2.push(4), 15);

      await new Promise((resolve) => setTimeout(resolve, 25));

      expect(results).toEqual([1, 2, 3, 4]);
    });
  });

  describe("cleanup and memory management", () => {
    it("should cleanup listeners when merged stream is abandoned", async () => {
      const stream1 = new Stream<number>();
      const stream2 = new Stream<number>();
      const merged = stream1.pipe(merge(stream2));

      let listenerCount = 0;
      const cleanup = merged.listen(() => listenerCount++);

      stream1.push(1);
      stream2.push(2);

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(listenerCount).toBe(2);

      // Cleanup
      cleanup();

      stream1.push(3);
      stream2.push(4);

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(listenerCount).toBe(2); // Should not increase
    });

    it("should handle one stream ending while others continue", async () => {
      const stream1 = new Stream<number>();
      const stream2 = new Stream<number>();
      const merged = stream1.pipe(merge(stream2));

      const results: number[] = [];
      merged.listen((value) => results.push(value));

      stream1.push(1);
      stream2.push(2);

      // Simulate stream1 ending (no more pushes)
      stream2.push(3, 4);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3, 4]);
    });
  });

  describe("edge cases", () => {
    it("should handle rapid successive emissions", async () => {
      const stream1 = new Stream<number>();
      const stream2 = new Stream<number>();
      const merged = stream1.pipe(merge(stream2));

      const results: number[] = [];
      merged.listen((value) => results.push(value));

      // Rapid emissions
      for (let i = 0; i < 100; i++) {
        if (i % 2 === 0) {
          stream1.push(i);
        } else {
          stream2.push(i);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toHaveLength(100);
      expect(results).toEqual(Array.from({ length: 100 }, (_, i) => i));
    });

    it("should work with single stream merge", async () => {
      const stream1 = new Stream<number>();
      const stream2 = new Stream<number>();
      const merged = stream1.pipe(merge(stream2));

      const results: number[] = [];
      merged.listen((value) => results.push(value));

      // Only use one stream
      stream1.push(1, 2, 3);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3]);
    });
  });
});
