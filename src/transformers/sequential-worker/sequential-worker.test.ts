import { describe, it, expect } from "vitest";
import { Stream } from "../../stream";
import { sequentialWorker } from "./sequential-worker";

describe("sequentialWorker", () => {
  it("executes transformations sequentially in worker", async () => {
    const stream = new Stream<number>();
    const results: number[] = [];

    const transformed = stream.pipe(sequentialWorker((n) => n * 2));

    transformed.listen((v) => results.push(v));

    stream.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([2, 4, 6]);
  });

  it("maintains order with async operations", async () => {
    const stream = new Stream<number>();
    const results: number[] = [];

    const transformed = stream.pipe(
      sequentialWorker(async (n) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return n * 2;
      }),
    );

    transformed.listen((v) => results.push(v));

    stream.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(results).toEqual([2, 4, 6]);
  });

  it("passes args to mapper", async () => {
    const stream = new Stream<number>();
    const results: number[] = [];

    const transformed = stream.pipe(sequentialWorker((n, multiplier: number) => n * multiplier, 3));

    transformed.listen((v) => results.push(v));

    stream.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([3, 6, 9]);
  });
});
