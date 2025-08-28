import { it, expect, describe } from "bun:test";
import { Stream } from "./stream";

describe("Stream", () => {
  describe("Constructor", () => {
    it("creates empty stream", () => {
      const stream = new Stream<number>();
      expect(stream.hasListeners).toBe(false);
    });

    it("creates stream with generator function", () => {
      Stream;
      const stream = new Stream(async function* () {
        yield 1;
        yield 2;
      });
      expect(stream.hasListeners).toBe(false);
    });
    it("should accept Stream as constructor parameter", async () => {
      const source = new Stream<number>();
      const derived = new Stream(source);

      const results: number[] = [];
      derived.listen((value) => results.push(value));

      source.push(1, 2, 3);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(results).toEqual([1, 2, 3]);
    });

    it("should work with transformed streams in constructor", async () => {
      const source = new Stream<number>();
      const filtered = new Stream(async function* () {
        for await (const value of source) {
          if (value > 0) yield value;
        }
      });

      const derived = new Stream(filtered);

      const results: number[] = [];
      derived.listen((value) => results.push(value));

      source.push(-1, 1, -2, 2, 3);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe("Push and Listen", () => {
    it("pushes and receives values", async () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      stream.listen((value) => values.push(value));

      stream.push(1, 2, 3);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([1, 2, 3]);
    });

    it("handles empty push", async () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      stream.listen((value) => values.push(value));

      stream.push(undefined as never);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([undefined as never]);
    });

    it("multiple listeners receive same values", async () => {
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

    it("hasListeners property", () => {
      const stream = new Stream<number>();

      expect(stream.hasListeners).toBe(false);

      const abort = stream.listen(() => {});

      expect(stream.hasListeners).toBe(true);

      abort();

      expect(stream.hasListeners).toBe(false);
    });
  });

  describe("AbortSignal Support", () => {
    it("respects aborted signal", async () => {
      const stream = new Stream<number>();
      const controller = new AbortController();
      controller.abort();

      const values: number[] = [];
      stream.listen((value) => values.push(value), controller.signal);

      stream.push(1);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([]);
    });

    it("aborts listener with signal", async () => {
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
    it("consumes generator when first listener added", async () => {
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

    it("generator shared between multiple listeners", async () => {
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
    it("then resolves with first value", async () => {
      const stream = new Stream<number>();

      const promise = stream.then((value) => value * 2);
      stream.push(5);

      const result = await promise;
      expect(result).toBe(10);
    });

    it("then resolves only once", async () => {
      const stream = new Stream<number>();

      const promise = stream.then();
      stream.push(1);
      stream.push(2);

      const result = await promise;
      expect(result).toBe(1);
    });
  });

  describe("Listeners Events", () => {
    it("listenerAdded emits when listener added", async () => {
      const stream = new Stream<number>();
      const joinEvents: any[] = [];

      stream.listenerAdded.listen(() => joinEvents.push(2));

      stream.listen(() => {});
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(joinEvents).toHaveLength(1);
    });

    it("consumerLeave emits when listener removed", async () => {
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
    it("supports for-await-of", async () => {
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

  describe("Pipe Method ", () => {
    it("should allow transformers to return any type", async () => {
      const source = new Stream<number>();

      const stringResult = source.pipe(
        (stream) =>
          new Stream(async function* () {
            for await (const value of stream) {
              yield value.toString();
            }
          })
      );

      const results: string[] = [];
      stringResult.listen((value) => results.push(value));

      source.push(1, 2, 3);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(results).toEqual(["1", "2", "3"]);
    });
  });
});
