import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { combineLatest } from "./combineLatest";

describe("combineLatest pattern", () => {
  it("should combine latest values", async () => {
    const stream1 = new Stream<number>();
    const stream2 = new Stream<string>();
    const combined = stream1.pipe(combineLatest(stream2));

    const results: Array<[number, string]> = [];
    combined.listen((value) => results.push(value));

    stream1.push(1);
    stream2.push("a");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([[1, "a"]]);
  });
});
