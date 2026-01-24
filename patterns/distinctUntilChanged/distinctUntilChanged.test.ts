import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { distinctUntilChanged } from "./distinctUntilChanged";

describe("distinctUntilChanged pattern", () => {
  it("should remove consecutive duplicates", async () => {
    const stream = new Stream<number>();
    const distinct = stream.pipe(distinctUntilChanged());

    const results: number[] = [];
    distinct.listen((value) => results.push(value));

    stream.push(1, 1, 2, 2, 3, 1, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([1, 2, 3, 1]);
  });

  it("should handle single values", async () => {
    const stream = new Stream<number>();
    const distinct = stream.pipe(distinctUntilChanged());

    const results: number[] = [];
    distinct.listen((value) => results.push(value));

    stream.push(1);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([1]);
  });

  it("should handle all duplicates", async () => {
    const stream = new Stream<number>();
    const distinct = stream.pipe(distinctUntilChanged());

    const results: number[] = [];
    distinct.listen((value) => results.push(value));

    stream.push(1, 1, 1, 1, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([1]);
  });
});
