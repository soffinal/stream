import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { distinct } from "./distinct";

describe("distinct pattern", () => {
  it("should remove duplicates", async () => {
    const stream = new Stream<number>();
    const uniqued = stream.pipe(distinct());

    const results: number[] = [];
    uniqued.listen((value) => results.push(value));

    stream.push(1, 2, 1, 3, 2, 4, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([1, 2, 3, 4]);
  });
});
