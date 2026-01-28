import { describe, test, expect } from "bun:test";
import { Stream } from "../../stream";
import { queue } from "./queue";

describe("queue", () => {
  test("consumes values (shifts from queue)", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue());

    source.push(1, 2, 3);

    const values: number[] = [];
    for await (const value of q) {
      values.push(value);
      if (value === 3) break;
    }

    expect(values).toEqual([1, 2, 3]);
    expect(q.cache.values).toEqual([]); // Consumed
  });

  test("HOT behavior - captures values before iteration", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue());

    // Push before iterating
    source.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(q.cache.values).toEqual([1, 2, 3]); // Captured

    const values: number[] = [];
    for await (const value of q) {
      values.push(value);
      if (value === 3) break;
    }

    expect(values).toEqual([1, 2, 3]);
  });

  test("exposes cache API", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue({ maxSize: 10, dropStrategy: "oldest" }));

    source.push(1, 2, 3);

    expect(q.cache.values).toEqual([1, 2, 3]);
    expect(q.cache.size).toBe(10);
    expect(q.cache.dropStrategy).toBe("oldest");
  });

  test("respects maxSize option", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue({ maxSize: 3 }));

    source.push(1, 2, 3, 4, 5);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(q.cache.values.length).toBe(3);
  });

  test("respects dropStrategy oldest", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue({ maxSize: 3, dropStrategy: "oldest" }));

    source.push(1, 2, 3, 4, 5);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(q.cache.values).toEqual([3, 4, 5]); // Oldest dropped
  });

  test("respects dropStrategy newest", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue({ maxSize: 3, dropStrategy: "newest" }));

    source.push(1, 2, 3, 4, 5);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(q.cache.values).toEqual([1, 2, 3]); // Newest dropped
  });

  test("clear() empties queue", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue());

    source.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(q.cache.values.length).toBe(3);

    q.cache.clear();

    expect(q.cache.values.length).toBe(0);
  });

  test("producer/consumer pattern", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue());

    // Producer
    let produced = 0;
    const producer = setInterval(() => {
      source.push(produced++);
      if (produced >= 10) clearInterval(producer);
    }, 10);

    // Consumer
    const consumed: number[] = [];
    for await (const value of q) {
      consumed.push(value);
      if (value === 9) break;
    }

    expect(consumed).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(q.cache.values).toEqual([]); // All consumed
  });

  test("multiple consumers share queue", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue());

    source.push(1, 2, 3, 4, 5, 6);

    const consumer1: number[] = [];
    const consumer2: number[] = [];

    // Consumer 1
    const c1 = (async () => {
      for await (const value of q) {
        consumer1.push(value);
        if (consumer1.length >= 3) break;
      }
    })();

    // Consumer 2
    const c2 = (async () => {
      for await (const value of q) {
        consumer2.push(value);
        if (consumer2.length >= 3) break;
      }
    })();

    await Promise.all([c1, c2]);

    // Both consumers got values (order may vary)
    const total = [...consumer1, ...consumer2].sort((a, b) => a - b);
    expect(total).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("works with transformations", async () => {
    const source = new Stream<number>();
    const q = source
      .pipe((s) =>
        new Stream(async function* () {
          for await (const v of s) {
            if (v > 0) yield v;
          }
        }),
      )
      .pipe((s) =>
        new Stream(async function* () {
          for await (const v of s) {
            yield v * 2;
          }
        }),
      )
      .pipe(queue());

    source.push(-1, 2, 3);

    const values: number[] = [];
    for await (const value of q) {
      values.push(value);
      if (value === 6) break;
    }

    expect(values).toEqual([4, 6]);
  });

  test("queue size decreases as consumed", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue());

    source.push(1, 2, 3, 4, 5);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(q.cache.values.length).toBe(5);

    const sizes: number[] = [];
    for await (const value of q) {
      sizes.push(q.cache.values.length);
      if (value === 5) break;
    }

    expect(sizes).toEqual([4, 3, 2, 1, 0]);
  });

  test("handles rapid push and consume", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue({ maxSize: 100 }));

    // Rapid producer
    for (let i = 0; i < 50; i++) {
      source.push(i);
    }

    // Consumer
    const consumed: number[] = [];
    for await (const value of q) {
      consumed.push(value);
      if (value === 49) break;
    }

    expect(consumed.length).toBe(50);
    expect(consumed[0]).toBe(0);
    expect(consumed[49]).toBe(49);
  });

  test("waits for values when queue is empty", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue());

    const values: number[] = [];

    // Start consumer (queue is empty)
    const consumer = (async () => {
      for await (const value of q) {
        values.push(value);
        if (value === 3) break;
      }
    })();

    // Push after consumer starts
    await new Promise((resolve) => setTimeout(resolve, 10));
    source.push(1);

    await new Promise((resolve) => setTimeout(resolve, 10));
    source.push(2);

    await new Promise((resolve) => setTimeout(resolve, 10));
    source.push(3);

    await consumer;

    expect(values).toEqual([1, 2, 3]);
  });

  test("cleanup with AbortController", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue());

    const controller = new AbortController();
    const values: number[] = [];

    const consumer = (async () => {
      try {
        for await (const value of q) {
          if (controller.signal.aborted) break;
          values.push(value);
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      } finally {
        // Cleanup
      }
    })();

    source.push(1, 2, 3, 4, 5);

    await new Promise((resolve) => setTimeout(resolve, 25));
    controller.abort();

    await consumer;

    expect(values.length).toBeLessThan(5); // Aborted before consuming all
  });

  test("persistent queue survives multiple iterations", async () => {
    const source = new Stream<number>();
    const q = source.pipe(queue());

    source.push(1, 2, 3);

    // First iteration
    const values1: number[] = [];
    for await (const value of q) {
      values1.push(value);
      if (value === 2) break; // Stop early
    }

    expect(values1).toEqual([1, 2]);
    expect(q.cache.values).toEqual([3]); // One left

    // Second iteration
    const values2: number[] = [];
    for await (const value of q) {
      values2.push(value);
      if (value === 3) break;
    }

    expect(values2).toEqual([3]);
    expect(q.cache.values).toEqual([]); // All consumed
  });
});
