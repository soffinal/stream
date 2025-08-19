import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { State } from "./state";

describe("State", () => {
  let state: State<number>;
  let cleanups: (() => void)[] = [];

  beforeEach(() => {
    state = new State(0);
    cleanups = [];
  });

  afterEach(() => {
    cleanups.forEach((cleanup) => cleanup());
    cleanups = [];
  });

  describe("constructor", () => {
    it("should initialize with provided value", () => {
      const state = new State(42);
      expect(state.value).toBe(42);
    });

    it("should work with different types", () => {
      const stringState = new State("hello");
      const objectState = new State({ count: 0 });
      const arrayState = new State([1, 2, 3]);

      expect(stringState.value).toBe("hello");
      expect(objectState.value).toEqual({ count: 0 });
      expect(arrayState.value).toEqual([1, 2, 3]);
    });
  });

  describe("value getter/setter", () => {
    it("should get current value", () => {
      expect(state.value).toBe(0);
    });

    it("should set new value", () => {
      state.value = 42;
      expect(state.value).toBe(42);
    });

    it("should notify listeners when value changes", () => {
      const listener = jest.fn();
      cleanups.push(state.listen(listener));

      state.value = 42;
      expect(listener).toHaveBeenCalledWith(42);
    });

    it("should notify multiple listeners", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      cleanups.push(state.listen(listener1));
      cleanups.push(state.listen(listener2));

      state.value = 42;
      expect(listener1).toHaveBeenCalledWith(42);
      expect(listener2).toHaveBeenCalledWith(42);
    });
  });

  describe("push method", () => {
    it("should update value with single argument", () => {
      state.push(42);
      expect(state.value).toBe(42);
    });

    it("should update value with multiple arguments (last wins)", () => {
      state.push(1, 2, 3);
      expect(state.value).toBe(3);
    });

    it("should notify listeners for each pushed value", () => {
      const listener = jest.fn();
      cleanups.push(state.listen(listener));

      state.push(1, 2, 3);
      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenNthCalledWith(1, 1);
      expect(listener).toHaveBeenNthCalledWith(2, 2);
      expect(listener).toHaveBeenNthCalledWith(3, 3);
    });
  });

  describe("async iterator", () => {
    it("should yield new values as they are set", async () => {
      const values: number[] = [];
      const iterator = state[Symbol.asyncIterator]();

      // Collect values in background
      (async () => {
        for await (const value of iterator) {
          values.push(value);
          if (values.length === 3) break;
        }
      })();

      // Wait a bit for iterator to be ready
      await new Promise((resolve) => setTimeout(resolve, 0));

      state.value = 1;
      state.value = 2;
      state.value = 3;

      // Wait for values to be collected
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([1, 2, 3]);
      await iterator.return();
    });
  });

  describe("inheritance from Stream", () => {
    it("should support filter operation", async () => {
      const filtered = state.filter((x) => x > 5);
      const values: number[] = [];

      const iterator = filtered[Symbol.asyncIterator]();
      (async () => {
        for await (const value of iterator) {
          values.push(value);
          if (values.length === 2) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));

      state.value = 3; // filtered out
      state.value = 7; // included
      state.value = 2; // filtered out
      state.value = 10; // included

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([7, 10]);
      await iterator.return();
    });

    it("should support map operation", async () => {
      const mapped = state.map((x) => x * 2);
      const values: number[] = [];

      const iterator = mapped[Symbol.asyncIterator]();
      (async () => {
        for await (const value of iterator) {
          values.push(value);
          if (values.length === 2) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 0));

      state.value = 5;
      state.value = 10;

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(values).toEqual([10, 20]);
      await iterator.return();
    });

    it("should support then (Promise-like behavior)", async () => {
      const promise = state.then((x) => x * 2);

      state.value = 21;

      const result = await promise;
      expect(result).toBe(42);
    });
  });

  describe("listener management", () => {
    it("should track hasListeners correctly", () => {
      expect(state.hasListeners).toBe(false);

      const cleanup = state.listen(() => {});
      expect(state.hasListeners).toBe(true);

      cleanup();
      expect(state.hasListeners).toBe(false);
    });

    it("should handle AbortSignal", () => {
      const controller = new AbortController();
      const listener = jest.fn();

      state.listen(listener, controller.signal);
      expect(state.hasListeners).toBe(true);

      controller.abort();
      expect(state.hasListeners).toBe(false);

      state.value = 42;
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle undefined values", () => {
      const state = new State<number | undefined>(undefined);
      expect(state.value).toBeUndefined();

      const listener = jest.fn();
      cleanups.push(state.listen(listener));

      state.value = undefined;
      expect(listener).toHaveBeenCalledWith(undefined);
    });

    it("should handle null values", () => {
      const state = new State<number | null>(null);
      expect(state.value).toBeNull();
    });

    it("should handle object mutations (reference equality)", () => {
      const obj = { count: 0 };
      const state = new State(obj);
      const listener = jest.fn();
      cleanups.push(state.listen(listener));

      // Mutating the object doesn't trigger listeners
      obj.count = 1;
      expect(listener).not.toHaveBeenCalled();

      // Setting the same reference triggers listeners
      state.value = obj;
      expect(listener).toHaveBeenCalledWith(obj);
    });
  });
});
