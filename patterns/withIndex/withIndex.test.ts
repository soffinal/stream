import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { withIndex } from "./withIndex";

describe("withIndex pattern", () => {
  it("should add index to values", async () => {
    const stream = new Stream<string>();
    const indexed = stream.pipe(withIndex());

    const results: Array<{ value: string; index: number }> = [];
    indexed.listen((value) => results.push(value));

    stream.push("a", "b", "c");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([
      { value: "a", index: 0 },
      { value: "b", index: 1 },
      { value: "c", index: 2 },
    ]);
  });
});
