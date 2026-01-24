import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { skip } from "./skip";

describe("skip pattern", () => {
  it("should skip first N values", async () => {
    const stream = new Stream<number>();
    const skipped = stream.pipe(skip(2));

    const results: number[] = [];
    skipped.listen((value) => results.push(value));

    stream.push(1, 2, 3, 4, 5);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([3, 4, 5]);
  });
});
