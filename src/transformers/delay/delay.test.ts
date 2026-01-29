import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { delay } from "./delay";

describe("delay pattern", () => {
  it("should delay emissions", async () => {
    const stream = new Stream<number>();
    const delayed = stream.pipe(delay(50));

    const results: number[] = [];
    const start = Date.now();
    delayed.listen((value) => results.push(value));

    stream.push(1);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([1]);
    expect(Date.now() - start).toBeGreaterThanOrEqual(50);
  });
});
