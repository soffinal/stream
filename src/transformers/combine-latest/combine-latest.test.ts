import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { combineLatest } from "./combine-latest";

describe("combineLatest", () => {
  it("should combine latest values", async () => {
    const stream1 = new Stream<number>();
    const stream2 = new Stream<string>();
    const combined = stream1.pipe(combineLatest(stream2));

    const results: Array<[number, string]> = [];
    combined.listen((value) => results.push(value));

    stream1.push(1);
    stream2.push("a");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([[1, "a"]]);
  });

  it("should keep latest value from each stream", async () => {
    const stream1 = new Stream<number>();
    const stream2 = new Stream<string>();
    const combined = stream1.pipe(combineLatest(stream2));

    const results: Array<[number, string]> = [];
    combined.listen((value) => results.push(value));

    stream1.push(1);
    stream2.push("a");
    stream1.push(2); // Updates with latest from stream2
    stream2.push("b"); // Updates with latest from stream1
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([
      [1, "a"],
      [2, "a"], // Latest from stream1, previous from stream2
      [2, "b"], // Previous from stream1, latest from stream2
    ]);
  });

  it("should not emit until all streams have values", async () => {
    const stream1 = new Stream<number>();
    const stream2 = new Stream<string>();
    const combined = stream1.pipe(combineLatest(stream2));

    const results: Array<[number, string]> = [];
    combined.listen((value) => results.push(value));

    stream1.push(1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(results).toEqual([]); // No emission yet

    stream2.push("a");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(results).toEqual([[1, "a"]]); // Now emits
  });

  it("should work regardless of emission order", async () => {
    const stream1 = new Stream<number>();
    const stream2 = new Stream<string>();
    const combined = stream1.pipe(combineLatest(stream2));

    const results: Array<[number, string]> = [];
    combined.listen((value) => results.push(value));

    stream2.push("a"); // stream2 first
    stream1.push(1); // stream1 second
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([[1, "a"]]);
  });

  it("should combine multiple streams", async () => {
    const stream1 = new Stream<number>();
    const stream2 = new Stream<string>();
    const stream3 = new Stream<boolean>();
    const combined = stream1.pipe(combineLatest(stream2, stream3));

    const results: Array<[number, string, boolean]> = [];
    combined.listen((value) => results.push(value));

    stream1.push(1);
    stream2.push("a");
    stream3.push(true);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([[1, "a", true]]);
  });

  it("should cleanup listeners on abort", async () => {
    const stream1 = new Stream<number>();
    const stream2 = new Stream<string>();
    const combined = stream1.pipe(combineLatest(stream2));

    const results: Array<[number, string]> = [];
    const abort = combined.listen((value) => results.push(value));

    stream1.push(1);
    stream2.push("a");
    await new Promise((resolve) => setTimeout(resolve, 10));

    abort(); // Cleanup

    stream1.push(2);
    stream2.push("b");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([[1, "a"]]); // No new emissions after abort
  });
});
