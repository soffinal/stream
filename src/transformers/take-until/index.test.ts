import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { takeUntil } from "./takeUntil";

describe("takeUntil pattern", () => {
  it("should take until notifier emits", async () => {
    const stream = new Stream<number>();
    const notifier = new Stream<void>();
    const taken = stream.pipe(takeUntil(notifier));

    const results: number[] = [];
    taken.listen((value) => results.push(value));

    stream.push(1, 2);
    await new Promise((resolve) => setTimeout(resolve, 10));
    notifier.push();
    stream.push(3, 4);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([1, 2]);
  });
});
