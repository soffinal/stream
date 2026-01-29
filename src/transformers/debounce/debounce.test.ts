import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { debounce } from "./debounce";

describe("debounce pattern", () => {
  it("should debounce emissions", async () => {
    const stream = new Stream<number>();
    const debounced = stream.pipe(debounce(100));

    const results: number[] = [];
    debounced.listen((value) => results.push(value));

    stream.push(1);
    setTimeout(() => stream.push(2), 50);
    setTimeout(() => stream.push(3), 150);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(results).toEqual([3]); // Last value after quiet period
  });

  it("should emit multiple values with quiet periods", async () => {
    const stream = new Stream<number>();
    const debounced = stream.pipe(debounce(50));

    const results: number[] = [];
    debounced.listen((value) => results.push(value));

    stream.push(1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    stream.push(2);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([1, 2]);
  });

  it("should handle rapid emissions", async () => {
    const stream = new Stream<number>();
    const debounced = stream.pipe(debounce(100));

    const results: number[] = [];
    debounced.listen((value) => results.push(value));

    for (let i = 0; i < 10; i++) {
      stream.push(i);
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(results).toEqual([9]); // Only last value
  });

  it("should be lazy", async () => {
    const stream = new Stream<number>();
    const debounced = stream.pipe(debounce(50));

    stream.push(1); // No listener yet
    await new Promise((resolve) => setTimeout(resolve, 100));

    const results: number[] = [];
    debounced.listen((value) => results.push(value)); // Add listener after

    stream.push(2);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([2]); // Only value after listener added
  });
});
