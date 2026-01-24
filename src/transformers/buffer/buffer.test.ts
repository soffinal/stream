import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { buffer } from "./buffer";

describe("buffer transformer", () => {
  it("should buffer values into arrays of specified size", async () => {
    const stream = new Stream<number>();
    const buffered = stream.pipe(buffer(3));

    const results: number[][] = [];
    buffered.listen((value) => results.push(value));

    stream.push(1, 2, 3, 4, 5, 6);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it("should not emit partial buffers", async () => {
    const stream = new Stream<number>();
    const buffered = stream.pipe(buffer(3));

    const results: number[][] = [];
    buffered.listen((value) => results.push(value));

    stream.push(1, 2, 3, 4, 5);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([[1, 2, 3]]); // Only full buffer emitted
  });

  it("should handle buffer size of 1", async () => {
    const stream = new Stream<number>();
    const buffered = stream.pipe(buffer(1));

    const results: number[][] = [];
    buffered.listen((value) => results.push(value));

    stream.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([[1], [2], [3]]);
  });

  it("should handle empty stream", async () => {
    const stream = new Stream<number>();
    const buffered = stream.pipe(buffer(3));

    const results: number[][] = [];
    buffered.listen((value) => results.push(value));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([]);
  });

  it("should not emit when buffer not full", async () => {
    const stream = new Stream<number>();
    const buffered = stream.pipe(buffer(10));

    const results: number[][] = [];
    buffered.listen((value) => results.push(value));

    stream.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([]); // Buffer not full, nothing emitted
  });
});
