import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { zip } from ".";

describe("zip transformer", () => {
  it("should combine two streams pairwise", async () => {
    const stream1 = new Stream<number>();
    const stream2 = new Stream<string>();
    const zipped = stream1.pipe(zip(stream2));

    const results: [number, string][] = [];
    zipped.listen((value) => results.push(value));

    stream1.push(1, 2, 3);
    stream2.push("a", "b", "c");

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([
      [1, "a"],
      [2, "b"],
      [3, "c"],
    ]);
  });

  it("should combine three streams", async () => {
    const stream1 = new Stream<number>();
    const stream2 = new Stream<string>();
    const stream3 = new Stream<boolean>();
    const zipped = stream1.pipe(zip(stream2, stream3));

    const results: [number, string, boolean][] = [];
    zipped.listen((value) => results.push(value));

    stream1.push(1, 2);
    stream2.push("a", "b");
    stream3.push(true, false);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([
      [1, "a", true],
      [2, "b", false],
    ]);
  });

  it("should stop when shortest stream ends", async () => {
    const stream1 = new Stream<number>();
    const stream2 = new Stream<string>();
    const zipped = stream1.pipe(zip(stream2));

    const results: [number, string][] = [];
    zipped.listen((value) => results.push(value));

    stream1.push(1, 2, 3, 4, 5);
    stream2.push("a", "b");

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([
      [1, "a"],
      [2, "b"],
    ]);
  });

  it("should handle empty streams", async () => {
    const stream1 = new Stream<number>();
    const stream2 = new Stream<string>();
    const zipped = stream1.pipe(zip(stream2));

    const results: [number, string][] = [];
    zipped.listen((value) => results.push(value));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([]);
  });
});
