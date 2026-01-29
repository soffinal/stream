import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { window } from ".";

describe("window pattern", () => {
  it("should collect values into time windows", async () => {
    const stream = new Stream<number>();
    const windowed = stream.pipe(window(100));

    const results: number[][] = [];
    windowed.listen((arr) => results.push(arr));

    stream.push(1, 2, 3);
    await new Promise((resolve) => setTimeout(resolve, 120));
    stream.push(4, 5);
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(results).toEqual([
      [1, 2, 3],
      [4, 5],
    ]);
  });

  it("should handle empty windows", async () => {
    const stream = new Stream<number>();
    const windowed = stream.pipe(window(50));

    const results: number[][] = [];
    windowed.listen((arr) => results.push(arr));

    stream.push(1);
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toEqual([1]);
  });

  it("should be lazy", async () => {
    const stream = new Stream<number>();
    const windowed = stream.pipe(window(50));

    stream.push(1, 2); // No listener yet
    await new Promise((resolve) => setTimeout(resolve, 100));

    const results: number[][] = [];
    windowed.listen((arr) => results.push(arr));

    stream.push(3, 4);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results[0]).toEqual([3, 4]);
  });
});
