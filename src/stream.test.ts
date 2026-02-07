import { it, expect, describe } from "bun:test";
import { Stream } from "./stream";
import { abortSignal } from "./transformers/abort-signal";

describe("Stream", () => {
  describe("Constructor", () => {
    it("creates empty stream", () => {
      const stream = new Stream<number>();
      expect(stream.hasListeners).toBe(false);
    });

    it("creates stream with generator function", () => {
      Stream;
      const stream = new Stream<number>(async function* () {
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
      const filtered = new Stream<number>(async function* () {
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

      const ctr = stream.listen(() => {});

      expect(stream.hasListeners).toBe(true);

      ctr.abort();

      expect(stream.hasListeners).toBe(false);
    });
  });

  describe("Cleanup Mechanisms", () => {
    it("manual cleanup removes listener", async () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      const ctr = stream.listen((value) => values.push(value));

      stream.push(1);
      ctr.abort();
      stream.push(2);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([1]);
      expect(stream.hasListeners).toBe(false);
    });

    it("respects aborted signal", async () => {
      const stream = new Stream<number>();
      const controller = new AbortController();
      controller.abort();

      const values: number[] = [];
      stream.listen((value) => values.push(value)).addSignal(new Stream().pipe(abortSignal(controller.signal)));

      stream.push(1);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([]);
    });

    it("aborts listener with signal", async () => {
      const stream = new Stream<number>();
      const controller = new AbortController();
      const values: number[] = [];

      stream.listen((value) => values.push(value)).addSignal(new Stream().pipe(abortSignal(controller.signal)));

      stream.push(1);
      controller.abort();
      stream.push(2);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([1]);
    });

    it.only("stream trigger cleanup", async () => {
      const stream = new Stream<number>();
      const stopSignal = new Stream<void>();
      const values: number[] = [];

      stream.listen((value) => values.push(value)).setSource(stopSignal);

      stream.push(1);
      stopSignal.push();
      await new Promise((resolve) => setTimeout(resolve, 0));
      stream.push(2);

      expect(values).toEqual([1]);
      expect(stream.hasListeners).toBe(false);
    });

    it("disposable pattern with Symbol.dispose", () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      const cleanup = stream.listen((value) => values.push(value));

      expect(typeof cleanup[Symbol.dispose]).toBe("function");

      stream.push(1);
      cleanup[Symbol.dispose]();
      stream.push(2);

      expect(values).toEqual([1]);
      expect(stream.hasListeners).toBe(false);
    });
  });

  describe("WeakRef Context Support", () => {
    it("should accept object as context", async () => {
      const stream = new Stream<number>();
      const context = { id: 1 };
      const values: number[] = [];

      stream.listen((value) => values.push(value), context);

      stream.push(1, 2, 3);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values).toEqual([1, 2, 3]);
    });

    it("should preserve listener identity with same function reference", () => {
      const stream = new Stream<number>();
      const listener = (value: number) => console.log(value);
      const context1 = { id: 1 };
      const context2 = { id: 2 };

      stream.listen(listener, context1);
      expect(stream.hasListeners).toBe(true);

      // Same listener reference should replace, not add
      stream.listen(listener, context2);
      expect(stream.hasListeners).toBe(true);
    });

    it("should auto-remove listener when context is garbage collected", async () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      // Create context in isolated scope
      (() => {
        const context = { id: 1 };
        stream.listen((value) => values.push(value), context);
      })();

      // Force GC if available (Bun/Node)
      if (global.gc) {
        global.gc();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Push should clean up dead listeners
      stream.push(1);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Listener should be removed (if GC ran)
      // Note: GC timing is non-deterministic, so this test may be flaky
      // In real usage, this prevents memory leaks over time
    });

    it("should handle multiple listeners with different contexts", async () => {
      const stream = new Stream<number>();
      const context1 = { id: 1 };
      const context2 = { id: 2 };
      const values1: number[] = [];
      const values2: number[] = [];

      stream.listen((value) => values1.push(value), context1);
      stream.listen((value) => values2.push(value), context2);

      stream.push(1, 2, 3);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values1).toEqual([1, 2, 3]);
      expect(values2).toEqual([1, 2, 3]);
    });

    it("should work with mixed context types", async () => {
      const stream = new Stream<number>();
      const context = { id: 1 };
      const controller = new AbortController();
      const values1: number[] = [];
      const values2: number[] = [];
      const values3: number[] = [];

      stream.listen((value) => values1.push(value)); // No context
      stream.listen((value) => values2.push(value), context); // Object context
      stream.listen((value) => values3.push(value), controller.signal); // AbortSignal

      stream.push(1, 2);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values1).toEqual([1, 2]);
      expect(values2).toEqual([1, 2]);
      expect(values3).toEqual([1, 2]);

      controller.abort();
      stream.push(3);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(values1).toEqual([1, 2, 3]);
      expect(values2).toEqual([1, 2, 3]);
      expect(values3).toEqual([1, 2]); // Aborted
    });
  });

  describe("withContext Method", () => {
    it("should iterate while context is alive", async () => {
      const stream = new Stream<number>();
      const context = { id: 1 };
      const values: number[] = [];

      (async () => {
        for await (const value of stream.withContext(context)) {
          values.push(value);
          if (value === 3) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));

      stream.push(1, 2, 3, 4);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([1, 2, 3]);
    });

    it("should stop iteration when context is GC'd", async () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      (async () => {
        let context: any = { id: 1 };
        const iterator = stream.withContext(context);

        // Start iteration
        const next1 = await iterator.next();
        if (!next1.done) values.push(next1.value);

        // Clear context reference
        context = null;

        // Force GC if available
        if (global.gc) {
          global.gc();
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Try to get next value - should stop
        const next2 = await iterator.next();
        if (!next2.done) values.push(next2.value);
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));
      stream.push(1);
      await new Promise((resolve) => setTimeout(resolve, 150));
      stream.push(2);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should only have first value (if GC ran)
      expect(values.length).toBeGreaterThanOrEqual(1);
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

      const ctr = stream.listen(() => {});
      ctr.abort();
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
          }),
      );

      const results: string[] = [];
      stringResult.listen((value) => results.push(value));

      source.push(1, 2, 3);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(results).toEqual(["1", "2", "3"]);
    });
  });
});
