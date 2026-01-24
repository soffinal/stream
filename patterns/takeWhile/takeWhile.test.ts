import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { takeWhile } from "./takeWhile";

describe("takeWhile pattern", () => {
  it("should take while condition is true", async () => {
    const stream = new Stream<number>();
    const taken = stream.pipe(takeWhile((n) => n < 5));

    const results: number[] = [];
    taken.listen((value) => results.push(value));

    stream.push(1, 2, 3, 4, 5, 6);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([1, 2, 3, 4]);
  });
});
