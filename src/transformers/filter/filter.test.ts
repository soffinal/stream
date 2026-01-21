import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { filter } from "./filter";

describe("filter transformer", () => {
  describe("basic functionality", () => {
    it("should filter values with stateless predicate", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(filter({}, (state, value) => [value > 3, state]));

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5, 6);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([4, 5, 6]);
    });

    it("should filter with type guards", async () => {
      const stream = new Stream<number | string>();
      const filtered = stream.pipe(filter({}, (state, value): [boolean, {}] => [typeof value === "number", state]));

      const results: (number | string)[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, "hello", 2, "world", 3);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3]);
    });

    it("should handle empty stream", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(filter({}, (state, value) => [value > 0, state]));

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([]);
    });

    it("should filter out all values when predicate is always false", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(filter({}, (state, value) => [false, state]));

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([]);
    });

    it("should pass all values when predicate is always true", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(filter({}, (state, value) => [true, state]));

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("stateful filtering", () => {
    it("should maintain count state", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter({ count: 0 }, (state, value) => [
          state.count < 3, // Only allow first 3 items
          { count: state.count + 1 },
        ]),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5, 6);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3]);
    });

    it("should filter based on accumulated state", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter({ sum: 0 }, (state, value) => {
          const newSum = state.sum + value;
          return [
            newSum <= 10, // Only allow while sum <= 10
            { sum: newSum },
          ];
        }),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(2, 3, 4, 5, 1); // sum: 2, 5, 9, 14(reject), 15(reject)

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([2, 3, 4]);
    });

    it("should handle complex state objects", async () => {
      const stream = new Stream<string>();
      const filtered = stream.pipe(
        filter({ seen: new Set<string>(), uniqueCount: 0 }, (state, value) => {
          const isNew = !state.seen.has(value);
          const newSeen = new Set(state.seen);
          if (isNew) newSeen.add(value);

          return [
            isNew && state.uniqueCount < 3, // Only first 3 unique values
            {
              seen: newSeen,
              uniqueCount: isNew ? state.uniqueCount + 1 : state.uniqueCount,
            },
          ];
        }),
      );

      const results: string[] = [];
      filtered.listen((value) => results.push(value));

      stream.push("a", "b", "a", "c", "b", "d", "e");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual(["a", "b", "c"]);
    });

    it("should handle alternating filter pattern", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter({ shouldPass: true }, (state, value) => [
          state.shouldPass,
          { shouldPass: !state.shouldPass }, // Alternate between true/false
        ]),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5, 6);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 3, 5]); // Every other item
    });
  });

  describe("async filtering", () => {
    it("should handle async predicates", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter({}, async (state, value) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return [value % 2 === 0, state];
        }),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5, 6);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(results).toEqual([2, 4, 6]);
    });

    it("should maintain order with async operations", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter({ processed: 0 }, async (state, value) => {
          // Simulate varying async delays
          const delay = value === 3 ? 20 : 5;
          await new Promise((resolve) => setTimeout(resolve, delay));

          return [value > 2, { processed: state.processed + 1 }];
        }),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(results).toEqual([3, 4, 5]);
    });

    it("should handle async state updates", async () => {
      const stream = new Stream<string>();
      const filtered = stream.pipe(
        filter({ cache: new Map<string, boolean>() }, async (state, value) => {
          // Simulate async validation
          await new Promise((resolve) => setTimeout(resolve, 1));

          const isValid = value.length > 3;
          const newCache = new Map(state.cache);
          newCache.set(value, isValid);

          return [isValid, { cache: newCache }];
        }),
      );

      const results: string[] = [];
      filtered.listen((value) => results.push(value));

      stream.push("hi", "hello", "ok", "world", "a", "test");

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(results).toEqual(["hello", "world", "test"]);
    });
  });

  describe("conditional filtering", () => {
    it("should filter based on previous values", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter({ prev: null as number | null }, (state, value) => {
          const shouldPass = state.prev === null || value > state.prev;
          return [shouldPass, { prev: value }];
        }),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 3, 2, 5, 4, 6); // Only increasing values

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 3, 5, 6]);
    });

    it("should implement throttle-like behavior", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter({ lastEmit: 0, delay: 100 }, (state, value) => {
          const now = Date.now();
          const shouldEmit = now - state.lastEmit >= state.delay;
          return [
            shouldEmit,
            {
              lastEmit: shouldEmit ? now : state.lastEmit,
              delay: state.delay,
            },
          ];
        }),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1);
      setTimeout(() => stream.push(2), 50); // Too soon
      setTimeout(() => stream.push(3), 120); // Should pass

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(results).toEqual([1, 3]);
    });

    it("should implement distinct behavior", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter({ seen: new Set<number>() }, (state, value) => {
          const isNew = !state.seen.has(value);
          const newSeen = new Set(state.seen);
          if (isNew) newSeen.add(value);

          return [isNew, { seen: newSeen }];
        }),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 1, 3, 2, 4, 1, 5);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("error handling", () => {
    it("should handle errors in predicate function", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter({}, (state, value) => {
          if (value === 0) {
            throw new Error("Zero not allowed");
          }
          return [value > 0, state];
        }),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3]);
    });

    it("should handle async errors gracefully", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter({}, async (state, value) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          if (value < 0) {
            throw new Error("Negative value");
          }
          return [value > 0, state];
        }),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe("performance and memory", () => {
    it("should handle large volumes of data", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter({ processed: 0 }, (state, value) => [value % 2 === 0, { processed: state.processed + 1 }]),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      for (let i = 0; i < 1000; i++) {
        stream.push(i);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(results).toHaveLength(500); // Half should pass (even numbers)
      expect(results[0]).toBe(0);
      expect(results[499]).toBe(998);
    });

    it("should handle rapid successive emissions", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter({ count: 0 }, (state, value) => [state.count < 50, { count: state.count + 1 }]),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      for (let i = 0; i < 100; i++) {
        stream.push(i);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toHaveLength(50);
      expect(results).toEqual(Array.from({ length: 50 }, (_, i) => i));
    });
  });

  describe("concurrency strategies", () => {
    it("should handle simple predicate with sequential strategy", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter(
          async (value) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return value > 2;
          },
          { strategy: "sequential" },
        ),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5);
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(results).toEqual([3, 4, 5]);
    });

    it("should handle simple predicate with concurrent-unordered strategy", async () => {
      const stream = new Stream<number>();
      const delays = [30, 10, 20, 5, 15];
      let callIndex = 0;

      const filtered = stream.pipe(
        filter(
          async (value) => {
            const delay = delays[callIndex++];
            await new Promise((resolve) => setTimeout(resolve, delay));
            return value > 2;
          },
          { strategy: "concurrent-unordered" },
        ),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5);
      await new Promise((resolve) => setTimeout(resolve, 80));

      // Results may be out of order due to different delays
      expect(results).not.toEqual([3, 4, 5]); // Should be reordered
      expect(results.sort()).toEqual([3, 4, 5]);
    });

    it("should handle simple predicate with concurrent-ordered strategy", async () => {
      const stream = new Stream<number>();
      const delays = [30, 10, 20, 5, 15];
      let callIndex = 0;

      const filtered = stream.pipe(
        filter(
          async (value) => {
            const delay = delays[callIndex++];
            await new Promise((resolve) => setTimeout(resolve, delay));
            return value > 2;
          },
          { strategy: "concurrent-ordered" },
        ),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Results should maintain original order despite different delays
      expect(results).toEqual([3, 4, 5]);
    });

    it("should handle type guard predicates (synchronous only)", async () => {
      const stream = new Stream<number | string>();
      const filtered = stream.pipe(filter((value): value is number => typeof value === "number"));

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, "hello", 2, "world", 3);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3]);
    });

    it("should handle stream termination with concurrent strategies", async () => {
      const stream = new Stream<number>();
      let processedCount = 0;

      const filtered = stream.pipe(
        filter(
          async (value) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            processedCount++;
            if (processedCount >= 3) return; // Terminate after 3 items
            return value > 0;
          },
          { strategy: "concurrent-unordered" },
        ),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(results).toHaveLength(2); // Only first 2 positive values
      expect(results.sort()).toEqual([1, 2]);
    });

    it("should handle complex async validation with ordered concurrency", async () => {
      const stream = new Stream<{ id: number; value: string }>();

      const filtered = stream.pipe(
        filter(
          async (item) => {
            // Simulate API validation with varying delays
            const delay = Math.random() * 20;
            await new Promise((resolve) => setTimeout(resolve, delay));
            return item.value.length > 3;
          },
          { strategy: "concurrent-ordered" },
        ),
      );

      const results: Array<{ id: number; value: string }> = [];
      filtered.listen((value) => results.push(value));

      stream.push({ id: 1, value: "hi" }, { id: 2, value: "hello" }, { id: 3, value: "ok" }, { id: 4, value: "world" });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(2);
      expect(results[1].id).toBe(4);
      expect(results[0].value).toBe("hello");
      expect(results[1].value).toBe("world");
    });
  });

  describe("edge cases", () => {
    it("should handle null and undefined values", async () => {
      const stream = new Stream<number | null | undefined>();
      const filtered = stream.pipe(filter({}, (state, value) => [value != null, state]));

      const results: (number | null | undefined)[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, null, 2, undefined, 3, 0);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3, 0]);
    });

    it("should handle complex object filtering", async () => {
      const stream = new Stream<{ id: number; active: boolean; score: number }>();
      const filtered = stream.pipe(
        filter({ minScore: 50 }, (state, value) => [value.active && value.score >= state.minScore, state]),
      );

      const results: { id: number; active: boolean; score: number }[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(
        { id: 1, active: true, score: 60 },
        { id: 2, active: false, score: 70 },
        { id: 3, active: true, score: 40 },
        { id: 4, active: true, score: 80 },
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([
        { id: 1, active: true, score: 60 },
        { id: 4, active: true, score: 80 },
      ]);
    });

    it("should handle state mutations correctly", async () => {
      const stream = new Stream<number>();
      const filtered = stream.pipe(
        filter({ history: [] as number[] }, (state, value) => {
          const newHistory = [...state.history, value];
          const shouldPass = newHistory.length <= 3;

          return [shouldPass, { history: shouldPass ? newHistory : state.history }];
        }),
      );

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      stream.push(1, 2, 3, 4, 5);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3]);
    });
  });
});
