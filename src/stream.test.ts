import { test, expect, describe } from "bun:test";
import { Stream, map, filter, group, merge, flat } from "./stream";

describe("Stream", () => {
  describe("Constructor", () => {
    test("creates empty stream", () => {
      const stream = new Stream<number>();
      expect(stream.hasListeners).toBe(false);
    });

    test("creates stream with generator function", () => {
      const stream = new Stream(async function* () {
        yield 1;
        yield 2;
      });
      expect(stream.hasListeners).toBe(false);
    });
  });

  describe("Push and Listen", () => {
    test("pushes and receives values", async () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      stream.listen((value) => values.push(value));

      stream.push(1, 2, 3);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([1, 2, 3]);
    });

    test("handles empty push", async () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      stream.listen((value) => values.push(value));

      stream.push(undefined as never);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([undefined as never]);
    });

    test("multiple listeners receive same values", async () => {
      const stream = new Stream<number>();
      const values1: number[] = [];
      const values2: number[] = [];

      stream.listen((value) => values1.push(value));
      stream.listen((value) => values2.push(value));

      stream.push(1, 2);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values1).toEqual([1, 2]);
      expect(values2).toEqual([1, 2]);
    });

    test("hasListeners property", () => {
      const stream = new Stream<number>();

      expect(stream.hasListeners).toBe(false);

      const abort = stream.listen(() => {});

      expect(stream.hasListeners).toBe(true);

      abort();

      expect(stream.hasListeners).toBe(false);
    });
  });

  describe("AbortSignal Support", () => {
    test("respects aborted signal", async () => {
      const stream = new Stream<number>();
      const controller = new AbortController();
      controller.abort();

      const values: number[] = [];
      stream.listen((value) => values.push(value), controller.signal);

      stream.push(1);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([]);
    });

    test("aborts listener with signal", async () => {
      const stream = new Stream<number>();
      const controller = new AbortController();
      const values: number[] = [];

      stream.listen((value) => values.push(value), controller.signal);

      stream.push(1);
      controller.abort();
      stream.push(2);

      await new Promise((resolve) => setTimeout(resolve, 0));
      console.log(values);

      expect(values).toEqual([1]);
    });
  });

  describe("Generator Function", () => {
    test("consumes generator when first listener added", async () => {
      const stream = new Stream(async function* () {
        yield 1;
        yield 2;
        yield 3;
      });

      const values: number[] = [];
      stream.listen((value) => values.push(value));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([1, 2, 3]);
    });

    test("generator shared between multiple listeners", async () => {
      const stream = new Stream(async function* () {
        yield 1;
        yield 2;
      });

      const values1: number[] = [];
      const values2: number[] = [];

      stream.listen((value) => values1.push(value));
      stream.listen((value) => values2.push(value));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values1).toEqual([1, 2]);
      expect(values2).toEqual([1, 2]);
    });
  });

  describe("Promise Interface", () => {
    test("then resolves with first value", async () => {
      const stream = new Stream<number>();

      const promise = stream.then((value) => value * 2);
      stream.push(5);

      const result = await promise;
      expect(result).toBe(10);
    });

    test("then resolves only once", async () => {
      const stream = new Stream<number>();

      const promise = stream.then();
      stream.push(1);
      stream.push(2);

      const result = await promise;
      expect(result).toBe(1);
    });
  });

  describe("Filter", () => {
    test("filters with predicate function", async () => {
      const stream = new Stream<number>();
      const filtered = stream.filter((x) => x > 2);

      const values: number[] = [];
      filtered.listen((value) => values.push(value));

      stream.push(1, 2, 3, 4);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([3, 4]);
    });

    test("filters with accumulator", async () => {
      const stream = new Stream<number>();
      const filtered = stream.filter(0, (acc, value) => [value > acc, Math.max(acc, value)]);

      const values: number[] = [];
      filtered.listen((value) => values.push(value));

      stream.push(1, 3, 2, 5, 4);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([1, 3, 5]);
    });

    test("filters with async predicate", async () => {
      const stream = new Stream<number>();
      const filtered = stream.filter(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x % 2 === 0;
      });

      const values: number[] = [];
      filtered.listen((value) => values.push(value));

      stream.push(1, 2, 3, 4);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([2, 4]);
    });
  });

  describe("Map", () => {
    test("maps with function", async () => {
      const stream = new Stream<number>();
      const mapped = stream.map((x) => x * 2);

      const values: number[] = [];
      mapped.listen((value) => values.push(value));

      stream.push(1, 2, 3);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([2, 4, 6]);
    });

    test("maps with accumulator", async () => {
      const stream = new Stream<number>();
      const mapped = stream.map(0, (acc, value) => [acc + value, acc + value]);

      const values: number[] = [];
      mapped.listen((value) => values.push(value));

      stream.push(1, 2, 3);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([1, 3, 6]);
    });

    test("maps with async function", async () => {
      const stream = new Stream<number>();
      const mapped = stream.map(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x.toString();
      });

      const values: string[] = [];
      mapped.listen((value) => values.push(value));

      stream.push(1, 2);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual(["1", "2"]);
    });
  });

  describe("Group", () => {
    test("groups with predicate", async () => {
      const stream = new Stream<number>();
      const grouped = stream.group((acc, value) => acc.length === 2);

      const values: number[][] = [];
      grouped.listen((value) => values.push(value));

      stream.push(1, 2, 3, 4, 5);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    test("groups with accumulator", async () => {
      const stream = new Stream<number>();
      const grouped = stream.group(0, (sum, value) => (sum + value >= 5 ? [true, 0] : [false, sum + value]));

      const values: number[] = [];
      grouped.listen((value) => values.push(value));

      stream.push(1, 2, 3, 1, 4);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([3, 1]);
    });
  });

  describe("Merge", () => {
    test("merges multiple streams", async () => {
      const stream1 = new Stream<number>();
      const stream2 = new Stream<number>();
      const stream3 = new Stream<number>();

      const merged = stream1.merge(stream2, stream3);
      const values: number[] = [];
      merged.listen((value) => values.push(value));

      stream1.push(1);
      stream2.push(2);
      stream3.push(3);
      stream1.push(4);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values.sort()).toEqual([1, 2, 3, 4]);
    });
  });

  describe("Flat", () => {
    test("flattens arrays", async () => {
      const stream = new Stream<number[]>();
      const flattened = stream.flat();

      const values: number[] = [];
      flattened.listen((value) => values.push(value));

      stream.push([1, 2], [3, 4]);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([1, 2, 3, 4]);
    });

    test("flattens with depth", async () => {
      const stream = new Stream<number[][][]>();
      const flattened = stream.flat(2);

      const values: number[] = [];
      flattened.listen((value) => values.push(value));

      stream.push([[[1, 2]], [[3, 4]]]);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([1, 2, 3, 4]);
    });

    test("passes through non-arrays", async () => {
      const stream = new Stream<number | number[]>();
      const flattened = stream.flat();

      const values: number[] = [];
      flattened.listen((value) => values.push(value));

      stream.push(1, [2, 3], 4);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([1, 2, 3, 4]);
    });
  });

  describe("Listeners Events", () => {
    test("listenerAdded emits when listener added", async () => {
      const stream = new Stream<number>();
      const joinEvents: any[] = [];

      stream.listenerAdded.listen(() => joinEvents.push(2));

      stream.listen(() => {});
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(joinEvents).toHaveLength(1);
    });

    test("consumerLeave emits when listener removed", async () => {
      const stream = new Stream<number>();
      const leaveEvents: any[] = [];

      stream.listenerRemoved.listen(() => leaveEvents.push(7));

      const abort = stream.listen(() => {});
      abort();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(leaveEvents).toHaveLength(1);
    });
  });

  describe("Async Iteration", () => {
    test("supports for-await-of", async () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      (async () => {
        let count = 0;
        for await (const value of stream) {
          values.push(value);
          if (++count === 3) break;
        }
      })();

      stream.push(1, 2, 3, 4);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([1, 2, 3]);
    });
  });

  describe("Memory Management", () => {
    test("cleans up queue after 1000 items", async () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      stream.listen((value) => values.push(value));

      // Push more than 1000 items
      for (let i = 0; i < 1500; i++) {
        stream.push(i);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toHaveLength(1500);
      expect(values[0]).toBe(0);
      expect(values[1499]).toBe(1499);
    });
  });

  describe("Pipe Method", () => {
    test("applies transformer function", async () => {
      const stream = new Stream<number>();
      const doubled = stream.pipe((s) => s.map((x) => x * 2));

      const values: number[] = [];
      doubled.listen((value) => values.push(value));

      stream.push(1, 2, 3);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([2, 4, 6]);
    });

    test("chains multiple transformations", async () => {
      const stream = new Stream<number>();
      const result = stream
        .pipe((s) => s.filter((x) => x > 0))
        .pipe((s) => s.map((x) => x * 2))
        .pipe((s) => s.filter((x) => x < 10));

      const values: number[] = [];
      result.listen((value) => values.push(value));

      stream.push(-1, 1, 2, 3, 5, 6);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([2, 4, 6]);
    });
  });

  describe("Functional Transformers", () => {
    describe("map transformer", () => {
      test("simple mapping", async () => {
        const stream = new Stream<number>();
        const doubled = stream.pipe(map((x) => x * 2));

        const values: number[] = [];
        doubled.listen((value) => values.push(value));

        stream.push(1, 2, 3);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(values).toEqual([2, 4, 6]);
      });

      test("stateful mapping", async () => {
        const stream = new Stream<number>();
        const sums = stream.pipe(map(0, (sum, n) => [sum + n, sum + n]));

        const values: number[] = [];
        sums.listen((value) => values.push(value));

        stream.push(1, 2, 3);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(values).toEqual([1, 3, 6]);
      });

      test("async mapping", async () => {
        const stream = new Stream<number>();
        const strings = stream.pipe(
          map(async (x) => {
            await new Promise((resolve) => setTimeout(resolve, 1));
            return x.toString();
          })
        );

        const values: string[] = [];
        strings.listen((value) => values.push(value));

        stream.push(1, 2);
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(values).toEqual(["1", "2"]);
      });
    });

    describe("filter transformer", () => {
      test("simple filtering", async () => {
        const stream = new Stream<number>();
        const positives = stream.pipe(filter((x) => x > 0));

        const values: number[] = [];
        positives.listen((value) => values.push(value));

        stream.push(-1, 0, 1, 2);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(values).toEqual([1, 2]);
      });

      test("stateful filtering", async () => {
        const stream = new Stream<number>();
        const increasing = stream.pipe(filter(0, (prev, curr) => [curr > prev, Math.max(prev, curr)]));

        const values: number[] = [];
        increasing.listen((value) => values.push(value));

        stream.push(1, 3, 2, 5, 4);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(values).toEqual([1, 3, 5]);
      });
    });

    describe("group transformer", () => {
      test("group by count", async () => {
        const stream = new Stream<number>();
        const batches = stream.pipe(group((batch) => batch.length >= 2));

        const values: number[][] = [];
        batches.listen((value) => values.push(value));

        stream.push(1, 2, 3, 4, 5);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(values).toEqual([
          [1, 2],
          [3, 4],
        ]);
      });

      test("stateful grouping", async () => {
        const stream = new Stream<number>();
        const sumGroups = stream.pipe(group(0, (sum, n) => (sum + n >= 5 ? [true, 0] : [false, sum + n])));

        const values: number[] = [];
        sumGroups.listen((value) => values.push(value));

        stream.push(1, 2, 3, 1, 4);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(values).toEqual([3, 1]);
      });
    });

    describe("merge transformer", () => {
      test("merges multiple streams", async () => {
        const stream1 = new Stream<string>();
        const stream2 = new Stream<number>();
        const merged = stream1.pipe(merge(stream2));

        const values: (string | number)[] = [];
        merged.listen((value) => values.push(value));

        stream1.push("a");
        stream2.push(1);
        stream1.push("b");

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(values.sort()).toEqual([1, "a", "b"]);
      });
    });

    describe("flat transformer", () => {
      test("flattens arrays", async () => {
        const stream = new Stream<number[]>();
        const flattened = stream.pipe(flat());

        const values: number[] = [];
        flattened.listen((value) => values.push(value));

        stream.push([1, 2], [3, 4]);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(values).toEqual([1, 2, 3, 4]);
      });

      test("flattens with depth", async () => {
        const stream = new Stream<number[][][]>();
        const flattened = stream.pipe(flat(2));

        const values: number[] = [];
        flattened.listen((value) => values.push(value));

        stream.push([[[1, 2]], [[3, 4]]]);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(values).toEqual([1, 2, 3, 4]);
      });
    });
  });

  describe("Functional Composition", () => {
    test("complex pipeline with all transformers", async () => {
      const stream = new Stream<number>();

      const result = stream
        .pipe(filter((x) => x > 0)) // Remove negatives -> 1,2,3
        .pipe(map((x) => [x, x * 2])) // Create pairs -> [1,2],[2,4],[3,6]
        .pipe(flat()) // Flatten pairs -> 1,2,2,4,3,6
        .pipe(group((batch) => batch.length >= 4)) // Group by 4 -> [1,2,2,4]
        .pipe(map((batch) => batch.reduce((a, b) => a + b, 0))); // Sum each group -> 9

      const values: number[] = [];
      result.listen((value) => values.push(value));

      stream.push(-1, 1, 2, 3);
      await new Promise((resolve) => setTimeout(resolve, 0));
      console.log(values);

      expect(values).toEqual([9]); // [1, 2, 2, 4] -> sum = 9
    });

    test("reusable transformation pipeline", async () => {
      const processNumbers = (stream: Stream<number>) => stream.pipe(filter((x) => x > 0)).pipe(map((x) => x * 2));

      const stream1 = new Stream<number>();
      const stream2 = new Stream<number>();

      const result1 = stream1.pipe(processNumbers);
      const result2 = stream2.pipe(processNumbers);

      const values1: number[] = [];
      const values2: number[] = [];

      result1.listen((value) => values1.push(value));
      result2.listen((value) => values2.push(value));

      stream1.push(-1, 1, 2);
      stream2.push(0, 3, 4);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values1).toEqual([2, 4]);
      expect(values2).toEqual([6, 8]);
    });
  });
});
