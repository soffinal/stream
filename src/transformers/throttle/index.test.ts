import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { throttle } from ".";

describe("throttle pattern", () => {
  it("should throttle emissions", async () => {
    const stream = new Stream<number>();
    const throttled = stream.pipe(throttle(100));

    const results: number[] = [];
    throttled.listen((value) => results.push(value));

    stream.push(1);
    setTimeout(() => stream.push(2), 50); // Too soon
    setTimeout(() => stream.push(3), 120); // Should pass

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(results).toEqual([1, 3]);
  });
});
