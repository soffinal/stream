import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { timeout } from "./timeout";

describe("timeout pattern", () => {
  it("should pass through values when within timeout", async () => {
    const stream = new Stream<number>();
    const timedStream = stream.pipe(timeout(200));

    const results: number[] = [];
    timedStream.listen((value) => results.push(value));

    stream.push(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    stream.push(2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    stream.push(3);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(results).toEqual([1, 2, 3]);
  });
});
