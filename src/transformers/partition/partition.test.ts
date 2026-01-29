import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { partition } from "./partition";

describe("partition pattern", () => {
  it("should partition into two streams", async () => {
    const stream = new Stream<number>();
    const [evens, odds] = stream.pipe(partition((n) => n % 2 === 0));

    const evenResults: number[] = [];
    const oddResults: number[] = [];
    evens.listen((value) => evenResults.push(value));
    odds.listen((value) => oddResults.push(value));

    stream.push(1, 2, 3, 4, 5, 6);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(evenResults).toEqual([2, 4, 6]);
    expect(oddResults).toEqual([1, 3, 5]);
  });
});
