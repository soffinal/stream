import { it, expect, describe } from "bun:test";
import { Stream } from "./stream";
import { abortSignal } from "./transformers/abort-signal";
import { weakRef } from "./transformers/weak-ref";

describe("Stream", () => {
  describe("Constructor", () => {
    it("creates empty stream", () => {
      const stream = new Stream<number>();
      expect(stream.hasListeners).toBe(false);
    });

    it("creates stream with source function", () => {
      Stream;
      const stream = new Stream<number>((self) => {
        self.push(1);
        self.push(2);
      });
      expect(stream.hasListeners).toBe(false);
    });

    it("should work with transformed streams in constructor", async () => {
      const source = new Stream<number>();
      const filtered = new Stream<number>((self) => {
        return source.listen((v) => v > 0 && self.push(v));
      });

      const results: number[] = [];
      filtered.listen((value) => results.push(value));

      source.push(-1, 1, -2, 2, 3);

      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe("Push and Listen", () => {
    it("pushes and receives values", async () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      stream.listen((value) => values.push(value));

      stream.push(1, 2, 3);

      expect(values).toEqual([1, 2, 3]);
    });

    it("handles empty push", async () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      stream.listen((value) => values.push(value));

      stream.push(undefined as never);

      expect(values).toEqual([undefined as never]);
    });

    it("multiple listeners receive same values", async () => {
      const stream = new Stream<number>();
      const values1: number[] = [];
      const values2: number[] = [];

      stream.listen((value) => values1.push(value));
      stream.listen((value) => values2.push(value));

      stream.push(1, 2);

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

      const controller = stream.listen((value) => values.push(value));

      stream.push(1);
      controller.abort();
      stream.push(2);

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

      expect(values).toEqual([1]);
    });

    it("stream trigger cleanup", async () => {
      const stream = new Stream<number>();
      const stopSignal = new Stream<void>();
      const values: number[] = [];

      stream.listen((value) => values.push(value)).addSignal(stopSignal);

      stream.push(1);
      stopSignal.push();
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
    it("should auto-remove listener when context is garbage collected", async () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      (() => {
        const context = { id: 1 };
        stream.listen((value) => values.push(value)).addSignal(new Stream().pipe(weakRef(context)));
      })();

      Bun.gc(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      stream.push(1);

      expect(values).toEqual([]);
    });

    it("should handle multiple listeners with different contexts", async () => {
      const stream = new Stream<number>();
      const values1: number[] = [];
      const values2: number[] = [];

      (() => {
        const context1 = { id: 1 };
        const context2 = { id: 2 };

        stream.listen((value) => values1.push(value)).addSignal(new Stream().pipe(weakRef(context1)));
        stream.listen((value) => values2.push(value)).addSignal(new Stream().pipe(weakRef(context2)));
      })();

      Bun.gc(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      stream.push(1, 2, 3);

      expect(values1).toEqual([]);
      expect(values2).toEqual([]);
    });

    it("should work with mixed signals types", async () => {
      const stream = new Stream<number>();
      const controller = new AbortController();
      const values1: number[] = [];
      const values2: number[] = [];
      const values3: number[] = [];

      (() => {
        const context = { id: 1 };
        stream.listen((value) => values1.push(value));
        stream.listen((value) => values2.push(value)).addSignal(new Stream().pipe(weakRef(context)));
        stream.listen((value) => values3.push(value)).addSignal(new Stream().pipe(abortSignal(controller.signal)));
      })();

      stream.push(1, 2);

      expect(values1).toEqual([1, 2]);
      expect(values2).toEqual([1, 2]);
      expect(values3).toEqual([1, 2]);

      controller.abort();
      Bun.gc(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      stream.push(3);

      expect(values1).toEqual([1, 2, 3]);
      expect(values2).toEqual([1, 2]);
      expect(values3).toEqual([1, 2]); // Aborted
    });
  });

  describe("withContext Method", () => {
    it("should iterate while context is alive", async () => {
      const stream = new Stream<number>();
      const values: number[] = [];

      (async () => {
        const context = { id: 1 };
        for await (const value of stream.withContext(context)) {
          values.push(value);
        }
      })();

      stream.push(1, 2, 3);

      Bun.gc(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      stream.push(4);

      expect(values).toEqual([1, 2, 3]);
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

      const promise1 = stream.then();
      const promise2 = stream.then();
      stream.push(1);
      stream.push(2);

      const result = await promise1;
      const result2 = await promise2;
      expect(result).toBe(1);
      expect(result2).toBe(2);
    });
  });

  describe("Listeners Events", () => {
    it("listenerAdded emits when listener added", async () => {
      const stream = new Stream<number>();
      const joinEvents: any[] = [];

      stream.events.listen(() => joinEvents.push(2)); // two events emitted "listaner-added" and "first-listener-added"

      stream.listen(() => {});
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(joinEvents).toHaveLength(2);
    });

    it("Emitt four events when listen and abort", async () => {
      const stream = new Stream<number>();
      const leaveEvents: any[] = [];

      stream.events.listen(() => leaveEvents.push(7));

      const controller = stream.listen(() => {});
      controller.abort();

      expect(leaveEvents).toHaveLength(4);
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
          new Stream<string>((self) => {
            return stream.listen((v) => self.push(v.toString()));
          }),
      );

      const results: string[] = [];
      stringResult.listen((value) => results.push(value));

      source.push(1, 2, 3);

      expect(results).toEqual(["1", "2", "3"]);
    });
  });
});
