import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { sample } from "./sample";

describe("sample pattern", () => {
  it("should sample on another stream", async () => {
    const stream = new Stream<number>();
    const sampler = new Stream<void>();
    const sampled = stream.pipe(sample(sampler));

    const results: number[] = [];
    sampled.listen((value) => results.push(value));

    stream.push(1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    sampler.push();
    stream.push(2);
    stream.push(3);
    await new Promise((resolve) => setTimeout(resolve, 5));
    sampler.push();

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(results).toEqual([3]);
  });
});
