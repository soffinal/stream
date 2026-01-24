import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { startWith } from "./startWith";

describe("startWith pattern", () => {
  it("should prepend initial values", async () => {
    const stream = new Stream<number>();
    const started = stream.pipe(startWith(0, -1));

    const results: number[] = [];
    started.listen((value) => results.push(value));

    await new Promise((resolve) => setTimeout(resolve, 10));
    stream.push(1, 2);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([0, -1, 1, 2]);
  });
});
