import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { cache } from "./cache";

describe("cache transformer", () => {
  describe("basic caching", () => {
    it("should cache values", async () => {
      const stream = new Stream<number>();
      const cached = stream.pipe(cache({ size: 3 }));

      stream.push(1, 2, 3, 4, 5);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cached.cache.values).toEqual([3, 4, 5]);
    });

    it("should pass through values to listeners", async () => {
      const stream = new Stream<number>();
      const cached = stream.pipe(cache());

      const results: number[] = [];
      cached.listen((value) => results.push(value));

      stream.push(1, 2, 3);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe("hot behavior", () => {
    it("should cache events even without listeners", async () => {
      const stream = new Stream<number>();
      const cached = stream.pipe(cache({ size: 3 }));

      stream.push(1, 2, 3, 4, 5);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cached.cache.values).toEqual([3, 4, 5]);
    });
  });

  describe("dropStrategy", () => {
    it("should drop oldest values when size exceeded (default)", async () => {
      const stream = new Stream<number>();
      const cached = stream.pipe(cache({ size: 3 }));

      stream.push(1, 2, 3, 4, 5);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cached.cache.values).toEqual([3, 4, 5]);
      expect(cached.cache.dropStrategy).toBe("oldest");
    });

    it("should drop newest values when dropStrategy is 'newest'", async () => {
      const stream = new Stream<number>();
      const cached = stream.pipe(cache({ size: 3, dropStrategy: "newest" }));

      stream.push(1, 2, 3, 4, 5);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cached.cache.values).toEqual([1, 2, 3]);
      expect(cached.cache.dropStrategy).toBe("newest");
    });
  });

  describe("initialValues", () => {
    it("should start with initial values", async () => {
      const stream = new Stream<string>();
      const cached = stream.pipe(cache({ initialValues: ["init", "ready"] }));

      expect(cached.cache.values).toEqual(["init", "ready"]);
    });

    it("should combine initial values with new values", async () => {
      const stream = new Stream<number>();
      const cached = stream.pipe(cache({ initialValues: [1, 2] }));

      stream.push(3, 4);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cached.cache.values).toEqual([1, 2, 3, 4]);
    });
  });

  describe("cache management", () => {
    it("should allow manual clear", async () => {
      const stream = new Stream<number>();
      const cached = stream.pipe(cache({ initialValues: [1, 2, 3] }));

      cached.cache.clear();

      expect(cached.cache.values).toEqual([]);
    });

    it("should expose size", async () => {
      const stream = new Stream<number>();
      const cached = stream.pipe(cache({ size: 10 }));

      expect(cached.cache.size).toBe(10);
    });

    it("should have undefined size when unlimited", async () => {
      const stream = new Stream<number>();
      const cached = stream.pipe(cache());

      expect(cached.cache.size).toBeUndefined();
    });
  });
});

describe("TTL (Time-To-Live)", () => {
  it("should evict values after TTL expires", async () => {
    const stream = new Stream<number>();
    const cached = stream.pipe(cache({ ttl: 50 }));

    stream.push(1, 2, 3);
    expect(cached.cache.values).toEqual([1, 2, 3]);

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(cached.cache.values).toEqual([]);
  });

  it("should evict values individually based on their timestamp", async () => {
    const stream = new Stream<number>();
    const cached = stream.pipe(cache({ ttl: 50 }));

    stream.push(1);
    await new Promise((resolve) => setTimeout(resolve, 30));
    stream.push(2);
    await new Promise((resolve) => setTimeout(resolve, 30));

    // 1 should be evicted, 2 should remain
    expect(cached.cache.values).toEqual([2]);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(cached.cache.values).toEqual([]);
  });

  it("should call onEvict callback when TTL expires", async () => {
    const stream = new Stream<number>();
    const evicted: Array<{ value: number; reason: string }> = [];

    const cached = stream.pipe(cache({ ttl: 50 }));
    cached.cache.evicted.listen((e) => evicted.push(e));

    stream.push(1, 2, 3);
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(evicted).toEqual([
      { value: 1, reason: "ttl" },
      { value: 2, reason: "ttl" },
      { value: 3, reason: "ttl" },
    ]);
  });

  it("should work with both size and TTL", async () => {
    const stream = new Stream<number>();
    const evicted: Array<{ value: number; reason: string }> = [];

    const cached = stream.pipe(cache({ size: 2, ttl: 100 }));
    cached.cache.evicted.listen((e) => evicted.push(e));

    stream.push(1, 2, 3); // 1 evicted by size
    expect(cached.cache.values).toEqual([2, 3]);
    expect(evicted).toEqual([{ value: 1, reason: "size" }]);

    await new Promise((resolve) => setTimeout(resolve, 110));

    // 2 and 3 evicted by TTL
    expect(cached.cache.values).toEqual([]);
    expect(evicted).toEqual([
      { value: 1, reason: "size" },
      { value: 2, reason: "ttl" },
      { value: 3, reason: "ttl" },
    ]);
  });

  it("should clear timers when cache is cleared", async () => {
    const stream = new Stream<number>();
    const evicted: number[] = [];

    const cached = stream.pipe(cache({ ttl: 50 }));
    cached.cache.evicted.listen((e) => evicted.push(e.value));

    stream.push(1, 2, 3);
    cached.cache.clear();

    await new Promise((resolve) => setTimeout(resolve, 60));

    // No evictions should happen
    expect(evicted).toEqual([]);
  });

  it("should expose ttl in cache API", () => {
    const stream = new Stream<number>();
    const cached = stream.pipe(cache({ ttl: 1000 }));

    expect(cached.cache.ttl).toBe(1000);
  });

  it("should have undefined ttl when not set", () => {
    const stream = new Stream<number>();
    const cached = stream.pipe(cache());

    expect(cached.cache.ttl).toBeUndefined();
  });
});

describe("evicted stream", () => {
  it("should emit eviction events when size is exceeded", async () => {
    const stream = new Stream<number>();
    const evicted: Array<{ value: number; reason: string }> = [];

    const cached = stream.pipe(cache({ size: 2 }));
    cached.cache.evicted.listen((e) => evicted.push(e));

    stream.push(1, 2, 3, 4);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(evicted).toEqual([
      { value: 1, reason: "size" },
      { value: 2, reason: "size" },
    ]);
  });

  it("should work with dropStrategy newest", async () => {
    const stream = new Stream<number>();
    const evicted: Array<{ value: number; reason: string }> = [];

    const cached = stream.pipe(cache({ size: 2, dropStrategy: "newest" }));
    cached.cache.evicted.listen((e) => evicted.push(e));

    stream.push(1, 2, 3, 4);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(evicted).toEqual([
      { value: 3, reason: "size" },
      { value: 4, reason: "size" },
    ]);
    expect(cached.cache.values).toEqual([1, 2]);
  });

  it("should support multiple listeners", async () => {
    const stream = new Stream<number>();
    const evicted1: number[] = [];
    const evicted2: number[] = [];

    const cached = stream.pipe(cache({ size: 2 }));
    cached.cache.evicted.listen((e) => evicted1.push(e.value));
    cached.cache.evicted.listen((e) => evicted2.push(e.value));

    stream.push(1, 2, 3);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(evicted1).toEqual([1]);
    expect(evicted2).toEqual([1]);
  });
});
