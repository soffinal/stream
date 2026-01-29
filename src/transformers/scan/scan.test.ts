import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { scan } from "./scan";

describe("scan pattern", () => {
  it("should accumulate values", async () => {
    const stream = new Stream<number>();
    const scanned = stream.pipe(scan((sum, n) => sum + n, 0));

    const results: number[] = [];
    scanned.listen((value) => results.push(value));

    stream.push(1, 2, 3, 4, 5);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([1, 3, 6, 10, 15]);
  });
});
