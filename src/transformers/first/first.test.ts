import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { first } from "./first";

describe("first pattern", () => {
  it("should emit only first value", async () => {
    const stream = new Stream<number>();
    const firsted = stream.pipe(first());

    const results: number[] = [];
    firsted.listen((value) => results.push(value));

    stream.push(1, 2, 3);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([1]);
  });
});
