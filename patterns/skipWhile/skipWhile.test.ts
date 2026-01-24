import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { skipWhile } from "./skipWhile";

describe("skipWhile pattern", () => {
  it("should skip while condition is true", async () => {
    const stream = new Stream<number>();
    const skipped = stream.pipe(skipWhile((n) => n < 5));

    const results: number[] = [];
    skipped.listen((value) => results.push(value));

    stream.push(1, 2, 3, 4, 5, 6, 7);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([5, 6, 7]);
  });
});
