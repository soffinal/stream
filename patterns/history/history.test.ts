import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { history } from "./history";

describe("history pattern", () => {
  it("should emit sliding window of last N values", async () => {
    const stream = new Stream<number>();
    const windowed = stream.pipe(history(3));

    const results: number[][] = [];
    windowed.listen((arr) => results.push(arr));

    stream.push(1);
    stream.push(2);
    stream.push(3);
    stream.push(4);
    stream.push(5);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([
      [1],
      [1, 2],
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
    ]);
  });

  it("should handle size 1", async () => {
    const stream = new Stream<number>();
    const windowed = stream.pipe(history(1));

    const results: number[][] = [];
    windowed.listen((arr) => results.push(arr));

    stream.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([[1], [2], [3]]);
  });

  it("should handle large window", async () => {
    const stream = new Stream<number>();
    const windowed = stream.pipe(history(10));

    const results: number[][] = [];
    windowed.listen((arr) => results.push(arr));

    stream.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([[1], [1, 2], [1, 2, 3]]);
  });
});
