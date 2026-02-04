import { describe, it, expect } from "vitest";
import { Stream } from "../../stream";
import { statefullWorker } from "./statefull-worker";

describe("statefullWorker", () => {
  it("maintains state across transformations in worker", async () => {
    const stream = new Stream<number>();
    const results: number[] = [];

    const transformed = stream.pipe(
      statefullWorker({ sum: 0 }, (state, value) => {
        const newSum = state.sum + value;
        return [newSum, { sum: newSum }];
      }),
    );

    transformed.listen((v) => results.push(v));

    stream.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([1, 3, 6]); // Running sum
  });

  it("executes sequentially with async operations", async () => {
    const stream = new Stream<number>();
    const results: number[] = [];

    const transformed = stream.pipe(
      statefullWorker({ count: 0 }, async (state, value) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        const newCount = state.count + 1;
        return [value * newCount, { count: newCount }];
      }),
    );

    transformed.listen((v) => results.push(v));

    stream.push(10, 20, 30);

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(results).toEqual([10, 40, 90]); // 10*1, 20*2, 30*3
  });

  it("passes args to mapper", async () => {
    const stream = new Stream<number>();
    const results: number[] = [];

    const transformed = stream.pipe(
      statefullWorker(
        { sum: 0 },
        (state, value, multiplier: number) => {
          const newSum = state.sum + value * multiplier;
          return [newSum, { sum: newSum }];
        },
        2,
      ),
    );

    transformed.listen((v) => results.push(v));

    stream.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([2, 6, 12]); // Running sum with multiplier
  });
});
