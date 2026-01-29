import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { take } from "./take";

describe("take pattern", () => {
  it("should take first N values", async () => {
    const stream = new Stream<number>();
    const taken = stream.pipe(take(3));

    const results: number[] = [];
    taken.listen((value) => results.push(value));

    stream.push(1, 2, 3, 4, 5);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([1, 2, 3]);
  });

  it("should handle take(1)", async () => {
    const stream = new Stream<number>();
    const taken = stream.pipe(take(1));

    const results: number[] = [];
    taken.listen((value) => results.push(value));

    stream.push(1, 2, 3);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([1]);
  });
});
