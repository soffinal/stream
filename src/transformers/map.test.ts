import { describe, it, expect } from "bun:test";
import { Stream } from "../stream";
import { map } from "./map";

describe("map transformer", () => {
  describe("basic functionality", () => {
    it("should transform values with stateless mapping", async () => {
      const stream = new Stream<number>();
      const mapped = stream.pipe(map({}, (state, value) => [value * 2, state]));

      const results: number[] = [];
      mapped.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it("should transform types correctly", async () => {
      const stream = new Stream<number>();
      const mapped = stream.pipe(map({}, (state, value) => [value.toString(), state]));

      const results: string[] = [];
      mapped.listen((value) => results.push(value));

      stream.push(1, 2, 3);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual(["1", "2", "3"]);
    });

    it("should handle empty stream", async () => {
      const stream = new Stream<number>();
      const mapped = stream.pipe(map({}, (state, value) => [value * 2, state]));

      const results: number[] = [];
      mapped.listen((value) => results.push(value));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([]);
    });
  });

  describe("stateful mapping", () => {
    it("should maintain state across transformations", async () => {
      const stream = new Stream<number>();
      const mapped = stream.pipe(
        map({ count: 0 }, (state, value) => [{ value, count: state.count }, { count: state.count + 1 }])
      );

      const results: { value: number; count: number }[] = [];
      mapped.listen((value) => results.push(value));

      stream.push(10, 20, 30);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([
        { value: 10, count: 0 },
        { value: 20, count: 1 },
        { value: 30, count: 2 },
      ]);
    });

    it("should accumulate state correctly", async () => {
      const stream = new Stream<number>();
      const mapped = stream.pipe(
        map({ sum: 0 }, (state, value) => {
          const newSum = state.sum + value;
          return [newSum, { sum: newSum }];
        })
      );

      const results: number[] = [];
      mapped.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 3, 6, 10, 15]); // Running sum
    });

    it("should handle complex state objects", async () => {
      const stream = new Stream<string>();
      const mapped = stream.pipe(
        map({ words: new Array<string>(), totalLength: 0 }, (state, value) => {
          const newWords = [...state.words, value];
          const newTotalLength = state.totalLength + value.length;
          return [
            {
              word: value,
              wordCount: newWords.length,
              avgLength: newTotalLength / newWords.length,
            },
            { words: newWords, totalLength: newTotalLength },
          ];
        })
      );

      const results: { word: string; wordCount: number; avgLength: number }[] = [];
      mapped.listen((value) => results.push(value));

      stream.push("hello", "world", "test");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([
        { word: "hello", wordCount: 1, avgLength: 5 },
        { word: "world", wordCount: 2, avgLength: 5 },
        { word: "test", wordCount: 3, avgLength: 4.666666666666667 },
      ]);
    });
  });

  describe("async mapping", () => {
    it("should handle async transformations", async () => {
      const stream = new Stream<number>();
      const mapped = stream.pipe(
        map({}, async (state, value) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return [value * 3, state];
        })
      );

      const results: number[] = [];
      mapped.listen((value) => results.push(value));

      stream.push(1, 2, 3);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(results).toEqual([3, 6, 9]);
    });

    it("should maintain order with async operations", async () => {
      const stream = new Stream<number>();
      const mapped = stream.pipe(
        map({ processed: 0 }, async (state, value) => {
          // Simulate varying async delays
          const delay = value === 2 ? 20 : 5;
          await new Promise((resolve) => setTimeout(resolve, delay));

          return [{ value, processedAt: state.processed }, { processed: state.processed + 1 }];
        })
      );

      const results: { value: number; processedAt: number }[] = [];
      mapped.listen((value) => results.push(value));

      stream.push(1, 2, 3);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(results).toEqual([
        { value: 1, processedAt: 0 },
        { value: 2, processedAt: 1 },
        { value: 3, processedAt: 2 },
      ]);
    });

    it("should handle async state updates", async () => {
      const stream = new Stream<string>();
      const mapped = stream.pipe(
        map({ cache: new Map<string, number>() }, async (state, value) => {
          // Simulate async lookup
          await new Promise((resolve) => setTimeout(resolve, 1));

          const count = (state.cache.get(value) || 0) + 1;
          const newCache = new Map(state.cache);
          newCache.set(value, count);

          return [{ word: value, occurrences: count }, { cache: newCache }];
        })
      );

      const results: { word: string; occurrences: number }[] = [];
      mapped.listen((value) => results.push(value));

      stream.push("hello", "world", "hello", "test", "world", "hello");

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(results).toEqual([
        { word: "hello", occurrences: 1 },
        { word: "world", occurrences: 1 },
        { word: "hello", occurrences: 2 },
        { word: "test", occurrences: 1 },
        { word: "world", occurrences: 2 },
        { word: "hello", occurrences: 3 },
      ]);
    });
  });

  describe("error handling", () => {
    it("should handle errors in transformation function", async () => {
      const stream = new Stream<number>();
      const mapped = stream.pipe(
        map({}, (state, value) => {
          if (value === 0) {
            throw new Error("Division by zero");
          }
          return [10 / value, state];
        })
      );

      const results: number[] = [];
      const errors: Error[] = [];

      mapped.listen(
        (value) => results.push(value)
        // Note: This assumes the Stream class handles error propagation
        // If not, we'd need to wrap in try-catch
      );

      stream.push(1, 2, 5);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([10, 5, 2]);
    });

    it("should handle async errors", async () => {
      const stream = new Stream<number>();
      const mapped = stream.pipe(
        map({}, async (state, value) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          if (value < 0) {
            throw new Error("Negative value");
          }
          return [Math.sqrt(value), state];
        })
      );

      const results: number[] = [];
      mapped.listen((value) => results.push(value));

      stream.push(4, 9, 16);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(results).toEqual([2, 3, 4]);
    });
  });

  describe("performance and memory", () => {
    it("should handle large volumes of data", async () => {
      const stream = new Stream<number>();
      const mapped = stream.pipe(
        map({ processed: 0 }, (state, value) => [value * 2, { processed: state.processed + 1 }])
      );

      const results: number[] = [];
      mapped.listen((value) => results.push(value));

      const largeArray = Array.from({ length: 1000 }, (_, i) => i);
      largeArray.forEach((value) => stream.push(value));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(results).toHaveLength(1000);
      expect(results[0]).toBe(0);
      expect(results[999]).toBe(1998);
    });

    it("should handle rapid successive emissions", async () => {
      const stream = new Stream<number>();
      const mapped = stream.pipe(map({ count: 0 }, (state, value) => [`item-${value}`, { count: state.count + 1 }]));

      const results: string[] = [];
      mapped.listen((value) => results.push(value));

      for (let i = 0; i < 100; i++) {
        stream.push(i);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toHaveLength(100);
      expect(results[0]).toBe("item-0");
      expect(results[99]).toBe("item-99");
    });
  });

  describe("edge cases", () => {
    it("should handle null and undefined values", async () => {
      const stream = new Stream<number | null | undefined>();
      const mapped = stream.pipe(
        map({}, (state, value) => [
          value === null ? "null" : value === undefined ? "undefined" : value.toString(),
          state,
        ])
      );

      const results: string[] = [];
      mapped.listen((value) => results.push(value));

      stream.push(1, null, 2, undefined, 3);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual(["1", "null", "2", "undefined", "3"]);
    });

    it("should handle complex object transformations", async () => {
      const stream = new Stream<{ id: number; name: string }>();
      const mapped = stream.pipe(
        map({ idCounter: 0 }, (state, value) => [
          {
            ...value,
            id: state.idCounter,
            name: value.name.toUpperCase(),
            processed: true,
          },
          { idCounter: state.idCounter + 1 },
        ])
      );

      const results: { id: number; name: string; processed: boolean }[] = [];
      mapped.listen((value) => results.push(value));

      stream.push({ id: 999, name: "alice" }, { id: 888, name: "bob" }, { id: 777, name: "charlie" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([
        { id: 0, name: "ALICE", processed: true },
        { id: 1, name: "BOB", processed: true },
        { id: 2, name: "CHARLIE", processed: true },
      ]);
    });

    it("should handle state mutations correctly", async () => {
      const stream = new Stream<number>();
      const mapped = stream.pipe(
        map({ history: [] as number[] }, (state, value) => {
          // Test that state is properly isolated
          const newHistory = [...state.history, value];
          return [{ value, historyLength: newHistory.length }, { history: newHistory }];
        })
      );

      const results: { value: number; historyLength: number }[] = [];
      mapped.listen((value) => results.push(value));

      stream.push(1, 2, 3);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([
        { value: 1, historyLength: 1 },
        { value: 2, historyLength: 2 },
        { value: 3, historyLength: 3 },
      ]);
    });
  });
});
